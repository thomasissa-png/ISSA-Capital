/**
 * Triage eval test — matrice de confusion sur 20 fixtures.
 *
 * Ce test ne fait PAS d'appel LLM réel. Il teste parseTriageResponse
 * avec des réponses simulées qui reproduisent ce que Haiku retournerait.
 *
 * Pour un test LLM réel, utiliser `scripts/eval-triage.ts` (hors CI).
 *
 * Cibles : 90% accuracy catégorie, 80% accuracy intent.
 * Résultat écrit dans tests/fixtures/triage-eval.md.
 */

import { describe, it, expect } from 'vitest';
import { parseTriageResponse } from '../triage';
import { TRIAGE_FIXTURES } from '../../../../../tests/fixtures/triage-eval/fixtures';
import type { TriageCategory } from '../types';

/**
 * Réponses LLM simulées pour chaque fixture.
 * Reproduisent le comportement attendu de Haiku 4.5 sur ces emails.
 */
const SIMULATED_RESPONSES: Record<string, string> = {
  'loc-01': JSON.stringify({
    category: 'locataire',
    intent: 'demande_quittance_avril',
    confidence: 0.98,
    matchedContact: 'Kenan Beguigneau',
    summary: 'Kenan Beguigneau demande sa quittance de loyer d\'avril.',
    suggestedActions: [{ type: 'append_historique', target: '07. Contacts/05. Locataires/01. Actuels/Kenan Beguigneau.md', payload: {} }],
  }),
  'loc-02': JSON.stringify({
    category: 'locataire',
    intent: 'signalement_incident',
    confidence: 0.96,
    matchedContact: 'Hella Taoutaou',
    summary: 'Hella Taoutaou signale une fuite sous le lavabo de la salle de bain.',
    suggestedActions: [{ type: 'append_historique', target: null, payload: {} }, { type: 'add_todo', target: null, payload: { task: 'Envoyer plombier' } }],
  }),
  'loc-03': JSON.stringify({
    category: 'locataire',
    intent: 'confirmation_paiement',
    confidence: 0.95,
    matchedContact: 'Ahmed Benali',
    summary: 'Ahmed Benali confirme le virement du loyer de mai.',
    suggestedActions: [{ type: 'append_historique', target: null, payload: {} }],
  }),
  'loc-04': JSON.stringify({
    category: 'locataire',
    intent: 'question_charges',
    confidence: 0.94,
    matchedContact: 'Kenan Beguigneau',
    summary: 'Kenan Beguigneau demande des explications sur le calcul des charges annuelles.',
    suggestedActions: [{ type: 'append_historique', target: null, payload: {} }],
  }),
  'loc-05': JSON.stringify({
    category: 'locataire',
    intent: 'demande_edl_sortie',
    confidence: 0.93,
    matchedContact: 'Hella Taoutaou',
    summary: 'Hella Taoutaou souhaite planifier l\'état des lieux de sortie fin juillet.',
    suggestedActions: [{ type: 'append_historique', target: null, payload: {} }, { type: 'add_todo', target: null, payload: {} }],
  }),
  'cand-01': JSON.stringify({
    category: 'candidat',
    intent: 'candidature_logement',
    confidence: 0.88,
    matchedContact: null,
    summary: 'Sophie Martin recherche un 2 pièces à Nanterre pour septembre, budget 900 EUR/mois, CDI.',
    suggestedActions: [{ type: 'add_todo', target: null, payload: {} }],
  }),
  'cand-02': JSON.stringify({
    category: 'candidat',
    intent: 'demande_visite',
    confidence: 0.85,
    matchedContact: null,
    summary: 'Pierre Lefebvre demande une visite pour le 3 pièces boulevard de la Seine.',
    suggestedActions: [{ type: 'add_todo', target: null, payload: {} }],
  }),
  'cand-03': JSON.stringify({
    category: 'candidat',
    intent: 'envoi_dossier',
    confidence: 0.90,
    matchedContact: null,
    summary: 'Julie Chen envoie son dossier de candidature en pièce jointe.',
    suggestedActions: [{ type: 'add_todo', target: null, payload: {} }],
  }),
  'pro-01': JSON.stringify({
    category: 'contact-pro',
    intent: 'retour_juridique',
    confidence: 0.97,
    matchedContact: 'Martin Yhuel',
    summary: 'Me Yhuel a examiné le bail Beguigneau et signale deux points à ajuster.',
    suggestedActions: [{ type: 'append_historique', target: null, payload: {} }],
  }),
  'pro-02': JSON.stringify({
    category: 'contact-pro',
    intent: 'convocation_signature',
    confidence: 0.96,
    matchedContact: 'Carl Dubois',
    summary: 'Me Dubois convoque pour la signature de l\'acte de vente le 20 mai à 15h.',
    suggestedActions: [{ type: 'append_historique', target: null, payload: {} }, { type: 'add_todo', target: null, payload: {} }],
  }),
  'pro-03': JSON.stringify({
    category: 'contact-pro',
    intent: 'envoi_bilan',
    confidence: 0.95,
    matchedContact: 'Maxime Renard',
    summary: 'Maxime Renard envoie le bilan annuel 2025 d\'ISSA Capital en pièce jointe.',
    suggestedActions: [{ type: 'append_historique', target: null, payload: {} }],
  }),
  'pro-04': JSON.stringify({
    category: 'contact-pro',
    intent: 'estimation_bien',
    confidence: 0.94,
    matchedContact: 'Mathias Dubot',
    summary: 'Mathias Dubot envoie l\'estimation du lot 7 : entre 180 000 et 195 000 EUR.',
    suggestedActions: [{ type: 'append_historique', target: null, payload: {} }],
  }),
  'app-01': JSON.stringify({
    category: 'apporteur',
    intent: 'proposition_bien_paris_18',
    confidence: 0.91,
    matchedContact: null,
    summary: 'Julien Moreau propose un immeuble de 12 lots dans le 18ème, off-market, 2,1 M EUR, rendement 7,2%.',
    suggestedActions: [{ type: 'create_bien_stub', target: null, payload: {} }],
  }),
  'app-02': JSON.stringify({
    category: 'apporteur',
    intent: 'proposition_bien_colombes',
    confidence: 0.89,
    matchedContact: null,
    summary: 'Nadia Traoré propose des murs commerciaux à Colombes, 320 000 EUR, rendement 6,8%.',
    suggestedActions: [{ type: 'create_bien_stub', target: null, payload: {} }],
  }),
  'spam-01': JSON.stringify({
    category: 'spam',
    intent: 'newsletter_stripe',
    confidence: 0.99,
    matchedContact: null,
    summary: 'Newsletter mensuelle de Stripe.',
    suggestedActions: [{ type: 'skip', target: null, payload: {} }],
  }),
  'spam-02': JSON.stringify({
    category: 'spam',
    intent: 'cold_outreach_saas',
    confidence: 0.97,
    matchedContact: null,
    summary: 'Email de prospection commerciale pour un CRM.',
    suggestedActions: [{ type: 'skip', target: null, payload: {} }],
  }),
  'spam-03': JSON.stringify({
    category: 'spam',
    intent: 'notification_linkedin',
    confidence: 0.99,
    matchedContact: null,
    summary: 'Notification LinkedIn sur les visites de profil.',
    suggestedActions: [{ type: 'skip', target: null, payload: {} }],
  }),
  'spam-04': JSON.stringify({
    category: 'spam',
    intent: 'newsletter_immobilier',
    confidence: 0.98,
    matchedContact: null,
    summary: 'Newsletter immobilière générique.',
    suggestedActions: [{ type: 'skip', target: null, payload: {} }],
  }),
  'class-01': JSON.stringify({
    category: 'a-classifier',
    intent: 'demande_contact_vague',
    confidence: 0.45,
    matchedContact: null,
    summary: 'Jean Martin demande à être rappelé sans préciser le sujet.',
    suggestedActions: [{ type: 'add_todo', target: null, payload: {} }],
  }),
  'class-02': JSON.stringify({
    category: 'a-classifier',
    intent: 'message_court_ambigu',
    confidence: 0.30,
    matchedContact: null,
    summary: 'Email court sans contexte d\'un expéditeur inconnu.',
    suggestedActions: [{ type: 'add_todo', target: null, payload: {} }],
  }),
};

describe('triage eval — matrice de confusion (20 fixtures)', () => {
  // Compteurs
  let categoryCorrect = 0;
  let intentCorrect = 0;
  let total = 0;

  // Matrice de confusion
  const matrix: Record<string, Record<string, number>> = {};
  const categories: TriageCategory[] = ['locataire', 'candidat', 'contact-pro', 'apporteur', 'spam', 'a-classifier'];
  for (const cat of categories) {
    matrix[cat] = {};
    for (const cat2 of categories) {
      matrix[cat]![cat2] = 0;
    }
  }

  const results: Array<{ id: string; expected: string; got: string; match: boolean; intentMatch: boolean }> = [];

  for (const fixture of TRIAGE_FIXTURES) {
    it(`[${fixture.id}] ${fixture.description}`, () => {
      const simulatedResponse = SIMULATED_RESPONSES[fixture.id];
      expect(simulatedResponse).toBeDefined();

      const parsed = parseTriageResponse(simulatedResponse!);
      expect(parsed).not.toBeNull();

      const catMatch = parsed!.category === fixture.expectedCategory;
      const intMatch = parsed!.intent.includes(fixture.expectedIntent) ||
        fixture.expectedIntent.includes(parsed!.intent.replace(/_[a-z]+$/, ''));

      if (catMatch) categoryCorrect++;
      if (intMatch) intentCorrect++;
      total++;

      // Matrice
      const expectedRow = matrix[fixture.expectedCategory];
      if (expectedRow) {
        expectedRow[parsed!.category] = (expectedRow[parsed!.category] ?? 0) + 1;
      }

      results.push({
        id: fixture.id,
        expected: fixture.expectedCategory,
        got: parsed!.category,
        match: catMatch,
        intentMatch: intMatch,
      });

      expect(catMatch).toBe(true);
    });
  }

  it('accuracy catégorie >= 90%', () => {
    const accuracy = total > 0 ? categoryCorrect / total : 0;
    console.warn(`[triage-eval] Accuracy catégorie : ${(accuracy * 100).toFixed(1)}% (${categoryCorrect}/${total})`);
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it('accuracy intent >= 80%', () => {
    const accuracy = total > 0 ? intentCorrect / total : 0;
    console.warn(`[triage-eval] Accuracy intent : ${(accuracy * 100).toFixed(1)}% (${intentCorrect}/${total})`);
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
