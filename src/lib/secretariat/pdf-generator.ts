/**
 * Génération PDF de comptes rendus — secrétariat ISSA Capital.
 *
 * Utilise pdfkit pour produire un PDF A4 professionnel, non éditable,
 * reproduisant fidèlement le format du CR défini dans cr-renderer.ts.
 *
 * Le PDF contient :
 *  - Header CONFIDENTIEL + métadonnées (référence, entité, date, type, lieu, participants)
 *  - Corps : sections 1 à 4
 *  - Annexes photographiques (listing, pas les images elles-mêmes)
 *  - Footer : formule de clôture + mention RGPD + Art. 39-1
 */

import PDFDocument from 'pdfkit';
import type { CRDraft } from './types';
import {
  entiteNomComplet,
  typeReunionLibelle,
  dateFormatFr,
} from './cr-renderer';

// ============================================================
// Constantes de mise en page
// ============================================================

const PAGE_MARGIN = 60;
const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_OBLIQUE = 'Helvetica-Oblique';
const COLOR_PRIMARY = '#1a1a1a';
const COLOR_SECONDARY = '#555555';
const COLOR_ACCENT = '#8B0000'; // Rouge foncé pour CONFIDENTIEL
const COLOR_RULE = '#cccccc';
const FONT_SIZE_TITLE = 16;
const FONT_SIZE_HEADING = 13;
const FONT_SIZE_BODY = 10.5;
const FONT_SIZE_SMALL = 9;
const FONT_SIZE_LABEL = 9.5;
const LINE_GAP = 3;

// ============================================================
// Helpers internes
// ============================================================

/**
 * Formate un timestamp ISO complet en français : "8 avril 2026 à 14:32 UTC".
 */
function dateTimeFormatFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const datePart = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${datePart} à ${hours}:${minutes} UTC`;
}

/**
 * Dessine une ligne horizontale de séparation.
 */
function drawRule(doc: PDFKit.PDFDocument): void {
  const y = doc.y + 6;
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .strokeColor(COLOR_RULE)
    .lineWidth(0.5)
    .stroke();
  doc.y = y + 10;
}

/**
 * Écrit un champ label: valeur sur une ligne.
 */
function writeField(doc: PDFKit.PDFDocument, label: string, value: string): void {
  const startX = PAGE_MARGIN;
  const maxWidth = doc.page.width - PAGE_MARGIN * 2;

  doc.font(FONT_BOLD).fontSize(FONT_SIZE_LABEL).fillColor(COLOR_SECONDARY);
  doc.text(`${label} : `, startX, doc.y, { continued: true, width: maxWidth });
  doc.font(FONT_REGULAR).fillColor(COLOR_PRIMARY);
  doc.text(value, { width: maxWidth, lineGap: LINE_GAP });
}

/**
 * Écrit un titre de section (ex : "1. Objet et lien avec l'intérêt social").
 */
function writeHeading(doc: PDFKit.PDFDocument, text: string): void {
  doc.moveDown(0.5);
  doc
    .font(FONT_BOLD)
    .fontSize(FONT_SIZE_HEADING)
    .fillColor(COLOR_PRIMARY)
    .text(text, PAGE_MARGIN, doc.y, {
      width: doc.page.width - PAGE_MARGIN * 2,
      lineGap: LINE_GAP,
    });
  doc.moveDown(0.3);
}

/**
 * Écrit un bloc de texte corps (contenu de section).
 */
function writeBody(doc: PDFKit.PDFDocument, text: string): void {
  doc
    .font(FONT_REGULAR)
    .fontSize(FONT_SIZE_BODY)
    .fillColor(COLOR_PRIMARY)
    .text(text, PAGE_MARGIN, doc.y, {
      width: doc.page.width - PAGE_MARGIN * 2,
      lineGap: LINE_GAP,
      align: 'justify',
    });
  doc.moveDown(0.4);
}

// ============================================================
// Fonction principale
// ============================================================

/**
 * Génère un PDF professionnel pour un compte rendu validé.
 *
 * @param params.cr Le draft CR structuré et validé
 * @param params.reference Référence séquentielle (ex: "IC-CR-2026-0003")
 * @param params.dateEtablissement Timestamp ISO de la validation
 * @returns Buffer contenant le PDF complet
 */
export async function generateCrPdf(params: {
  cr: CRDraft;
  reference: string;
  dateEtablissement: string;
}): Promise<Buffer> {
  const { cr, reference, dateEtablissement } = params;

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];

    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: PAGE_MARGIN,
        bottom: PAGE_MARGIN,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
      },
      info: {
        Title: `CR ${reference} — ${entiteNomComplet(cr.entite)}`,
        Author: 'Thomas Issa — ISSA Capital SAS',
        Subject: `Compte rendu ${typeReunionLibelle(cr.type_reunion)} — ${dateFormatFr(cr.date_reunion)}`,
        Keywords: `CR, ${cr.entite}, ${reference}, confidentiel`,
        Creator: 'Secrétariat ISSA Capital',
      },
    });

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // ============================================================
    // CONFIDENTIEL — bandeau haut
    // ============================================================

    doc
      .font(FONT_BOLD)
      .fontSize(FONT_SIZE_SMALL)
      .fillColor(COLOR_ACCENT)
      .text('CONFIDENTIEL — Diffusion restreinte', PAGE_MARGIN, PAGE_MARGIN, {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: 'right',
      });

    doc.moveDown(1.5);

    // ============================================================
    // Titre
    // ============================================================

    doc
      .font(FONT_BOLD)
      .fontSize(FONT_SIZE_TITLE)
      .fillColor(COLOR_PRIMARY)
      .text('COMPTE RENDU DE RÉUNION PROFESSIONNELLE', PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: 'center',
      });

    doc.moveDown(1);

    // ============================================================
    // Métadonnées header
    // ============================================================

    writeField(doc, 'Référence', reference);
    writeField(doc, 'Entité', entiteNomComplet(cr.entite));
    writeField(doc, 'Date de la réunion', dateFormatFr(cr.date_reunion));
    writeField(doc, "Date d'établissement", dateTimeFormatFr(dateEtablissement));
    writeField(doc, 'Type', typeReunionLibelle(cr.type_reunion));
    writeField(doc, 'Lieu', cr.lieu);

    if (cr.montant_ttc_eur !== null) {
      writeField(doc, 'Montant TTC', `${cr.montant_ttc_eur} €`);
    }
    if (cr.etablissement_nom !== null) {
      writeField(doc, 'Établissement', cr.etablissement_nom);
    }

    doc.moveDown(0.5);

    // Participants
    doc
      .font(FONT_BOLD)
      .fontSize(FONT_SIZE_LABEL)
      .fillColor(COLOR_SECONDARY)
      .text('Participants :', PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
    doc.moveDown(0.2);

    for (const p of cr.participants) {
      doc
        .font(FONT_REGULAR)
        .fontSize(FONT_SIZE_BODY)
        .fillColor(COLOR_PRIMARY)
        .text(
          `  •  ${p.prenom} ${p.nom}, ${p.titre}, ${p.societe} (${p.qualite_relation})`,
          PAGE_MARGIN,
          doc.y,
          { width: doc.page.width - PAGE_MARGIN * 2, lineGap: LINE_GAP },
        );
    }

    doc.moveDown(0.5);
    drawRule(doc);

    // ============================================================
    // Section 1 : Objet et lien avec l'intérêt social
    // ============================================================

    writeHeading(doc, "1. Objet et lien avec l'intérêt social");
    writeBody(doc, cr.section_1_objet_art_39_1);

    // ============================================================
    // Section 2 : Points abordés
    // ============================================================

    writeHeading(doc, '2. Points abordés');
    writeBody(doc, cr.section_2_points_abordes);

    // ============================================================
    // Section 3 : Décisions et conclusions
    // ============================================================

    writeHeading(doc, '3. Décisions et conclusions');
    writeBody(doc, cr.section_3_decisions);

    // ============================================================
    // Section 4 : Suites à donner (conditionnelle)
    // ============================================================

    if (cr.section_4_suites_a_donner !== null) {
      writeHeading(doc, '4. Suites à donner');
      writeBody(doc, cr.section_4_suites_a_donner);
    }

    // ============================================================
    // Annexes photographiques (si présentes)
    // ============================================================

    const annexes = cr.annexes_photographiques;
    if (annexes && annexes.length > 0) {
      drawRule(doc);

      writeHeading(
        doc,
        `Annexes photographiques — ${annexes.length} document${annexes.length > 1 ? 's' : ''} joint${annexes.length > 1 ? 's' : ''}`,
      );

      for (const annexe of annexes) {
        const fileRef = `${cr.entite}-CR-${cr.date_reunion}_photo_${String(annexe.numero).padStart(2, '0')}.jpg`;

        doc
          .font(FONT_BOLD)
          .fontSize(FONT_SIZE_BODY)
          .fillColor(COLOR_PRIMARY)
          .text(`Photo ${annexe.numero} — ${annexe.legende}`, PAGE_MARGIN, doc.y, {
            width: doc.page.width - PAGE_MARGIN * 2,
          });

        doc
          .font(FONT_OBLIQUE)
          .fontSize(FONT_SIZE_SMALL)
          .fillColor(COLOR_SECONDARY)
          .text(
            `Auteur : Thomas Issa — ${dateFormatFr(cr.date_reunion)} — Réf. fichier : ${fileRef}`,
            PAGE_MARGIN,
            doc.y,
            { width: doc.page.width - PAGE_MARGIN * 2 },
          );

        doc.moveDown(0.3);
      }

      doc
        .font(FONT_OBLIQUE)
        .fontSize(FONT_SIZE_SMALL)
        .fillColor(COLOR_SECONDARY)
        .text(
          `Fichiers conservés dans la GED ISSA Capital, dossier ${reference}, accès restreint Président.`,
          PAGE_MARGIN,
          doc.y,
          { width: doc.page.width - PAGE_MARGIN * 2 },
        );

      doc.moveDown(0.5);
    }

    // ============================================================
    // Footer — formule de clôture
    // ============================================================

    drawRule(doc);

    doc
      .font(FONT_REGULAR)
      .fontSize(FONT_SIZE_BODY)
      .fillColor(COLOR_PRIMARY)
      .text(
        `En foi de quoi, le présent compte rendu a été établi et certifié exact par Thomas Issa, Président — ${entiteNomComplet(cr.entite)}.`,
        PAGE_MARGIN,
        doc.y,
        {
          width: doc.page.width - PAGE_MARGIN * 2,
          lineGap: LINE_GAP,
        },
      );

    // Signature manuscrite PNG (si configurée)
    const signaturePath = process.env.SIGNATURE_PNG_PATH;
    if (signaturePath) {
      try {
        doc.moveDown(0.5);
        doc.image(signaturePath, PAGE_MARGIN, doc.y, {
          width: 150,
          height: 60,
        });
        doc.moveDown(3);
      } catch {
        // Fichier signature absent ou illisible — on continue sans
        doc.moveDown(0.3);
      }
    } else {
      doc.moveDown(0.3);
    }

    doc
      .font(FONT_BOLD)
      .fontSize(FONT_SIZE_SMALL)
      .fillColor(COLOR_SECONDARY)
      .text(`Horodaté le : ${dateTimeFormatFr(dateEtablissement)}`, PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });

    doc.moveDown(1);
    drawRule(doc);

    // ============================================================
    // Mention RGPD + Art. 39-1
    // ============================================================

    doc
      .font(FONT_REGULAR)
      .fontSize(FONT_SIZE_SMALL - 1)
      .fillColor(COLOR_SECONDARY)
      .text(
        'Ce document contient des données à caractère personnel traitées par ISSA Capital SAS conformément ' +
          'au Règlement (UE) 2016/679 (RGPD). Finalité : documentation professionnelle et preuve fiscale ' +
          `(Art. 39-1 CGI). Conservation : 10 ans. Droits d'accès et de rectification : ${params.cr.entite === 'IC' ? 'contact@issa-capital.com' : 'contact@versi.fr'}.`,
        PAGE_MARGIN,
        doc.y,
        {
          width: doc.page.width - PAGE_MARGIN * 2,
          lineGap: 2,
          align: 'justify',
        },
      );

    doc.moveDown(0.3);

    doc
      .font(FONT_REGULAR)
      .fontSize(FONT_SIZE_SMALL - 1)
      .fillColor(COLOR_SECONDARY)
      .text(
        'Document établi à titre de justificatif interne — se reporter aux pièces comptables associées ' +
          '(factures, notes de frais) pour la déductibilité fiscale.',
        PAGE_MARGIN,
        doc.y,
        {
          width: doc.page.width - PAGE_MARGIN * 2,
          lineGap: 2,
          align: 'justify',
        },
      );

    // Fin du document
    doc.end();
  });
}
