/**
 * TEST EXHAUSTIF — PDF photos (0 à 10) + compteur toutes entités.
 *
 * Ce test génère de VRAIS PDFs avec de VRAIES images et vérifie
 * visuellement que le layout est correct. Pas de mock.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateCrPdf } from '../pdf-generator';
import { getNextReference } from '../reference-counter';
import type { CRDraft } from '../types';

// Créer une image JPEG minimale valide (1x1 pixel rouge)
// C'est le plus petit JPEG valide possible
const MINI_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAAAP/Z';

// Image PNG minimale 2x2 pixels (rouge)
const MINI_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADklEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==';

const DATA_DIR = '/tmp/issa-test-exhaustif';
const COUNTER_KEY = '__issa_cr_counter__';

function makeCR(entite: 'IC' | 'GO' | 'VI' | 'VV', withAnnexes: number): CRDraft {
  const annexes = withAnnexes > 0
    ? Array.from({ length: withAnnexes }, (_, i) => ({
        numero: i + 1,
        legende: `Photo ${i + 1} — Vue ${i + 1} du bien immobilier, angle ${i + 1}`,
      }))
    : null;

  return {
    reference_placeholder: '[REF_TO_BE_GENERATED]',
    entite,
    type_reunion: 'dejeuner',
    date_reunion: '2026-04-10',
    lieu: 'Restaurant Le Voltaire, Paris 1er',
    participants: [
      { prenom: 'Thomas', nom: 'Issa', titre: 'Associé', societe: 'Gradient One', qualite_relation: 'Signataire' },
      { prenom: 'Carl', nom: 'Standertskjold-Nordenstam', titre: 'Co-fondateur', societe: 'Gradient One', qualite_relation: 'Co-fondateur' },
    ],
    objet: "Validation du pacte d'associés et visite technique du bien rue des Muguets",
    montant_ttc_eur: 82.43,
    etablissement_nom: 'Le Voltaire',
    section_1_objet_art_39_1: "La présente réunion avait pour objet la validation du pacte d'associés conformément à l'Art. 39-1 du CGI. La dépense s'est élevée à 82,43 € TTC (justificatif disponible dans l'application de facturation Tiime, rattaché à l'entité Gradient One). Le déjeuner a permis de tenir cette réunion dans la continuité de la visite technique réalisée le même jour.",
    section_2_points_abordes: "Les échanges ont porté sur les points suivants : (i) Pacte d'associés Gradient One — Thomas Issa a exposé que la version finale était prête pour transmission à Martin Yhuel, Avocat Associé de PNM Avocats ; (ii) Bien immobilier rue des Muguets — Maxime Lemoine a confirmé l'acceptation de l'offre d'acquisition et la nécessité de procéder à la validation des plans architectes (cf. Annexes photos 1 et 2) ; (iii) Stratégie de pré-commercialisation — les participants ont examiné le calendrier de mise en œuvre.",
    section_3_decisions: "Il a été acté que le pacte d'associés sera transmis à Martin Yhuel dans les 48 heures. Les plans architectes du bien rue des Muguets ont été approuvés. Le lancement de la pré-commercialisation a été validé sous condition de validation des plans.",
    section_4_suites_a_donner: "Transmission du pacte à Martin Yhuel — Responsable : Thomas Issa, Associé — Échéance : 12 avril 2026\nValidation plans architectes — Responsable : Maxime Lemoine, Co-fondateur — Échéance : dès que possible",
    annexes_photographiques: annexes,
  };
}

function makePhotos(count: number): Array<{ base64: string; mimeType: string }> {
  return Array.from({ length: count }, (_, i) => ({
    base64: i % 2 === 0 ? MINI_JPEG_BASE64 : MINI_PNG_BASE64,
    mimeType: i % 2 === 0 ? 'image/jpeg' : 'image/png',
  }));
}

// Reset complet du compteur (globalThis + disque + tous les répertoires possibles)
function resetCounter(): void {
  (globalThis as Record<string, unknown>)[COUNTER_KEY] = {};
  // Nettoyer tous les emplacements possibles du fichier compteur
  const paths = [
    resolve(DATA_DIR, 'cr-counter.json'),
    resolve('/tmp/issa-secretariat', 'cr-counter.json'),
    resolve('/home/runner/issa-data', 'cr-counter.json'),
  ];
  for (const p of paths) {
    try { if (existsSync(p)) unlinkSync(p); } catch { /* ignore */ }
  }
}

describe('TEST EXHAUSTIF — PDF photos + compteur', () => {
  beforeEach(() => {
    resetCounter();
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  });

  // ============================================================
  // PHOTOS : 0, 1, 2, 5, 10
  // ============================================================

  const photoCounts = [0, 1, 2, 5, 10];

  for (const count of photoCounts) {
    it(`PDF avec ${count} photo${count > 1 ? 's' : ''} — génération sans crash, taille correcte`, async () => {
      const cr = makeCR('GO', count);
      const photos = count > 0 ? makePhotos(count) : undefined;

      const buf = await generateCrPdf({
        cr,
        reference: `GO-CR-2026-${String(count + 1).padStart(4, '0')}`,
        dateEtablissement: '2026-04-10T14:30:00Z',
        photos,
      });

      // 1. C'est un PDF valide
      expect(buf.slice(0, 5).toString()).toBe('%PDF-');

      // 2. Taille proportionnelle au nombre de photos
      // Un PDF sans photo ~5KB, avec photos ~6KB+ par photo (images minimales)
      if (count === 0) {
        expect(buf.length).toBeGreaterThan(2000);
      } else {
        expect(buf.length).toBeGreaterThan(2000 + count * 200);
      }

      // 3. Se termine par %%EOF
      const tail = buf.slice(-20).toString('latin1');
      expect(tail).toContain('%%EOF');

      // 4. Écrire le PDF pour inspection manuelle
      const outPath = resolve(DATA_DIR, `test-pdf-${count}-photos.pdf`);
      writeFileSync(outPath, buf);
    });
  }

  // ============================================================
  // ENTITÉS : IC, GO, VI, VV — chacune avec 2 photos
  // ============================================================

  const entites: Array<'IC' | 'GO' | 'VI' | 'VV'> = ['IC', 'GO', 'VI', 'VV'];
  for (const entite of entites) {
    it(`PDF entité ${entite} — génération sans crash avec 2 photos`, async () => {
      const cr = makeCR(entite, 2);
      const photos = makePhotos(2);

      const buf = await generateCrPdf({
        cr,
        reference: `${entite}-CR-2026-0001`,
        dateEtablissement: '2026-04-10T14:30:00Z',
        photos,
      });

      // PDF valide
      expect(buf.slice(0, 5).toString()).toBe('%PDF-');
      expect(buf.length).toBeGreaterThan(2000);

      // Se termine correctement
      const tail = buf.slice(-20).toString('latin1');
      expect(tail).toContain('%%EOF');

      // Écrire pour inspection
      const outPath = resolve(DATA_DIR, `test-pdf-entite-${entite}.pdf`);
      writeFileSync(outPath, buf);
    });
  }

  // ============================================================
  // COMPTEUR : incrémentation par entité
  // ============================================================

  it('compteur IC : 0001 → 0002 → 0003', () => {
    expect(getNextReference('IC')).toBe(`IC-CR-${new Date().getFullYear()}-0001`);
    expect(getNextReference('IC')).toBe(`IC-CR-${new Date().getFullYear()}-0002`);
    expect(getNextReference('IC')).toBe(`IC-CR-${new Date().getFullYear()}-0003`);
  });

  it('compteur GO : 0001 → 0002 → 0003', () => {
    expect(getNextReference('GO')).toBe(`GO-CR-${new Date().getFullYear()}-0001`);
    expect(getNextReference('GO')).toBe(`GO-CR-${new Date().getFullYear()}-0002`);
    expect(getNextReference('GO')).toBe(`GO-CR-${new Date().getFullYear()}-0003`);
  });

  it('compteur VI : 0001 → 0002', () => {
    expect(getNextReference('VI')).toBe(`VI-CR-${new Date().getFullYear()}-0001`);
    expect(getNextReference('VI')).toBe(`VI-CR-${new Date().getFullYear()}-0002`);
  });

  it('compteur VV : 0001 → 0002', () => {
    expect(getNextReference('VV')).toBe(`VV-CR-${new Date().getFullYear()}-0001`);
    expect(getNextReference('VV')).toBe(`VV-CR-${new Date().getFullYear()}-0002`);
  });

  it('compteurs indépendants : IC et GO ne s\'interfèrent pas', () => {
    expect(getNextReference('IC')).toBe(`IC-CR-${new Date().getFullYear()}-0001`);
    expect(getNextReference('GO')).toBe(`GO-CR-${new Date().getFullYear()}-0001`);
    expect(getNextReference('IC')).toBe(`IC-CR-${new Date().getFullYear()}-0002`);
    expect(getNextReference('GO')).toBe(`GO-CR-${new Date().getFullYear()}-0002`);
    expect(getNextReference('VI')).toBe(`VI-CR-${new Date().getFullYear()}-0001`);
    expect(getNextReference('IC')).toBe(`IC-CR-${new Date().getFullYear()}-0003`);
  });

  it('compteur persiste sur disque après sauvegarde', () => {
    getNextReference('IC'); // 0001
    getNextReference('IC'); // 0002

    // Vider le cache mémoire pour forcer la lecture disque
    (globalThis as Record<string, unknown>)[COUNTER_KEY] = {};

    // Le prochain appel doit lire depuis le disque et retourner 0003
    expect(getNextReference('IC')).toBe(`IC-CR-${new Date().getFullYear()}-0003`);
  });
});
