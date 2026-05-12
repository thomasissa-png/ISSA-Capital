/**
 * Workflow Quittance de loyer — machine d'états Telegram.
 *
 * États :
 *   selecting_locataire → confirming_locataire → confirming_periode
 *   → confirming_montants → generating → done | error
 *
 * À chaque étape, Anya envoie un aperçu et demande confirmation
 * via boutons inline (pattern CR existant).
 *
 * Le workflow est entièrement auto-contenu : il gère la lecture Drive,
 * la résolution du bien, le calcul des variables, la génération PDF,
 * et l'upload vers Drive.
 */

import type { Workflow, WorkflowState, WorkflowResponse, WorkflowMessage } from './types';
import type { Locataire, QuittanceWorkflowData, QuittanceVariables } from '../rent/types';
import {
  locataireTotal,
  locataireNomAvecCivilite,
  locataireInitiales,
} from '../rent/types';
import { rechercherLocataire, listerLocatairesActuels } from '../rent/locataires';
import { resoudreBien } from '../rent/biens';
import { chargerBailleur } from '../rent/bailleur';
import { nombreEnLettres } from '../rent/num-en-lettres';
import { formatDateFr, dernierJourDuMois } from '../rent/dates-fr';
import { chargerSignatureBase64 } from '../rent/signature';
import { genererQuittancePdf } from '../rent/pdf-quittance';
import { getAccessToken, getOrCreateSubfolder } from '../drive-upload';

// ============================================================
// Constantes
// ============================================================

/** TTL du workflow quittance : 1 heure (plus court que CR car pas de collecte longue) */
const QUITTANCE_TTL_MS = 60 * 60 * 1000;

/** Mois en français pour l'affichage */
const MOIS_FR = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

// ============================================================
// Étapes du workflow
// ============================================================

type QuittanceStep =
  | 'selecting_locataire'
  | 'confirming_locataire'
  | 'confirming_periode'
  | 'confirming_montants'
  | 'generating'
  | 'done'
  | 'error';

// ============================================================
// Helpers internes
// ============================================================

function makeState(step: QuittanceStep, data: QuittanceWorkflowData): WorkflowState {
  const now = Date.now();
  return {
    type: 'quittance',
    step,
    data: data as unknown as Record<string, unknown>,
    startedAt: now,
    expiresAt: now + QUITTANCE_TTL_MS,
  };
}

function getData(state: WorkflowState): QuittanceWorkflowData {
  return state.data as unknown as QuittanceWorkflowData;
}

/**
 * Construit les variables de quittance (port fidèle du Python variables_quittance).
 */
function construireVariables(
  loc: Locataire,
  annee: number,
  mois: number,
  loyerOverride?: number,
  chargesOverride?: number,
  moyenPaiementOverride?: string,
): QuittanceVariables | { error: string } {
  const bailleur = chargerBailleur();
  const bien = resoudreBien(loc.adresseBien);
  if (!bien) {
    return {
      error: `Bien introuvable pour l'adresse "${loc.adresseBien}". Vérifier biens.yml ou la fiche locataire.`,
    };
  }

  const loyer = loyerOverride ?? loc.montantLoyer;
  const charges = chargesOverride ?? loc.montantCharges;
  const total = loyer + charges;
  const moyenPaiement = moyenPaiementOverride ?? loc.moyenPaiement;

  // Dates — port fidèle du Python
  const debut = new Date(annee, mois - 1, 1); // mois JS = 0-indexed
  const finJour = dernierJourDuMois(annee, mois);
  const fin = new Date(annee, mois - 1, finJour);

  // Date d'émission : 3 du mois suivant (Python : date(annee + (mois // 12), (mois % 12) + 1, 3))
  const emissionMois = (mois % 12) + 1;
  const emissionAnnee = annee + Math.floor(mois / 12);
  const dateEmission = new Date(emissionAnnee, emissionMois - 1, 3);

  // Date de paiement : 2 du mois concerné
  const datePaiement = new Date(annee, mois - 1, 2);

  // Signature
  const signaturePngBase64 = chargerSignatureBase64();

  return {
    bailleurNom: bailleur.nom,
    bailleurTelephone: bailleur.telephone,
    bailleurAdresse: bailleur.adresse,
    bailleurCpVille: bailleur.cpVille,
    signaturePngBase64,
    signatureLargeurMm: bailleur.signatureLargeurMm,
    locataireNom: locataireNomAvecCivilite(loc),
    bienAdresseLigne1: bien.ligne1,
    bienAdresseLigne2: bien.ligne2,
    bienCpVille: bien.cpVille,
    periodeMoisAnnee: `${MOIS_FR[mois]} ${annee}`,
    periodeDebut: formatDateFr(debut),
    periodeFin: formatDateFr(fin),
    loyer,
    charges,
    total,
    totalLettres: nombreEnLettres(total),
    datePaiement: formatDateFr(datePaiement),
    moyenPaiement,
    lieuEmission: 'Nanterre',
    dateEmission: formatDateFr(dateEmission),
    numeroQuittance: `QL-${annee}-${String(mois).padStart(2, '0')}-${locataireInitiales(loc)}`,
  };
}

/**
 * Upload le PDF vers Drive dans Quittances/{Locataire}/.
 *
 * Décision Thomas : si le fichier existe déjà → écrasement silencieux.
 * On cherche d'abord un fichier existant avec le même nom et on le supprime
 * (la suppression + recréation est plus fiable que l'update avec le scope drive.file).
 */
async function uploadQuittanceDrive(
  pdfBuffer: Buffer,
  locataireNom: string,
  filename: string,
): Promise<{ success: boolean; webViewLink?: string; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Token OAuth2 indisponible pour Drive' };
  }

  // Dossier parent : DRIVE_QUITTANCES_FOLDER_ID (configurable) ou fallback sur _Inbox parent
  const quittancesFolderId = process.env.DRIVE_QUITTANCES_FOLDER_ID
    ?? process.env.DRIVE_INBOX_FOLDER_ID;
  if (!quittancesFolderId) {
    return { success: false, error: 'DRIVE_QUITTANCES_FOLDER_ID ou DRIVE_INBOX_FOLDER_ID manquant' };
  }

  try {
    // Créer/trouver le sous-dossier Quittances (si on utilise Inbox comme parent)
    let parentId: string;
    if (process.env.DRIVE_QUITTANCES_FOLDER_ID) {
      parentId = process.env.DRIVE_QUITTANCES_FOLDER_ID;
    } else {
      const qFolder = await getOrCreateSubfolder(accessToken, quittancesFolderId, 'Quittances');
      if (!qFolder) {
        return { success: false, error: 'Impossible de créer le dossier Quittances sur Drive' };
      }
      parentId = qFolder;
    }

    // Sous-dossier par locataire
    const locataireFolderId = await getOrCreateSubfolder(accessToken, parentId, locataireNom);
    if (!locataireFolderId) {
      return { success: false, error: `Impossible de créer le dossier ${locataireNom} sur Drive` };
    }

    // Chercher un fichier existant avec le même nom → supprimer pour écraser
    const escaped = filename.replace(/'/g, "\\'");
    const searchQ = encodeURIComponent(
      `name='${escaped}' and '${locataireFolderId}' in parents and trashed=false`,
    );
    const searchUrl = `${DRIVE_FILES_API}?q=${searchQ}&fields=files(id)&supportsAllDrives=true`;
    const searchResp = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (searchResp.ok) {
      const searchData = (await searchResp.json()) as { files?: Array<{ id: string }> };
      for (const existing of searchData.files ?? []) {
        // Supprimer silencieusement (écrasement — décision Thomas)
        await fetch(`${DRIVE_FILES_API}/${existing.id}?supportsAllDrives=true`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        });
        console.log(`[quittance] fichier existant supprimé : ${existing.id}`);
      }
    }

    // Upload le nouveau PDF
    const metadata = JSON.stringify({
      name: filename,
      parents: [locataireFolderId],
      mimeType: 'application/pdf',
    });

    const boundary = '===issa_quittance_boundary===';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata + '\r\n' +
      `--${boundary}\r\n` +
      'Content-Type: application/pdf\r\n\r\n';
    const footer = `\r\n--${boundary}--`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      pdfBuffer,
      Buffer.from(footer, 'utf-8'),
    ]);

    const uploadResp = await fetch(
      `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(bodyBuffer.length),
        },
        body: bodyBuffer,
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!uploadResp.ok) {
      const errText = await uploadResp.text().catch(() => '');
      return { success: false, error: `Drive API ${uploadResp.status}: ${errText.slice(0, 200)}` };
    }

    const uploadData = (await uploadResp.json()) as { id?: string; webViewLink?: string };
    return {
      success: true,
      webViewLink: uploadData.webViewLink,
    };
  } catch (err) {
    return {
      success: false,
      error: `Erreur Drive : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================
// Workflow Quittance — implémente l'interface Workflow
// ============================================================

export const quittanceWorkflow: Workflow = {
  type: 'quittance',
  ttlMs: QUITTANCE_TTL_MS,

  // ----------------------------------------------------------
  // start : demander le nom du locataire
  // ----------------------------------------------------------

  async start(_chatId: number, _initialText?: string): Promise<WorkflowResponse> {
    // Lister les locataires actuels pour proposer un choix
    const locataires = await listerLocatairesActuels();
    const data: QuittanceWorkflowData = {};

    if (locataires.length > 0) {
      data.locatairesDisponibles = locataires.map((nom) => ({ nom, adresse: '' }));
      const liste = locataires.map((nom, i) => `${i + 1}. ${nom}`).join('\n');
      return {
        newState: makeState('selecting_locataire', data),
        messages: [
          {
            text:
              `Quittance de loyer — quel locataire ?\n\n${liste}\n\n` +
              `Envoie le numéro ou le nom du locataire.`,
          },
        ],
      };
    }

    // Pas de liste dispo (Drive inaccessible) → demander le nom directement
    return {
      newState: makeState('selecting_locataire', data),
      messages: [
        {
          text: 'Quittance de loyer — envoie le nom du locataire (prénom nom).',
        },
      ],
    };
  },

  // ----------------------------------------------------------
  // handleMessage : traite le texte selon l'étape
  // ----------------------------------------------------------

  async handleMessage(
    _chatId: number,
    state: WorkflowState,
    text: string,
  ): Promise<WorkflowResponse> {
    const step = state.step as QuittanceStep;
    const data = getData(state);

    switch (step) {
      case 'selecting_locataire':
        return handleSelectLocataire(data, text);

      case 'confirming_periode':
        return handleSaisiePeriode(data, text);

      default:
        return {
          newState: state,
          messages: [
            { text: 'Utilise les boutons pour confirmer ou annuler.' },
          ],
        };
    }
  },

  // ----------------------------------------------------------
  // handlePhoto / handleVoice : non supportés pour la quittance
  // ----------------------------------------------------------

  async handlePhoto(
    _chatId: number,
    state: WorkflowState,
  ): Promise<WorkflowResponse> {
    return {
      newState: state,
      messages: [{ text: 'Les photos ne sont pas utilisées pour les quittances.' }],
    };
  },

  async handleVoice(
    _chatId: number,
    state: WorkflowState,
  ): Promise<WorkflowResponse> {
    return {
      newState: state,
      messages: [{ text: 'Les vocaux ne sont pas utilisés pour les quittances.' }],
    };
  },

  // ----------------------------------------------------------
  // handleCallback : boutons inline
  // ----------------------------------------------------------

  async handleCallback(
    _chatId: number,
    state: WorkflowState,
    callbackData: string,
  ): Promise<WorkflowResponse> {
    const step = state.step as QuittanceStep;
    const data = getData(state);

    // Annulation depuis n'importe quelle étape
    if (callbackData === 'q_cancel') {
      return {
        newState: null,
        messages: [{ text: 'Quittance annulée. Mode inbox réactivé.' }],
      };
    }

    switch (step) {
      case 'confirming_locataire':
        return handleConfirmLocataire(data, callbackData);

      case 'confirming_periode':
        return handleConfirmPeriode(data, callbackData);

      case 'confirming_montants':
        return handleConfirmMontants(data, callbackData);

      default:
        return {
          newState: state,
          messages: [{ text: 'Action inattendue.' }],
        };
    }
  },

  // ----------------------------------------------------------
  // cancel
  // ----------------------------------------------------------

  async cancel(): Promise<WorkflowResponse> {
    return {
      newState: null,
      messages: [{ text: 'Quittance annulée. Mode inbox réactivé.' }],
    };
  },
};

// ============================================================
// Handlers par étape
// ============================================================

/**
 * Étape 1 : sélection du locataire.
 * L'utilisateur envoie un numéro (si liste affichée) ou un nom.
 */
async function handleSelectLocataire(
  data: QuittanceWorkflowData,
  text: string,
): Promise<WorkflowResponse> {
  const trimmed = text.trim();

  // Si c'est un numéro et qu'on a une liste
  const num = parseInt(trimmed, 10);
  let query = trimmed;

  if (!Number.isNaN(num) && data.locatairesDisponibles && num >= 1 && num <= data.locatairesDisponibles.length) {
    const selected = data.locatairesDisponibles[num - 1];
    if (selected) {
      query = selected.nom;
    }
  }

  // Rechercher sur Drive
  const { locataire, alternatives } = await rechercherLocataire(query);

  if (alternatives.length > 1) {
    // Plusieurs résultats → demander de préciser
    const liste = alternatives.map((nom, i) => `${i + 1}. ${nom}`).join('\n');
    data.locatairesDisponibles = alternatives.map((nom) => ({ nom, adresse: '' }));
    return {
      newState: makeState('selecting_locataire', data),
      messages: [
        {
          text: `Plusieurs locataires correspondent :\n\n${liste}\n\nPrécise le numéro ou le nom complet.`,
        },
      ],
    };
  }

  if (!locataire) {
    return {
      newState: makeState('selecting_locataire', data),
      messages: [
        {
          text: `Locataire "${query}" non trouvé sur Drive. Vérifie le nom et réessaie.`,
        },
      ],
    };
  }

  // Locataire trouvé → passer à la confirmation
  data.locataire = locataire;
  data.locataireNom = locataire.nomFichier;

  const bien = resoudreBien(locataire.adresseBien);
  const adresseInfo = bien
    ? `${bien.ligne1}, ${bien.ligne2}, ${bien.cpVille}`
    : locataire.adresseBien;

  const apercu =
    `Locataire trouvé :\n\n` +
    `Nom : ${locataireNomAvecCivilite(locataire)}\n` +
    `Adresse : ${adresseInfo}\n` +
    `Loyer : ${locataire.montantLoyer} €\n` +
    `Charges : ${locataire.montantCharges} €\n` +
    `Total : ${locataireTotal(locataire)} €`;

  return {
    newState: makeState('confirming_locataire', data),
    messages: [
      {
        text: apercu,
        showConfirmation: true,
      },
    ],
  };
}

/**
 * Étape 2 : confirmation du locataire (callback bouton).
 */
async function handleConfirmLocataire(
  data: QuittanceWorkflowData,
  callbackData: string,
): Promise<WorkflowResponse> {
  if (callbackData === 'q_confirm') {
    // Proposer le mois courant — les boutons mois rapide sont gérés par le router
    const now = new Date();
    const moisCourant = now.getMonth() + 1;
    const anneeCourante = now.getFullYear();

    return {
      newState: makeState('confirming_periode', data),
      messages: [
        {
          text:
            `Période de la quittance ?\n\n` +
            `Envoie le mois au format YYYY-MM (ex: ${anneeCourante}-${String(moisCourant).padStart(2, '0')})\n` +
            `ou utilise les boutons ci-dessous.`,
          showConfirmation: true, // les boutons mois rapide sont ajoutés par le router
        },
      ],
    };
  }

  if (callbackData === 'q_modify') {
    // Retour à la sélection
    return {
      newState: makeState('selecting_locataire', {}),
      messages: [
        { text: 'OK, envoie le nom du locataire.' },
      ],
    };
  }

  return {
    newState: makeState('confirming_locataire', data),
    messages: [{ text: 'Utilise les boutons pour confirmer, modifier ou annuler.' }],
  };
}

/**
 * Étape 3a : saisie de la période (message texte YYYY-MM).
 */
async function handleSaisiePeriode(
  data: QuittanceWorkflowData,
  text: string,
): Promise<WorkflowResponse> {
  const trimmed = text.trim();

  // Parser le format YYYY-MM ou MM/YYYY
  let annee: number;
  let mois: number;

  const matchYM = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  const matchMY = trimmed.match(/^(\d{1,2})\/(\d{4})$/);

  // Aussi supporter le nom du mois en français : "mai 2026", "janvier 2026"
  const matchFr = trimmed.match(/^(\w+)\s+(\d{4})$/i);

  if (matchYM) {
    annee = parseInt(matchYM[1]!, 10);
    mois = parseInt(matchYM[2]!, 10);
  } else if (matchMY) {
    annee = parseInt(matchMY[2]!, 10);
    mois = parseInt(matchMY[1]!, 10);
  } else if (matchFr) {
    const moisNom = matchFr[1]!.toLowerCase();
    const idx = MOIS_FR.findIndex((m) => m.toLowerCase() === moisNom);
    if (idx < 1) {
      return {
        newState: makeState('confirming_periode', data),
        messages: [{ text: 'Mois non reconnu. Envoie au format YYYY-MM (ex: 2026-05).' }],
      };
    }
    annee = parseInt(matchFr[2]!, 10);
    mois = idx;
  } else {
    return {
      newState: makeState('confirming_periode', data),
      messages: [{ text: 'Format non reconnu. Envoie au format YYYY-MM (ex: 2026-05).' }],
    };
  }

  if (mois < 1 || mois > 12) {
    return {
      newState: makeState('confirming_periode', data),
      messages: [{ text: 'Mois invalide (1-12). Réessaie.' }],
    };
  }

  data.annee = annee;
  data.mois = mois;

  // Passer à la confirmation des montants
  return buildMontantsPreview(data);
}

/**
 * Étape 3b : confirmation de la période via callback (mois courant/précédent).
 */
async function handleConfirmPeriode(
  data: QuittanceWorkflowData,
  callbackData: string,
): Promise<WorkflowResponse> {
  if (callbackData === 'q_modify') {
    return {
      newState: makeState('confirming_locataire', data),
      messages: [{ text: 'Retour à la confirmation du locataire.' }],
    };
  }

  // q_mois_YYYY_MM
  const matchMois = callbackData.match(/^q_mois_(\d{4})_(\d{1,2})$/);
  if (matchMois) {
    data.annee = parseInt(matchMois[1]!, 10);
    data.mois = parseInt(matchMois[2]!, 10);
    return buildMontantsPreview(data);
  }

  return {
    newState: makeState('confirming_periode', data),
    messages: [{ text: 'Envoie le mois au format YYYY-MM.' }],
  };
}

/**
 * Construit l'aperçu des montants pour confirmation.
 */
function buildMontantsPreview(data: QuittanceWorkflowData): WorkflowResponse {
  const loc = data.locataire!;
  const annee = data.annee!;
  const mois = data.mois!;

  const loyer = data.loyerOverride ?? loc.montantLoyer;
  const charges = data.chargesOverride ?? loc.montantCharges;
  const total = loyer + charges;

  const apercu =
    `Récapitulatif de la quittance :\n\n` +
    `Locataire : ${locataireNomAvecCivilite(loc)}\n` +
    `Période : ${MOIS_FR[mois]} ${annee}\n` +
    `Loyer : ${loyer} €\n` +
    `Charges : ${charges} €\n` +
    `Total : ${total} € (${nombreEnLettres(total)})\n` +
    `Moyen : ${data.moyenPaiementOverride ?? loc.moyenPaiement}\n` +
    `N° : QL-${annee}-${String(mois).padStart(2, '0')}-${locataireInitiales(loc)}\n\n` +
    `Confirmer la génération ?`;

  return {
    newState: makeState('confirming_montants', data),
    messages: [
      {
        text: apercu,
        showConfirmation: true,
      },
    ],
  };
}

/**
 * Étape 4 : confirmation des montants → génération PDF + upload.
 */
async function handleConfirmMontants(
  data: QuittanceWorkflowData,
  callbackData: string,
): Promise<WorkflowResponse> {
  if (callbackData === 'q_modify') {
    // Retour à la saisie de la période
    return {
      newState: makeState('confirming_periode', data),
      messages: [{ text: 'OK, envoie la nouvelle période au format YYYY-MM.' }],
    };
  }

  if (callbackData !== 'q_confirm') {
    return {
      newState: makeState('confirming_montants', data),
      messages: [{ text: 'Utilise les boutons pour confirmer, modifier ou annuler.' }],
    };
  }

  // --- Génération ---
  const loc = data.locataire!;
  const annee = data.annee!;
  const mois = data.mois!;

  const varsResult = construireVariables(
    loc,
    annee,
    mois,
    data.loyerOverride,
    data.chargesOverride,
    data.moyenPaiementOverride,
  );

  if ('error' in varsResult) {
    return {
      newState: makeState('error', data),
      messages: [{ text: `Erreur : ${varsResult.error}` }],
    };
  }

  const variables = varsResult;

  // Générer le PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await genererQuittancePdf(variables);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      newState: makeState('error', data),
      messages: [{ text: `Erreur génération PDF : ${msg}` }],
    };
  }

  // Upload vers Drive
  const nomFichier = loc.nomFichier.replace(/\s+/g, '-');
  const filename = `Quittance-${nomFichier}-${annee}-${String(mois).padStart(2, '0')}.pdf`;

  const driveResult = await uploadQuittanceDrive(pdfBuffer, loc.nomFichier, filename);

  // Construire les messages de retour
  const messages: WorkflowMessage[] = [];

  let confirmMsg = `Quittance ${variables.numeroQuittance} générée.`;

  if (driveResult.success) {
    confirmMsg += `\n\nUploadée sur Drive : ${driveResult.webViewLink ?? 'OK'}`;
    confirmMsg += `\nDossier : Quittances/${loc.nomFichier}/`;
  } else {
    confirmMsg += `\n\nUpload Drive échoué : ${driveResult.error}`;
    confirmMsg += `\nLe PDF est envoyé ici directement.`;
  }

  messages.push({ text: confirmMsg });

  // Stocker le buffer en base64 dans data pour que le router puisse l'envoyer via Telegram
  const doneData: QuittanceWorkflowData = {
    ...data,
    pdfBase64: pdfBuffer.toString('base64'),
    pdfFilename: filename,
  };

  return {
    newState: makeState('done', doneData),
    messages,
  };
}
