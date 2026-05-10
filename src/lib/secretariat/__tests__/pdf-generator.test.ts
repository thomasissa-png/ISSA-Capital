import { describe, it, expect } from 'vitest';
import { generateCrPdf } from '../pdf-generator';
import type { CRDraft } from '../types';

const BASE_CR: CRDraft = {
  reference_placeholder: '[REF_TO_BE_GENERATED]',
  entite: 'GO',
  type_reunion: 'dejeuner',
  date_reunion: '2026-04-09',
  lieu: 'Papà Raffaele, 5 rue Saint-Jacques, 59000 Lille',
  participants: [
    { prenom: 'Thomas', nom: 'Issa', titre: 'Associé', societe: 'Gradient One', qualite_relation: 'Signataire' },
    { prenom: 'Carl', nom: 'Standertskjold-Nordenstam', titre: 'Co-fondateur', societe: 'Gradient One', qualite_relation: 'Co-fondateur' },
  ],
  objet: "Validation du pacte d'associés de Gradient One",
  montant_ttc_eur: 82.43,
  etablissement_nom: 'Papà Raffaele',
  section_1_objet_art_39_1: "La présente réunion avait pour objet la validation du pacte d'associés conformément à l'Art. 39-1 du CGI.",
  section_2_points_abordes: "Les échanges ont porté sur le pacte d'associés et la visite du bien rue des Muguets.",
  section_3_decisions: 'Il a été acté que le pacte sera transmis à Martin Yhuel sous 48h.',
  section_4_suites_a_donner: 'Transmission pacte — Responsable : Thomas Issa — Échéance : 11 avril 2026',
  annexes_photographiques: null,
};

const DATE_ETAB = '2026-04-09T16:42:00Z';

describe('PDF Generator — tests exhaustifs', () => {
  it('génère un PDF valide pour un CR complet', async () => {
    const buf = await generateCrPdf({ cr: BASE_CR, reference: 'GO-CR-2026-0001', dateEtablissement: DATE_ETAB });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('génère un PDF sans section 4 (null)', async () => {
    const cr = { ...BASE_CR, section_4_suites_a_donner: null };
    const buf = await generateCrPdf({ cr, reference: 'GO-CR-2026-0002', dateEtablissement: DATE_ETAB });
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
  });

  it('génère un PDF sans montant ni établissement (null)', async () => {
    const cr = { ...BASE_CR, montant_ttc_eur: null, etablissement_nom: null };
    const buf = await generateCrPdf({ cr, reference: 'GO-CR-2026-0003', dateEtablissement: DATE_ETAB });
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('génère un PDF pour entité IC', async () => {
    const cr = { ...BASE_CR, entite: 'IC' as const };
    const buf = await generateCrPdf({ cr, reference: 'IC-CR-2026-0001', dateEtablissement: DATE_ETAB });
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('génère un PDF pour entité VI', async () => {
    const cr = { ...BASE_CR, entite: 'VI' as const };
    const buf = await generateCrPdf({ cr, reference: 'VI-CR-2026-0001', dateEtablissement: DATE_ETAB });
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('génère un PDF pour entité VV', async () => {
    const cr = { ...BASE_CR, entite: 'VV' as const };
    const buf = await generateCrPdf({ cr, reference: 'VV-CR-2026-0001', dateEtablissement: DATE_ETAB });
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('génère un PDF avec annexes photographiques (sans images)', async () => {
    const cr = {
      ...BASE_CR,
      annexes_photographiques: [
        { numero: 1, legende: "Façade de l'immeuble, 12 rue de Tournon" },
        { numero: 2, legende: 'Salon principal, parquet chevron' },
      ],
    };
    const buf = await generateCrPdf({ cr, reference: 'GO-CR-2026-0004', dateEtablissement: DATE_ETAB });
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('génère un PDF multi-pages (section 2 longue)', async () => {
    const longText = 'Les échanges ont porté sur de nombreux sujets stratégiques liés au développement de Gradient One et à la structuration de son portefeuille de participations. '.repeat(20);
    const cr = { ...BASE_CR, section_2_points_abordes: longText };
    const buf = await generateCrPdf({ cr, reference: 'GO-CR-2026-0005', dateEtablissement: DATE_ETAB });
    expect(buf.length).toBeGreaterThan(3000);
  });

  it('gère les caractères spéciaux UTF-8 (accents, cédilles)', async () => {
    const cr = {
      ...BASE_CR,
      lieu: "Café à côté de l'église — Père Noël, çà et là",
      objet: "Réunion stratégique — acquéreurs potentiels (début été)",
      section_1_objet_art_39_1: "Conformément à l'intérêt social de l'entité — Art. 39-1 du CGI. Dépense : 82,43 € TTC.",
    };
    const buf = await generateCrPdf({ cr, reference: 'GO-CR-2026-0006', dateEtablissement: DATE_ETAB });
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('gère un participant unique', async () => {
    const cr = {
      ...BASE_CR,
      participants: [{ prenom: 'Thomas', nom: 'Issa', titre: 'Président', societe: 'ISSA Capital SAS', qualite_relation: 'Signataire' }],
    };
    const buf = await generateCrPdf({ cr, reference: 'IC-CR-2026-0002', dateEtablissement: DATE_ETAB });
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('gère une date d\'établissement au format ISO complet', async () => {
    const buf = await generateCrPdf({ cr: BASE_CR, reference: 'GO-CR-2026-0007', dateEtablissement: '2026-04-09T23:59:59.999Z' });
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('ne crashe pas sur une section vide (string vide)', async () => {
    const cr = {
      ...BASE_CR,
      section_2_points_abordes: '',
      section_3_decisions: '',
    };
    const buf = await generateCrPdf({ cr, reference: 'GO-CR-2026-0008', dateEtablissement: DATE_ETAB });
    expect(buf.length).toBeGreaterThan(500);
  });
});
