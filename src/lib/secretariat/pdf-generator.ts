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

import { existsSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
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

/**
 * Sécurise une valeur avant de la passer à pdfkit (qui crashe sur undefined/null).
 */
function safe(value: string | null | undefined): string {
  return value ?? '';
}

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
  photos?: Array<{ base64: string; mimeType: string }>;
}): Promise<Buffer> {
  const { cr, reference, dateEtablissement, photos } = params;

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
        Author: `Thomas Issa — ${entiteNomComplet(cr.entite)}`,
        Subject: `Compte rendu ${typeReunionLibelle(cr.type_reunion)} — ${dateFormatFr(cr.date_reunion)}`,
        Keywords: `CR, ${cr.entite}, ${reference}, confidentiel`,
        Creator: 'Secrétariat ISSA Capital',
      },
    });

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // La numérotation de page est ajoutée en fin de document
    // (pas dans pageAdded qui cause un stack overflow avec doc.text)

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

    // Sous-titre entité (ancrage institutionnel immédiat)
    doc.moveDown(0.3);
    doc
      .font(FONT_REGULAR)
      .fontSize(11)
      .fillColor(COLOR_SECONDARY)
      .text(entiteNomComplet(cr.entite), PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: 'center',
      });

    doc.moveDown(1);

    // ============================================================
    // Métadonnées header
    // ============================================================

    writeField(doc, 'Référence', safe(reference));
    writeField(doc, 'Entité', entiteNomComplet(cr.entite));
    writeField(doc, 'Date de la réunion', dateFormatFr(safe(cr.date_reunion)));
    writeField(doc, "Date d'établissement", dateTimeFormatFr(safe(dateEtablissement)));
    writeField(doc, 'Type', typeReunionLibelle(cr.type_reunion));
    writeField(doc, 'Lieu', safe(cr.lieu));

    if (cr.montant_ttc_eur !== null) {
      writeField(doc, 'Montant TTC', `${cr.montant_ttc_eur} €`);
    }
    if (cr.etablissement_nom !== null) {
      writeField(doc, 'Établissement', cr.etablissement_nom);
    }

    doc.moveDown(0.5);

    // Participants — adapté au mode solo (S16 Q2)
    // Mode solo = 0 participant tiers OU uniquement Thomas Issa.
    // Libellé : "Présent" en mode solo, "Participants" sinon.
    const isSolo =
      cr.participants.length === 0 ||
      (cr.participants.length === 1 &&
        cr.participants[0]?.prenom === 'Thomas' &&
        cr.participants[0]?.nom === 'Issa');
    const labelParticipants = isSolo ? 'Présent :' : 'Participants :';

    doc
      .font(FONT_BOLD)
      .fontSize(FONT_SIZE_LABEL)
      .fillColor(COLOR_SECONDARY)
      .text(labelParticipants, PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
    doc.moveDown(0.2);

    if (cr.participants.length === 0) {
      // Mode solo strict (aucun participant dans le JSON) : afficher Thomas comme signataire.
      doc
        .font(FONT_REGULAR)
        .fontSize(FONT_SIZE_BODY)
        .fillColor(COLOR_PRIMARY)
        .text(
          '  •  Thomas Issa, Président (signataire — mode solo)',
          PAGE_MARGIN,
          doc.y,
          { width: doc.page.width - PAGE_MARGIN * 2, lineGap: LINE_GAP },
        );
    } else {
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
    }

    doc.moveDown(0.5);
    drawRule(doc);

    // ============================================================
    // Section 1 : Objet et lien avec l'intérêt social
    // ============================================================

    writeHeading(doc, "1. Objet et lien avec l'intérêt social");
    writeBody(doc, safe(cr.section_1_objet_art_39_1));

    // ============================================================
    // Section 2 : Points abordés
    // ============================================================

    writeHeading(doc, '2. Points abordés');
    writeBody(doc, safe(cr.section_2_points_abordes));

    // ============================================================
    // Section 3 : Décisions et conclusions
    // ============================================================

    writeHeading(doc, '3. Décisions et conclusions');
    writeBody(doc, safe(cr.section_3_decisions));

    // ============================================================
    // Section 4 : Suites à donner (conditionnelle)
    // ============================================================

    if (cr.section_4_suites_a_donner) {
      writeHeading(doc, '4. Suites à donner');
      writeBody(doc, safe(cr.section_4_suites_a_donner));
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

      for (let i = 0; i < annexes.length; i++) {
        const annexe = annexes[i];
        if (!annexe) continue;
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

        // Insérer l'image dans le PDF si disponible
        const photoData = photos?.[i];
        if (photoData) {
          try {
            const imgBuffer = Buffer.from(photoData.base64, 'base64');
            const contentWidth = doc.page.width - PAGE_MARGIN * 2;
            const maxPhotoWidth = Math.min(350, contentWidth);
            const maxPhotoHeight = 300;

            // Nouvelle page si pas assez de place (légende + image + marge)
            const spaceNeeded = maxPhotoHeight + 40;
            const spaceLeft = doc.page.height - PAGE_MARGIN - doc.y;
            if (spaceLeft < spaceNeeded) {
              doc.addPage();
            }

            // Insérer l'image — centrer horizontalement
            const imageY = doc.y;
            const imageX = PAGE_MARGIN + (contentWidth - maxPhotoWidth) / 2;
            doc.image(imgBuffer, imageX, imageY, {
              fit: [maxPhotoWidth, maxPhotoHeight],
            });

            // Avancer le curseur Y manuellement (pdfkit ne le fait pas avec fit)
            // On prend la hauteur max possible comme estimation sûre
            doc.y = imageY + maxPhotoHeight + 15;
          } catch (imgErr) {
            // Si l'image ne peut pas être insérée, noter l'erreur et continuer
            doc
              .font(FONT_OBLIQUE)
              .fontSize(FONT_SIZE_SMALL)
              .fillColor(COLOR_SECONDARY)
              .text(
                `[Image non disponible — ${imgErr instanceof Error ? imgErr.message : 'format non supporté'}]`,
                PAGE_MARGIN,
                doc.y,
                { width: doc.page.width - PAGE_MARGIN * 2 },
              );
            doc.moveDown(0.3);
          }
        }

        doc.moveDown(0.3);
      }

      doc.moveDown(0.5);
      doc
        .font(FONT_OBLIQUE)
        .fontSize(FONT_SIZE_SMALL)
        .fillColor(COLOR_SECONDARY)
        .text(
          `Fichiers conservés dans la GED ${entiteNomComplet(cr.entite)}, dossier ${reference}, accès restreint Président.`,
          PAGE_MARGIN,
          doc.y,
          { width: doc.page.width - PAGE_MARGIN * 2 },
        );

      doc.moveDown(0.5);
    }

    // ============================================================
    // Footer — formule de clôture
    // Vérifier qu'il reste assez de place (signature + mentions = ~200px)
    // ============================================================

    const footerSpaceNeeded = 200;
    const footerSpaceLeft = doc.page.height - PAGE_MARGIN - doc.y;
    if (footerSpaceLeft < footerSpaceNeeded) {
      doc.addPage();
    }

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

    // Signature manuscrite PNG — embarquée dans le repo
    const signaturePath = process.env.SIGNATURE_PNG_PATH
      ?? pathResolve(process.cwd(), 'docs', 'signature thomas.png');
    try {
      if (existsSync(signaturePath)) {
        doc.moveDown(0.5);
        // Signature décalée à droite (dans l'espace vide, pas sur le texte)
        doc.image(signaturePath, PAGE_MARGIN + 200, doc.y, {
          width: 150,
          height: 60,
        });
        doc.moveDown(0.8);
      } else {
        doc.moveDown(0.8);
      }
    } catch {
      doc.moveDown(0.8);
    }

    // Bloc signataire sous la signature (nom + titre)
    doc
      .font(FONT_BOLD)
      .fontSize(FONT_SIZE_BODY)
      .fillColor(COLOR_PRIMARY)
      .text('Thomas Issa', PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
    doc
      .font(FONT_REGULAR)
      .fontSize(FONT_SIZE_SMALL)
      .fillColor(COLOR_SECONDARY)
      .text(`Président — ${entiteNomComplet(cr.entite)}`, PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
    doc.moveDown(0.8);

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
        `Ce document contient des données à caractère personnel traitées par ${entiteNomComplet(cr.entite)} conformément ` +
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
