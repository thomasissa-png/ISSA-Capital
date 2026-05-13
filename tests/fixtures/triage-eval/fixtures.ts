/**
 * 20 email fixtures anonymisés pour l'évaluation du triage Haiku.
 *
 * Chaque fixture : email normalisé + verdict attendu (catégorie + intent).
 * Utilisé par triage-eval.test.ts pour calculer la matrice de confusion.
 *
 * Anonymisation : noms réels remplacés par des pseudonymes.
 * Les patterns email (domaines, formulations) sont réalistes.
 */

import type { EmailMessage } from '@/lib/secretariat/gmail-source/types';
import type { KnownContact, TriageCategory } from '@/lib/secretariat/triage/types';

export interface TriageFixture {
  id: string;
  email: EmailMessage;
  expectedCategory: TriageCategory;
  expectedIntent: string;
  description: string;
}

// ============================================================
// Contacts connus (injectés dans le contexte)
// ============================================================

export const KNOWN_CONTACTS: KnownContact[] = [
  { name: 'Kenan Beguigneau', email: 'kbeguigneau@gmail.com', type: 'locataire' },
  { name: 'Hella Taoutaou', email: 'hella.taoutaou@gmail.com', type: 'locataire' },
  { name: 'Ahmed Benali', email: 'ahmed.benali@outlook.fr', type: 'locataire' },
  { name: 'Martin Yhuel', email: 'martin.yhuel@avocats-paris.law', type: 'pro' },
  { name: 'Carl Dubois', email: 'carl.dubois@notaires-nanterre.fr', type: 'pro' },
  { name: 'Maxime Renard', email: 'maxime@expert-comptable.fr', type: 'pro' },
  { name: 'Mathias Dubot', email: 'mathias.dubot@agence-immo.fr', type: 'pro' },
];

// ============================================================
// Helper
// ============================================================

function makeEmail(
  overrides: Partial<EmailMessage> & { from: EmailMessage['from'] },
): EmailMessage {
  return {
    source: 'gmail',
    id: `msg-${Math.random().toString(36).slice(2, 10)}`,
    to: [{ email: 'thomas.issa@gmail.com' }],
    cc: [],
    subject: '(sans objet)',
    bodyPlain: '',
    receivedAt: new Date('2026-05-12T10:00:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/test',
    ...overrides,
  };
}

// ============================================================
// 20 fixtures
// ============================================================

export const TRIAGE_FIXTURES: TriageFixture[] = [
  // --- LOCATAIRE (5 fixtures) ---
  {
    id: 'loc-01',
    description: 'Locataire connu demande quittance',
    expectedCategory: 'locataire',
    expectedIntent: 'demande_quittance',
    email: makeEmail({
      from: { email: 'kbeguigneau@gmail.com', name: 'Kenan Beguigneau' },
      subject: 'Quittance avril',
      bodyPlain: 'Bonjour Thomas, pourriez-vous m\'envoyer la quittance d\'avril ? Merci, Kenan',
    }),
  },
  {
    id: 'loc-02',
    description: 'Locataire signale une fuite',
    expectedCategory: 'locataire',
    expectedIntent: 'signalement_incident',
    email: makeEmail({
      from: { email: 'hella.taoutaou@gmail.com', name: 'Hella Taoutaou' },
      subject: 'Fuite dans la salle de bain',
      bodyPlain: 'Bonjour, j\'ai une fuite sous le lavabo de la salle de bain. L\'eau coule depuis ce matin. Pourriez-vous envoyer un plombier ? Merci, Hella',
    }),
  },
  {
    id: 'loc-03',
    description: 'Locataire confirme virement loyer',
    expectedCategory: 'locataire',
    expectedIntent: 'confirmation_paiement',
    email: makeEmail({
      from: { email: 'ahmed.benali@outlook.fr', name: 'Ahmed Benali' },
      subject: 'Virement loyer mai',
      bodyPlain: 'Bonjour, je vous confirme que le virement pour le loyer de mai a été effectué ce matin. Cordialement, Ahmed',
    }),
  },
  {
    id: 'loc-04',
    description: 'Locataire pose question sur les charges',
    expectedCategory: 'locataire',
    expectedIntent: 'question_charges',
    email: makeEmail({
      from: { email: 'kbeguigneau@gmail.com', name: 'Kenan Beguigneau' },
      subject: 'Re: Charges annuelles',
      bodyPlain: 'Bonjour, j\'aurais aimé savoir comment sont calculées les charges annuelles. Le montant m\'a semblé plus élevé que l\'année dernière. Merci, Kenan',
    }),
  },
  {
    id: 'loc-05',
    description: 'Locataire demande état des lieux sortie',
    expectedCategory: 'locataire',
    expectedIntent: 'demande_edl_sortie',
    email: makeEmail({
      from: { email: 'hella.taoutaou@gmail.com', name: 'Hella Taoutaou' },
      subject: 'Départ fin juillet',
      bodyPlain: 'Bonjour Thomas, je souhaiterais planifier l\'état des lieux de sortie. Mon bail se termine fin juillet. Quand pourriez-vous passer ? Merci, Hella',
    }),
  },

  // --- CANDIDAT (3 fixtures) ---
  {
    id: 'cand-01',
    description: 'Candidature spontanée logement',
    expectedCategory: 'candidat',
    expectedIntent: 'candidature_logement',
    email: makeEmail({
      from: { email: 'sophie.martin@gmail.com', name: 'Sophie Martin' },
      subject: 'Recherche appartement Nanterre',
      bodyPlain: 'Bonjour, je cherche un appartement 2 pièces à Nanterre pour septembre 2026. Mon budget est de 900 EUR/mois. Je suis en CDI (revenu net 2800 EUR). Pouvez-vous me recontacter ? Cordialement, Sophie Martin',
    }),
  },
  {
    id: 'cand-02',
    description: 'Demande de visite suite annonce',
    expectedCategory: 'candidat',
    expectedIntent: 'demande_visite',
    email: makeEmail({
      from: { email: 'pierre.lefebvre@free.fr', name: 'Pierre Lefebvre' },
      subject: 'Annonce 3P Bd de la Seine',
      bodyPlain: 'Bonjour, j\'ai vu votre annonce pour le 3 pièces boulevard de la Seine. Serait-il possible de planifier une visite cette semaine ? Je suis disponible mercredi et vendredi. Merci, Pierre',
    }),
  },
  {
    id: 'cand-03',
    description: 'Envoi dossier locatif',
    expectedCategory: 'candidat',
    expectedIntent: 'envoi_dossier',
    email: makeEmail({
      from: { email: 'julie.chen@hotmail.com', name: 'Julie Chen' },
      subject: 'Mon dossier de candidature',
      bodyPlain: 'Bonjour, suite à notre échange téléphonique, je vous envoie mon dossier de candidature en pièce jointe. Cordialement, Julie Chen',
      attachments: [
        { name: 'dossier_candidature_chen.pdf', mimeType: 'application/pdf', sizeBytes: 2500000, id: 'att-01' },
      ],
    }),
  },

  // --- CONTACT-PRO (4 fixtures) ---
  {
    id: 'pro-01',
    description: 'Avocat envoie retour juridique',
    expectedCategory: 'contact-pro',
    expectedIntent: 'retour_juridique',
    email: makeEmail({
      from: { email: 'martin.yhuel@avocats-paris.law', name: 'Me Martin Yhuel' },
      subject: 'Re: Bail Beguigneau - observations',
      bodyPlain: 'Cher Thomas, j\'ai examiné le bail. Deux points à ajuster : la clause résolutoire au paragraphe 12 et l\'indexation IRL. Je vous prépare un memo détaillé. Cordialement, Martin Yhuel, Avocat au Barreau de Paris',
    }),
  },
  {
    id: 'pro-02',
    description: 'Notaire convocation signature',
    expectedCategory: 'contact-pro',
    expectedIntent: 'convocation_signature',
    email: makeEmail({
      from: { email: 'carl.dubois@notaires-nanterre.fr', name: 'Carl Dubois' },
      subject: 'Convocation - Signature acte Nanterre',
      bodyPlain: 'Monsieur Issa, nous avons le plaisir de vous convoquer pour la signature de l\'acte de vente le 20 mai 2026 à 15h00 en notre étude. Merci de confirmer votre présence. Me Carl Dubois',
    }),
  },
  {
    id: 'pro-03',
    description: 'Comptable envoie bilan',
    expectedCategory: 'contact-pro',
    expectedIntent: 'envoi_bilan',
    email: makeEmail({
      from: { email: 'maxime@expert-comptable.fr', name: 'Maxime Renard' },
      subject: 'Bilan ISSA Capital 2025',
      bodyPlain: 'Bonjour Thomas, veuillez trouver ci-joint le bilan annuel 2025 d\'ISSA Capital. Quelques points à discuter lors de notre prochain call. Cordialement, Maxime',
      attachments: [
        { name: 'bilan_issa_2025.pdf', mimeType: 'application/pdf', sizeBytes: 500000, id: 'att-02' },
      ],
    }),
  },
  {
    id: 'pro-04',
    description: 'Agent immo connu envoie estimation',
    expectedCategory: 'contact-pro',
    expectedIntent: 'estimation_bien',
    email: makeEmail({
      from: { email: 'mathias.dubot@agence-immo.fr', name: 'Mathias Dubot' },
      subject: 'Estimation lot 7 Rue Barbusse',
      bodyPlain: 'Thomas, suite à notre échange, j\'ai fait passer un expert pour le lot 7. L\'estimation est entre 180 000 et 195 000 EUR. On en discute quand tu veux. Mathias',
    }),
  },

  // --- APPORTEUR (2 fixtures) ---
  {
    id: 'app-01',
    description: 'Proposition bien off-market',
    expectedCategory: 'apporteur',
    expectedIntent: 'proposition_bien',
    email: makeEmail({
      from: { email: 'julien.moreau@gmail.com', name: 'Julien Moreau' },
      subject: 'Immeuble 12 lots Paris 18 - off market',
      bodyPlain: 'Bonjour Thomas, je me permets de vous contacter car j\'ai un immeuble de 12 lots dans le 18ème à vous proposer. Prix : 2,1 M EUR. Rendement brut estimé : 7,2%. Surface totale : 450 m2. Disponible immédiatement, pas encore sur le marché. Si intéressé, je peux vous envoyer le dossier complet. Cordialement, Julien Moreau',
    }),
  },
  {
    id: 'app-02',
    description: 'Opportunité investissement commerce',
    expectedCategory: 'apporteur',
    expectedIntent: 'proposition_bien',
    email: makeEmail({
      from: { email: 'nadia.traoré@immo-invest.fr', name: 'Nadia Traoré' },
      subject: 'Opportunité - Murs commerciaux Colombes',
      bodyPlain: 'Bonjour, nous avons actuellement un local commercial de 120 m2 à Colombes, bail 3/6/9 en cours, locataire solide (boulangerie depuis 8 ans). Prix demandé : 320 000 EUR, rendement net 6,8%. Je serais ravie d\'en discuter. Nadia Traoré, consultante immobilière',
    }),
  },

  // --- SPAM (4 fixtures) ---
  {
    id: 'spam-01',
    description: 'Newsletter Stripe',
    expectedCategory: 'spam',
    expectedIntent: 'newsletter',
    email: makeEmail({
      from: { email: 'noreply@newsletter.stripe.com', name: 'Stripe' },
      subject: 'Your monthly Stripe update - May 2026',
      bodyPlain: 'Here\'s what\'s new in Stripe this month. New features, updates, and improvements to help you grow your business.',
    }),
  },
  {
    id: 'spam-02',
    description: 'Cold outreach SaaS',
    expectedCategory: 'spam',
    expectedIntent: 'cold_outreach',
    email: makeEmail({
      from: { email: 'sales@crm-solution.io', name: 'CRM Solution' },
      subject: 'Boostez votre productivité avec notre CRM',
      bodyPlain: 'Bonjour Thomas, je suis Pierre de CRM Solution. Notre outil révolutionne la gestion immobilière. 14 jours d\'essai gratuit ! Cliquez ici pour commencer.',
    }),
  },
  {
    id: 'spam-03',
    description: 'Notification LinkedIn',
    expectedCategory: 'spam',
    expectedIntent: 'notification_service',
    email: makeEmail({
      from: { email: 'notifications-noreply@linkedin.com', name: 'LinkedIn' },
      subject: '3 personnes ont consulté votre profil',
      bodyPlain: '3 personnes ont consulté votre profil LinkedIn cette semaine. Découvrez qui s\'intéresse à vous.',
    }),
  },
  {
    id: 'spam-04',
    description: 'Email marketing immobilier générique',
    expectedCategory: 'spam',
    expectedIntent: 'newsletter',
    email: makeEmail({
      from: { email: 'marketing@immobilier-news.fr', name: 'Immobilier News' },
      subject: 'Les tendances immobilières mai 2026',
      bodyPlain: 'Chaque mois, retrouvez notre analyse des marchés immobiliers en Île-de-France. Ce mois-ci : la hausse des taux se confirme. Cliquez pour lire notre étude complète.',
    }),
  },

  // --- A-CLASSIFIER (2 fixtures) ---
  {
    id: 'class-01',
    description: 'Email ambigu expéditeur inconnu',
    expectedCategory: 'a-classifier',
    expectedIntent: 'demande_contact_vague',
    email: makeEmail({
      from: { email: 'jean.martin@gmail.com', name: 'Jean Martin' },
      subject: 'Question',
      bodyPlain: 'Bonjour, j\'aurais une question à vous poser. Pouvez-vous me rappeler ? Cordialement, Jean Martin',
    }),
  },
  {
    id: 'class-02',
    description: 'Email court sans contexte',
    expectedCategory: 'a-classifier',
    expectedIntent: 'message_court_ambigu',
    email: makeEmail({
      from: { email: 'contact@unknown-company.com', name: 'Unknown' },
      subject: 'Suite à notre discussion',
      bodyPlain: 'Bonjour, comme convenu.',
    }),
  },
];
