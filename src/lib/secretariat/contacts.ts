/**
 * Base de contacts récurrents — Secrétariat ISSA Capital.
 *
 * Persistée dans /home/runner/issa-data/contacts.json.
 * Les contacts de base sont embarqués dans le code et fusionnés avec
 * les contacts ajoutés dynamiquement (via Anya quand elle rencontre
 * une personne inconnue).
 *
 * Injecté dans le system prompt Claude via [INJECTION_DATABASE_CONTACTS_ICI].
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_DIR = existsSync('/home/runner') ? '/home/runner/issa-data' : '/tmp/issa-secretariat';
const CONTACTS_PATH = resolve(DATA_DIR, 'contacts.json');
const GLOBAL_KEY = '__issa_contacts__' as const;

export interface Contact {
  prenom: string;
  nom: string;
  titre: string;
  societe: string;
  entitesVisibles: string[];
  notes?: string;
}

/**
 * Contacts de base — embarqués dans le code, toujours présents.
 */
const BASE_CONTACTS: Contact[] = [
  {
    prenom: 'Thomas',
    nom: 'Issa',
    titre: 'Président',
    societe: 'ISSA Capital SAS',
    entitesVisibles: ['IC', 'GO', 'VI', 'VV'],
    notes: 'Fondateur. Accès toutes entités. Signataire de tous les CR.',
  },
  {
    prenom: 'Jean-Pierre',
    nom: 'Issa',
    titre: 'Co-Managing Director',
    societe: '2J Impression',
    entitesVisibles: ['IC'],
    notes: 'Père de Thomas. Figure fondatrice patrimoniale. Board ISSA Capital.',
  },
  {
    prenom: 'Carl',
    nom: 'Standertskjold-Nordenstam',
    titre: 'Co-fondateur',
    societe: 'Gradient One / Versi',
    entitesVisibles: ['GO', 'VI', 'VV'],
    notes: "Co-fondateur Versi (2022). Co-actionnaire Gradient One. Accès GO/VI/VV uniquement, JAMAIS IC. NON responsable immobilier — c'est Maxime qui gère l'immobilier.",
  },
  {
    prenom: 'Maxime',
    nom: 'Lemoine',
    titre: 'Co-fondateur',
    societe: 'Gradient One / Versi',
    entitesVisibles: ['GO', 'VI', 'VV'],
    notes: "Co-fondateur Versi (2022). Co-actionnaire Gradient One. Accès GO/VI/VV uniquement, JAMAIS IC. RESPONSABLE de la partie immobilière (Versi Immobilier, Versi Invest, projets immo).",
  },
  {
    prenom: 'Martin',
    nom: 'Yhuel',
    titre: 'Avocat Associé',
    societe: 'PNM Avocats',
    entitesVisibles: ['IC', 'GO', 'VI', 'VV'],
    notes: 'Avocat de la famille Issa. Droit des sociétés, capital-investissement, M&A. Basé à Lille.',
  },
  {
    prenom: 'Emmanuel',
    nom: 'Gomez',
    titre: 'Conseiller',
    societe: 'Indépendant',
    entitesVisibles: ['IC', 'GO', 'VI', 'VV'],
    notes: 'Ex-Président de Gradient One. Conseiller proche de Thomas Issa (sans contrat). Accès toutes entités.',
  },
];

// ============================================================
// Persistence
// ============================================================

function getGlobalContacts(): Contact[] {
  if (!(GLOBAL_KEY in globalThis)) {
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = [];
  }
  return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as Contact[];
}

function setGlobalContacts(data: Contact[]): void {
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = data;
}

function ensureDir(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  } catch { /* best effort */ }
}

/**
 * Charge les contacts dynamiques (ajoutés par Anya).
 */
function loadDynamicContacts(): Contact[] {
  const cached = getGlobalContacts();
  if (cached.length > 0) return cached;

  try {
    ensureDir();
    if (existsSync(CONTACTS_PATH)) {
      const raw = readFileSync(CONTACTS_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Contact[];
      setGlobalContacts(parsed);
      return parsed;
    }
  } catch {
    console.warn('[contacts] fichier corrompu, reset');
  }

  setGlobalContacts([]);
  return [];
}

function saveDynamicContacts(contacts: Contact[]): void {
  setGlobalContacts(contacts);
  try {
    ensureDir();
    writeFileSync(CONTACTS_PATH, JSON.stringify(contacts, null, 2), 'utf8');
  } catch (err) {
    console.error('[contacts] erreur écriture :', err);
  }
}

/**
 * Retourne tous les contacts (base + dynamiques).
 */
export function getAllContacts(): Contact[] {
  const dynamic = loadDynamicContacts();
  return [...BASE_CONTACTS, ...dynamic];
}

/**
 * Ajoute un nouveau contact (depuis Anya quand elle rencontre quelqu'un d'inconnu).
 * Vérifie qu'il n'existe pas déjà (par nom de famille).
 */
export function addContact(contact: Contact): boolean {
  const all = getAllContacts();
  const exists = all.some(
    (c) => c.nom.toLowerCase() === contact.nom.toLowerCase() &&
           c.prenom.toLowerCase() === contact.prenom.toLowerCase(),
  );
  if (exists) return false;

  const dynamic = loadDynamicContacts();
  dynamic.push(contact);
  saveDynamicContacts(dynamic);
  return true;
}

/**
 * Formate tous les contacts pour injection dans le system prompt.
 */
export function formatContactsForPrompt(): string {
  const all = getAllContacts();
  if (all.length === 0) return '(Aucun contact récurrent enregistré)';

  return all.map((c) => {
    const entites = c.entitesVisibles.join(', ');
    const notes = c.notes ? `. Notes : ${c.notes}` : '';
    return `- ${c.prenom} ${c.nom} — ${c.titre}, ${c.societe} (entités visibles : [${entites}])${notes}`;
  }).join('\n');
}
