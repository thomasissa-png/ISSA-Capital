/**
 * Tests frontmatter — parsing + patch bit-parfait.
 *
 * Fixtures : fiches réelles du vault Obsidian (second-cerveau/)
 * Critère de réussite : parse + re-serialize → bit-identique à l'original
 */
import { describe, it, expect } from 'vitest';
import {
  parseObsidianFile,
  patchFrontmatterField,
  upsertFrontmatterField,
  addToFrontmatterList,
  extractEmails,
  isBitIdentical,
} from '../frontmatter';

// ============================================================
// Fixtures — fiches réelles du vault
// ============================================================

/** Contact pro (Martin Yhuel) — avec listes et accents */
const FIXTURE_CONTACT_PRO = `---
type: contact
société: PNM Avocats
rôle: Avocat Associé
tags:
  - pro
  - juridique
date_dernière_interaction: [à compléter par Thomas]
---

# Martin Yhuel

## Qui c'est

Avocat de la famille Issa. Avocat Associé chez PNM Avocats, spécialisé en droit des sociétés, capital-investissement et M&A. Basé à Lille.

## Projets liés

- [[Projets/ISSA Capital]] — conseil juridique
- [[Projets/Gradient One]] — conseil juridique
- [[Projets/Versi Immobilier]] — conseil juridique
- [[Projets/Versi Invest]] — conseil juridique

## Notes

Accès toutes entités (IC, GO, VI, VV).
`;

/** Contact famille (Leslie Guérin) — champs vides */
const FIXTURE_CONTACT_FAMILLE = `---
type: contact
société:
rôle:
tags:
  - famille
date_dernière_interaction: [à compléter par Thomas]
---

# Leslie Guérin

## Qui c'est

Mère d'Antoine Issa (2015) et Noémie Issa (2018), les deux premiers enfants de [[Contacts/Thomas Issa]].

## Notes

[à compléter par Thomas]
`;

/** Contact pro (Emmanuel Gomez) */
const FIXTURE_CONTACT_GOMEZ = `---
type: contact
société: Indépendant
rôle: Conseiller
tags:
  - pro
  - conseiller
date_dernière_interaction: [à compléter par Thomas]
---

# Emmanuel Gomez

## Qui c'est

Ex-Président de [[Projets/Gradient One]]. Conseiller proche de [[Contacts/Thomas Issa]] (sans contrat). Lien direct avec [[Projets/Versimo]] (filiale de Gradient One).

## Projets liés

- [[Projets/Gradient One]] — ex-Président
- [[Projets/Versimo]] — lien opérationnel

## Notes

Accès toutes entités (IC, GO, VI, VV). N'est PAS co-actionnaire Gradient One (les 3 co-actionnaires sont Thomas, Carl, Maxime). Rôle : conseil informel.
`;

/** Template Réunion — avec {{placeholder}} */
const FIXTURE_TEMPLATE_REUNION = `---
date: {{date}}
participants:
projet:
type: réunion
---

# {{title}}

## Contexte
Pourquoi cette réunion, avec qui, où.

## Ce qui a été dit
Les points clés, en vrac si besoin — Claude structurera.

## Décisions prises


## Actions
- [ ] [Action] — [Responsable] — [Deadline]

## Notes perso
Ce que j'en pense, ce que je retiens.
`;

/** Template Contact — champs email présents mais vides */
const FIXTURE_TEMPLATE_CONTACT = `---
nom:
société:
rôle:
email:
téléphone:
rencontré_via:
date_premier_contact:
tags: []
---

# {{title}}

## Qui c'est
1-2 phrases : qui est cette personne, pourquoi je la connais.

## Dernière interaction
Date + contexte.

## Ce qu'il/elle cherche


## Notes
Ce que je dois savoir pour la prochaine interaction.
`;

/** Fiche locataire synthétique — avec email et alias */
const FIXTURE_LOCATAIRE = `---
civilite: Monsieur
nom_officiel: Kenan Beguigneau
adresse_bien: 2 bis boulevard de la Seine, Studio 7, 92000 Nanterre
montant_loyer: 590
montant_charges: 100
date_entree_bail: 2024-05-23
email: kbeguigneau@gmail.com
alias_email:
  - kenanbe@gmail.com
  - kenan.b@outlook.fr
date_dernière_interaction: 2026-05-06
---

# Kenan Beguigneau

## Qui c'est

Locataire du Studio 7 au 2 bis boulevard de la Seine, Nanterre.

## Historique

### 2026-05-06 — Confirmation virement
Kenan confirme le virement du loyer de mai 2026.

### 2026-04-03 — Entrée dans les lieux
Signature du bail et remise des clés.

## Notes

Paiement par virement bancaire le 3 de chaque mois.
`;

/** Template Projet */
const FIXTURE_TEMPLATE_PROJET = `---
nom:
statut: actif | en pause | terminé
associés:
date_début:
---

# {{title}}

## C'est quoi
1-2 phrases.

## Objectif actuel
Ce qu'on cherche à atteindre dans les 3 prochains mois.

## Décisions récentes


## Prochaines étapes
- [ ]

## Liens
- Site :
- Drive :
- Repo :
`;

/** Fichier sans frontmatter */
const FIXTURE_NO_FRONTMATTER = `# Simple note

Du contenu sans frontmatter.
`;

// ============================================================
// Tests : parsing
// ============================================================

describe('parseObsidianFile', () => {
  it('parse les champs scalaires du frontmatter (Martin Yhuel)', () => {
    const result = parseObsidianFile(FIXTURE_CONTACT_PRO);
    expect(result.frontmatter).not.toBeNull();
    expect(result.frontmatter!.fields['type']).toBe('contact');
    expect(result.frontmatter!.fields['société']).toBe('PNM Avocats');
    expect(result.frontmatter!.fields['rôle']).toBe('Avocat Associé');
  });

  it('parse les listes YAML (tags)', () => {
    const result = parseObsidianFile(FIXTURE_CONTACT_PRO);
    expect(result.frontmatter!.lists['tags']).toEqual(['pro', 'juridique']);
  });

  it('parse les champs vides comme null (Leslie Guérin)', () => {
    const result = parseObsidianFile(FIXTURE_CONTACT_FAMILLE);
    expect(result.frontmatter!.fields['société']).toBeNull();
    expect(result.frontmatter!.fields['rôle']).toBeNull();
  });

  it('parse les nombres (loyer locataire)', () => {
    const result = parseObsidianFile(FIXTURE_LOCATAIRE);
    expect(result.frontmatter!.fields['montant_loyer']).toBe(590);
    expect(result.frontmatter!.fields['montant_charges']).toBe(100);
  });

  it('préserve les dates YYYY-MM-DD comme strings (pas de conversion en nombre)', () => {
    const result = parseObsidianFile(FIXTURE_LOCATAIRE);
    expect(result.frontmatter!.fields['date_entree_bail']).toBe('2024-05-23');
    expect(typeof result.frontmatter!.fields['date_entree_bail']).toBe('string');
  });

  it('parse les alias email comme liste', () => {
    const result = parseObsidianFile(FIXTURE_LOCATAIRE);
    expect(result.frontmatter!.lists['alias_email']).toEqual([
      'kenanbe@gmail.com',
      'kenan.b@outlook.fr',
    ]);
  });

  it('parse les tags vides [] comme null + liste vide', () => {
    const result = parseObsidianFile(FIXTURE_TEMPLATE_CONTACT);
    // tags: [] devrait donner fields.tags = null et pas de liste
    expect(result.frontmatter!.fields['tags']).toBeNull();
  });

  it('extrait correctement le body (après le frontmatter)', () => {
    const result = parseObsidianFile(FIXTURE_CONTACT_PRO);
    expect(result.body).toContain('# Martin Yhuel');
    expect(result.body).toContain('Avocat de la famille Issa');
  });

  it('gère un fichier sans frontmatter', () => {
    const result = parseObsidianFile(FIXTURE_NO_FRONTMATTER);
    expect(result.frontmatter).toBeNull();
    expect(result.body).toBe(FIXTURE_NO_FRONTMATTER);
  });

  it('parse le template Réunion avec {{placeholder}}', () => {
    const result = parseObsidianFile(FIXTURE_TEMPLATE_REUNION);
    expect(result.frontmatter!.fields['date']).toBe('{{date}}');
    expect(result.frontmatter!.fields['type']).toBe('réunion');
  });
});

// ============================================================
// Tests : bit-parfait (parse + pas de modification = identique)
// ============================================================

describe('bit-parfait — parse sans modification', () => {
  const fixtures: Array<[string, string]> = [
    ['Contact pro (Martin Yhuel)', FIXTURE_CONTACT_PRO],
    ['Contact famille (Leslie Guérin)', FIXTURE_CONTACT_FAMILLE],
    ['Contact pro (Emmanuel Gomez)', FIXTURE_CONTACT_GOMEZ],
    ['Template Réunion', FIXTURE_TEMPLATE_REUNION],
    ['Template Contact', FIXTURE_TEMPLATE_CONTACT],
    ['Locataire (Kenan)', FIXTURE_LOCATAIRE],
    ['Template Projet', FIXTURE_TEMPLATE_PROJET],
  ];

  for (const [name, fixture] of fixtures) {
    it(`${name} — fullContent === original`, () => {
      const result = parseObsidianFile(fixture);
      expect(result.fullContent).toBe(fixture);
    });
  }
});

// ============================================================
// Tests : patch frontmatter
// ============================================================

describe('patchFrontmatterField', () => {
  it('modifie un champ existant sans toucher les autres', () => {
    const result = patchFrontmatterField(
      FIXTURE_LOCATAIRE,
      'date_dernière_interaction',
      '2026-05-13',
    );

    // Le champ modifié a la nouvelle valeur
    const parsed = parseObsidianFile(result);
    expect(parsed.frontmatter!.fields['date_dernière_interaction']).toBe('2026-05-13');

    // Les autres champs sont intacts
    expect(parsed.frontmatter!.fields['civilite']).toBe('Monsieur');
    expect(parsed.frontmatter!.fields['nom_officiel']).toBe('Kenan Beguigneau');
    expect(parsed.frontmatter!.fields['montant_loyer']).toBe(590);
    expect(parsed.frontmatter!.fields['email']).toBe('kbeguigneau@gmail.com');
  });

  it('préserve l\'ordre des clés (ne réordonne pas)', () => {
    const result = patchFrontmatterField(
      FIXTURE_LOCATAIRE,
      'montant_charges',
      150,
    );

    // Vérifier que l'ordre des clés est préservé dans le YAML brut
    const lines = result.split('\n');
    const loyerIdx = lines.findIndex((l) => l.startsWith('montant_loyer:'));
    const chargesIdx = lines.findIndex((l) => l.startsWith('montant_charges:'));
    const emailIdx = lines.findIndex((l) => l.startsWith('email:'));

    expect(loyerIdx).toBeLessThan(chargesIdx);
    expect(chargesIdx).toBeLessThan(emailIdx);
  });

  it('ne touche pas au body Markdown', () => {
    const result = patchFrontmatterField(
      FIXTURE_LOCATAIRE,
      'montant_loyer',
      650,
    );

    // Le body doit être identique
    const originalBody = FIXTURE_LOCATAIRE.slice(
      FIXTURE_LOCATAIRE.indexOf('---', 4) + 4,
    );
    const resultBody = result.slice(result.indexOf('---', 4) + 4);
    expect(resultBody).toBe(originalBody);
  });

  it('retourne le contenu inchangé si la clé n\'existe pas', () => {
    const result = patchFrontmatterField(
      FIXTURE_LOCATAIRE,
      'champ_inexistant',
      'valeur',
    );
    expect(result).toBe(FIXTURE_LOCATAIRE);
  });

  it('gère la mise à jour d\'un champ vide (société de Leslie)', () => {
    const result = patchFrontmatterField(
      FIXTURE_CONTACT_FAMILLE,
      'société',
      'Nouvelle société',
    );

    const parsed = parseObsidianFile(result);
    expect(parsed.frontmatter!.fields['société']).toBe('Nouvelle société');
    // Les listes ne sont pas touchées
    expect(parsed.frontmatter!.lists['tags']).toEqual(['famille']);
  });

  it('bit-parfait : modifier un seul champ préserve tout le reste', () => {
    const result = patchFrontmatterField(
      FIXTURE_LOCATAIRE,
      'date_dernière_interaction',
      '2026-05-13',
    );

    // Comparer ligne par ligne — seule la ligne modifiée doit différer
    const originalLines = FIXTURE_LOCATAIRE.split('\n');
    const resultLines = result.split('\n');

    let diffCount = 0;
    const maxLen = Math.max(originalLines.length, resultLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (originalLines[i] !== resultLines[i]) {
        diffCount++;
        // La seule différence doit être sur la ligne date_dernière_interaction
        expect(resultLines[i]).toBe('date_dernière_interaction: 2026-05-13');
      }
    }
    expect(diffCount).toBe(1);
  });

  it('préserve les listes YAML intactes lors du patch', () => {
    const result = patchFrontmatterField(
      FIXTURE_LOCATAIRE,
      'civilite',
      'Madame',
    );

    const parsed = parseObsidianFile(result);
    expect(parsed.frontmatter!.lists['alias_email']).toEqual([
      'kenanbe@gmail.com',
      'kenan.b@outlook.fr',
    ]);
  });
});

// ============================================================
// Tests : upsertFrontmatterField (S24)
// ============================================================

describe('upsertFrontmatterField', () => {
  it('ajoute une clé absente en fin de frontmatter', () => {
    const result = upsertFrontmatterField(FIXTURE_LOCATAIRE, 'canal_préféré', 'WhatsApp');
    const parsed = parseObsidianFile(result);
    expect(parsed.frontmatter!.fields['canal_préféré']).toBe('WhatsApp');
    // Champs existants préservés
    expect(parsed.frontmatter!.lists['alias_email']).toEqual([
      'kenanbe@gmail.com',
      'kenan.b@outlook.fr',
    ]);
  });

  it('met à jour une clé existante (délègue au patch)', () => {
    const once = upsertFrontmatterField(FIXTURE_LOCATAIRE, 'fréquence_échanges', 'occasionnel');
    const twice = upsertFrontmatterField(once, 'fréquence_échanges', 'soutenu');
    const parsed = parseObsidianFile(twice);
    expect(parsed.frontmatter!.fields['fréquence_échanges']).toBe('soutenu');
    // Une seule occurrence de la clé (pas de doublon)
    const occurrences = twice.split('\n').filter((l) => l.startsWith('fréquence_échanges:')).length;
    expect(occurrences).toBe(1);
  });

  it('sans frontmatter → contenu inchangé', () => {
    const noFm = '# Titre\n\ntexte\n';
    expect(upsertFrontmatterField(noFm, 'canal_préféré', 'Email')).toBe(noFm);
  });

  it('préserve le body après ajout', () => {
    const result = upsertFrontmatterField(FIXTURE_CONTACT_PRO, 'canal_préféré', 'Réunion');
    const originalBody = FIXTURE_CONTACT_PRO.slice(FIXTURE_CONTACT_PRO.indexOf('---', 4) + 4);
    const resultBody = result.slice(result.indexOf('---', 4) + 4);
    expect(resultBody).toBe(originalBody);
  });
});

// ============================================================
// Tests : addToFrontmatterList (S24 nuit — bouton « Lier »)
// ============================================================

describe('addToFrontmatterList', () => {
  const FIXTURE_NO_ALIAS = `---
type: contact
email: maxime.lemoine@edhec.com
telephone: +33 6 32 68 32 74
---

# Maxime Lemoine
`;

  const FIXTURE_WITH_ALIAS = `---
type: contact
email: kbeguigneau@gmail.com
alias_email:
  - kenanbe@gmail.com
  - kenan.b@outlook.fr
telephone: +33 6 11 22 33 44
---

# Kenan B.
`;

  const FIXTURE_FLOW_STYLE = `---
type: contact
email: x@y.fr
alias_email: [a@b.fr, c@d.fr]
---

# Test
`;

  it('crée la liste si absente, après la clé ancre', () => {
    const result = addToFrontmatterList(FIXTURE_NO_ALIAS, 'alias_email', 'maxime@versi.fr', 'email');
    expect(result).toContain('alias_email:');
    expect(result).toContain('  - maxime@versi.fr');
    const idxEmail = result.indexOf('email:');
    const idxAlias = result.indexOf('alias_email:');
    const idxTel = result.indexOf('telephone:');
    expect(idxEmail).toBeLessThan(idxAlias);
    expect(idxAlias).toBeLessThan(idxTel);
  });

  it('append à une liste existante (bloc-style)', () => {
    const result = addToFrontmatterList(
      FIXTURE_WITH_ALIAS,
      'alias_email',
      'kenan@versi.fr',
      'email',
    );
    expect(result).toContain('  - kenan@versi.fr');
    expect(result).toContain('  - kenanbe@gmail.com');
    expect(result).toContain('  - kenan.b@outlook.fr');
  });

  it('idempotent : valeur déjà présente → no-op (case-insensitive)', () => {
    const result = addToFrontmatterList(
      FIXTURE_WITH_ALIAS,
      'alias_email',
      'KenanBE@gmail.com',
      'email',
    );
    expect(result).toBe(FIXTURE_WITH_ALIAS);
  });

  it('YAML flow-style → REFUSE l\'édition (anti-corruption, audit S24 nuit)', () => {
    const result = addToFrontmatterList(FIXTURE_FLOW_STYLE, 'alias_email', 'new@x.fr', 'email');
    // Inchangé : on préfère ne rien faire plutôt que casser le YAML.
    expect(result).toBe(FIXTURE_FLOW_STYLE);
    expect(result).not.toContain('  - new@x.fr');
  });

  it('frontmatter absent → contenu inchangé', () => {
    const noFm = '# Titre\n\nsans frontmatter\n';
    expect(addToFrontmatterList(noFm, 'alias_email', 'x@y.fr', 'email')).toBe(noFm);
  });

  it('clé ancre absente → contenu inchangé (pas de point d\'insertion fiable)', () => {
    const noAnchor = '---\ntype: contact\n---\n\n# Test\n';
    expect(addToFrontmatterList(noAnchor, 'alias_email', 'x@y.fr', 'email')).toBe(noAnchor);
  });

  // S26 H2 — Hook de normalisation custom pour dédup par hash (téléphone).
  describe('normalize hook (S26 H2 — dédup par hash téléphone normalisé)', () => {
    const FIXTURE_OLD_FORMAT = `---
type: contact
email: a@b.fr
telephone: +33 6 11 22 33 44
alias_telephone:
  - 664850631
---

# Old phone
`;

    const normalizePhone = (v: string): string => {
      const digits = v.replace(/\D/g, '');
      return digits.length >= 6 ? digits.slice(-9) : v.trim().toLowerCase();
    };

    it('dédup texte (défaut) : "+33 6 64 85 06 31" et "664850631" sont vus comme DIFFÉRENTS → doublon créé', () => {
      const result = addToFrontmatterList(
        FIXTURE_OLD_FORMAT,
        'alias_telephone',
        '+33 6 64 85 06 31',
        'telephone',
      );
      // Sans hook : les deux formats coexistent (régression S24-S26 si pas de fix).
      expect(result).toContain('  - 664850631');
      expect(result).toContain('  - +33 6 64 85 06 31');
    });

    it('dédup hash (hook normalizePhone) : "+33 6 64 85 06 31" et "664850631" → no-op', () => {
      const result = addToFrontmatterList(
        FIXTURE_OLD_FORMAT,
        'alias_telephone',
        '+33 6 64 85 06 31',
        'telephone',
        normalizePhone,
      );
      // Avec hook : doublon détecté → contenu inchangé.
      expect(result).toBe(FIXTURE_OLD_FORMAT);
      expect(result).not.toContain('  - +33 6 64 85 06 31');
    });

    it('dédup hash : nouvelle valeur (téléphone différent) ajoutée normalement', () => {
      const result = addToFrontmatterList(
        FIXTURE_OLD_FORMAT,
        'alias_telephone',
        '+33 7 99 88 77 66',
        'telephone',
        normalizePhone,
      );
      expect(result).toContain('  - +33 7 99 88 77 66');
      // L'ancien reste en place (pas de migration).
      expect(result).toContain('  - 664850631');
    });
  });
});

// ============================================================
// Tests : extractEmails
// ============================================================

describe('extractEmails', () => {
  it('extrait l\'email principal', () => {
    const parsed = parseObsidianFile(FIXTURE_LOCATAIRE);
    const emails = extractEmails(parsed);
    expect(emails).toContain('kbeguigneau@gmail.com');
  });

  it('extrait les alias email', () => {
    const parsed = parseObsidianFile(FIXTURE_LOCATAIRE);
    const emails = extractEmails(parsed);
    expect(emails).toContain('kenanbe@gmail.com');
    expect(emails).toContain('kenan.b@outlook.fr');
  });

  it('retourne tous les emails (principal + alias)', () => {
    const parsed = parseObsidianFile(FIXTURE_LOCATAIRE);
    const emails = extractEmails(parsed);
    expect(emails).toHaveLength(3);
  });

  it('retourne un tableau vide si pas d\'email', () => {
    const parsed = parseObsidianFile(FIXTURE_CONTACT_PRO);
    const emails = extractEmails(parsed);
    expect(emails).toHaveLength(0);
  });

  it('normalise en lowercase', () => {
    const content = `---
email: Thomas.ISSA@Gmail.com
---

# Test
`;
    const parsed = parseObsidianFile(content);
    const emails = extractEmails(parsed);
    expect(emails).toEqual(['thomas.issa@gmail.com']);
  });

  it('retourne un tableau vide si pas de frontmatter', () => {
    const parsed = parseObsidianFile(FIXTURE_NO_FRONTMATTER);
    const emails = extractEmails(parsed);
    expect(emails).toHaveLength(0);
  });

  // -----------------------------------------------------------
  // Tests : emails secondaires dans ## Notes (spec D2 vault-paths)
  // -----------------------------------------------------------

  it('extrait un email secondaire depuis ## Notes', () => {
    const content = `---
email: primary@example.com
---

# Test Contact

## Notes

Emails secondaires: secondary@example.com
`;
    const parsed = parseObsidianFile(content);
    const emails = extractEmails(parsed);
    expect(emails).toContain('primary@example.com');
    expect(emails).toContain('secondary@example.com');
    expect(emails).toHaveLength(2);
  });

  it('extrait plusieurs emails secondaires (virgule) depuis ## Notes', () => {
    const content = `---
email: primary@example.com
---

# Test Contact

## Notes

Emails secondaires: a@example.com, b@example.com, c@example.com
`;
    const parsed = parseObsidianFile(content);
    const emails = extractEmails(parsed);
    expect(emails).toHaveLength(4);
    expect(emails).toContain('primary@example.com');
    expect(emails).toContain('a@example.com');
    expect(emails).toContain('b@example.com');
    expect(emails).toContain('c@example.com');
  });

  it('extrait un email secondaire meme sans email primaire dans le frontmatter', () => {
    const content = `---
type: contact
---

# Contact sans email primaire

## Notes

Email secondaire: backup@example.com
`;
    const parsed = parseObsidianFile(content);
    const emails = extractEmails(parsed);
    expect(emails).toHaveLength(1);
    expect(emails).toContain('backup@example.com');
  });

  it('ignore les annotations entre parentheses dans les emails secondaires', () => {
    const content = `---
email: timimehmel@gmail.com
---

# Timilas Mehmel

## Notes

Emails secondaires: amrouchemehmel971@gmail.com (garant père)
`;
    const parsed = parseObsidianFile(content);
    const emails = extractEmails(parsed);
    expect(emails).toHaveLength(2);
    expect(emails).toContain('timimehmel@gmail.com');
    expect(emails).toContain('amrouchemehmel971@gmail.com');
  });

  it('deduplique les emails (primaire == secondaire)', () => {
    const content = `---
email: same@example.com
---

# Test

## Notes

Emails secondaires: same@example.com, other@example.com
`;
    const parsed = parseObsidianFile(content);
    const emails = extractEmails(parsed);
    expect(emails).toHaveLength(2);
    expect(emails).toContain('same@example.com');
    expect(emails).toContain('other@example.com');
  });
});

// ============================================================
// Tests : isBitIdentical
// ============================================================

describe('isBitIdentical', () => {
  it('retourne true pour des contenus identiques', () => {
    expect(isBitIdentical(FIXTURE_LOCATAIRE, FIXTURE_LOCATAIRE)).toBe(true);
  });

  it('retourne false pour un seul caractère différent', () => {
    const modified = FIXTURE_LOCATAIRE.replace('590', '591');
    expect(isBitIdentical(FIXTURE_LOCATAIRE, modified)).toBe(false);
  });
});
