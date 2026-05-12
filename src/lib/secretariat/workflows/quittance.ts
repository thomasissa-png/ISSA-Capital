/**
 * Workflow Quittance de loyer — machine d'états Telegram.
 *
 * Batch mode : N locataires × M mois = N×M PDFs en une seule invocation.
 *
 * États :
 *   selecting_locataires → selecting_periode → generating → done | error
 *
 * Génération directe sans confirmation (décision Thomas) : dès que la période
 * est validée, le batch démarre. Aucune limite sur N×M.
 *
 * Le workflow est entièrement auto-contenu : il gère la lecture Drive,
 * la résolution du bien, le calcul des variables, la génération PDF,
 * et l'upload vers Drive.
 *
 * Le mode "1 quittance simple" est juste le cas N=1, M=1.
 */

import type { Workflow, WorkflowState, WorkflowResponse } from './types';
import type { Locataire, QuittanceWorkflowData, QuittanceVariables } from '../rent/types';
import {
  locataireNomAvecCivilite,
  locataireInitiales,
} from '../rent/types';
import {
  rechercherLocataire,
  listerLocatairesActuels,
  loadAllFiches,
} from '../rent/locataires';
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

/** TTL du workflow quittance : 1 heure */
const QUITTANCE_TTL_MS = 60 * 60 * 1000;

/** Mois en français pour l'affichage */
const MOIS_FR = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Mois en français minuscules pour le parseur */
const MOIS_FR_LOWER: Record<string, number> = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4,
  mai: 5, juin: 6, juillet: 7, août: 8, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
};

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

// ============================================================
// Étapes du workflow
// ============================================================

type QuittanceStep =
  | 'selecting_locataires'
  | 'selecting_periode'
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

// ============================================================
// Parseur de sélection locataires (exported for tests)
// ============================================================

/**
 * Parse l'input de sélection locataires.
 *
 * - "tous", "*", "all", "tout" → tous
 * - "1,3,5" ou "1-5" ou "1, 3-5, 8" → indices
 * - Sinon → recherche textuelle (nom)
 */
export function parseLocataireSelection(
  input: string,
  totalCount: number,
): { type: 'indices'; indices: number[] } | { type: 'all' } | { type: 'search'; query: string } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: 'Entrée vide.' };

  // Check "tous", "*", "all", "tout"
  const lower = trimmed.toLowerCase();
  if (lower === 'tous' || lower === '*' || lower === 'all' || lower === 'tout') {
    return { type: 'all' };
  }

  // Check if numeric pattern (digits, commas, dashes, spaces only)
  if (/^[\d,\s-]+$/.test(trimmed)) {
    const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
    const indices: number[] = [];

    for (const part of parts) {
      const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]!, 10);
        const end = parseInt(rangeMatch[2]!, 10);
        if (start > end) {
          return { error: `Plage invalide : ${start}-${end} (début > fin).` };
        }
        if (start < 1) {
          return { error: `Numéro invalide : ${start}. Les numéros commencent à 1.` };
        }
        if (end > totalCount) {
          return { error: `Numéro ${end} hors limites (max: ${totalCount}).` };
        }
        for (let i = start; i <= end; i++) {
          indices.push(i);
        }
      } else {
        const num = parseInt(part, 10);
        if (Number.isNaN(num)) {
          return { error: `"${part}" n'est pas un numéro valide.` };
        }
        if (num < 1) {
          return { error: `Numéro invalide : ${num}. Les numéros commencent à 1.` };
        }
        if (num > totalCount) {
          return { error: `Numéro ${num} hors limites (max: ${totalCount}).` };
        }
        indices.push(num);
      }
    }

    // Deduplicate and sort
    const unique = [...new Set(indices)].sort((a, b) => a - b);
    if (unique.length === 0) {
      return { error: 'Aucun numéro valide trouvé.' };
    }

    return { type: 'indices', indices: unique };
  }

  // Fallback: text search
  return { type: 'search', query: trimmed };
}

// ============================================================
// Parseur de période (exported for tests)
// ============================================================

/**
 * Parse l'input de sélection de période.
 *
 * Formats supportés :
 * - "2026-04" ou "avril 2026" → 1 mois
 * - "2026-04,2026-05,2026-06" → N mois
 * - "2026-04 à 2026-08" ou "2026-04 - 2026-08" → plage
 * - "T1 2026", "T2 2026" etc. → trimestre
 * - "2026" (seul) → 12 mois
 * - "mois en cours", "ce mois" → mois courant
 * - "mois précédent", "mois dernier" → mois -1
 * - Max 24 mois par batch
 */
export function parsePeriodeSelection(
  input: string,
  today: Date = new Date(),
): { mois: Array<{ year: number; month: number }> } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: 'Entrée vide.' };

  const lower = trimmed.toLowerCase();

  // "mois en cours", "ce mois"
  if (lower === 'mois en cours' || lower === 'ce mois') {
    return { mois: [{ year: today.getFullYear(), month: today.getMonth() + 1 }] };
  }

  // "mois précédent", "mois dernier"
  if (lower === 'mois précédent' || lower === 'mois precédent' || lower === 'mois precedent' || lower === 'mois dernier') {
    const prevMonth = today.getMonth(); // 0-indexed, so getMonth() = current - 1
    const year = prevMonth === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const month = prevMonth === 0 ? 12 : prevMonth;
    return { mois: [{ year, month }] };
  }

  // Trimestre: "T1 2026", "T2 2026", "T3 2026", "T4 2026"
  const trimestreMatch = trimmed.match(/^[Tt]([1-4])\s+(\d{4})$/);
  if (trimestreMatch) {
    const q = parseInt(trimestreMatch[1]!, 10);
    const year = parseInt(trimestreMatch[2]!, 10);
    const startMonth = (q - 1) * 3 + 1;
    return {
      mois: [
        { year, month: startMonth },
        { year, month: startMonth + 1 },
        { year, month: startMonth + 2 },
      ],
    };
  }

  // Année seule: "2026" → 12 mois
  if (/^\d{4}$/.test(trimmed)) {
    const year = parseInt(trimmed, 10);
    return {
      mois: Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 })),
    };
  }

  // Plage: "2026-04 à 2026-08" or "2026-04 - 2026-08" or "avril 2026 à août 2026"
  const rangePatterns = [
    /^(.+?)\s+à\s+(.+)$/i,
    /^(.+?)\s*-\s*(.+)$/,
  ];

  for (const pattern of rangePatterns) {
    const rangeMatch = trimmed.match(pattern);
    if (rangeMatch) {
      const startParsed = parseSingleMonth(rangeMatch[1]!.trim());
      const endParsed = parseSingleMonth(rangeMatch[2]!.trim());

      if (!startParsed || !endParsed) {
        // Not a valid range of months — could be a single "YYYY-MM" with dash
        continue;
      }

      const startVal = startParsed.year * 12 + startParsed.month;
      const endVal = endParsed.year * 12 + endParsed.month;

      if (startVal > endVal) {
        return { error: `Plage invalide : ${rangeMatch[1]} est après ${rangeMatch[2]}.` };
      }

      const count = endVal - startVal + 1;

      const result: Array<{ year: number; month: number }> = [];
      let y = startParsed.year;
      let m = startParsed.month;
      for (let i = 0; i < count; i++) {
        result.push({ year: y, month: m });
        m++;
        if (m > 12) { m = 1; y++; }
      }
      return { mois: result };
    }
  }

  // Liste: "2026-04,2026-05,2026-06" or "avril 2026, mai 2026"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
    const result: Array<{ year: number; month: number }> = [];

    for (const part of parts) {
      const parsed = parseSingleMonth(part);
      if (!parsed) {
        return { error: `Mois non reconnu : "${part}". Utilise le format YYYY-MM ou "mois année".` };
      }
      result.push(parsed);
    }

    return { mois: result };
  }

  // Single month: "2026-04" or "avril 2026"
  const single = parseSingleMonth(trimmed);
  if (single) {
    return { mois: [single] };
  }

  return { error: `Format non reconnu : "${trimmed}". Formats acceptés : YYYY-MM, "mois année", T1-T4 YYYY, YYYY.` };
}

/**
 * Parse un seul mois depuis divers formats.
 * Returns null if unparseable.
 */
function parseSingleMonth(input: string): { year: number; month: number } | null {
  const trimmed = input.trim();

  // YYYY-MM
  const ymMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (ymMatch) {
    const year = parseInt(ymMatch[1]!, 10);
    const month = parseInt(ymMatch[2]!, 10);
    if (month >= 1 && month <= 12) return { year, month };
    return null;
  }

  // MM/YYYY
  const myMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (myMatch) {
    const month = parseInt(myMatch[1]!, 10);
    const year = parseInt(myMatch[2]!, 10);
    if (month >= 1 && month <= 12) return { year, month };
    return null;
  }

  // "avril 2026" or "Avril 2026" or "août 2026"
  // Use [^\s\d]+ instead of \w+ to match accented characters (û, é, etc.)
  const frMatch = trimmed.match(/^([^\s\d]+)\s+(\d{4})$/i);
  if (frMatch) {
    const moisNom = frMatch[1]!.toLowerCase();
    const month = MOIS_FR_LOWER[moisNom];
    if (month) {
      const year = parseInt(frMatch[2]!, 10);
      return { year, month };
    }
    // Also check against MOIS_FR array (capitalized)
    const idx = MOIS_FR.findIndex((m) => m.toLowerCase() === moisNom);
    if (idx >= 1) {
      return { year: parseInt(frMatch[2]!, 10), month: idx };
    }
  }

  return null;
}

// ============================================================
// Message formatters
// ============================================================

/**
 * Construit la liste numérotée des locataires.
 * Alignement des numéros sur 2 chiffres.
 */
export function buildNumberedListMessage(locataires: string[]): string {
  const padWidth = String(locataires.length).length;
  return locataires
    .map((nom, i) => `  ${String(i + 1).padStart(padWidth, ' ')}. ${nom}`)
    .join('\n');
}

/**
 * Formate un mois { year, month } en label français : "avril 2026"
 */
function moisLabel(m: { year: number; month: number }): string {
  return `${(MOIS_FR[m.month] ?? '???').toLowerCase()} ${m.year}`;
}

// ============================================================
// Construire les variables de quittance (inchangé)
// ============================================================

function construireVariables(
  loc: Locataire,
  annee: number,
  mois: number,
): QuittanceVariables | { error: string } {
  const bailleur = chargerBailleur();
  const bien = resoudreBien(loc.adresseBien);
  if (!bien) {
    return {
      error: `Bien introuvable pour l'adresse "${loc.adresseBien}". Vérifier biens.yml ou la fiche locataire.`,
    };
  }

  const loyer = loc.montantLoyer;
  const charges = loc.montantCharges;
  const total = loyer + charges;
  const moyenPaiement = loc.moyenPaiement;

  const debut = new Date(annee, mois - 1, 1);
  const finJour = dernierJourDuMois(annee, mois);
  const fin = new Date(annee, mois - 1, finJour);

  const emissionMois = (mois % 12) + 1;
  const emissionAnnee = annee + Math.floor(mois / 12);
  const dateEmission = new Date(emissionAnnee, emissionMois - 1, 3);

  const datePaiement = new Date(annee, mois - 1, 2);

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

// ============================================================
// Upload Drive (inchangé)
// ============================================================

async function uploadQuittanceDrive(
  pdfBuffer: Buffer,
  locataireNom: string,
  filename: string,
): Promise<{ success: boolean; webViewLink?: string; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Token OAuth2 indisponible pour Drive' };
  }

  const quittancesFolderId = process.env.DRIVE_QUITTANCES_FOLDER_ID
    ?? process.env.DRIVE_INBOX_FOLDER_ID;
  if (!quittancesFolderId) {
    return { success: false, error: 'DRIVE_QUITTANCES_FOLDER_ID ou DRIVE_INBOX_FOLDER_ID manquant' };
  }

  try {
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

    const locataireFolderId = await getOrCreateSubfolder(accessToken, parentId, locataireNom);
    if (!locataireFolderId) {
      return { success: false, error: `Impossible de créer le dossier ${locataireNom} sur Drive` };
    }

    // Delete existing file with same name (overwrite — decision Thomas)
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
        console.log(`[quittance] fichier existant supprimé : ${existing.id}`);
      }
    }

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
// Batch generation (called by the router after "Lancer" callback)
// ============================================================

export interface BatchResult {
  generated: number;
  failed: Array<{ locataire: string; mois: string; reason: string }>;
  results: Array<{
    locataireNom: string;
    moisLabel: string;
    pdfBuffer: Buffer;
    pdfFilename: string;
  }>;
}

/**
 * Generates N×M quittance PDFs.
 * Called by the webhook router after the user clicks "Lancer".
 */
export async function generateBatch(
  locataires: Locataire[],
  moisList: Array<{ year: number; month: number }>,
): Promise<BatchResult> {
  const results: BatchResult['results'] = [];
  const failed: BatchResult['failed'] = [];

  for (const loc of locataires) {
    for (const m of moisList) {
      const label = moisLabel(m);
      try {
        const varsResult = construireVariables(loc, m.year, m.month);
        if ('error' in varsResult) {
          failed.push({ locataire: loc.nomFichier, mois: label, reason: varsResult.error });
          continue;
        }

        const pdfBuffer = await genererQuittancePdf(varsResult);
        const nomFichier = loc.nomFichier.replace(/\s+/g, '-');
        const filename = `Quittance-${nomFichier}-${m.year}-${String(m.month).padStart(2, '0')}.pdf`;

        // Upload to Drive
        const driveResult = await uploadQuittanceDrive(pdfBuffer, loc.nomFichier, filename);
        if (!driveResult.success) {
          console.warn(`[quittance-batch] upload Drive échoué pour ${loc.nomFichier} ${label}: ${driveResult.error}`);
          // Don't fail the whole batch — PDF is still generated and sent via Telegram
        }

        results.push({
          locataireNom: loc.nomFichier,
          moisLabel: label,
          pdfBuffer,
          pdfFilename: filename,
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        failed.push({ locataire: loc.nomFichier, mois: label, reason });
      }
    }
  }

  return {
    generated: results.length,
    failed,
    results,
  };
}

// ============================================================
// Workflow Quittance — implémente l'interface Workflow
// ============================================================

export const quittanceWorkflow: Workflow = {
  type: 'quittance',
  command: 'quittance',
  commandDescription: 'Générer des quittances de loyer',
  ttlMs: QUITTANCE_TTL_MS,

  // ----------------------------------------------------------
  // start : lister locataires actuels et demander sélection
  // ----------------------------------------------------------

  async start(_chatId: number, _initialText?: string): Promise<WorkflowResponse> {
    const locataires = await listerLocatairesActuels();
    const data: QuittanceWorkflowData = {};

    if (locataires.length > 0) {
      data.locatairesDisponibles = locataires.map((nom) => ({ nom, adresse: '' }));
      const liste = buildNumberedListMessage(locataires);
      return {
        newState: makeState('selecting_locataires', data),
        messages: [
          {
            text:
              `📋 Voici tes ${locataires.length} locataires actuels :\n\n${liste}\n\n` +
              `Choisis qui :\n` +
              `- Numéros séparés par virgule : 1,3,5\n` +
              `- Plage : 1-5\n` +
              `- Tous : tous (ou *)\n` +
              `- Ou tape un nom (recherche futée fonctionne aussi)`,
          },
        ],
      };
    }

    // No list available (Drive inaccessible) — ask for name directly
    return {
      newState: makeState('selecting_locataires', data),
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
      case 'selecting_locataires':
        return handleSelectLocataires(data, text);

      case 'selecting_periode':
        return handleSelectPeriode(data, text);

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
    // Cancel from any step
    if (callbackData === 'q_cancel') {
      return {
        newState: null,
        messages: [{ text: 'Quittance annulée. Mode inbox réactivé.' }],
      };
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
      messages: [{ text: 'Quittance annulée. Mode inbox réactivé.' }],
    };
  },
};

// ============================================================
// Handlers par étape
// ============================================================

/**
 * Step 1: selecting_locataires — parse input, resolve locataires.
 */
async function handleSelectLocataires(
  data: QuittanceWorkflowData,
  text: string,
): Promise<WorkflowResponse> {
  const totalCount = data.locatairesDisponibles?.length ?? 0;
  const parsed = parseLocataireSelection(text, totalCount);

  if ('error' in parsed) {
    return {
      newState: makeState('selecting_locataires', data),
      messages: [{ text: `❌ ${parsed.error}\n\nRéessaie : numéros, plage, "tous" ou un nom.` }],
    };
  }

  if (parsed.type === 'all') {
    // Select all — resolve from cache
    const cache = await loadAllFiches();
    const actuels = cache.fiches.filter((f) => f.source === 'actuels');
    if (actuels.length === 0) {
      return {
        newState: makeState('selecting_locataires', data),
        messages: [{ text: 'Aucun locataire trouvé sur Drive.' }],
      };
    }
    data.selectedLocataires = actuels.map((f) => f.locataire);
    return buildPeriodePrompt(data);
  }

  if (parsed.type === 'indices') {
    // Resolve by indices from the displayed list
    if (!data.locatairesDisponibles || data.locatairesDisponibles.length === 0) {
      return {
        newState: makeState('selecting_locataires', data),
        messages: [{ text: 'Pas de liste de locataires disponible. Tape un nom.' }],
      };
    }

    const cache = await loadAllFiches();
    const actuels = cache.fiches.filter((f) => f.source === 'actuels').sort(
      (a, b) => a.nomFichier.localeCompare(b.nomFichier),
    );

    const selected: Locataire[] = [];
    const notFound: number[] = [];

    for (const idx of parsed.indices) {
      const locInfo = data.locatairesDisponibles[idx - 1];
      if (!locInfo) {
        notFound.push(idx);
        continue;
      }
      const fiche = actuels.find((f) => f.nomFichier === locInfo.nom);
      if (fiche) {
        selected.push(fiche.locataire);
      } else {
        // Try to find by fuzzy search
        const { locataire } = await rechercherLocataire(locInfo.nom);
        if (locataire) {
          selected.push(locataire);
        } else {
          notFound.push(idx);
        }
      }
    }

    if (selected.length === 0) {
      return {
        newState: makeState('selecting_locataires', data),
        messages: [{ text: `Aucun locataire trouvé pour les numéros ${notFound.join(', ')}. Réessaie.` }],
      };
    }

    data.selectedLocataires = selected;

    if (notFound.length > 0) {
      const names = selected.map((l) => l.nomFichier).join(', ');
      return {
        ...buildPeriodePrompt(data),
        messages: [
          {
            text:
              `⚠️ Numéros introuvables : ${notFound.join(', ')}\n\n` +
              `✅ Sélection : ${names} (${selected.length} locataire${selected.length > 1 ? 's' : ''})`,
          },
          buildPeriodePrompt(data).messages[0]!,
        ],
      };
    }

    return buildPeriodePrompt(data);
  }

  // parsed.type === 'search' — fuzzy search by name
  const { locataire, candidats, totaux } = await rechercherLocataire(parsed.query);

  if (candidats.length > 0) {
    const liste = candidats.map((c, i) => `${i + 1}. ${c.nomAffiche}`).join('\n');
    data.locatairesDisponibles = candidats.map((c) => ({ nom: c.nomFichier, adresse: '' }));
    return {
      newState: makeState('selecting_locataires', data),
      messages: [
        {
          text: `Plusieurs locataires correspondent à "${parsed.query}" :\n\n${liste}\n\nPrécise le numéro ou le nom complet.`,
        },
      ],
    };
  }

  if (!locataire) {
    if (totaux.actuels > 0) {
      const actuels = await listerLocatairesActuels();
      data.locatairesDisponibles = actuels.map((nom) => ({ nom, adresse: '' }));
      const liste = buildNumberedListMessage(actuels);
      return {
        newState: makeState('selecting_locataires', data),
        messages: [
          {
            text: `Aucun locataire ne correspond à "${parsed.query}". Voici tes ${totaux.actuels} locataires actuels :\n\n${liste}\n\nEnvoie le numéro ou le nom.`,
          },
        ],
      };
    }

    return {
      newState: makeState('selecting_locataires', data),
      messages: [
        {
          text: `Locataire "${parsed.query}" non trouvé sur Drive. Vérifie le nom et réessaie.`,
        },
      ],
    };
  }

  // Single locataire found by name → select it
  data.selectedLocataires = [locataire];
  return buildPeriodePrompt(data);
}

/**
 * Build the period selection prompt after locataires are confirmed.
 */
function buildPeriodePrompt(data: QuittanceWorkflowData): WorkflowResponse {
  const count = data.selectedLocataires?.length ?? 0;
  const names = (data.selectedLocataires ?? []).map((l) => l.nomFichier).join(', ');

  return {
    newState: makeState('selecting_periode', data),
    messages: [
      {
        text:
          `✅ Sélection : ${names} (${count} locataire${count > 1 ? 's' : ''})\n\n` +
          `📅 Choisis la période :\n` +
          `- Mois unique : mai 2026 ou 2026-05\n` +
          `- Plusieurs mois : 2026-04,2026-05,2026-06\n` +
          `- Plage : 2026-04 à 2026-08 (5 mois)\n` +
          `- Trimestre : T2 2026\n` +
          `- Année complète : 2026 (12 mois)`,
      },
    ],
  };
}

/**
 * Step 2: selecting_periode — parse input, lance directement la génération.
 * Pas de récap, pas de confirmation (décision Thomas).
 */
async function handleSelectPeriode(
  data: QuittanceWorkflowData,
  text: string,
): Promise<WorkflowResponse> {
  const result = parsePeriodeSelection(text);

  if ('error' in result) {
    return {
      newState: makeState('selecting_periode', data),
      messages: [{ text: `❌ ${result.error}\n\nRéessaie avec un format valide.` }],
    };
  }

  data.selectedMois = result.mois;
  const locCount = data.selectedLocataires?.length ?? 0;
  const moisCount = result.mois.length;
  const totalPdfs = locCount * moisCount;
  data.totalPdfs = totalPdfs;

  return {
    newState: makeState('generating', data),
    messages: [
      {
        text: `🔄 Génération de ${totalPdfs} quittance${totalPdfs > 1 ? 's' : ''} en cours...`,
      },
    ],
  };
}
