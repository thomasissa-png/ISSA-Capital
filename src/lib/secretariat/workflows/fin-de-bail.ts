/**
 * Workflow Fin de bail — machine d'états Telegram.
 *
 * États :
 *   selecting_locataire → collecting_date_fin → confirming_recap
 *   → generating → done | error
 *
 * Génération : PDF attestation fin de bail, upload Drive dans Baux/, envoi Telegram.
 *
 * L'attestation est un document simple (1 page) permettant à un ancien locataire
 * de prouver qu'il a quitté le logement (banque, assurance, nouveau bailleur).
 *
 * Réutilise les libs de rent/ : locataires (recherche futée),
 * bail-config (résolution bailleur + adresse), pdf-fin-de-bail (PDFKit).
 *
 * Décision Thomas appliquée : pas de confirmation des infos vault
 * (vault = source de vérité). Confirmation uniquement sur le récap
 * avant génération.
 */

import type { Workflow, WorkflowState, WorkflowResponse } from './types';
import type { Locataire, FinDeBailWorkflowData } from '../rent/types';
import {
  rechercherLocataire,
  listerLocatairesActuels,
  loadAllFiches,
} from '../rent/locataires';
import { chargerBailleurBail, chargerDefaultsBail } from '../rent/bail-config';
import { resoudreBien } from '../rent/biens';
import { locataireNomAvecCivilite } from '../rent/types';
import { chargerSignatureBase64 } from '../rent/signature';
import { genererFinDeBailPdf } from '../rent/pdf-fin-de-bail';
import { getAccessToken, getOrCreateSubfolder } from '../drive-upload';
import { parseLocataireSelection, buildNumberedListMessage } from './quittance';
import { parseDateInput } from './bail';
import { formatDateFr } from '../rent/dates-fr';
import type { FinDeBailVariables } from '../rent/types';

// ============================================================
// Constantes
// ============================================================

/** TTL du workflow fin de bail : 1 heure */
const FIN_DE_BAIL_TTL_MS = 60 * 60 * 1000;

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

// ============================================================
// Types internes
// ============================================================

type FinDeBailStep =
  | 'selecting_locataire'
  | 'collecting_date_fin'
  | 'confirming_recap'
  | 'generating'
  | 'done'
  | 'error';

// ============================================================
// Helpers internes
// ============================================================

function makeState(step: FinDeBailStep, data: FinDeBailWorkflowData): WorkflowState {
  const now = Date.now();
  return {
    type: 'findebail',
    step,
    data: data as unknown as Record<string, unknown>,
    startedAt: now,
    expiresAt: now + FIN_DE_BAIL_TTL_MS,
  };
}

function getData(state: WorkflowState): FinDeBailWorkflowData {
  return state.data as unknown as FinDeBailWorkflowData;
}

// ============================================================
// Upload Drive dans Baux/
// ============================================================

async function uploadFinDeBailDrive(
  fileBuffer: Buffer,
  locataireNom: string,
  filename: string,
): Promise<{ success: boolean; webViewLink?: string; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Token OAuth2 indisponible pour Drive' };
  }

  const bauxFolderId = process.env.DRIVE_BAUX_FOLDER_ID;
  if (!bauxFolderId) {
    console.warn('[fin-de-bail] DRIVE_BAUX_FOLDER_ID manquant — skip upload Drive');
    return { success: false, error: 'DRIVE_BAUX_FOLDER_ID manquant dans les variables d\'environnement' };
  }

  try {
    // Créer/trouver le sous-dossier locataire
    const locataireFolderId = await getOrCreateSubfolder(accessToken, bauxFolderId, locataireNom);
    if (!locataireFolderId) {
      return { success: false, error: `Impossible de créer le dossier ${locataireNom} dans Baux/` };
    }

    // Supprimer un fichier existant du même nom (overwrite — pattern quittance)
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
        await fetch(`${DRIVE_FILES_API}/${existing.id}?supportsAllDrives=true`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        });
        console.warn(`[fin-de-bail] fichier existant supprimé : ${existing.id}`);
      }
    }

    // Upload multipart
    const metadata = JSON.stringify({
      name: filename,
      parents: [locataireFolderId],
      mimeType: 'application/pdf',
    });

    const boundary = '===issa_findebail_boundary===';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata + '\r\n' +
      `--${boundary}\r\n` +
      'Content-Type: application/pdf\r\n\r\n';
    const footer = `\r\n--${boundary}--`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      fileBuffer,
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
    console.warn(`[fin-de-bail] upload OK : ${filename} → ${uploadData.webViewLink ?? uploadData.id}`);
    return { success: true, webViewLink: uploadData.webViewLink };
  } catch (err) {
    return {
      success: false,
      error: `Erreur Drive : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================
// Construction des variables de fin de bail
// ============================================================

/**
 * Construit les variables nécessaires au rendu du PDF fin de bail.
 */
export function construireVariablesFinDeBail(
  loc: Locataire,
  dateFin: Date,
  dateEmission?: Date,
): FinDeBailVariables | { error: string } {
  const bailleur = chargerBailleurBail();
  const defaults = chargerDefaultsBail();

  const bien = resoudreBien(loc.adresseBien);
  if (!bien) {
    return {
      error: `Bien introuvable pour l'adresse "${loc.adresseBien}". Vérifier biens.json.`,
    };
  }

  const signaturePngBase64 = chargerSignatureBase64();
  const adresseBien = `${bien.ligne1}, ${bien.cpVille}`;

  return {
    bailleurNom: bailleur.nom_complet,
    bailleurDateNaissance: bailleur.date_naissance,
    bailleurLieuNaissance: bailleur.lieu_naissance,
    bailleurAdresse: bailleur.adresse,
    bailleurCpVille: bailleur.cp_ville,
    signaturePngBase64,
    signatureLargeurMm: bailleur.signature_largeur_mm,
    locataireNom: locataireNomAvecCivilite(loc),
    adresseBien,
    dateFin,
    dateEmission: dateEmission ?? new Date(),
    lieuSignature: defaults.lieu_signature,
  };
}

// ============================================================
// Génération fin de bail (PDF)
// ============================================================

export interface FinDeBailGenerationResult {
  success: boolean;
  pdfBuffer?: Buffer;
  filenameBase?: string;
  driveLink?: string;
  error?: string;
}

/**
 * Génère le PDF de l'attestation, uploade sur Drive.
 */
export async function generateFinDeBail(
  loc: Locataire,
  dateFin: Date,
  dateEmission?: Date,
): Promise<FinDeBailGenerationResult> {
  const varsResult = construireVariablesFinDeBail(loc, dateFin, dateEmission);
  if ('error' in varsResult) {
    return { success: false, error: varsResult.error };
  }

  const nomFichier = loc.nomFichier.replace(/\s+/g, '-');
  const dateStr = `${dateFin.getFullYear()}-${String(dateFin.getMonth() + 1).padStart(2, '0')}-${String(dateFin.getDate()).padStart(2, '0')}`;
  const filenameBase = `Fin-de-bail-${nomFichier}-${dateStr}`;

  try {
    console.warn(`[fin-de-bail] génération PDF pour ${loc.nomFichier}…`);
    const pdfBuffer = await genererFinDeBailPdf(varsResult);

    // Upload Drive
    const driveResult = await uploadFinDeBailDrive(
      pdfBuffer,
      loc.nomFichier,
      `${filenameBase}.pdf`,
    );
    if (!driveResult.success) {
      console.warn(`[fin-de-bail] upload Drive échoué : ${driveResult.error}`);
    }

    return {
      success: true,
      pdfBuffer,
      filenameBase,
      driveLink: driveResult.webViewLink,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[fin-de-bail] erreur génération : ${msg}`);
    return { success: false, error: msg };
  }
}

// ============================================================
// Workflow Fin de bail — implémente l'interface Workflow
// ============================================================

export const finDeBailWorkflow: Workflow = {
  type: 'findebail',
  command: 'findebail',
  commandDescription: 'Générer une attestation de fin de bail (PDF)',
  ttlMs: FIN_DE_BAIL_TTL_MS,

  // ----------------------------------------------------------
  // start : lister locataires et demander sélection
  // ----------------------------------------------------------

  async start(_chatId: number, _initialText?: string): Promise<WorkflowResponse> {
    const locataires = await listerLocatairesActuels();
    const data: FinDeBailWorkflowData = {};

    if (locataires.length > 0) {
      data.locatairesDisponibles = locataires.map((nom) => ({ nom, adresse: '' }));
      const liste = buildNumberedListMessage(locataires);
      return {
        newState: makeState('selecting_locataire', data),
        messages: [
          {
            text:
              `📋 Fin de bail — Choisis le locataire :\n\n${liste}\n\n` +
              `Envoie le numéro, le nom, ou tape un nom (recherche futée).`,
          },
        ],
      };
    }

    return {
      newState: makeState('selecting_locataire', data),
      messages: [
        {
          text: 'Fin de bail — envoie le nom du locataire (prénom nom).',
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
    const step = state.step as FinDeBailStep;
    const data = getData(state);

    switch (step) {
      case 'selecting_locataire':
        return handleSelectLocataire(data, text);

      case 'collecting_date_fin':
        return handleDateFin(data, text);

      case 'confirming_recap':
        return handleConfirmation(data, text);

      default:
        return {
          newState: state,
          messages: [{ text: 'Attestation en cours de génération, patiente…' }],
        };
    }
  },

  // ----------------------------------------------------------
  // handlePhoto / handleVoice : non supportés
  // ----------------------------------------------------------

  async handlePhoto(
    _chatId: number,
    state: WorkflowState,
  ): Promise<WorkflowResponse> {
    return {
      newState: state,
      messages: [{ text: 'Les photos ne sont pas utilisées pour les attestations fin de bail.' }],
    };
  },

  async handleVoice(
    _chatId: number,
    state: WorkflowState,
  ): Promise<WorkflowResponse> {
    return {
      newState: state,
      messages: [{ text: 'Les vocaux ne sont pas utilisés pour les attestations fin de bail.' }],
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
    if (callbackData === 'fdb_cancel') {
      return {
        newState: null,
        messages: [{ text: 'Fin de bail annulée. Mode inbox réactivé.' }],
      };
    }

    if (callbackData === 'fdb_confirm') {
      const data = getData(state);
      return startGeneration(data);
    }

    return {
      newState: state,
      messages: [{ text: 'Action non reconnue.' }],
    };
  },

  // ----------------------------------------------------------
  // cancel
  // ----------------------------------------------------------

  async cancel(): Promise<WorkflowResponse> {
    return {
      newState: null,
      messages: [{ text: 'Fin de bail annulée. Mode inbox réactivé.' }],
    };
  },
};

// ============================================================
// Handlers par étape
// ============================================================

/**
 * Step 1 : sélection du locataire
 */
async function handleSelectLocataire(
  data: FinDeBailWorkflowData,
  text: string,
): Promise<WorkflowResponse> {
  const totalCount = data.locatairesDisponibles?.length ?? 0;
  const parsed = parseLocataireSelection(text, totalCount);

  if ('error' in parsed) {
    return {
      newState: makeState('selecting_locataire', data),
      messages: [{ text: `${parsed.error}\n\nRéessaie : numéro, nom ou recherche.` }],
    };
  }

  // Fin de bail = un seul locataire
  if (parsed.type === 'all') {
    return {
      newState: makeState('selecting_locataire', data),
      messages: [{ text: 'L\'attestation se fait pour un seul locataire. Envoie le numéro ou le nom.' }],
    };
  }

  let locataire: Locataire | null = null;

  if (parsed.type === 'indices') {
    if (parsed.indices.length > 1) {
      return {
        newState: makeState('selecting_locataire', data),
        messages: [{ text: 'L\'attestation se fait pour un seul locataire. Envoie un seul numéro.' }],
      };
    }

    const idx = parsed.indices[0]!;
    if (!data.locatairesDisponibles || !data.locatairesDisponibles[idx - 1]) {
      return {
        newState: makeState('selecting_locataire', data),
        messages: [{ text: `Numéro ${idx} invalide. Réessaie.` }],
      };
    }

    const locInfo = data.locatairesDisponibles[idx - 1]!;
    const cache = await loadAllFiches();
    const fiche = cache.fiches.find(
      (f) => f.nomFichier === locInfo.nom && f.source === 'actuels',
    );
    if (fiche) {
      locataire = fiche.locataire;
    } else {
      const { locataire: found } = await rechercherLocataire(locInfo.nom);
      locataire = found;
    }
  }

  if (parsed.type === 'search') {
    const { locataire: found, candidats, totaux } = await rechercherLocataire(parsed.query);

    if (candidats.length > 0) {
      const liste = candidats.map((c, i) => `${i + 1}. ${c.nomAffiche}`).join('\n');
      data.locatairesDisponibles = candidats.map((c) => ({ nom: c.nomFichier, adresse: '' }));
      return {
        newState: makeState('selecting_locataire', data),
        messages: [
          {
            text: `Plusieurs locataires correspondent à "${parsed.query}" :\n\n${liste}\n\nPrécise le numéro.`,
          },
        ],
      };
    }

    if (!found) {
      if (totaux.actuels > 0) {
        const actuels = await listerLocatairesActuels();
        data.locatairesDisponibles = actuels.map((nom) => ({ nom, adresse: '' }));
        const liste = buildNumberedListMessage(actuels);
        return {
          newState: makeState('selecting_locataire', data),
          messages: [
            {
              text: `Aucun locataire ne correspond à "${parsed.query}". Voici tes ${totaux.actuels} locataires :\n\n${liste}`,
            },
          ],
        };
      }

      return {
        newState: makeState('selecting_locataire', data),
        messages: [{ text: `Locataire "${parsed.query}" non trouvé. Vérifie le nom et réessaie.` }],
      };
    }

    locataire = found;
  }

  if (!locataire) {
    return {
      newState: makeState('selecting_locataire', data),
      messages: [{ text: 'Locataire non trouvé. Réessaie.' }],
    };
  }

  data.selectedLocataire = locataire;

  // Passer à la date de fin
  const defaultDateFin = locataire.dateFinBail
    ? `\n\nDate de fin enregistrée : ${formatDateFr(locataire.dateFinBail)}. Tape "ok" pour l'utiliser.`
    : '';

  return {
    newState: makeState('collecting_date_fin', data),
    messages: [
      {
        text:
          `Locataire : ${locataire.nomAffiche}\n` +
          `Bien : ${locataire.adresseBien}\n\n` +
          `📅 Date de fin du bail ?${defaultDateFin}\n\n` +
          `Formats acceptés : 2026-05-15, 15/05/2026, 15 mai 2026`,
      },
    ],
  };
}

/**
 * Step 2 : date de fin du bail
 */
function handleDateFin(
  data: FinDeBailWorkflowData,
  text: string,
): WorkflowResponse {
  const lower = text.trim().toLowerCase();

  // Si le locataire a déjà une date_fin_bail et que l'utilisateur valide
  if ((lower === 'ok' || lower === 'oui' || lower === 'idem') && data.selectedLocataire?.dateFinBail) {
    const d = data.selectedLocataire.dateFinBail;
    data.dateFin = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return buildRecap(data);
  }

  const date = parseDateInput(text);
  if (!date) {
    return {
      newState: makeState('collecting_date_fin', data),
      messages: [
        {
          text: 'Date non reconnue. Formats acceptés : 2026-05-15, 15/05/2026 ou 15 mai 2026.',
        },
      ],
    };
  }

  data.dateFin = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return buildRecap(data);
}

/**
 * Construit le récap avant génération
 */
function buildRecap(data: FinDeBailWorkflowData): WorkflowResponse {
  const loc = data.selectedLocataire!;
  const dateFin = new Date(data.dateFin!);
  const today = new Date();

  // Date d'émission = aujourd'hui
  data.dateEmission = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return {
    newState: makeState('confirming_recap', data),
    messages: [
      {
        text:
          `📋 Récapitulatif fin de bail :\n\n` +
          `👤 ${loc.nomAffiche}\n` +
          `🏠 ${loc.adresseBien}\n` +
          `📅 Fin du bail : ${formatDateFr(dateFin)}\n` +
          `📝 Émission : ${formatDateFr(today)}\n\n` +
          `Tape "ok" pour générer l'attestation, ou "annuler" pour abandonner.`,
        showConfirmation: true,
      },
    ],
  };
}

/**
 * Step 3 : confirmation du récap
 */
function handleConfirmation(
  data: FinDeBailWorkflowData,
  text: string,
): WorkflowResponse {
  const lower = text.trim().toLowerCase();

  if (lower === 'annuler' || lower === 'cancel' || lower === 'non') {
    return {
      newState: null,
      messages: [{ text: 'Fin de bail annulée. Mode inbox réactivé.' }],
    };
  }

  if (lower === 'ok' || lower === 'oui' || lower === 'go' || lower === 'c\'est bon' || lower === 'valider') {
    return startGeneration(data);
  }

  return {
    newState: makeState('confirming_recap', data),
    messages: [{ text: 'Tape "ok" pour générer ou "annuler".' }],
  };
}

/**
 * Transition vers l'étape generating
 */
function startGeneration(data: FinDeBailWorkflowData): WorkflowResponse {
  return {
    newState: makeState('generating', data),
    messages: [
      {
        text: '🔄 Génération de l\'attestation de fin de bail en cours…',
      },
    ],
  };
}
