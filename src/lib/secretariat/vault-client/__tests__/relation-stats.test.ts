import { describe, it, expect } from 'vitest';
import { computeRelationStats } from '../relation-stats';

const NOW = new Date('2026-05-27T12:00:00Z');

function fiche(historique: string[]): string {
  return ['---', 'nom: Test', '---', '', '## Historique', '', ...historique, ''].join('\n');
}

describe('computeRelationStats (S24)', () => {
  it('aucune section historique → null/null', () => {
    const r = computeRelationStats('---\nnom: X\n---\n\n## Notes\n- rien\n', NOW);
    expect(r.canalPrefere).toBeNull();
    expect(r.frequence).toBeNull();
  });

  it('WhatsApp dominant → canal_préféré WhatsApp', () => {
    const r = computeRelationStats(
      fiche([
        '### 2026-05-26 — WhatsApp : Marc',
        '### 2026-05-24 — WhatsApp : Marc',
        '### 2026-05-20 — Email : objet',
      ]),
      NOW,
    );
    expect(r.canalPrefere).toBe('WhatsApp');
  });

  it('Email dominant → canal_préféré Email', () => {
    const r = computeRelationStats(
      fiche([
        '### 2026-05-25 — Email : a',
        '### 2026-05-22 — Email : b',
        '### 2026-05-21 — WhatsApp : c',
      ]),
      NOW,
    );
    expect(r.canalPrefere).toBe('Email');
  });

  it('réunion calendar → canal Réunion', () => {
    const r = computeRelationStats(fiche(['### 2026-05-20 — Réunion : point projet']), NOW);
    expect(r.canalPrefere).toBe('Réunion');
  });

  it('fréquence soutenue : ≥8 jours distincts sur 30 j', () => {
    const days = ['05-26', '05-25', '05-24', '05-22', '05-20', '05-18', '05-15', '05-10'];
    const r = computeRelationStats(
      fiche(days.map((d) => `### 2026-${d} — WhatsApp : Marc`)),
      NOW,
    );
    expect(r.frequence).toBe('soutenu');
  });

  it('fréquence régulière : 4–7 jours sur 30 j', () => {
    const r = computeRelationStats(
      fiche([
        '### 2026-05-26 — Email : a',
        '### 2026-05-20 — Email : b',
        '### 2026-05-12 — WhatsApp : c',
        '### 2026-05-05 — Email : d',
      ]),
      NOW,
    );
    expect(r.frequence).toBe('régulier');
  });

  it('fréquence occasionnelle : 1–3 jours sur 30 j', () => {
    const r = computeRelationStats(fiche(['### 2026-05-20 — WhatsApp : c']), NOW);
    expect(r.frequence).toBe('occasionnel');
  });

  it('fréquence espacée : entrées hors fenêtre 30 j', () => {
    const r = computeRelationStats(fiche(['### 2026-01-10 — Email : vieux']), NOW);
    expect(r.frequence).toBe('espacé');
  });

  it('même jour, plusieurs entrées → comptées comme 1 jour distinct', () => {
    const r = computeRelationStats(
      fiche([
        '### 2026-05-26 — WhatsApp : matin',
        '### 2026-05-26 — Email : aprem',
      ]),
      NOW,
    );
    expect(r.frequence).toBe('occasionnel');
  });

  it('entrées sans canal reconnu ignorées', () => {
    const r = computeRelationStats(fiche(['### 2026-05-26 — Note interne : blabla']), NOW);
    expect(r.canalPrefere).toBeNull();
    expect(r.frequence).toBeNull();
  });
});
