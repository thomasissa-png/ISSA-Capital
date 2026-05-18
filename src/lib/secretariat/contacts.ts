/**
 * Contacts récurrents — Secrétariat ISSA Capital.
 *
 * Sources fusionnées par `getAllContacts()` :
 * 1. Vault Drive (07. Contacts/) via `vault-contacts.ts` — source de vérité (S15.5F)
 * 2. Contacts dynamiques persistés dans `/home/runner/issa-data/contacts.json`
 *    (ajoutés par Anya quand elle rencontre quelqu'un d'inconnu en CR)
 *
 * Plus de BASE_CONTACTS hardcodés depuis S15.5F (suppression dette technique).
 * Thomas Issa (signataire CR) est référencé en dur dans `cr-renderer.ts`.
 *
 * Injecté dans le system prompt Claude via [INJECTION_DATABASE_CONTACTS_ICI].
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getVaultContacts } from './vault-contacts';
import type { VaultContact } from './vault-contacts';

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
 * Convertit un VaultContact en Contact (interface existante).
 */
function vaultToContact(vc: VaultContact): Contact {
  return {
    prenom: vc.prenom,
    nom: vc.nom,
    titre: vc.titre,
    societe: vc.societe,
    entitesVisibles: vc.entitesVisibles,
    notes: vc.notes,
  };
}

/**
 * Clé de déduplication : prenom+nom en lowercase, trimmed.
 */
function deduplicationKey(c: Contact): string {
  return `${c.prenom.trim().toLowerCase()}|${c.nom.trim().toLowerCase()}`;
}

/**
 * Retourne tous les contacts (vault + base + dynamiques), dédupliqués.
 *
 * Priorité : vault > BASE > dynamic (le vault est la source de vérité,
 * BASE est fallback si vault indisponible).
 * Déduplication par prenom+nom (case-insensitive, trim).
 */
export async function getAllContacts(): Promise<Contact[]> {
  const dynamic = loadDynamicContacts();

  // Charger les contacts vault (avec fallback gracieux)
  let vaultContacts: Contact[] = [];
  try {
    const raw = await getVaultContacts();
    vaultContacts = raw.map(vaultToContact);
  } catch (err) {
    console.warn(
      `[contacts] erreur vault, fallback dynamic uniquement : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Fusion avec dédup : vault prime sur dynamic
  const seen = new Set<string>();
  const result: Contact[] = [];

  // 1. Vault contacts (source de vérité)
  for (const c of vaultContacts) {
    const key = deduplicationKey(c);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(c);
    }
  }

  // 2. Dynamic contacts (Anya-added, ne duplique pas le vault)
  for (const c of dynamic) {
    const key = deduplicationKey(c);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(c);
    }
  }

  return result;
}

/**
 * Ajoute un nouveau contact (depuis Anya quand elle rencontre quelqu'un d'inconnu).
 * Vérifie qu'il n'existe pas déjà (par prenom+nom).
 */
export async function addContact(contact: Contact): Promise<boolean> {
  const all = await getAllContacts();
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
export async function formatContactsForPrompt(): Promise<string> {
  const all = await getAllContacts();
  if (all.length === 0) return '(Aucun contact récurrent enregistré)';

  return all.map((c) => {
    const entites = c.entitesVisibles.join(', ');
    const notes = c.notes ? `. Notes : ${c.notes}` : '';
    return `- ${c.prenom} ${c.nom} — ${c.titre}, ${c.societe} (entités visibles : [${entites}])${notes}`;
  }).join('\n');
}
