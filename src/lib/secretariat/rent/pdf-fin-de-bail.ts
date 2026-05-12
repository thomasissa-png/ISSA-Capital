/**
 * Génération PDF d'une attestation de fin de bail.
 *
 * Port fidèle du Python generer_fin_de_bail.py :
 *   - En-tête bailleur (nom, adresse, CP ville)
 *   - Objet : "Fin de bail"
 *   - Lieu et date d'émission
 *   - Corps : attestation sur l'honneur que le locataire n'est plus locataire
 *   - Formule de politesse
 *   - Signature image (si disponible)
 *   - Nom bailleur
 *
 * Produit uniquement un PDF (pas de DOCX — l'attestation est un document
 * simple, contrairement au bail qui nécessite un DOCX modifiable).
 */

import PDFDocument from 'pdfkit';
import type { FinDeBailVariables } from './types';
import { formatDateFr } from './dates-fr';

// ============================================================
// Constantes
// ============================================================

const FONT_SIZE_NORMAL = 11;
const FONT_SIZE_BOLD = 11;
const LINE_HEIGHT = 1.4;
const MARGIN_LEFT = 72; // ~2.5 cm
const MARGIN_RIGHT = 72;
const MARGIN_TOP = 72;
const MARGIN_BOTTOM = 72;

// ============================================================
// Helpers
// ============================================================

/**
 * Formate une date en français long : "1er mai 2026" ou "15 janvier 2025".
 */
function dateFrLong(date: Date): string {
  const jour = date.getDate();
  const mois = [
    '', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  const jourStr = jour === 1 ? '1er' : String(jour);
  return `${jourStr} ${mois[date.getMonth() + 1]} ${date.getFullYear()}`;
}

// ============================================================
// Génération PDF
// ============================================================

/**
 * Génère le PDF de l'attestation de fin de bail.
 *
 * @param vars Variables résolues pour le rendu
 * @returns Buffer PDF
 */
export async function genererFinDeBailPdf(vars: FinDeBailVariables): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: MARGIN_TOP,
          bottom: MARGIN_BOTTOM,
          left: MARGIN_LEFT,
          right: MARGIN_RIGHT,
        },
        info: {
          Title: `Attestation fin de bail — ${vars.locataireNom}`,
          Author: vars.bailleurNom,
          Subject: 'Fin de bail',
          Creator: 'ISSA Capital — Anya',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const pageWidth = doc.page.width - MARGIN_LEFT - MARGIN_RIGHT;

      // ── En-tête bailleur ──────────────────────────────
      doc
        .font('Helvetica-Bold')
        .fontSize(FONT_SIZE_BOLD)
        .text(vars.bailleurNom, { lineGap: 2 });

      doc
        .font('Helvetica')
        .fontSize(FONT_SIZE_NORMAL)
        .text(vars.bailleurAdresse, { lineGap: 2 })
        .text(vars.bailleurCpVille, { lineGap: 2 });

      doc.moveDown(2);

      // ── Objet ──────────────────────────────
      doc
        .font('Helvetica-Bold')
        .text('Objet : ', { continued: true })
        .font('Helvetica')
        .text('Fin de bail');

      doc.moveDown(1);

      // ── Lieu et date ──────────────────────────────
      doc.text(
        `Fait à ${vars.lieuSignature}, le ${formatDateFr(vars.dateEmission)},`,
      );

      doc.moveDown(1);

      // ── Destinataire ──────────────────────────────
      doc.text('À qui de droit,');

      doc.moveDown(1);

      // ── Corps de l'attestation ──────────────────────────────
      const corps =
        `Je, soussigné ${vars.bailleurNom}, né le ` +
        `${dateFrLong(new Date(vars.bailleurDateNaissance))} à ${vars.bailleurLieuNaissance}, ` +
        `propriétaire du logement situé au ${vars.adresseBien}, ` +
        `certifie sur l'honneur que ${vars.locataireNom} n'est plus locataire ` +
        `depuis le ${dateFrLong(vars.dateFin)}.`;

      doc.text(corps, {
        width: pageWidth,
        lineGap: FONT_SIZE_NORMAL * (LINE_HEIGHT - 1),
        align: 'justify',
      });

      doc.moveDown(1);

      // ── Formule de politesse ──────────────────────────────
      doc.text('Très cordialement,');

      doc.moveDown(2);

      // ── Signature image (si disponible) ──────────────────────────────
      if (vars.signaturePngBase64) {
        try {
          const sigBuffer = Buffer.from(vars.signaturePngBase64, 'base64');
          const sigWidthPt = (vars.signatureLargeurMm / 25.4) * 72;
          doc.image(sigBuffer, { width: sigWidthPt });
          doc.moveDown(0.5);
        } catch (err) {
          console.warn(
            `[pdf-fin-de-bail] signature non insérée : ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // ── Nom bailleur sous signature ──────────────────────────────
      doc
        .font('Helvetica')
        .fontSize(FONT_SIZE_NORMAL)
        .text(vars.bailleurNom);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
