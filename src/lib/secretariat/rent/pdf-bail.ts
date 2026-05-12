/**
 * Génération DOCX + PDF d'un bail meublé — port fidèle du Python generer_bail.py.
 *
 * Produit un DOCX via la lib `docx` (npm), puis un PDF via PDFKit
 * (le DOCX est le format principal pour Thomas, le PDF est un complément).
 *
 * 24 sections juridiques :
 *   1. Titre
 *   2. Bailleur (état civil complet)
 *   3. Preneur (état civil complet, accord féminin/masculin)
 *   4. Préambule ("Il a été convenu…")
 *   5. Adresse du logement
 *   6. État des lieux contradictoire
 *   7. Inventaire contradictoire (intro)
 *   8. Durée
 *   9. Forme du congé / préavis
 *  10. Montant et paiement du loyer
 *  11. Charges
 *  12. Indexation (IRL)
 *  13. Dépôt de garantie
 *  14. Obligations du preneur (10 items)
 *  15. Obligations du bailleur (4 items)
 *  16. Clause résolutoire (4 items)
 *  17. Clause pénale 10% (3 items)
 *  18. Élection de domicile
 *  19. Annexes obligatoires (6 items loi ALUR)
 *  20. Signatures
 *  21. Page état des lieux (page 2)
 *  22. Inventaire détaillé (4 catégories)
 *  23. Signature inventaire
 *  24. Métadonnées document
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  TabStopPosition,
  TabStopType,
  PageBreak,
  convertMillimetersToTwip,
} from 'docx';
import PDFDocument from 'pdfkit';
import type { BailVariables } from './types';
import { nombreEnLettres } from './num-en-lettres';
import { dateEnLettres, formatDateFr } from './dates-fr';

// ============================================================
// Helpers texte
// ============================================================

/** "1er" pour le 1, sinon le nombre en string */
function jourAvecOrdinal(jour: number): string {
  return jour === 1 ? '1er' : String(jour);
}

/** Montant en lettres (arrondi entier) */
function montantEnLettres(montant: number): string {
  return nombreEnLettres(montant, '').trim();
}

// ============================================================
// Contenu des sections juridiques (constantes réutilisées DOCX + PDF)
// ============================================================

const OBLIGATIONS_PRENEUR = [
  'de payer le loyer et les charges récupérables aux termes convenus ;',
  "d'user paisiblement du logement suivant la destination qui lui a été donnée par le contrat de location (exclusivement habitation) ;",
  "de répondre des dégradations et pertes qui surviennent pendant la durée du contrat dans les locaux dont il a la jouissance exclusive, à moins qu'il ne prouve qu'elles ont eu lieu par un cas de force majeure, par faute du bailleur ou par le fait d'un tiers qu'il n'a pas introduit dans le logement ;",
  "de prendre à sa charge l'entretien courant du logement ainsi que l'ensemble des réparations locatives définies par décret au Conseil d'État, sauf si elles sont occasionnées par vétusté, malfaçon, vice de construction, cas fortuit ou de force majeure ;",
  "de ne pas transformer sans l'accord exprès et écrit du bailleur les locaux loués et les équipements ; le bailleur peut, si le locataire a méconnu cette obligation, exiger la remise en état des locaux ou conserver les transformations effectuées sans que le locataire puisse réclamer une indemnité pour les frais engagés ; le bailleur a toutefois la faculté d'exiger, aux frais du locataire, la remise immédiate des lieux en état lorsque les transformations mettent en péril le bon fonctionnement des équipements ou la sécurité du local ;",
  "de s'assurer contre les risques dont il doit répondre en sa qualité de locataire et d'en justifier lors de la remise des clés et ensuite chaque année ;",
  "de souffrir la réalisation par le bailleur des réparations urgentes et qui ne peuvent être différées jusqu'à la fin du contrat de location sans préjudice de l'application des dispositions de l'article 1724 du Code civil ;",
  'de laisser visiter, aussitôt le congé donné ou reçu, ou en cas de mise en vente, les locaux loués, deux heures par jour, les jours ouvrables ;',
  "de ne céder le contrat de location, ni de sous-louer, sauf accord exprès et écrit du bailleur ;",
  "de ne pas utiliser l'accès Internet à des fins de reproduction, de représentation, de mise à disposition ou de communication au public d'œuvres ou d'objets protégés par un droit d'auteur ou par un droit voisin, tels que des textes, images, photographies, œuvres musicales, œuvres audiovisuelles, logiciels et jeux vidéo, sans autorisation.",
];

const OBLIGATIONS_BAILLEUR = [
  "de délivrer au locataire le logement en bon état de réparations de toutes espèces et les équipements mentionnés au contrat de location en bon état de fonctionnement ;",
  "d'assurer la jouissance paisible du logement et de garantir le locataire contre les vices ou défauts qui en empêchent l'usage, quand même il ne les aurait pas connus lors de la conclusion du contrat de location, sans préjudice de l'application du second alinéa de l'article 1721 du Code civil ;",
  "d'entretenir les locaux en état de servir à l'usage prévu dans le contrat et d'y faire toutes les réparations nécessaires autres que locatives ;",
  'de remettre, lorsque le locataire en fait la demande, une quittance gratuitement.',
];

const CLAUSE_RESOLUTOIRE = [
  "À défaut de paiement de tout ou partie du loyer ou des charges et un mois après commandement demeuré infructueux, le présent contrat sera résilié immédiatement et de plein droit et le bailleur pourra, dans le cas où le locataire ne quitterait pas les lieux, l'y contraindre par simple ordonnance de référé.",
  "Il est expressément convenu qu'en cas de paiement par chèque le loyer et les charges ne seront considérés comme réglés qu'après encaissement du chèque, la clause résolutoire pouvant être appliquée par le bailleur dans le cas où le chèque serait sans provision.",
  "Toute offre de paiement ou d'exécution après l'expiration du délai ci-dessus mentionné sera réputée nulle et non avenue et ne pourra faire obstacle à la résiliation de la présente location.",
  "À défaut de production par le locataire d'attestation couvrant ses risques locatifs et un mois après commandement resté infructueux, il sera fait application de la présente clause résolutoire.",
];

const CLAUSE_PENALE = [
  "À titre de clause pénale, le preneur accepte entièrement et définitivement d'avoir à payer au bailleur une somme égale à 10% des sommes dues, sans que ce paiement puisse le dispenser du règlement des sommes impayées et du règlement intégral des frais nécessaires au recouvrement de ces sommes.",
  "Ladite clause pénale sera applicable dans un délai de quinze jours après mise en demeure de payer, le tout sans qu'il soit dérogé à la précédente clause résolutoire.",
  "En cas de retard dans la libération des lieux après réception du congé ou expiration du contrat, le preneur, quels que soient ses motifs, devra une astreinte par jour de retard calculée sur la base de trois fois le loyer journalier en cours à la date du départ. Cette indemnité n'ouvrira aucun droit de maintien dans les lieux au preneur, et elle sera acquise au bailleur à titre d'indemnité, à forfait, sans préjudice de tous dommages et intérêts.",
];

const ANNEXES_OBLIGATOIRES = [
  'le diagnostic de performance énergétique (DPE) ;',
  "l'état des risques et pollutions (ERP) ;",
  'le constat de risque d\'exposition au plomb (CREP), pour les logements construits avant le 1er janvier 1949 ;',
  "l'état de l'installation intérieure d'électricité et de gaz, lorsque ces installations ont plus de 15 ans ;",
  "l'état des lieux d'entrée et l'inventaire contradictoire des meubles ;",
  'la notice d\'information relative aux droits et obligations des locataires et des bailleurs.',
];

const INVENTAIRE_LABELS: Array<{ key: string; label: string }> = [
  { key: 'electromenager', label: 'Électroménager' },
  { key: 'vaisselle', label: 'Vaisselle' },
  { key: 'linge', label: 'Linge' },
  { key: 'divers', label: 'Divers' },
];

// ============================================================
// Génération DOCX
// ============================================================

/**
 * Génère le bail au format DOCX.
 *
 * @returns Buffer contenant le fichier .docx
 */
export async function genererBailDocx(v: BailVariables): Promise<Buffer> {
  const accordNe = v.locataireEstFeminin ? 'Née' : 'Né';
  const accordDesigne = v.locataireEstFeminin ? 'désignée' : 'désigné';
  const jp = jourAvecOrdinal(v.jourPaiement);

  const dNaissBailleur = new Date(v.bailleurDateNaissance);
  const dateDebutLettres = dateEnLettres(v.dateDebut);
  const dateDebutChiffres = formatDateChiffres(v.dateDebut);
  const dateSignatureStr = formatDateFr(v.dateSignature);

  const children: Paragraph[] = [];

  // Helper pour les paragraphes
  const addPara = (text: string, opts?: { bold?: boolean; italic?: boolean; center?: boolean; size?: number }) => {
    children.push(
      new Paragraph({
        alignment: opts?.center ? AlignmentType.CENTER : undefined,
        children: [
          new TextRun({
            text,
            bold: opts?.bold,
            italics: opts?.italic,
            size: opts?.size ? opts.size * 2 : undefined, // half-points
          }),
        ],
      }),
    );
  };

  const addEmpty = () => {
    children.push(new Paragraph({ children: [] }));
  };

  const addHeading = (text: string) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 22 })],
      }),
    );
  };

  const addBullet = (text: string) => {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text, size: 22 })],
      }),
    );
  };

  // ===== 1. Titre =====
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: v.typeBail, bold: true, size: 28 })],
    }),
  );
  addEmpty();

  // ===== 2. Préambule =====
  addPara('Entre les soussignés,');
  addEmpty();

  // ===== 3. Bailleur =====
  addPara(`M. ${v.bailleurNomCapitales},`, { bold: true });
  addPara(
    `Né le ${formatDateFr(dNaissBailleur)} à ${v.bailleurLieuNaissance}, ` +
    `de nationalité ${v.bailleurNationalite}, demeurant au ` +
    `${v.bailleurAdresse}, ${v.bailleurCpVille}`,
  );
  addPara('désigné ci-après « le bailleur »', { italic: true, center: true });
  addEmpty();

  addPara('Et');
  addEmpty();

  // ===== 4. Preneur =====
  addPara(`${v.locataireCiviliteAbregee} ${v.locataireNom},`, { bold: true });
  addPara(
    `${accordNe} le ${v.locataireDateNaissance} à ${v.locataireLieuNaissance}, ` +
    `de nationalité ${v.locataireNationalite}`,
  );
  addPara(`${accordDesigne} ci-après « le preneur »`, { italic: true, center: true });
  addEmpty();

  addPara('Il a été convenu et arrêté ce qui suit :');
  addEmpty();
  addPara(
    'Le bailleur loue les locaux et équipements ci-après désignés au preneur ' +
    'qui les accepte aux conditions suivantes :',
  );
  addEmpty();

  // ===== 5. Adresse du logement =====
  addHeading('Adresse du logement donné en location');
  addPara(v.bienAdresseLigne1);
  if (v.bienComplement) addPara(v.bienComplement);
  addPara(v.bienCpVille);
  addEmpty();
  addPara(`Un studio de ${v.bienSurfaceM2}m² avec ${v.bienPieces}, meublé.`);
  addEmpty();

  // ===== 6. État des lieux =====
  addHeading('État des lieux contradictoire');
  addPara(
    'Un état des lieux contradictoire sera établi lors de la remise des clés au locataire ' +
    'et lors de la restitution de celles-ci.',
  );
  addPara("L'état des lieux sera obligatoirement annexé au présent contrat.");
  addEmpty();

  // ===== 7. Inventaire intro =====
  addHeading('Inventaire contradictoire');
  addPara(
    'La présente location étant consentie et acceptée en meublé, un inventaire contradictoire ' +
    'des meubles sera établi lors de la remise des clés au locataire et lors de la restitution ' +
    "de celles-ci. L'inventaire sera annexé au présent contrat. Le preneur sera responsable de " +
    'toute détérioration ou perte pouvant survenir à ce mobilier.',
  );
  addEmpty();

  // ===== 8. Durée =====
  addHeading('Durée');
  addPara(
    `Le logement constitue la résidence principale du locataire. La présente ` +
    `location est consentie et acceptée pour une durée de ${v.dureeBail} ` +
    `qui commence à courir le ${dateDebutLettres} – ${dateDebutChiffres} ` +
    `renouvelable ensuite par tacite reconduction et par période d'un an faute de congé préalable.`,
  );
  addEmpty();

  // ===== 9. Forme du congé =====
  addHeading('Forme du congé, durée du préavis');
  addPara('Le présent contrat pourra être résilié :');
  addBullet(
    `par le preneur à tout moment, moyennant un délai de préavis de ${v.preavisLocataire} ` +
    "(partant de la date de réception de l'acte)",
  );
  addBullet(
    `par le bailleur, à l'expiration du bail ou de chacun de ses renouvellements, moyennant ` +
    `un délai de préavis de ${v.preavisBailleur}. Lorsque le logement constitue la résidence ` +
    'principale du locataire, le refus du renouvellement du bail par le bailleur doit être ' +
    'motivé soit par sa décision de reprendre ou de vendre le logement, soit par un motif ' +
    "légitime et sérieux, notamment l'inexécution par le locataire de l'une des obligations " +
    "lui incombant, et notifié au preneur 3 mois avant l'expiration du bail.",
  );
  addPara(
    'Le congé de location devra être signifié de part et d\'autre par lettre recommandée ' +
    "avec accusé de réception ou par acte d'huissier.",
  );
  addPara(
    "En cas de résiliation du preneur ou à l'expiration du bail, la notification de résiliation " +
    'ou de fin de bail vaudra engagement formel de partir et renonciation à tout maintien dans ' +
    "les lieux, sans qu'il soit besoin de recourir à aucune formalité. Faute de libérer les lieux " +
    'à la date convenue, la clause pénale incluse dans le présent contrat sera immédiatement applicable.',
  );
  addEmpty();

  // ===== 10. Loyer =====
  addHeading('Montant et paiement du loyer');
  addPara(
    `La présente location est consentie et acceptée moyennant un paiement mensuel ` +
    `et d'avance de ${montantEnLettres(v.loyer)} euros (${Math.round(v.loyer)} euros). ` +
    `Il sera payable le ${jp} de chaque mois.`,
  );
  addEmpty();

  // ===== 11. Charges =====
  addHeading('Charges');
  addPara(
    `Les charges sont fixées forfaitairement à ${montantEnLettres(v.charges)} euros ` +
    `(${Math.round(v.charges)} euros) par mois. Elles seront acquittées en même temps que le ` +
    "loyer, c'est-à-dire mensuellement et d'avance et révisées chaque année aux " +
    `mêmes conditions que le loyer principal. Elles contiennent notamment ` +
    `${v.bienChargesIncluses}.`,
  );
  addEmpty();

  // ===== 12. Indexation (IRL) =====
  addHeading('Indexation');
  addPara(
    "Le loyer pourra être indexé annuellement à la date anniversaire du contrat, " +
    "sur la base de l'Indice de Référence des Loyers (IRL) publié chaque trimestre " +
    "par l'INSEE (article 17-1 de la loi n° 89-462 du 6 juillet 1989). L'indice de " +
    'référence est celui du trimestre précédant la signature du présent contrat. ' +
    'À chaque révision, le nouveau loyer sera calculé selon la formule : ' +
    'nouveau loyer = loyer en cours × (nouvel IRL / IRL de référence).',
  );
  addEmpty();

  // ===== 13. Dépôt de garantie =====
  addHeading('Dépôt de garantie');
  addBullet(
    `À titre de garantie de l'entière exécution de ses obligations le locataire verse, ce jour, ` +
    `un dépôt de garantie correspondant à la somme de ${montantEnLettres(v.depotGarantie)} euros ` +
    `(${Math.round(v.depotGarantie)} euros).`,
  );
  addBullet(
    `Ce dépôt qui ne pourra excéder deux mois de loyer principal ne dispensera en aucun cas le ` +
    `locataire du paiement du loyer et des charges aux dates fixées. Il sera restitué dans un ` +
    `délai maximal de ${v.delaiRestitutionDepot} à compter du départ du locataire, déduction ` +
    'faite, le cas échéant, des sommes restant dues au bailleur et des paiements dont ce dernier ' +
    "pourrait être tenu pour responsable aux lieu et place du locataire. Le départ s'entend après " +
    "complet déménagement et établissement de l'état des lieux et de l'inventaire contradictoire " +
    "de sortie, résiliation des abonnements en cours tels qu'eau, électricité, gaz, téléphone, " +
    'exécution des réparations locatives, paiement des taxes et impôts et remise des clés. ' +
    'À défaut de restitution du montant de garantie dans le délai prévu, le solde du dépôt de ' +
    'garantie restant dû au locataire après arrêté des comptes produira intérêt au taux légal ' +
    'au profit du locataire.',
  );
  addBullet('Le dépôt de garantie ne sera pas révisable au cours de la présente location.');
  addEmpty();

  // ===== 14. Obligations du preneur =====
  addHeading('Obligations du preneur');
  addPara('Le preneur est tenu aux obligations suivantes :');
  for (const o of OBLIGATIONS_PRENEUR) {
    addBullet(o);
  }
  addEmpty();

  // ===== 15. Obligations du bailleur =====
  addHeading('Obligations du bailleur');
  addPara('Le bailleur est tenu aux principales obligations suivantes :');
  for (const o of OBLIGATIONS_BAILLEUR) {
    addBullet(o);
  }
  addEmpty();

  // ===== 16. Clause résolutoire =====
  addHeading('Clause résolutoire');
  for (const c of CLAUSE_RESOLUTOIRE) {
    addBullet(c);
  }
  addEmpty();

  // ===== 17. Clause pénale 10% =====
  addHeading('Clause pénale');
  for (const c of CLAUSE_PENALE) {
    addBullet(c);
  }
  addEmpty();

  // ===== 18. Élection de domicile =====
  addHeading('Élection de domicile');
  addPara(
    'Pour l\'exécution des présentes et de leur suite, le bailleur fait élection de domicile ' +
    'en sa demeure et le preneur dans les lieux loués.',
  );
  addEmpty();

  // ===== 19. Annexes obligatoires =====
  addHeading('Annexes obligatoires');
  addPara(
    'Sont annexés au présent contrat conformément à la loi du 6 juillet 1989 ' +
    "et à ses textes d'application :",
  );
  for (const a of ANNEXES_OBLIGATOIRES) {
    addBullet(a);
  }
  addEmpty();

  // ===== 20. Signatures =====
  addPara(
    `Fait à ${v.lieuSignature}, le ${dateSignatureStr}, en originaux dont un remis au preneur.`,
  );
  addEmpty();
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Le preneur\t\t\t\t\tLe bailleur', bold: true, size: 22 })],
    }),
  );
  addEmpty();
  addPara(
    '(Faire précéder chaque signature de la mention manuscrite : « Lu et approuvé, bon pour accord ».)',
    { italic: true, size: 10 },
  );

  // ===== 21. Page 2 — État des lieux =====
  children.push(new Paragraph({ children: [new PageBreak()] }));
  addHeading('État des lieux contradictoire');
  addEmpty();
  addPara('Remarques :');
  for (let i = 0; i < 5; i++) addEmpty();
  addPara('Défauts :');
  for (let i = 0; i < 5; i++) addEmpty();
  addPara(`Fait à ${v.lieuSignature}, le ___/___/______`);
  addEmpty();

  // ===== 22-23. Inventaire détaillé =====
  if (v.inventaire) {
    addHeading('Inventaire contradictoire');
    addEmpty();
    for (const { key, label } of INVENTAIRE_LABELS) {
      const items = v.inventaire[key];
      if (!items || items.length === 0) continue;
      addPara(`${label} :`, { bold: true });
      for (const item of items) {
        addBullet(item);
      }
      addEmpty();
    }
    addPara(`Fait à ${v.lieuSignature}, le ___/___/______`);
  }

  // ===== 24. Construction du document =====
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(18),
            bottom: convertMillimetersToTwip(18),
            left: convertMillimetersToTwip(20),
            right: convertMillimetersToTwip(20),
          },
        },
      },
      children,
    }],
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 22, // 11pt in half-points
          },
        },
      },
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ============================================================
// Génération PDF (version simplifiée via PDFKit)
// ============================================================

/**
 * Génère le bail au format PDF via PDFKit.
 *
 * Reprend les mêmes 24 sections que le DOCX mais en rendu PDFKit direct.
 * Layout A4, marge 20mm, police Helvetica 11pt.
 */
export async function genererBailPdf(v: BailVariables): Promise<Buffer> {
  const accordNe = v.locataireEstFeminin ? 'Née' : 'Né';
  const accordDesigne = v.locataireEstFeminin ? 'désignée' : 'désigné';
  const jp = jourAvecOrdinal(v.jourPaiement);

  const dNaissBailleur = new Date(v.bailleurDateNaissance);
  const dateDebutLettres = dateEnLettres(v.dateDebut);
  const dateDebutChiffres = formatDateChiffres(v.dateDebut);
  const dateSignatureStr = formatDateFr(v.dateSignature);

  const M_LEFT = 57; // ~20mm
  const M_RIGHT = 57;
  const M_TOP = 51; // ~18mm
  const M_BOTTOM = 51;
  const W = 595.28 - M_LEFT - M_RIGHT;
  const FONT = 'Helvetica';
  const FONT_B = 'Helvetica-Bold';

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: M_TOP, bottom: M_BOTTOM, left: M_LEFT, right: M_RIGHT },
      info: {
        Title: `Bail meublé — ${v.locataireNom}`,
        Author: v.bailleurNom,
        Subject: v.typeBail,
        Creator: 'Secrétariat ISSA Capital',
      },
    });

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    const text = (t: string, opts?: { bold?: boolean; italic?: boolean; center?: boolean; indent?: number }) => {
      doc.font(opts?.bold ? FONT_B : (opts?.italic ? `${FONT}-Oblique` : FONT));
      doc.fontSize(11);
      const x = M_LEFT + (opts?.indent ?? 0);
      doc.text(t, x, undefined, {
        width: W - (opts?.indent ?? 0),
        align: opts?.center ? 'center' : 'left',
        lineGap: 1,
      });
    };

    const heading = (t: string) => {
      doc.moveDown(0.3);
      text(t, { bold: true });
      doc.moveDown(0.2);
    };

    const bullet = (t: string) => {
      doc.font(FONT).fontSize(11);
      doc.text(`• ${t}`, M_LEFT + 14, undefined, { width: W - 14, lineGap: 1 });
    };

    const empty = () => doc.moveDown(0.5);

    // 1. Titre
    doc.font(FONT_B).fontSize(14);
    doc.text(v.typeBail, M_LEFT, M_TOP, { width: W, align: 'center' });
    empty();

    // 2. Préambule
    text('Entre les soussignés,');
    empty();

    // 3. Bailleur
    text(`M. ${v.bailleurNomCapitales},`, { bold: true });
    text(
      `Né le ${formatDateFr(dNaissBailleur)} à ${v.bailleurLieuNaissance}, ` +
      `de nationalité ${v.bailleurNationalite}, demeurant au ` +
      `${v.bailleurAdresse}, ${v.bailleurCpVille}`,
    );
    text('désigné ci-après « le bailleur »', { italic: true, center: true });
    empty();
    text('Et');
    empty();

    // 4. Preneur
    text(`${v.locataireCiviliteAbregee} ${v.locataireNom},`, { bold: true });
    text(
      `${accordNe} le ${v.locataireDateNaissance} à ${v.locataireLieuNaissance}, ` +
      `de nationalité ${v.locataireNationalite}`,
    );
    text(`${accordDesigne} ci-après « le preneur »`, { italic: true, center: true });
    empty();

    text('Il a été convenu et arrêté ce qui suit :');
    empty();
    text(
      'Le bailleur loue les locaux et équipements ci-après désignés au preneur ' +
      'qui les accepte aux conditions suivantes :',
    );
    empty();

    // 5. Adresse
    heading('Adresse du logement donné en location');
    text(v.bienAdresseLigne1);
    if (v.bienComplement) text(v.bienComplement);
    text(v.bienCpVille);
    empty();
    text(`Un studio de ${v.bienSurfaceM2}m² avec ${v.bienPieces}, meublé.`);
    empty();

    // 6. État des lieux
    heading('État des lieux contradictoire');
    text(
      'Un état des lieux contradictoire sera établi lors de la remise des clés au locataire ' +
      'et lors de la restitution de celles-ci.',
    );
    text("L'état des lieux sera obligatoirement annexé au présent contrat.");
    empty();

    // 7. Inventaire intro
    heading('Inventaire contradictoire');
    text(
      'La présente location étant consentie et acceptée en meublé, un inventaire contradictoire ' +
      'des meubles sera établi lors de la remise des clés au locataire et lors de la restitution ' +
      "de celles-ci. L'inventaire sera annexé au présent contrat. Le preneur sera responsable de " +
      'toute détérioration ou perte pouvant survenir à ce mobilier.',
    );
    empty();

    // 8. Durée
    heading('Durée');
    text(
      `Le logement constitue la résidence principale du locataire. La présente ` +
      `location est consentie et acceptée pour une durée de ${v.dureeBail} ` +
      `qui commence à courir le ${dateDebutLettres} – ${dateDebutChiffres} ` +
      `renouvelable ensuite par tacite reconduction et par période d'un an faute de congé préalable.`,
    );
    empty();

    // 9. Forme du congé
    heading('Forme du congé, durée du préavis');
    text('Le présent contrat pourra être résilié :');
    bullet(
      `par le preneur à tout moment, moyennant un délai de préavis de ${v.preavisLocataire} ` +
      "(partant de la date de réception de l'acte)",
    );
    bullet(
      `par le bailleur, à l'expiration du bail ou de chacun de ses renouvellements, moyennant ` +
      `un délai de préavis de ${v.preavisBailleur}. Lorsque le logement constitue la résidence ` +
      'principale du locataire, le refus du renouvellement du bail par le bailleur doit être ' +
      'motivé soit par sa décision de reprendre ou de vendre le logement, soit par un motif ' +
      "légitime et sérieux, notamment l'inexécution par le locataire de l'une des obligations " +
      "lui incombant, et notifié au preneur 3 mois avant l'expiration du bail.",
    );
    text(
      'Le congé de location devra être signifié de part et d\'autre par lettre recommandée ' +
      "avec accusé de réception ou par acte d'huissier.",
    );
    text(
      "En cas de résiliation du preneur ou à l'expiration du bail, la notification de résiliation " +
      'ou de fin de bail vaudra engagement formel de partir et renonciation à tout maintien dans ' +
      "les lieux, sans qu'il soit besoin de recourir à aucune formalité. Faute de libérer les lieux " +
      'à la date convenue, la clause pénale incluse dans le présent contrat sera immédiatement applicable.',
    );
    empty();

    // 10. Loyer
    heading('Montant et paiement du loyer');
    text(
      `La présente location est consentie et acceptée moyennant un paiement mensuel ` +
      `et d'avance de ${montantEnLettres(v.loyer)} euros (${Math.round(v.loyer)} euros). ` +
      `Il sera payable le ${jp} de chaque mois.`,
    );
    empty();

    // 11. Charges
    heading('Charges');
    text(
      `Les charges sont fixées forfaitairement à ${montantEnLettres(v.charges)} euros ` +
      `(${Math.round(v.charges)} euros) par mois. Elles seront acquittées en même temps que le ` +
      "loyer, c'est-à-dire mensuellement et d'avance et révisées chaque année aux " +
      `mêmes conditions que le loyer principal. Elles contiennent notamment ` +
      `${v.bienChargesIncluses}.`,
    );
    empty();

    // 12. Indexation
    heading('Indexation');
    text(
      "Le loyer pourra être indexé annuellement à la date anniversaire du contrat, " +
      "sur la base de l'Indice de Référence des Loyers (IRL) publié chaque trimestre " +
      "par l'INSEE (article 17-1 de la loi n° 89-462 du 6 juillet 1989). L'indice de " +
      'référence est celui du trimestre précédant la signature du présent contrat. ' +
      'À chaque révision, le nouveau loyer sera calculé selon la formule : ' +
      'nouveau loyer = loyer en cours × (nouvel IRL / IRL de référence).',
    );
    empty();

    // 13. Dépôt de garantie
    heading('Dépôt de garantie');
    bullet(
      `À titre de garantie de l'entière exécution de ses obligations le locataire verse, ce jour, ` +
      `un dépôt de garantie correspondant à la somme de ${montantEnLettres(v.depotGarantie)} euros ` +
      `(${Math.round(v.depotGarantie)} euros).`,
    );
    bullet(
      `Ce dépôt qui ne pourra excéder deux mois de loyer principal ne dispensera en aucun cas le ` +
      `locataire du paiement du loyer et des charges aux dates fixées. Il sera restitué dans un ` +
      `délai maximal de ${v.delaiRestitutionDepot} à compter du départ du locataire, déduction ` +
      'faite, le cas échéant, des sommes restant dues au bailleur et des paiements dont ce dernier ' +
      "pourrait être tenu pour responsable aux lieu et place du locataire.",
    );
    bullet('Le dépôt de garantie ne sera pas révisable au cours de la présente location.');
    empty();

    // 14. Obligations preneur
    heading('Obligations du preneur');
    text('Le preneur est tenu aux obligations suivantes :');
    for (const o of OBLIGATIONS_PRENEUR) bullet(o);
    empty();

    // 15. Obligations bailleur
    heading('Obligations du bailleur');
    text('Le bailleur est tenu aux principales obligations suivantes :');
    for (const o of OBLIGATIONS_BAILLEUR) bullet(o);
    empty();

    // 16. Clause résolutoire
    heading('Clause résolutoire');
    for (const c of CLAUSE_RESOLUTOIRE) bullet(c);
    empty();

    // 17. Clause pénale
    heading('Clause pénale');
    for (const c of CLAUSE_PENALE) bullet(c);
    empty();

    // 18. Élection de domicile
    heading('Élection de domicile');
    text(
      'Pour l\'exécution des présentes et de leur suite, le bailleur fait élection de domicile ' +
      'en sa demeure et le preneur dans les lieux loués.',
    );
    empty();

    // 19. Annexes obligatoires
    heading('Annexes obligatoires');
    text(
      'Sont annexés au présent contrat conformément à la loi du 6 juillet 1989 ' +
      "et à ses textes d'application :",
    );
    for (const a of ANNEXES_OBLIGATOIRES) bullet(a);
    empty();

    // 20. Signatures
    text(
      `Fait à ${v.lieuSignature}, le ${dateSignatureStr}, en originaux dont un remis au preneur.`,
    );
    empty();
    text('Le preneur\t\t\t\t\tLe bailleur', { bold: true });
    empty();
    text(
      '(Faire précéder chaque signature de la mention manuscrite : « Lu et approuvé, bon pour accord ».)',
      { italic: true },
    );

    // 21. Page 2 — État des lieux
    doc.addPage();
    heading('État des lieux contradictoire');
    empty();
    text('Remarques :');
    doc.moveDown(3);
    text('Défauts :');
    doc.moveDown(3);
    text(`Fait à ${v.lieuSignature}, le ___/___/______`);
    empty();

    // 22-23. Inventaire détaillé
    if (v.inventaire) {
      heading('Inventaire contradictoire');
      empty();
      for (const { key, label } of INVENTAIRE_LABELS) {
        const items = v.inventaire[key];
        if (!items || items.length === 0) continue;
        text(`${label} :`, { bold: true });
        for (const item of items) bullet(item);
        empty();
      }
      text(`Fait à ${v.lieuSignature}, le ___/___/______`);
    }

    // Signature image si disponible
    if (v.signaturePngBase64) {
      try {
        const sigBuffer = Buffer.from(v.signaturePngBase64, 'base64');
        doc.moveDown(1);
        doc.image(sigBuffer, M_LEFT, undefined, {
          width: v.signatureLargeurMm * 2.835,
        });
      } catch (err) {
        console.warn(
          `[bail-pdf] erreur insertion signature : ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    doc.end();
  });
}

// ============================================================
// Helper : format date en chiffres ("11 avril 2026")
// ============================================================

function formatDateChiffres(d: Date): string {
  const MOIS = [
    '', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  const jour = d.getDate() === 1 ? '1er' : String(d.getDate());
  const mois = MOIS[d.getMonth() + 1] ?? '';
  return `${jour} ${mois} ${d.getFullYear()}`;
}
