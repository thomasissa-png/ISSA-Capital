/**
 * Types pour la source Gmail — email-ingest Anya.
 *
 * EmailMessage est le type normalisé utilisé par le triage et les handlers.
 * Déclaré ici pour être importé par gmail-source.ts et triage.ts.
 */

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** attachmentId Gmail (pour téléchargement ultérieur) */
  id: string;
}

/**
 * Format normalisé d'un email, quel que soit la source (Gmail/Outlook).
 * Spec: second-cerveau/Anya - Plan email-ingest.md section 2 couche 1.
 */
export interface EmailMessage {
  source: 'gmail' | 'outlook';
  /** Message ID Gmail (users.messages.get) */
  id: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  /** Corps texte brut (HTML strippé) */
  bodyPlain: string;
  receivedAt: Date;
  attachments: EmailAttachment[];
  /** Lien direct vers le message dans Gmail web (pour audit) */
  rawRef: string;
}
