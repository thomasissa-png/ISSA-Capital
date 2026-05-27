/**
 * Coherence actions — actions de cohérence dérivées d'un email traité
 * (S23 — email-ingest cohérent).
 *
 * À partir d'un EmailMessage + TriageResult, produit les ActionProposal qui
 * découlent du traitement de l'email, SANS BRUIT :
 *   1. `append_projet_historique` — si triage.projet défini (match certain).
 *      autoExecute=true (silencieux, comme l'historique contact).
 *   2. `copy_attachment` — pour chaque PJ jugée pertinente par le triage ET
 *      rattachable à un sujet suivi (projet/contact). autoExecute=false (proposé).
 *   3. `update_hot_context` — si detectSignal trouve un signal sur le texte.
 *      autoExecute=false (carte hotcontext: existante, toujours validé).
 *
 * Ces actions sont AJOUTÉES aux actions des handlers par le runner, qui regroupe
 * tout dans UNE seule carte Telegram (anti-bruit). L'enrichissement historique
 * CONTACT et le brouillon réponse restent gérés ailleurs (inchangés).
 *
 * Injection de deps `_xxx` pour les tests (zéro réseau).
 */

import type { EmailMessage } from '../gmail-source/types';
import type { TriageResult } from '../triage/types';
import type { ActionProposal } from '../handlers/types';
import {
  resolveAttachmentDestination,
  selectAttachmentsToKeep,
  buildCopyAttachmentPayload,
} from './attachment-handler';
import {
  detectSignal as defaultDetectSignal,
  passesHeuristicPrefilter as defaultPrefilter,
} from '../hot-context/signal-detector';
import type { DetectSignalContext } from '../hot-context/signal-detector';
import type { DetectSignalResult, Signal } from '../hot-context/types';

// ============================================================
// Dépendances injectables (tests)
// ============================================================

export interface CoherenceDeps {
  resolveAttachmentDestination: typeof resolveAttachmentDestination;
  detectSignal: (signal: Signal, ctx?: DetectSignalContext) => Promise<DetectSignalResult>;
  passesHeuristicPrefilter: (signal: Signal) => boolean;
}

const defaultDeps: CoherenceDeps = {
  resolveAttachmentDestination,
  detectSignal: defaultDetectSignal,
  passesHeuristicPrefilter: defaultPrefilter,
};

// ============================================================
// Helpers
// ============================================================

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function senderLabel(email: EmailMessage): string {
  return email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email;
}

// ============================================================
// (c) Historique projet — autoExecute silencieux
// ============================================================

/**
 * Produit l'action `append_projet_historique` si un projet est clairement
 * détecté par le triage. Le target/folderPath réel est résolu à l'exécution
 * (via projet-enricher/findProjetFicheByEntite) — ici on transporte juste le
 * code entité + la ligne d'historique.
 */
export function buildProjetHistoriqueAction(
  email: EmailMessage,
  triage: TriageResult,
): ActionProposal | null {
  if (!triage.projet) return null;

  const date = todayIso();
  const title = `${date} — Email : ${email.subject} (de ${senderLabel(email)})`;

  return {
    type: 'append_projet_historique',
    target: null, // résolu à l'exécution via le code entité
    payload: {
      projetCode: triage.projet,
      title,
      content: triage.summary,
      emailId: email.id,
    },
    description: `Historique projet ${triage.projet} : « ${email.subject} »`,
    autoExecute: true, // silencieux (match unique certain)
  };
}

// ============================================================
// (d) Pièces jointes — proposé (validé)
// ============================================================

/**
 * Produit les actions `copy_attachment` pour les PJ jugées pertinentes par le
 * triage ET rattachables à un sujet suivi. Si aucun sujet suivi (ni projet ni
 * contact connu) → aucune action (pas de dépotoir, §6).
 */
export async function buildCopyAttachmentActions(
  email: EmailMessage,
  triage: TriageResult,
  deps: CoherenceDeps,
): Promise<ActionProposal[]> {
  const selected = selectAttachmentsToKeep(email.attachments, triage.attachments_to_keep);
  if (selected.length === 0) return [];

  const destination = await deps.resolveAttachmentDestination(triage.projet, email.from.email);
  if (!destination) {
    // PJ pertinentes mais aucun sujet suivi → on ne classe pas (§6).
    console.warn(
      `[coherence-actions] ${selected.length} PJ pertinente(s) mais aucun sujet suivi pour ${email.from.email} — pas de copie`,
    );
    return [];
  }

  return selected.map((att) => ({
    type: 'copy_attachment' as const,
    target: `${destination.baseFolderPath}/${destination.subfolder}/${att.name}`,
    payload: buildCopyAttachmentPayload(email, att, destination),
    description: `Copier « ${att.name} » → ${destination.label}/${destination.subfolder} (${destination.kind})`,
    autoExecute: false, // Thomas valide chaque classement (§6)
  }));
}

// ============================================================
// (e) Hot-context — proposé (carte hotcontext: dédiée)
// ============================================================

/**
 * Détecte un signal hot-context sur le texte de l'email et produit une action
 * `update_hot_context` transportant le Patch. Le runner route ces actions vers
 * la carte `hotcontext:` existante (PAS la carte email principale).
 *
 * Pré-filtre heuristique amont (économie d'appel LLM). Aucun signal → null.
 */
export async function buildHotContextAction(
  email: EmailMessage,
  deps: CoherenceDeps,
): Promise<ActionProposal | null> {
  const signal: Signal = {
    source: 'email',
    sourceId: email.id,
    contentExcerpt: `${email.subject}\n\n${email.bodyPlain}`.slice(0, 2000),
    contextMeta: {
      from: email.from.email,
      subject: email.subject,
      ts: email.receivedAt instanceof Date ? email.receivedAt.toISOString() : String(email.receivedAt),
    },
  };

  if (!deps.passesHeuristicPrefilter(signal)) return null;

  let result: DetectSignalResult;
  try {
    result = await deps.detectSignal(signal);
  } catch (err) {
    console.warn(
      `[coherence-actions] detectSignal échoué pour ${email.id} : ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }

  if (!result.patch) return null;

  return {
    type: 'update_hot_context',
    target: null,
    payload: {
      // Patch sérialisé — l'exécuteur le transmet à sendHotContextPatchCard.
      patch: result.patch as unknown as Record<string, unknown>,
      confidence: result.confidence,
    },
    description: `Hot-context : ${result.patch.section}/${result.patch.action}`,
    autoExecute: false, // toujours validé (modifie le briefing)
  };
}

// ============================================================
// API publique — agrégation
// ============================================================

/**
 * Construit toutes les actions de cohérence pour un email traité.
 *
 * @param email Email normalisé.
 * @param triage Résultat du triage (avec projet?/attachments_to_keep?).
 * @param deps Dépendances injectables (défaut : modules réels).
 * @returns Liste d'ActionProposal (peut être vide — aucun bruit si rien de
 *   pertinent).
 */
export async function buildCoherenceActions(
  email: EmailMessage,
  triage: TriageResult,
  deps: CoherenceDeps = defaultDeps,
): Promise<ActionProposal[]> {
  const actions: ActionProposal[] = [];

  // (c) Historique projet (silencieux)
  const projetAction = buildProjetHistoriqueAction(email, triage);
  if (projetAction) actions.push(projetAction);

  // (d) Pièces jointes (proposé)
  const attachmentActions = await buildCopyAttachmentActions(email, triage, deps);
  actions.push(...attachmentActions);

  // (e) Hot-context : SUPPRIMÉ S24. La voie inline (signal email → carte
  // `hotcontext:` à valider) est retirée — le hot-context « vit seul » via la
  // revue autonome du soir (Haiku) + hebdo (Sonnet). `buildHotContextAction`
  // reste exporté (tests) mais n'est plus branché ici.

  return actions;
}
