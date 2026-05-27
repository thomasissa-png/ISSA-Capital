import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseFlatYaml,
  domainOf,
  lookupSocieteByEmail,
  _clearDomainsCache,
} from '../domains';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  _clearDomainsCache();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ENRICH_DOMAINS_YML_PATH;
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  _clearDomainsCache();
});

describe('parseFlatYaml', () => {
  it('parse les paires clé: "valeur" et ignore commentaires/lignes vides', () => {
    const map = parseFlatYaml(
      [
        '# commentaire',
        '',
        'sarani.studio: "Sarani"',
        "versi.fr: 'Versi'",
        'immocrew.fr: Immocrew  # inline comment',
        'ligne-sans-colon',
      ].join('\n'),
    );
    expect(map.get('sarani.studio')).toBe('Sarani');
    expect(map.get('versi.fr')).toBe('Versi');
    expect(map.get('immocrew.fr')).toBe('Immocrew');
    expect(map.has('ligne-sans-colon')).toBe(false);
  });
});

describe('domainOf', () => {
  it('extrait le domaine en minuscule', () => {
    expect(domainOf('Marc.Gernot@Exemple.COM')).toBe('exemple.com');
    expect(domainOf('pas-un-email')).toBeNull();
  });
});

describe('lookupSocieteByEmail (domains.yml par défaut)', () => {
  it('résout les domaines de l’écosystème', () => {
    expect(lookupSocieteByEmail('thomas@sarani.studio')).toBe('Sarani');
    expect(lookupSocieteByEmail('x@immocrew.fr')).toBe('Immocrew');
  });

  it('renvoie null pour un domaine générique (pas de devinette)', () => {
    expect(lookupSocieteByEmail('jean@gmail.com')).toBeNull();
    expect(lookupSocieteByEmail('jean@outlook.com')).toBeNull();
  });

  it('seed embarqué disponible même si l’override ENRICH_DOMAINS_YML_PATH est introuvable (bug prod S24 — ENOENT)', () => {
    process.env.ENRICH_DOMAINS_YML_PATH = '/chemin/inexistant/domains.yml';
    _clearDomainsCache();
    expect(lookupSocieteByEmail('thomas@sarani.studio')).toBe('Sarani');
    expect(lookupSocieteByEmail('x@issa-capital.com')).toBe('ISSA Capital');
  });
});
