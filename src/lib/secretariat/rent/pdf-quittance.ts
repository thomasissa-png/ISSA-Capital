/**
 * Génération PDF de quittances de loyer — PDFKit.
 *
 * Port fidèle du Python generer_quittance.py (fpdf2).
 * Utilise PDFKit (déjà en dépendance pour les CR).
 *
 * Layout A4 :
 * - Numéro de quittance (petit gris, en haut à droite)
 * - Titre "QUITTANCE DE LOYER" (22pt bold)
 * - Sous-titre mois
 * - Deux colonnes : bailleur / adresse de location
 * - Texte juridique (justifié)
 * - Détail du règlement (table : Loyer, Charges, Total)
 * - Date/moyen de paiement
 * - Lieu/date d'émission + signature
 * - Mentions légales (petit gris)
 */

import PDFDocument from 'pdfkit';
import type { QuittanceVariables } from './types';

// ============================================================
// Constantes de mise en page (alignées sur le Python)
// ============================================================

const PAGE_MARGIN_LEFT = 62; // 22mm ≈ 62pt
const PAGE_MARGIN_RIGHT = 62;
const PAGE_MARGIN_TOP = 56; // 20mm ≈ 56pt
const PAGE_MARGIN_BOTTOM = 56;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN_LEFT - PAGE_MARGIN_RIGHT; // A4 width - margins

const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

// ============================================================
// Helpers
// ============================================================

/**
 * Formate un montant pour l'affichage : entier si pas de décimales.
 * Port du Python : int(v) if v.is_integer() else v
 */
function formatMontant(montant: number): string {
  return Number.isInteger(montant) ? String(montant) : montant.toFixed(2);
}

// ============================================================
// Fonction principale
// ============================================================

/**
 * Génère un PDF de quittance de loyer.
 *
 * @param variables Variables pré-calculées pour le rendu
 * @returns Buffer contenant le PDF complet
 */
export async function genererQuittancePdf(
  variables: QuittanceVariables,
): Promise<Buffer> {
  const v = variables;

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];

    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: PAGE_MARGIN_TOP,
        bottom: PAGE_MARGIN_BOTTOM,
        left: PAGE_MARGIN_LEFT,
        right: PAGE_MARGIN_RIGHT,
      },
      info: {
        Title: `Quittance de loyer — ${v.locataireNom} — ${v.periodeMoisAnnee}`,
        Author: v.bailleurNom,
        Subject: `Quittance de loyer ${v.periodeMoisAnnee}`,
        Keywords: `quittance, loyer, ${v.numeroQuittance}`,
        Creator: 'Secrétariat ISSA Capital',
      },
    });

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // --- Numéro de quittance (petit gris, en haut à droite) ---
    doc
      .font(FONT_REGULAR)
      .fontSize(8)
      .fillColor('#6e6e6e')
      .text(`N° ${v.numeroQuittance}`, PAGE_MARGIN_LEFT, PAGE_MARGIN_TOP, {
        width: CONTENT_WIDTH,
        align: 'right',
      });

    doc.fillColor('#000000');
    doc.y = PAGE_MARGIN_TOP + 8;

    // --- Titre ---
    doc
      .font(FONT_BOLD)
      .fontSize(22)
      .text('QUITTANCE DE LOYER', PAGE_MARGIN_LEFT, doc.y, {
        width: CONTENT_WIDTH,
      });

    doc.moveDown(0.4);

    // --- Mois ---
    const moisY = doc.y;
    doc
      .font(FONT_REGULAR)
      .fontSize(11)
      .text('Quittance de loyer du mois de : ', PAGE_MARGIN_LEFT, moisY, {
        continued: true,
        width: CONTENT_WIDTH,
      });
    doc
      .font(FONT_BOLD)
      .text(v.periodeMoisAnnee);

    doc.moveDown(1);

    // --- Deux colonnes : bailleur / adresse ---
    const colY = doc.y;
    const colW = 220; // ~80mm

    // Colonne gauche : Bailleur
    doc
      .font(FONT_BOLD)
      .fontSize(11)
      .text('Coordonnées du bailleur', PAGE_MARGIN_LEFT, colY);
    doc
      .font(FONT_REGULAR)
      .fontSize(11)
      .text(v.bailleurNom, PAGE_MARGIN_LEFT, colY + 16)
      .text(v.bailleurTelephone)
      .text(v.bailleurAdresse)
      .text(v.bailleurCpVille);

    // Colonne droite : Adresse de location
    const colRightX = PAGE_MARGIN_LEFT + 250;
    doc
      .font(FONT_BOLD)
      .fontSize(11)
      .text('Adresse de location', colRightX, colY, { width: colW });
    doc
      .font(FONT_REGULAR)
      .fontSize(11)
      .text(v.bienAdresseLigne1, colRightX, colY + 16, { width: colW })
      .text(v.bienAdresseLigne2, { width: colW })
      .text(v.bienCpVille, { width: colW });

    // Avancer après les colonnes (comme le Python : col_y + 30 + ln(6))
    doc.y = colY + 85 + 17;

    // --- Texte juridique ---
    doc
      .font(FONT_REGULAR)
      .fontSize(11);

    const texte =
      `Je, soussigné ${v.bailleurNom}, propriétaire du logement désigné ci-dessus, ` +
      `déclare avoir reçu de ${v.locataireNom}, la somme de ` +
      `${v.totalLettres} (${formatMontant(v.total)} €), au titre du paiement du loyer et des charges ` +
      `pour la période de location du ${v.periodeDebut} au ${v.periodeFin} ` +
      `et lui en donne quittance, sous réserve de tous mes droits.`;

    doc.text(texte, PAGE_MARGIN_LEFT, doc.y, {
      width: CONTENT_WIDTH,
      align: 'justify',
      lineGap: 1.5,
    });

    doc.moveDown(0.8);

    // --- Détail du règlement ---
    doc
      .font(FONT_BOLD)
      .fontSize(11)
      .text('Détail du règlement', PAGE_MARGIN_LEFT, doc.y, {
        width: CONTENT_WIDTH,
      });

    doc.moveDown(0.3);

    const tableY = doc.y;
    const tableW = CONTENT_WIDTH;
    const colMontant = 80; // largeur colonne montant (à droite)
    const lineH = 20;

    // Ligne 1 : Loyer
    doc
      .font(FONT_REGULAR)
      .fontSize(11);
    doc.text('Loyer', PAGE_MARGIN_LEFT, tableY + 4, { width: tableW - colMontant });
    doc.text(`${formatMontant(v.loyer)} €`, PAGE_MARGIN_LEFT + tableW - colMontant, tableY + 4, {
      width: colMontant,
      align: 'right',
    });
    // Bordure basse
    doc
      .moveTo(PAGE_MARGIN_LEFT, tableY + lineH)
      .lineTo(PAGE_MARGIN_LEFT + tableW, tableY + lineH)
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .stroke();

    // Ligne 2 : Charges
    const chargesY = tableY + lineH;
    doc.text('Provision pour charges', PAGE_MARGIN_LEFT, chargesY + 4, { width: tableW - colMontant });
    doc.text(`${formatMontant(v.charges)} €`, PAGE_MARGIN_LEFT + tableW - colMontant, chargesY + 4, {
      width: colMontant,
      align: 'right',
    });
    doc
      .moveTo(PAGE_MARGIN_LEFT, chargesY + lineH)
      .lineTo(PAGE_MARGIN_LEFT + tableW, chargesY + lineH)
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .stroke();

    // Ligne 3 : Total (gras)
    const totalY = chargesY + lineH;
    doc
      .font(FONT_BOLD)
      .fontSize(11);
    doc.text('Total', PAGE_MARGIN_LEFT, totalY + 4, { width: tableW - colMontant });
    doc.text(`${formatMontant(v.total)} €`, PAGE_MARGIN_LEFT + tableW - colMontant, totalY + 4, {
      width: colMontant,
      align: 'right',
    });
    doc
      .moveTo(PAGE_MARGIN_LEFT, totalY + lineH)
      .lineTo(PAGE_MARGIN_LEFT + tableW, totalY + lineH)
      .strokeColor('#000000')
      .lineWidth(0.8)
      .stroke();

    doc.y = totalY + lineH + 17;

    // --- Date et moyen de paiement ---
    const paiementY = doc.y;
    doc
      .font(FONT_BOLD)
      .fontSize(11)
      .text('Date du paiement : ', PAGE_MARGIN_LEFT, paiementY, {
        continued: true,
        width: CONTENT_WIDTH,
      });
    doc
      .font(FONT_REGULAR)
      .text(v.datePaiement);

    doc
      .font(FONT_BOLD)
      .text('Moyen de paiement : ', PAGE_MARGIN_LEFT, doc.y, {
        continued: true,
        width: CONTENT_WIDTH,
      });
    doc
      .font(FONT_REGULAR)
      .text(v.moyenPaiement);

    doc.moveDown(1.5);

    // --- Lieu / date / signature ---
    doc
      .font(FONT_REGULAR)
      .fontSize(11)
      .text(`Fait à ${v.lieuEmission}, le ${v.dateEmission}`, PAGE_MARGIN_LEFT, doc.y, {
        width: CONTENT_WIDTH,
      });

    doc.moveDown(0.5);

    doc
      .font(FONT_BOLD)
      .fontSize(11)
      .text('Signature', PAGE_MARGIN_LEFT, doc.y, { width: CONTENT_WIDTH });

    // Image signature si disponible
    if (v.signaturePngBase64) {
      try {
        const sigBuffer = Buffer.from(v.signaturePngBase64, 'base64');
        const sigY = doc.y + 4;
        doc.image(sigBuffer, PAGE_MARGIN_LEFT, sigY, {
          width: v.signatureLargeurMm * 2.835, // mm → pt (1mm ≈ 2.835pt)
        });
        // Estimer la hauteur de la signature et avancer
        doc.y = sigY + v.signatureLargeurMm * 0.45 * 2.835;
      } catch (err) {
        console.error(
          `[quittance-pdf] erreur insertion signature : ${err instanceof Error ? err.message : err}`,
        );
        doc.moveDown(2);
      }
    } else {
      doc.moveDown(2);
    }

    doc.moveDown(1);

    // --- Mentions légales (petit gris, justifié) ---
    doc
      .font(FONT_REGULAR)
      .fontSize(8)
      .fillColor('#5a5a5a');

    const mentions =
      'Quittance délivrée en application de l\'article 21 de la loi n° 89-462 ' +
      'du 6 juillet 1989. ' +
      'Dont quittance, sous réserve de tous les droits et actions du propriétaire, de ' +
      'toutes poursuites qui auraient pu être engagées. En cas de congé précédemment ' +
      'donné, cette quittance représenterait une indemnité d\'occupation des lieux et ne ' +
      'saurait être considérée comme un titre de location. Cette quittance annule tous ' +
      'les reçus qui auraient pu être donnés pour acomptes versés, même si ces reçus ' +
      'portent une date postérieure à la date ci-contre. Le paiement de la présente ' +
      'quittance n\'emporte pas présomption de paiement des termes antérieurs.';

    doc.text(mentions, PAGE_MARGIN_LEFT, doc.y, {
      width: CONTENT_WIDTH,
      align: 'justify',
      lineGap: 1,
    });

    doc.fillColor('#000000');

    // Fin du document
    doc.end();
  });
}
