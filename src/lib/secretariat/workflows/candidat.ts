/**
 * Workflow Candidat — machine d'états Telegram.
 *
 * États :
 *   collecting_nom → collecting_contact → collecting_situation
 *   → collecting_garanties → collecting_bien → collecting_notes
 *   → confirming_recap → creating_fiche → done | error
 *
 * Crée une fiche Markdown avec frontmatter structuré dans le vault
 * Obsidian (Drive) : 07. Contacts / 05. Locataires / _Candidats / [Prenom Nom].md
 *
 * Pas de génération PDF — uniquement une fiche de pré-sélection.
 *
 * Convention vault existante respectée (locataires.ts LOCATAIRE_FOLDERS).
 */

import type { Workflow, WorkflowState, WorkflowResponse } from './types';
import type { CandidatWorkflowData } from '../rent/types';
import { getAccessToken, getOrCreateSubfolder } from '../drive-upload';

// ============================================================
// Constantes
// ============================================================

/** TTL du workflow candidat : 30 minutes */
const CANDIDAT_TTL_MS = 30 * 60 * 1000;

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

// ============================================================
// Types internes
// ============================================================

type CandidatStep =
  | 'collecting_nom'
  | 'collecting_contact'
  | 'collecting_situation'
  | 'collecting_garanties'
  | 'collecting_bien'
  | 'collecting_notes'
  | 'confirming_recap'
  | 'creating_fiche'
  | 'done'
  | 'error';

// ============================================================
// Helpers internes
// ============================================================

function makeState(step: CandidatStep, data: CandidatWorkflowData): WorkflowState {
  const now = Date.now();
  return {
    type: 'candidat',
    step,
    data: data as unknown as Record<string, unknown>,
    startedAt: now,
    expiresAt: now + CANDIDAT_TTL_MS,
  };
}

function getData(state: WorkflowState): CandidatWorkflowData {
  return state.data as unknown as CandidatWorkflowData;
}

// ============================================================
// Génération fiche Markdown
// ============================================================

/**
 * Construit le contenu Markdown de la fiche candidat.
 * Format aligné avec les fiches locataires existantes dans le vault.
 */
export function buildCandidatMarkdown(data: CandidatWorkflowData): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const lines: string[] = [
    '---',
    `prenom: "${data.prenom ?? ''}"`,
    `nom: "${data.nom ?? ''}"`,
    `email: "${data.email ?? ''}"`,
    `telephone: "${data.telephone ?? ''}"`,
    `situation_pro: "${data.situationPro ?? ''}"`,
    `garanties: "${data.garanties ?? ''}"`,
    `bien_vise: "${data.bienVise ?? ''}"`,
    `statut: candidat`,
    `date_candidature: ${dateStr}`,
    '---',
    '',
    `# ${data.prenom ?? ''} ${data.nom ?? ''}`,
    '',
    `**Date de candidature** : ${dateStr}`,
    '',
  ];

  if (data.situationPro) {
    lines.push(`## Situation professionnelle`, '', data.situationPro, '');
  }

  if (data.garanties) {
    lines.push(`## Garanties`, '', data.garanties, '');
  }

  if (data.bienVise) {
    lines.push(`## Bien visé`, '', data.bienVise, '');
  }

  if (data.notes) {
    lines.push(`## Notes`, '', data.notes, '');
  }

  return lines.join('\n');
}

// ============================================================
// Upload fiche sur Drive dans _Candidats/
// ============================================================

/**
 * Navigue vers 07. Contacts / 05. Locataires / _Candidats/
 * et crée le fichier .md.
 */
export async function uploadCandidatFiche(
  data: CandidatWorkflowData,
): Promise<{ success: boolean; webViewLink?: string; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Token OAuth2 indisponible pour Drive' };
  }

  const rootFolderId = process.env.DRIVE_VAULT_ROOT_ID ?? process.env.DRIVE_INBOX_FOLDER_ID;
  if (!rootFolderId) {
    console.warn('[candidat] DRIVE_VAULT_ROOT_ID manquant — skip upload Drive');
    return { success: false, error: 'DRIVE_VAULT_ROOT_ID manquant dans les variables d\'environnement' };
  }

  try {
    // Naviguer : root → 07. Contacts → 05. Locataires → _Candidats
    const contactsId = await findFolderByName(accessToken, rootFolderId, '07. Contacts');
    if (!contactsId) {
      return { success: false, error: 'Dossier "07. Contacts" introuvable sur Drive' };
    }

    const locatairesId = await findFolderByName(accessToken, contactsId, '05. Locataires');
    if (!locatairesId) {
      return { success: false, error: 'Dossier "05. Locataires" introuvable sur Drive' };
    }

    const candidatsId = await getOrCreateSubfolder(accessToken, locatairesId, '_Candidats');
    if (!candidatsId) {
      return { success: false, error: 'Impossible de créer/trouver le dossier "_Candidats" sur Drive' };
    }

    // Construire le contenu et le nom de fichier
    const filename = `${data.prenom ?? 'Prenom'} ${data.nom ?? 'Nom'}.md`;
    const content = buildCandidatMarkdown(data);

    // Supprimer un fichier existant du même nom (overwrite)
    const escaped = filename.replace(/'/g, "\\'");
    const searchQ = encodeURIComponent(
      `name='${escaped}' and '${candidatsId}' in parents and trashed=false`,
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
        console.warn(`[candidat] fichier existant supprimé : ${existing.id}`);
      }
    }

    // Upload multipart
    const metadata = JSON.stringify({
      name: filename,
      parents: [candidatsId],
      mimeType: 'text/markdown',
    });

    const boundary = '===issa_candidat_boundary===';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata + '\r\n' +
      `--${boundary}\r\n` +
      'Content-Type: text/markdown; charset=UTF-8\r\n\r\n';
    const footer = `\r\n--${boundary}--`;

    const contentBuffer = Buffer.from(content, 'utf-8');
    const bodyBuffer = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      contentBuffer,
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
    console.warn(`[candidat] upload OK : ${filename} → ${uploadData.webViewLink ?? uploadData.id}`);
    return { success: true, webViewLink: uploadData.webViewLink };
  } catch (err) {
    return {
      success: false,
      error: `Erreur Drive : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Recherche un dossier par nom dans un dossier parent.
 * Utilise le pattern list-then-filter (learning P1 S11 — Drive name= query bug).
 */
async function findFolderByName(
  accessToken: string,
  parentId: string,
  folderName: string,
): Promise<string | null> {
  try {
    const query = encodeURIComponent(
      `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const url = `${DRIVE_FILES_API}?q=${query}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=100`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      console.warn(`[candidat] Drive list failed HTTP ${resp.status}`);
      return null;
    }

    const data = (await resp.json()) as { files?: Array<{ id: string; name: string }> };
    const files = data.files ?? [];

    // Match local (pattern list-then-filter pour contourner bug Drive name=)
    const match = files.find((f) => f.name === folderName);
    if (match) return match.id;

    // Fallback : match case-insensitive
    const matchLower = files.find((f) => f.name.toLowerCase() === folderName.toLowerCase());
    if (matchLower) {
      console.warn(`[candidat] match case-insensitive : "${matchLower.name}" pour "${folderName}"`);
      return matchLower.id;
    }

    console.warn(`[candidat] dossier "${folderName}" non trouvé dans parent ${parentId}. Dossiers visibles : ${files.map((f) => f.name).join(', ')}`);
    return null;
  } catch (err) {
    console.warn(`[candidat] erreur recherche dossier : ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ============================================================
// Workflow Candidat — implémente l'interface Workflow
// ============================================================

export const candidatWorkflow: Workflow = {
  type: 'candidat',
  command: 'candidat',
  commandDescription: 'Créer une fiche candidat locataire',
  ttlMs: CANDIDAT_TTL_MS,

  // ----------------------------------------------------------
  // start : demander le nom du candidat
  // ----------------------------------------------------------

  async start(_chatId: number, _initialText?: string): Promise<WorkflowResponse> {
    const data: CandidatWorkflowData = {};

    return {
      newState: makeState('collecting_nom', data),
      messages: [
        {
          text:
            '📋 Nouvelle fiche candidat locataire.\n\n' +
            '👤 Nom et prénom du candidat ?\n' +
            '(ex: "Dupont Marie" ou "Marie Dupont")',
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
    const step = state.step as CandidatStep;
    const data = getData(state);

    switch (step) {
      case 'collecting_nom':
        return handleCollectNom(data, text);

      case 'collecting_contact':
        return handleCollectContact(data, text);

      case 'collecting_situation':
        return handleCollectSituation(data, text);

      case 'collecting_garanties':
        return handleCollectGaranties(data, text);

      case 'collecting_bien':
        return handleCollectBien(data, text);

      case 'collecting_notes':
        return handleCollectNotes(data, text);

      case 'confirming_recap':
        return handleConfirmation(data, text);

      default:
        return {
          newState: state,
          messages: [{ text: 'Création de la fiche en cours, patiente…' }],
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
      messages: [{ text: 'Les photos ne sont pas utilisées pour les fiches candidat.' }],
    };
  },

  async handleVoice(
    _chatId: number,
    state: WorkflowState,
  ): Promise<WorkflowResponse> {
    return {
      newState: state,
      messages: [{ text: 'Les vocaux ne sont pas utilisés pour les fiches candidat.' }],
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
    if (callbackData === 'cand_cancel') {
      return {
        newState: null,
        messages: [{ text: 'Fiche candidat annulée. Mode inbox réactivé.' }],
      };
    }

    if (callbackData === 'cand_confirm') {
      const data = getData(state);
      return startCreation(data);
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
      messages: [{ text: 'Fiche candidat annulée. Mode inbox réactivé.' }],
    };
  },
};

// ============================================================
// Handlers par étape
// ============================================================

/**
 * Step 1 : nom et prénom
 */
function handleCollectNom(
  data: CandidatWorkflowData,
  text: string,
): WorkflowResponse {
  const trimmed = text.trim();
  if (trimmed.length < 2) {
    return {
      newState: makeState('collecting_nom', data),
      messages: [{ text: 'Nom trop court. Envoie le nom complet (prénom nom).' }],
    };
  }

  // Essayer de séparer prénom/nom
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    data.prenom = parts[0]!;
    data.nom = parts.slice(1).join(' ');
  } else {
    data.nom = trimmed;
    data.prenom = '';
  }

  return {
    newState: makeState('collecting_contact', data),
    messages: [
      {
        text:
          `👤 ${data.prenom} ${data.nom}\n\n` +
          `📧 Email et/ou téléphone du candidat ?\n` +
          `(ex: "marie@email.com 06 12 34 56 78" ou juste l'un des deux)\n` +
          `Tape "skip" si pas d'info de contact.`,
      },
    ],
  };
}

/**
 * Step 2 : contact (email + téléphone)
 */
function handleCollectContact(
  data: CandidatWorkflowData,
  text: string,
): WorkflowResponse {
  const lower = text.trim().toLowerCase();

  if (lower !== 'skip' && lower !== '-' && lower !== 'non') {
    // Extraire email s'il y en a un
    const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      data.email = emailMatch[0];
    }

    // Extraire téléphone s'il y en a un
    const phoneMatch = text.match(/(?:0|\+33|0033)\s*[1-9][\s./-]?(?:\d[\s./-]?){8}/);
    if (phoneMatch) {
      data.telephone = phoneMatch[0].replace(/[\s./-]/g, '').replace(/^0033/, '0').replace(/^\+33/, '0');
    }

    // Si aucun pattern détecté, stocker comme tel
    if (!data.email && !data.telephone) {
      // Tenter comme téléphone brut ou email brut
      if (text.includes('@')) {
        data.email = text.trim();
      } else {
        data.telephone = text.trim();
      }
    }
  }

  return {
    newState: makeState('collecting_situation', data),
    messages: [
      {
        text:
          `💼 Situation professionnelle du candidat ?\n` +
          `(ex: "CDI chez Decathlon", "Étudiante L3 Dauphine", "Auto-entrepreneur")\n` +
          `Tape "skip" si pas d'info.`,
      },
    ],
  };
}

/**
 * Step 3 : situation professionnelle
 */
function handleCollectSituation(
  data: CandidatWorkflowData,
  text: string,
): WorkflowResponse {
  const lower = text.trim().toLowerCase();
  if (lower !== 'skip' && lower !== '-' && lower !== 'non') {
    data.situationPro = text.trim();
  }

  return {
    newState: makeState('collecting_garanties', data),
    messages: [
      {
        text:
          `🛡️ Garanties du candidat ?\n` +
          `(ex: "Garant parent — revenus 4000€/mois", "Visale", "Action Logement")\n` +
          `Tape "skip" si pas d'info.`,
      },
    ],
  };
}

/**
 * Step 4 : garanties
 */
function handleCollectGaranties(
  data: CandidatWorkflowData,
  text: string,
): WorkflowResponse {
  const lower = text.trim().toLowerCase();
  if (lower !== 'skip' && lower !== '-' && lower !== 'non') {
    data.garanties = text.trim();
  }

  return {
    newState: makeState('collecting_bien', data),
    messages: [
      {
        text:
          `🏠 Bien visé par le candidat ?\n` +
          `(ex: "Studio 7, 2 bis bd de la Seine, Nanterre" ou "Appartement F3 Rouen")\n` +
          `Tape "skip" si pas encore défini.`,
      },
    ],
  };
}

/**
 * Step 5 : bien visé
 */
function handleCollectBien(
  data: CandidatWorkflowData,
  text: string,
): WorkflowResponse {
  const lower = text.trim().toLowerCase();
  if (lower !== 'skip' && lower !== '-' && lower !== 'non') {
    data.bienVise = text.trim();
  }

  return {
    newState: makeState('collecting_notes', data),
    messages: [
      {
        text:
          `📝 Notes complémentaires ?\n` +
          `(ex: "Dossier solide, à rappeler vendredi", "Coloc avec son frère")\n` +
          `Tape "skip" pour terminer.`,
      },
    ],
  };
}

/**
 * Step 6 : notes complémentaires
 */
function handleCollectNotes(
  data: CandidatWorkflowData,
  text: string,
): WorkflowResponse {
  const lower = text.trim().toLowerCase();
  if (lower !== 'skip' && lower !== '-' && lower !== 'non') {
    data.notes = text.trim();
  }

  return buildRecap(data);
}

/**
 * Construit le récap avant création de la fiche
 */
function buildRecap(data: CandidatWorkflowData): WorkflowResponse {
  const parts = [
    `📋 Récapitulatif candidat :\n`,
    `👤 ${data.prenom ?? ''} ${data.nom ?? ''}`,
  ];

  if (data.email) parts.push(`📧 ${data.email}`);
  if (data.telephone) parts.push(`📱 ${data.telephone}`);
  if (data.situationPro) parts.push(`💼 ${data.situationPro}`);
  if (data.garanties) parts.push(`🛡️ ${data.garanties}`);
  if (data.bienVise) parts.push(`🏠 ${data.bienVise}`);
  if (data.notes) parts.push(`📝 ${data.notes}`);

  parts.push('');
  parts.push('Tape "ok" pour créer la fiche, ou "annuler" pour abandonner.');

  return {
    newState: makeState('confirming_recap', data),
    messages: [
      {
        text: parts.join('\n'),
        showConfirmation: true,
      },
    ],
  };
}

/**
 * Step 7 : confirmation du récap
 */
function handleConfirmation(
  data: CandidatWorkflowData,
  text: string,
): WorkflowResponse {
  const lower = text.trim().toLowerCase();

  if (lower === 'annuler' || lower === 'cancel' || lower === 'non') {
    return {
      newState: null,
      messages: [{ text: 'Fiche candidat annulée. Mode inbox réactivé.' }],
    };
  }

  if (lower === 'ok' || lower === 'oui' || lower === 'go' || lower === 'c\'est bon' || lower === 'valider') {
    return startCreation(data);
  }

  return {
    newState: makeState('confirming_recap', data),
    messages: [{ text: 'Tape "ok" pour créer la fiche ou "annuler".' }],
  };
}

/**
 * Transition vers l'étape creating_fiche
 */
function startCreation(data: CandidatWorkflowData): WorkflowResponse {
  return {
    newState: makeState('creating_fiche', data),
    messages: [
      {
        text: '🔄 Création de la fiche candidat…',
      },
    ],
  };
}
