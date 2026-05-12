/**
 * Workflow Bail meublé — machine d'états Telegram.
 *
 * États :
 *   selecting_locataire → collecting_date_debut → collecting_date_signature
 *   → confirming_recap → generating → done | error
 *
 * Génération : DOCX + PDF, upload Drive dans Baux/, envoi Telegram.
 *
 * Réutilise les libs de rent/ : locataires (recherche futée),
 * bail-config (résolution bien + inventaire), pdf-bail (DOCX+PDF).
 *
 * Décision Thomas appliquée : pas de confirmation des infos vault
 * (vault = source de vérité). Confirmation uniquement sur le récap
 * avant génération (dates + montants calculés/inférés).
 */

import type { Workflow, WorkflowState, WorkflowResponse } from './types';
import type { Locataire, BailWorkflowData } from '../rent/types';
import {
  rechercherLocataire,
  listerLocatairesActuels,
  loadAllFiches,
} from '../rent/locataires';
import {
  verifierFicheBail,
  construireVariablesBail,
  chargerDefaultsBail,
} from '../rent/bail-config';
import { genererBailDocx, genererBailPdf } from '../rent/pdf-bail';
import { getAccessToken, getOrCreateSubfolder } from '../drive-upload';
import { parseLocataireSelection, buildNumberedListMessage } from './quittance';
import { formatDateFr } from '../rent/dates-fr';

// ============================================================
// Constantes
// ============================================================

/** TTL du workflow bail : 2 heures (plus long que quittance car interactif) */
const BAIL_TTL_MS = 2 * 60 * 60 * 1000;

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

// ============================================================
// Types internes
// ============================================================

type BailStep =
  | 'selecting_locataire'
  | 'collecting_date_debut'
  | 'collecting_date_signature'
  | 'confirming_recap'
  | 'generating'
  | 'done'
  | 'error';

// ============================================================
// Helpers internes
// ============================================================

function makeState(step: BailStep, data: BailWorkflowData): WorkflowState {
  const now = Date.now();
  return {
    type: 'bail',
    step,
    data: data as unknown as Record<string, unknown>,
    startedAt: now,
    expiresAt: now + BAIL_TTL_MS,
  };
}

function getData(state: WorkflowState): BailWorkflowData {
  return state.data as unknown as BailWorkflowData;
}

/**
 * Parse une date YYYY-MM-DD depuis l'input utilisateur.
 *
 * Formats acceptés :
 * - "2026-05-15" (ISO)
 * - "15/05/2026" (FR)
 * - "15 mai 2026" (FR texte)
 */
const MOIS_FR_LOWER: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4,
  mai: 5, juin: 6, juillet: 7, août: 8, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
};

export function parseDateInput(input: string): Date | null {
  const trimmed = input.trim();

  // ISO: "2026-05-15"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1]!, 10);
    const m = parseInt(isoMatch[2]!, 10);
    const d = parseInt(isoMatch[3]!, 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d);
    }
  }

  // FR: "15/05/2026"
  const frMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (frMatch) {
    const d = parseInt(frMatch[1]!, 10);
    const m = parseInt(frMatch[2]!, 10);
    const y = parseInt(frMatch[3]!, 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d);
    }
  }

  // FR texte: "15 mai 2026" ou "1er mai 2026"
  const frTextMatch = trimmed.match(/^(\d{1,2})(?:er)?\s+([^\s\d]+)\s+(\d{4})$/i);
  if (frTextMatch) {
    const d = parseInt(frTextMatch[1]!, 10);
    const moisNom = frTextMatch[2]!.toLowerCase();
    const y = parseInt(frTextMatch[3]!, 10);
    const m = MOIS_FR_LOWER[moisNom];
    if (m && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d);
    }
  }

  return null;
}

// ============================================================
// Upload Drive dans Baux/
// ============================================================

async function uploadBailDrive(
  fileBuffer: Buffer,
  locataireNom: string,
  filename: string,
  mimeType: string,
): Promise<{ success: boolean; webViewLink?: string; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Token OAuth2 indisponible pour Drive' };
  }

  const bauxFolderId = process.env.DRIVE_BAUX_FOLDER_ID;
  if (!bauxFolderId) {
    console.warn('[bail] DRIVE_BAUX_FOLDER_ID manquant — skip upload Drive');
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
        console.warn(`[bail] fichier existant supprimé : ${existing.id}`);
      }
    }

    // Upload multipart
    const metadata = JSON.stringify({
      name: filename,
      parents: [locataireFolderId],
      mimeType,
    });

    const boundary = '===issa_bail_boundary===';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata + '\r\n' +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`;
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
    console.warn(`[bail] upload OK : ${filename} → ${uploadData.webViewLink ?? uploadData.id}`);
    return { success: true, webViewLink: uploadData.webViewLink };
  } catch (err) {
    return {
      success: false,
      error: `Erreur Drive : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ============================================================
// Génération bail (DOCX + PDF)
// ============================================================

export interface BailGenerationResult {
  success: boolean;
  docxBuffer?: Buffer;
  pdfBuffer?: Buffer;
  filenameBase?: string;
  driveLinks?: Array<{ type: string; link: string }>;
  error?: string;
}

/**
 * Génère DOCX + PDF du bail, uploade sur Drive.
 *
 * @param loc Locataire avec tous les champs bail
 * @param dateDebut Date de début du bail
 * @param dateSignature Date de signature (défaut : veille du début)
 */
export async function generateBail(
  loc: Locataire,
  dateDebut: Date,
  dateSignature?: Date,
): Promise<BailGenerationResult> {
  // Vérifier les champs obligatoires
  const issues = verifierFicheBail(loc);
  if (issues.length > 0) {
    return {
      success: false,
      error: `Fiche locataire incomplète — champs manquants : ${issues.join(', ')}`,
    };
  }

  // Construire les variables
  const varsResult = construireVariablesBail(loc, dateDebut, dateSignature);
  if ('error' in varsResult) {
    return { success: false, error: varsResult.error };
  }

  const nomFichier = loc.nomFichier.replace(/\s+/g, '-');
  const dateStr = `${dateDebut.getFullYear()}-${String(dateDebut.getMonth() + 1).padStart(2, '0')}-${String(dateDebut.getDate()).padStart(2, '0')}`;
  const filenameBase = `Bail-${nomFichier}-${dateStr}`;

  try {
    // Générer DOCX
    console.warn(`[bail] génération DOCX pour ${loc.nomFichier}…`);
    const docxBuffer = await genererBailDocx(varsResult);

    // Générer PDF
    console.warn(`[bail] génération PDF pour ${loc.nomFichier}…`);
    const pdfBuffer = await genererBailPdf(varsResult);

    // Upload Drive
    const driveLinks: Array<{ type: string; link: string }> = [];

    const docxUpload = await uploadBailDrive(
      docxBuffer,
      loc.nomFichier,
      `${filenameBase}.docx`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    if (docxUpload.success && docxUpload.webViewLink) {
      driveLinks.push({ type: 'DOCX', link: docxUpload.webViewLink });
    } else if (!docxUpload.success) {
      console.warn(`[bail] upload DOCX Drive échoué : ${docxUpload.error}`);
    }

    const pdfUpload = await uploadBailDrive(
      pdfBuffer,
      loc.nomFichier,
      `${filenameBase}.pdf`,
      'application/pdf',
    );
    if (pdfUpload.success && pdfUpload.webViewLink) {
      driveLinks.push({ type: 'PDF', link: pdfUpload.webViewLink });
    } else if (!pdfUpload.success) {
      console.warn(`[bail] upload PDF Drive échoué : ${pdfUpload.error}`);
    }

    return {
      success: true,
      docxBuffer,
      pdfBuffer,
      filenameBase,
      driveLinks,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[bail] erreur génération : ${msg}`);
    return { success: false, error: msg };
  }
}

// ============================================================
// Workflow Bail — implémente l'interface Workflow
// ============================================================

export const bailWorkflow: Workflow = {
  type: 'bail',
  command: 'bail',
  commandDescription: 'Générer un bail meublé (DOCX + PDF)',
  ttlMs: BAIL_TTL_MS,

  // ----------------------------------------------------------
  // start : lister locataires et demander sélection
  // ----------------------------------------------------------

  async start(_chatId: number, _initialText?: string): Promise<WorkflowResponse> {
    const locataires = await listerLocatairesActuels();
    const data: BailWorkflowData = {};

    if (locataires.length > 0) {
      data.locatairesDisponibles = locataires.map((nom) => ({ nom, adresse: '' }));
      const liste = buildNumberedListMessage(locataires);
      return {
        newState: makeState('selecting_locataire', data),
        messages: [
          {
            text:
              `📋 Bail meublé — Choisis le locataire :\n\n${liste}\n\n` +
              `Envoie le numéro, le nom, ou tape un nom (recherche futée).`,
          },
        ],
      };
    }

    return {
      newState: makeState('selecting_locataire', data),
      messages: [
        {
          text: 'Bail meublé — envoie le nom du locataire (prénom nom).',
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
    const step = state.step as BailStep;
    const data = getData(state);

    switch (step) {
      case 'selecting_locataire':
        return handleSelectLocataire(data, text);

      case 'collecting_date_debut':
        return handleDateDebut(data, text);

      case 'collecting_date_signature':
        return handleDateSignature(data, text);

      case 'confirming_recap':
        return handleConfirmation(data, text);

      default:
        return {
          newState: state,
          messages: [{ text: 'Bail en cours de génération, patiente…' }],
        };
    }
  },

  // ----------------------------------------------------------
  // handlePhoto / handleVoice : non supportés pour le bail
  // ----------------------------------------------------------

  async handlePhoto(
    _chatId: number,
    state: WorkflowState,
  ): Promise<WorkflowResponse> {
    return {
      newState: state,
      messages: [{ text: 'Les photos ne sont pas utilisées pour les baux.' }],
    };
  },

  async handleVoice(
    _chatId: number,
    state: WorkflowState,
  ): Promise<WorkflowResponse> {
    return {
      newState: state,
      messages: [{ text: 'Les vocaux ne sont pas utilisés pour les baux.' }],
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
    if (callbackData === 'bail_cancel') {
      return {
        newState: null,
        messages: [{ text: 'Bail annulé. Mode inbox réactivé.' }],
      };
    }

    if (callbackData === 'bail_confirm') {
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
      messages: [{ text: 'Bail annulé. Mode inbox réactivé.' }],
    };
  },
};

// ============================================================
// Handlers par étape
// ============================================================

/**
 * Step 1 : sélection du locataire (réutilise le parseur de quittance)
 */
async function handleSelectLocataire(
  data: BailWorkflowData,
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

  // Pour le bail, on accepte un seul locataire (pas de batch)
  if (parsed.type === 'all') {
    return {
      newState: makeState('selecting_locataire', data),
      messages: [{ text: 'Le bail se fait pour un seul locataire. Envoie le numéro ou le nom.' }],
    };
  }

  let locataire: Locataire | null = null;

  if (parsed.type === 'indices') {
    if (parsed.indices.length > 1) {
      return {
        newState: makeState('selecting_locataire', data),
        messages: [{ text: 'Le bail se fait pour un seul locataire. Envoie un seul numéro.' }],
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

  // Vérifier la fiche
  const issues = verifierFicheBail(locataire);
  if (issues.length > 0) {
    return {
      newState: makeState('selecting_locataire', data),
      messages: [
        {
          text:
            `La fiche de ${locataire.nomFichier} est incomplète pour un bail :\n\n` +
            issues.map((i) => `- ${i}`).join('\n') +
            '\n\nComplète la fiche Obsidian puis réessaie.',
        },
      ],
    };
  }

  data.selectedLocataire = locataire;

  // Passer à la date de début
  return {
    newState: makeState('collecting_date_debut', data),
    messages: [
      {
        text:
          `Locataire : ${locataire.nomAffiche}\n` +
          `Bien : ${locataire.adresseBien}\n` +
          `Loyer : ${locataire.montantLoyer}€ + ${locataire.montantCharges}€ charges\n\n` +
          `📅 Date de début du bail ? (ex: 2026-05-15, 15/05/2026 ou 15 mai 2026)`,
      },
    ],
  };
}

/**
 * Step 2 : date de début du bail
 */
function handleDateDebut(
  data: BailWorkflowData,
  text: string,
): WorkflowResponse {
  // Si le locataire a déjà une date_entree_bail et que l'utilisateur tape "ok" ou similaire
  const lower = text.trim().toLowerCase();
  if ((lower === 'ok' || lower === 'oui' || lower === 'idem') && data.selectedLocataire?.dateEntreeBail) {
    const d = data.selectedLocataire.dateEntreeBail;
    data.dateDebut = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return promptDateSignature(data);
  }

  const date = parseDateInput(text);
  if (!date) {
    return {
      newState: makeState('collecting_date_debut', data),
      messages: [
        {
          text: 'Date non reconnue. Formats acceptés : 2026-05-15, 15/05/2026 ou 15 mai 2026.',
        },
      ],
    };
  }

  data.dateDebut = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return promptDateSignature(data);
}

/**
 * Transition vers l'étape date de signature
 */
function promptDateSignature(data: BailWorkflowData): WorkflowResponse {
  const dateDebut = new Date(data.dateDebut!);
  const veille = new Date(dateDebut.getTime() - 24 * 60 * 60 * 1000);
  const veilleStr = formatDateFr(veille);

  return {
    newState: makeState('collecting_date_signature', data),
    messages: [
      {
        text:
          `Date de début : ${formatDateFr(dateDebut)}\n\n` +
          `📝 Date de signature ? (défaut : ${veilleStr}, la veille)\n` +
          `Tape "ok" pour la veille, ou une date précise.`,
      },
    ],
  };
}

/**
 * Step 3 : date de signature
 */
function handleDateSignature(
  data: BailWorkflowData,
  text: string,
): WorkflowResponse {
  const lower = text.trim().toLowerCase();

  if (lower === 'ok' || lower === 'oui' || lower === 'veille' || lower === '') {
    // Défaut : veille du début
    const dateDebut = new Date(data.dateDebut!);
    const veille = new Date(dateDebut.getTime() - 24 * 60 * 60 * 1000);
    data.dateSignature = `${veille.getFullYear()}-${String(veille.getMonth() + 1).padStart(2, '0')}-${String(veille.getDate()).padStart(2, '0')}`;
    return buildRecap(data);
  }

  const date = parseDateInput(text);
  if (!date) {
    return {
      newState: makeState('collecting_date_signature', data),
      messages: [
        {
          text: 'Date non reconnue. Formats acceptés : 2026-05-14, 14/05/2026 ou "ok" pour la veille.',
        },
      ],
    };
  }

  data.dateSignature = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return buildRecap(data);
}

/**
 * Construit le récap avant génération
 */
function buildRecap(data: BailWorkflowData): WorkflowResponse {
  const loc = data.selectedLocataire!;
  const dateDebut = new Date(data.dateDebut!);
  const dateSignature = new Date(data.dateSignature!);
  const defaults = chargerDefaultsBail();
  const depot = loc.depotGarantie ?? defaults.depot_garantie;

  return {
    newState: makeState('confirming_recap', data),
    messages: [
      {
        text:
          `📋 Récapitulatif du bail :\n\n` +
          `👤 ${loc.nomAffiche} (${loc.civilite ?? 'civilité ?'})\n` +
          `🏠 ${loc.adresseBien}\n` +
          `💰 Loyer : ${loc.montantLoyer}€ + ${loc.montantCharges}€ charges\n` +
          `🔒 Dépôt : ${depot}€\n` +
          `📅 Début : ${formatDateFr(dateDebut)}\n` +
          `✍️ Signature : ${formatDateFr(dateSignature)}\n` +
          `⏱ Durée : ${defaults.duree_bail}\n\n` +
          `Tape "ok" pour générer, ou "annuler" pour abandonner.`,
        showConfirmation: true,
      },
    ],
  };
}

/**
 * Step 4 : confirmation du récap
 */
function handleConfirmation(
  data: BailWorkflowData,
  text: string,
): WorkflowResponse {
  const lower = text.trim().toLowerCase();

  if (lower === 'annuler' || lower === 'cancel' || lower === 'non') {
    return {
      newState: null,
      messages: [{ text: 'Bail annulé. Mode inbox réactivé.' }],
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
function startGeneration(data: BailWorkflowData): WorkflowResponse {
  return {
    newState: makeState('generating', data),
    messages: [
      {
        text: '🔄 Génération du bail en cours (DOCX + PDF)…',
      },
    ],
  };
}
