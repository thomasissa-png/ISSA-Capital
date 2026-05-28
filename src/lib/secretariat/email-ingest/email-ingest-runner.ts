/**
 * Pipeline runner email-ingest — Anya.
 *
 * Orchestre le cycle complet :
 *   1. Charger contacts depuis cache
 *   2. Lister les emails non traités
 *   3. Pour chaque email intéressant (hors spam/système) :
 *      a. Documenter en silence (historique contact/projet — actions du handler
 *         + coherence-actions, append-only, faible risque)
 *      b. Détecter si Thomas a déjà répondu (hasReplyFromMe sur le thread)
 *      c. Si PAS répondu → créer un brouillon Gmail rattaché au fil, silencieusement
 *      d. Si expéditeur inconnu → carte Telegram de création de contact (no-match)
 *   4. Retourner les stats
 *
 * S23 — refonte UX (décisions verrouillées, docs/orchestration-plan-s23-email-workflow.md) :
 *   - Traitement AUTONOME et SILENCIEUX : plus de carte de validation générique.
 *   - SEULE interaction conservée : la carte de création de contact (no-match).
 *   - La création de brouillon est un passage de premier ordre (plus de return
 *     anticipé sur la branche auto-execute qui empêchait tout brouillon).
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4C §A + plan S23.
 */

import { randomUUID } from 'crypto';
import type { EmailMessage } from '../gmail-source/types';
import type { TriageResult, KnownContact } from '../triage/types';
import type { ActionProposal } from '../handlers/types';
import { getActiveSources, type EmailSourceAdapter } from './email-sources';
import { triageEmail } from '../triage/triage';
import { isLikelySpamByHeuristic } from './pre-filter';
import { loadKnownContacts } from './contacts-cache';
import { composeDraft } from './draft-composer';
import { isDirectlyAddressed } from './addressee';
import {
  handleLocataire,
  handleAClassifier,
  handleContactPro,
  handleApporteur,
  handleCandidat,
} from '../handlers';
import {
  saveNoMatch,
  sendNoMatchCard,
} from '../telegram-validation';
import type { NoMatchPending } from '../telegram-validation';
import { writeAuditLog } from '../vault-client/audit-log';
import {
  appendToHistorique,
  updateFrontmatter,
  createVaultFile,
} from '../vault-client';
import { addTaskToTickTick, mapTodoPriority } from '../ticktick/inbox-task';
import { createTickTickTaskForEmail } from './ticktick-integration';
import { buildCoherenceActions } from './coherence-actions';
import { appendProjetHistoriqueLine } from '../calendar-ingest/projet-enricher';

// ============================================================
// Types
// ============================================================

export interface IngestStats {
  totalListed: number;
  preFilteredSpam: number;
  haikuSpam: number;
  /**
   * S23 — emails intéressants traités en silence (documentation + éventuel
   * brouillon, sans carte de validation). Remplace l'ancien `pendingCreated`
   * (plus de pending de validation générique). Conservé pour compat stats.
   */
  pendingCreated: number;
  /** S18.5 : emails traités automatiquement (contact existant ou email système) */
  autoExecuted: number;
  /** S18.5 : emails système filtrés (noreply@, contact@, etc.) */
  systemEmailsFiltered: number;
  draftsCreated: number;
  draftsSkipped: number;
  /** S23 — brouillons non créés car Thomas a déjà répondu dans le fil */
  draftsSkippedAlreadyReplied: number;
  /** S24 — brouillons non créés car Thomas est en copie (Cc), pas destinataire direct */
  draftsSkippedNotAddressed: number;
  draftsFailed: number;
  /** S23 — cartes de création de contact envoyées (no-match, seule carte conservée) */
  contactCardsSent: number;
  errors: number;
  durationMs: number;
}

// ============================================================
// Constantes
// ============================================================

/** Seuil de confiance pour auto-spam sans Telegram */
const AUTO_SPAM_CONFIDENCE_THRESHOLD = 0.9;

/**
 * Nombre max d'emails traités PAR SOURCE et PAR RUN. Borne le temps d'un run
 * (chaque email = triage + brouillon LLM + écritures vault, ~plusieurs s) pour
 * qu'il TERMINE dans le timeout cron (900s) au lieu d'être coupé au milieu.
 * Le reliquat est traité au run suivant (les emails traités sont marqués → ne
 * re-listent plus). Draine un backlog progressivement plutôt que de boucler.
 */
const MAX_EMAILS_PER_SOURCE_PER_RUN = 8;

// ============================================================
// Dispatch handler par catégorie
// ============================================================

type HandlerFn = (triage: TriageResult, email: EmailMessage) => Promise<ActionProposal[]>;

/**
 * Mapping catégorie triage → handler.
 *
 * candidat → handleCandidat (handler dédié depuis Jalon 4D-1).
 * spam (confidence ≤ 0.9) → handleAClassifier (carte Telegram quand même).
 */
function getHandler(category: string): HandlerFn {
  switch (category) {
    case 'locataire':
      return handleLocataire;
    case 'contact-pro':
      return handleContactPro;
    case 'apporteur':
      return handleApporteur;
    case 'candidat':
      return handleCandidat;
    case 'a-classifier':
    case 'spam':
    default:
      return handleAClassifier;
  }
}

// ============================================================
// Pipeline principal
// ============================================================

/**
 * Exécute un cycle complet d'email-ingest.
 *
 * @returns Stats du run (total, spam pré-filtrés, spam Haiku, pendings créés, erreurs)
 */
export async function runEmailIngest(): Promise<IngestStats> {
  const startMs = Date.now();

  const stats: IngestStats = {
    totalListed: 0,
    preFilteredSpam: 0,
    haikuSpam: 0,
    pendingCreated: 0,
    autoExecuted: 0,
    systemEmailsFiltered: 0,
    draftsCreated: 0,
    draftsSkipped: 0,
    draftsSkippedAlreadyReplied: 0,
    draftsSkippedNotAddressed: 0,
    draftsFailed: 0,
    contactCardsSent: 0,
    errors: 0,
    durationMs: 0,
  };

  // 1. Charger contacts depuis cache
  let contacts: KnownContact[];
  try {
    contacts = await loadKnownContacts();
  } catch {
    console.warn('[email-ingest] erreur chargement contacts — run avec liste vide');
    contacts = [];
  }

  // 2. Pour chaque source active (Gmail + boîtes Outlook configurées), lister
  //    les emails non traités et les traiter avec le même pipeline.
  const sources = getActiveSources();
  console.warn(
    `[email-ingest] ${sources.length} source(s) active(s) : ${sources.map((s) => s.label).join(', ')}`,
  );

  // Traitement des sources EN PARALLÈLE (S23) : chaque boîte (Gmail, Outlook
  // Sarani, Outlook Versi) tourne indépendamment, pour qu'une source lente
  // (Gmail + brouillons) n'affame plus les suivantes. Les emails d'UNE source
  // restent séquentiels (pas de hammering d'un même fournisseur).
  await Promise.all(
    sources.map(async (source) => {
      let messages: Array<{ id: string; threadId?: string }>;
      try {
        messages = await source.listUnprocessed();
      } catch (err) {
        console.warn(
          `[email-ingest] erreur listUnprocessed (${source.label}) : ${err instanceof Error ? err.message : String(err)}`,
        );
        stats.errors++;
        return;
      }

      stats.totalListed += messages.length;
      // Borne le run : on traite au plus MAX_EMAILS_PER_SOURCE_PER_RUN ce cycle ;
      // le reste passe au run suivant (les emails traités sont marqués, donc ne
      // re-listent plus → le backlog se draine au lieu de couper le run).
      const batch = messages.slice(0, MAX_EMAILS_PER_SOURCE_PER_RUN);
      const overflow = messages.length - batch.length;
      console.warn(
        `[email-ingest] ${source.label} : ${messages.length} email(s) non traité(s)` +
          (overflow > 0 ? ` — ${batch.length} ce run, ${overflow} reportés` : ''),
      );

      let done = 0;
      for (const msg of batch) {
        try {
          await processOneEmail(source, msg.id, contacts, stats);
          done++;
        } catch (err) {
          console.warn(
            `[email-ingest] erreur inattendue sur ${source.label} message ${msg.id} : ${err instanceof Error ? err.message : String(err)}`,
          );
          stats.errors++;
        }
      }
      console.warn(`[email-ingest] ${source.label} : ${done}/${batch.length} traité(s) ce run`);
    }),
  );

  // 4. Audit final — ligne récap
  stats.durationMs = Date.now() - startMs;

  await writeAuditLog({
    ts: new Date().toISOString(),
    op: 'classify_note',
    target: 'email-ingest-run',
    trigger: 'api/email-ingest',
    payload: { ...stats },
    status: 'success',
  });

  console.warn(
    `[email-ingest] terminé en ${stats.durationMs}ms — ` +
    `total=${stats.totalListed}, pré-filtrés=${stats.preFilteredSpam}, ` +
    `haiku-spam=${stats.haikuSpam}, traités=${stats.pendingCreated}, ` +
    `auto=${stats.autoExecuted}, sys=${stats.systemEmailsFiltered}, ` +
    `drafts=${stats.draftsCreated}créés/${stats.draftsSkipped}skip/` +
    `${stats.draftsSkippedAlreadyReplied}déjà-répondu/` +
    `${stats.draftsSkippedNotAddressed}en-copie/${stats.draftsFailed}err, ` +
    `cartes-contact=${stats.contactCardsSent}, erreurs=${stats.errors}`,
  );

  return stats;
}

// ============================================================
// Traitement d'un email
// ============================================================

async function processOneEmail(
  source: EmailSourceAdapter,
  messageId: string,
  contacts: KnownContact[],
  stats: IngestStats,
): Promise<void> {
  // Fetch detail
  const detail = await source.fetchDetail(messageId);
  if (!detail) {
    console.warn(`[email-ingest] fetchDetail null pour ${source.label} message ${messageId}`);
    stats.errors++;
    return;
  }

  // Pré-filtre heuristique
  if (isLikelySpamByHeuristic(detail)) {
    await source.markProcessed(messageId);
    await writeAuditLog({
      ts: new Date().toISOString(),
      op: 'classify_note',
      target: messageId,
      trigger: 'email-ingest:pre-filter',
      payload: {
        from: detail.from.email,
        subject: detail.subject,
        reason: 'auto-spam-prefilter',
      },
      status: 'success',
    });
    stats.preFilteredSpam++;
    return;
  }

  // Triage Haiku
  const triage = await triageEmail(detail, contacts);
  if (!triage) {
    await source.markFailed(messageId);
    await writeAuditLog({
      ts: new Date().toISOString(),
      op: 'classify_note',
      target: messageId,
      trigger: 'email-ingest:triage-failed',
      payload: {
        from: detail.from.email,
        subject: detail.subject,
      },
      status: 'error',
      errorMessage: 'Haiku triage échoué après retry',
    });
    stats.errors++;
    return;
  }

  // Auto-spam Haiku (confidence > 0.9)
  if (triage.category === 'spam' && triage.confidence > AUTO_SPAM_CONFIDENCE_THRESHOLD) {
    await source.markProcessed(messageId);
    await writeAuditLog({
      ts: new Date().toISOString(),
      op: 'classify_note',
      target: messageId,
      trigger: 'email-ingest:auto-spam-haiku',
      payload: {
        from: detail.from.email,
        subject: detail.subject,
        confidence: triage.confidence,
      },
      status: 'success',
    });
    stats.haikuSpam++;
    return;
  }

  // Dispatch handler
  const handler = getHandler(triage.category);
  const handlerActions = await handler(triage, detail);

  // S23 — actions de cohérence (historique projet, copie PJ, hot-context).
  // Best-effort : un échec ne bloque PAS le traitement de l'email.
  let coherenceActions: ActionProposal[] = [];
  try {
    coherenceActions = await buildCoherenceActions(detail, triage);
  } catch (err) {
    console.warn(
      `[email-ingest] buildCoherenceActions échoué pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // S24 — voie hot-context inline SUPPRIMÉE : plus de carte `hotcontext:` depuis
  // l'email. Le hot-context « vit seul » via la revue autonome (soir + hebdo).
  // Toutes les actions (handler + cohérence).
  const allActions = [...handlerActions, ...coherenceActions];

  // Séparer la proposition de création de contact (no-match) : c'est la SEULE
  // interaction Telegram conservée (S23). Tout le reste est documentation auto.
  const noMatchAction = allActions.find((a) => a.type === 'prompt_create_contact_choice');
  // copy_attachment nécessitait une validation Thomas (carte supprimée S23) et
  // une résolution de sous-dossier — hors périmètre de la documentation auto
  // append-only. Exclu pour éviter un échec/log trompeur à chaque PJ. À traiter
  // séparément (build #2 / réintégration dédiée).
  const docActions = allActions.filter(
    (a) => a.type !== 'prompt_create_contact_choice' && a.type !== 'copy_attachment',
  );

  // (a) DOCUMENTATION — silencieuse, automatique, que l'email soit répondu ou non.
  // S23 : plus de carte de validation. Les actions de documentation (historique
  // contact/projet, dépôt A classifier) sont append-only / faible risque →
  // exécutées directement, qu'elles soient marquées autoExecute ou non.
  const isSystemEmailAction = docActions.some(
    (a) =>
      a.type === 'mark_processed' &&
      (a.payload as Record<string, unknown>)['reason'] === 'system-email',
  );

  if (docActions.length > 0) {
    await executeAutoActions(source, docActions, detail, triage, isSystemEmailAction);
  }

  // Email système (noreply@, contact@…) : marqué traité, aucun brouillon, aucune carte.
  if (isSystemEmailAction) {
    stats.autoExecuted++;
    stats.systemEmailsFiltered++;
    return;
  }

  // (b) DÉTECTION « déjà répondu » — si Thomas a déjà répondu dans le fil, on
  // documente (déjà fait ci-dessus) mais on ne prépare PAS de brouillon.
  let alreadyReplied = false;
  try {
    alreadyReplied = await source.hasReplyFromMe(detail);
  } catch (err) {
    // Fail-open : en cas de doute on tente le brouillon (mieux qu'un email orphelin).
    console.warn(
      `[email-ingest] hasReplyFromMe échoué pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // (b2) GARDE « destinataire direct » (S24) — si Thomas est seulement en copie
  // (Cc) et que l'email s'adresse à quelqu'un d'autre, pas de BROUILLON. La garde
  // ne touche QUE le brouillon de réponse : la mise à jour des fiches projet/
  // contact + historique + todo est faite plus haut (docActions/handlers), donc
  // elle a TOUJOURS lieu selon le contenu, copie ou pas. Fail-open si on ne
  // résout pas l'adresse propriétaire.
  let directlyAddressed = true;
  try {
    const selfAddresses = await source.getSelfAddresses();
    const check = isDirectlyAddressed(selfAddresses, detail.to, detail.cc);
    directlyAddressed = check.addressed;
    if (!directlyAddressed) {
      console.warn(
        `[email-ingest] ${messageId} : ${check.reason} — pas de brouillon (documentation/todo conservés)`,
      );
    }
  } catch (err) {
    console.warn(
      `[email-ingest] getSelfAddresses échoué pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // (c) BROUILLON — seulement si pas déjà répondu ET Thomas destinataire direct.
  // Création silencieuse, rattachée au fil (threadId + In-Reply-To via
  // draft-composer). Aucune carte, aucune notif.
  if (alreadyReplied) {
    stats.draftsSkippedAlreadyReplied++;
    console.warn(
      `[email-ingest] ${messageId} : Thomas a déjà répondu dans le fil — pas de brouillon`,
    );
  } else if (!directlyAddressed) {
    stats.draftsSkippedNotAddressed++;
  } else {
    try {
      const draftResult = await composeDraft(detail, triage, source.createReplyDraft);
      if (draftResult.success) {
        stats.draftsCreated++;
      } else if (draftResult.skipReason) {
        stats.draftsSkipped++;
      } else {
        stats.draftsFailed++;
        console.warn(
          `[email-ingest] draft échoué pour ${messageId} : ${draftResult.error ?? 'erreur inconnue'}`,
        );
      }
    } catch (err) {
      stats.draftsFailed++;
      console.warn(
        `[email-ingest] erreur inattendue draft pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // (d) CONTACT INCONNU → carte de création de contact (la SEULE carte conservée).
  if (noMatchAction) {
    const noMatch: NoMatchPending = {
      id: randomUUID(),
      // Plus de pending de validation parent : la carte no-match est autonome.
      parentPendingId: noMatchAction.payload['emailMessageId'] as string,
      emailFrom: noMatchAction.payload['emailFrom'] as string,
      nameFrom: (noMatchAction.payload['nameFrom'] as string | null) ?? null,
      defaultType: (noMatchAction.payload['defaultType'] as NoMatchPending['defaultType']) ?? 'autres',
      emailMessageId: noMatchAction.payload['emailMessageId'] as string,
      emailThreadRef: noMatchAction.payload['emailThreadRef'] as string,
      createdAt: new Date().toISOString(),
    };

    await saveNoMatch(noMatch);

    try {
      const sent = await sendNoMatchCard(noMatch);
      stats.contactCardsSent++;
      // S24 soir — on persiste le message_id de la carte pour permettre à
      // Thomas d'ajouter du contexte en répondant au message Telegram AVANT
      // de cliquer un bouton (reply → pending.userContext → intégré dans la
      // fiche créée). Re-save = 1 PATCH Drive de plus, acceptable (~1/no-match).
      noMatch.cardMessageId = sent.messageId;
      await saveNoMatch(noMatch);
    } catch (err) {
      console.warn(
        `[email-ingest] erreur envoi carte no-match pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Créer une tâche TickTick pour les emails nécessitant une action.
  try {
    await createTickTickTaskForEmail(detail, triage);
  } catch (err) {
    // Non bloquant — la tâche TickTick est un bonus, pas un prérequis
    console.warn(
      `[email-ingest] erreur création tâche TickTick pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // CRITIQUE : marquer l'email traité maintenant qu'il est documenté + brouillonné.
  // Sans ça, un email « intéressant » (non-spam, non-système) n'était jamais marqué
  // → re-listé et re-traité à CHAQUE run (re-brouillon en boucle, backlog Outlook
  // jamais drainé, run qui sature le timeout). Le label/catégorie « Anya/traité »
  // est le marqueur de traitement d'Anya (≠ statut lu/non-lu côté Thomas).
  try {
    await source.markProcessed(messageId);
  } catch (err) {
    console.warn(
      `[email-ingest] markProcessed final échoué pour ${source.label} ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  stats.pendingCreated++;
}

// ============================================================
// Auto-execute (S18.5)
// ============================================================

/**
 * Exécute les actions auto-exécutables d'un email sans validation Telegram.
 *
 * Cas d'usage S18.5 :
 *   1. Contact existant : append_historique + update_frontmatter + mark_processed
 *      → fiche enrichie en silence, pas de carte Thomas
 *   2. Email système (noreply@, contact@) : uniquement mark_processed
 *      → email marqué traité, pas de carte
 *
 * Audit : chaque action écrit une ligne JSONL avec auto: true.
 * Erreur silencieuse : si une action échoue (ex: Drive 503), on log mais
 * on continue — le mark_processed final reste critique (sinon l'email
 * sera re-traité au prochain cycle).
 */
async function executeAutoActions(
  source: EmailSourceAdapter,
  actions: ActionProposal[],
  email: EmailMessage,
  triage: TriageResult,
  isSystemEmail: boolean,
): Promise<void> {
  const trigger = `email_ingest:auto:${email.id}`;

  for (const action of actions) {
    const result = await executeAutoAction(source, action, email, triage, trigger);

    await writeAuditLog({
      ts: new Date().toISOString(),
      op: 'classify_note',
      target: action.target ?? email.id,
      trigger: `email_ingest:auto:${action.type}`,
      payload: {
        auto: true,
        reason: isSystemEmail ? 'system-email' : 'contact-existing',
        actionType: action.type,
        emailId: email.id,
        from: email.from.email,
        subject: email.subject,
        category: triage.category,
        ok: result.ok,
        ...(result.error ? { error: result.error } : {}),
      },
      status: result.ok ? 'success' : 'error',
      ...(result.error ? { errorMessage: result.error } : {}),
    });

    if (!result.ok) {
      console.warn(
        `[email-ingest] auto-action ${action.type} échouée pour ${email.id} : ${result.error}`,
      );
    }
  }
}

/**
 * Exécute UNE action auto en appelant le vault-client directement.
 *
 * Dupliqué léger du callback-handler.executeAction car ici on a un
 * EmailMessage direct (pas de PendingValidation). Garder la duplication
 * volontairement (3 cases utilisés sur 7) pour éviter un refactor de
 * callback-handler qui touche le critical path validation Telegram.
 */
async function executeAutoAction(
  source: EmailSourceAdapter,
  action: ActionProposal,
  email: EmailMessage,
  triage: TriageResult,
  trigger: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'append_historique': {
        if (!action.target) {
          return { ok: false, error: 'target manquant pour append_historique' };
        }
        const lastSlash = action.target.lastIndexOf('/');
        if (lastSlash === -1) {
          return { ok: false, error: `target invalide : ${action.target}` };
        }
        const folderPath = action.target.slice(0, lastSlash);
        const filename = action.target.slice(lastSlash + 1);

        const title =
          (action.payload['title'] as string) ??
          `${new Date().toISOString().slice(0, 10)} — Email traité`;
        const content = (action.payload['content'] as string) ?? triage.summary;

        const success = await appendToHistorique(folderPath, filename, {
          title,
          content,
          trigger,
          updateLastInteraction:
            (action.payload['updateLastInteraction'] as boolean) ?? true,
        });
        return success
          ? { ok: true }
          : { ok: false, error: 'appendToHistorique échoué' };
      }

      case 'update_frontmatter': {
        if (!action.target) {
          return { ok: false, error: 'target manquant pour update_frontmatter' };
        }
        const lastSlash = action.target.lastIndexOf('/');
        if (lastSlash === -1) {
          return { ok: false, error: `target invalide : ${action.target}` };
        }
        const folderPath = action.target.slice(0, lastSlash);
        const filename = action.target.slice(lastSlash + 1);

        // Le handler contact-pro passe le payload directement (pas dans .fields)
        // Construire le mapping fields à partir du payload (hors meta keys)
        const fields: Record<string, string | number | boolean | null> = {};
        for (const [key, value] of Object.entries(action.payload)) {
          if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            value === null
          ) {
            fields[key] = value;
          }
        }

        const success = await updateFrontmatter({
          folderPath,
          filename,
          fields,
          trigger,
        });
        return success
          ? { ok: true }
          : { ok: false, error: 'updateFrontmatter échoué' };
      }

      case 'create_file':
      case 'create_bien_stub': {
        if (!action.target) {
          return { ok: false, error: `target manquant pour ${action.type}` };
        }
        const lastSlash = action.target.lastIndexOf('/');
        if (lastSlash === -1) {
          return { ok: false, error: `target invalide : ${action.target}` };
        }
        const folderPath = action.target.slice(0, lastSlash);
        const filename = action.target.slice(lastSlash + 1);
        const content = (action.payload['content'] as string) ?? '';

        const success = await createVaultFile(folderPath, filename, content, trigger);
        return success
          ? { ok: true }
          : { ok: false, error: `createVaultFile échoué pour ${action.target}` };
      }

      case 'add_todo': {
        // S24 P2 : route vers TickTick (hub unique) au lieu de Todo.md miroir
        // (qui est écrasé au prochain render → tâche perdue). Les producteurs
        // (locataire/apporteur) écrivent `task`+`priority` (P1/P2) ; on lit
        // `task` en priorité, fallback `title`, fallback résumé triage.
        const title =
          (action.payload['task'] as string) ??
          (action.payload['title'] as string) ??
          triage.summary;
        const date = (action.payload['date'] as string) ?? undefined;
        const description =
          (action.payload['description'] as string) ?? undefined;

        const result = await addTaskToTickTick({
          title,
          date,
          description,
          priority: mapTodoPriority(action.payload['priority']),
        });
        return result.status === 'error'
          ? { ok: false, error: result.error ?? 'addTaskToTickTick échoué' }
          : { ok: true };
      }

      case 'mark_processed': {
        const success = await source.markProcessed(email.id);
        return success ? { ok: true } : { ok: false, error: 'markProcessed échoué' };
      }

      // S23 — historique projet (silencieux). Réutilise la résolution fiche
      // (findProjetFicheByEntite) + appendToHistorique PATCH in-place (R5) via
      // le helper projet-enricher.
      case 'append_projet_historique': {
        const code = action.payload['projetCode'] as string | undefined;
        if (!code) {
          return { ok: false, error: 'projetCode manquant pour append_projet_historique' };
        }
        const res = await appendProjetHistoriqueLine(code, {
          title: action.payload['title'] as string,
          content: action.payload['content'] as string,
          trigger: `email_ingest:auto:${email.id}`,
        });
        return res.status === 'enriched'
          ? { ok: true }
          : res.status === 'no-fiche'
            ? { ok: true } // fiche absente = skip silencieux, pas une erreur
            : { ok: false, error: res.error ?? 'append_projet_historique échoué' };
      }

      case 'skip': {
        return { ok: true };
      }

      default: {
        return { ok: false, error: `type d'action inconnu (auto) : ${action.type}` };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
