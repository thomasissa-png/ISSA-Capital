/**
 * Seed initial des contacts.
 *
 * Source : docs/product/secretariat-contacts-database.md
 *
 * Stratégie de parsing :
 *   - Le fichier markdown contient des blocs `### Prénom Nom` séparés par `---`
 *   - Champs structurés en bullets : `- **Rôle** : ...`, `- **Entité principale** : ...`
 *   - Les sections de placeholders ("Contacts à compléter par Thomas") sont
 *     détectées et ignorées (le marqueur `[À COMPLÉTER PAR THOMAS]` est la
 *     seule contenu du bloc)
 *   - Les noms contenant des placeholders style `[NOM DE FAMILLE À COMPLÉTER]`
 *     sont conservés tels quels (Carl/Maxime) mais marqués dans `notes`
 *   - UPSERT par clé (prenom + nom) : si le contact existe déjà, skip.
 *     On ne met pas à jour pour ne pas écraser des modifs admin.
 *
 * Usage CLI :
 *   npm run seed
 *
 * Idempotent : peut être ré-exécuté sans créer de doublons.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';

import { getDb, initDatabase } from './connection';
import { getLogger } from '../utils/logger';

const DEFAULT_SOURCE_PATH = path.resolve(
  __dirname,
  '../../../../docs/product/secretariat-contacts-database.md',
);

interface ParsedContact {
  prenom: string;
  nom: string;
  titre: string | null;
  societe: string | null;
  email: string | null;
  telephone: string | null;
  notes: string | null;
  entites_visibles: string[] | null;
}

/**
 * Extrait la valeur d'un bullet `- **Label** : valeur`.
 * Retourne null si absent ou si la valeur est un placeholder.
 */
function extractField(block: string, label: string): string | null {
  const regex = new RegExp(`-\\s*\\*\\*${label}\\*\\*\\s*:\\s*(.+)`, 'i');
  const match = block.match(regex);
  if (!match || !match[1]) return null;

  const value = match[1].trim();
  if (value === '' || value.startsWith('`[À COMPLÉTER') || value.includes('[À COMPLÉTER PAR THOMAS]')) {
    return null;
  }

  // Retire les backticks markdown autour des valeurs type `valeur`
  return value.replace(/^`|`$/g, '').trim();
}

/**
 * Déduit `entites_visibles` depuis la mention "Accès agent secrétariat".
 * - "TOUT" / "toutes entités" → ["IC","GO","VI","VV"]
 * - Contient "ISSA Capital" → IC
 * - Contient "Gradient One" → GO
 * - Contient "Versi Immobilier" → VI
 * - Contient "Versi Invest" → VV
 */
function parseEntitesVisibles(block: string): string[] | null {
  const regex = /-\s*\*\*Accès agent secrétariat\*\*\s*:\s*(.+)/i;
  const match = block.match(regex);
  if (!match || !match[1]) return null;

  const value = match[1].trim();
  if (/TOUT|toutes entit/i.test(value)) {
    return ['IC', 'GO', 'VI', 'VV'];
  }

  const entities: string[] = [];
  if (/ISSA Capital/i.test(value)) entities.push('IC');
  if (/Gradient One/i.test(value)) entities.push('GO');
  if (/Versi Immobilier/i.test(value)) entities.push('VI');
  if (/Versi Invest/i.test(value)) entities.push('VV');

  return entities.length > 0 ? entities : null;
}

/**
 * Parse un bloc `### Prénom Nom` en ParsedContact.
 * Retourne null si le bloc n'est pas un contact valide (placeholder, titre seul, etc.).
 */
function parseContactBlock(block: string): ParsedContact | null {
  // Titre du bloc : `### Prénom Nom [...]`
  const titleMatch = block.match(/^###\s+(.+)$/m);
  if (!titleMatch || !titleMatch[1]) return null;

  const rawTitle = titleMatch[1].trim();

  // Skip les titres qui sont purement des placeholders de section
  // (ex : "Versi Immobilier — équipe / co-gérants")
  if (rawTitle.includes('—') || rawTitle.includes('équipe')) return null;

  // Skip les titres qui commencent par un tiret/bullet de section
  if (rawTitle.startsWith('-')) return null;

  // Si le bloc contient uniquement `[À COMPLÉTER PAR THOMAS]` sans bullets structurés,
  // on skip (section placeholder).
  if (block.includes('[À COMPLÉTER PAR THOMAS]') && !block.includes('**Rôle**')) {
    return null;
  }

  // Découpe prénom / nom
  // Cas 1 : "Prénom Nom" → prenom="Prénom", nom="Nom"
  // Cas 2 : "Prénom `[NOM DE FAMILLE À COMPLÉTER]`" → prenom="Prénom", nom="[À COMPLÉTER]"
  let prenom: string;
  let nom: string;

  const placeholderNomMatch = rawTitle.match(/^(\S+)\s+`?\[NOM.*\]`?/i);
  if (placeholderNomMatch && placeholderNomMatch[1]) {
    prenom = placeholderNomMatch[1];
    nom = '[À COMPLÉTER]';
  } else {
    const parts = rawTitle.split(/\s+/);
    if (parts.length < 2) return null;
    prenom = parts[0] ?? '';
    nom = parts.slice(1).join(' ');
  }

  if (!prenom || !nom) return null;

  // Extraction des champs
  const roleRaw = extractField(block, 'Rôle');
  const entiteRaw = extractField(block, 'Entité principale');
  const numeroRaw = extractField(block, 'Numéro WhatsApp');
  const emailRaw = extractField(block, 'Email');
  const notesRaw = extractField(block, 'Notes');

  // Le rôle contient souvent "Titre, Société" → split
  let titre: string | null = null;
  let societe: string | null = null;

  if (roleRaw) {
    const commaIdx = roleRaw.indexOf(',');
    if (commaIdx > 0) {
      titre = roleRaw.slice(0, commaIdx).trim();
      societe = roleRaw.slice(commaIdx + 1).trim();
    } else {
      titre = roleRaw;
    }
  }

  // Fallback societe depuis "Entité principale" si pas extraite du rôle
  if (!societe && entiteRaw) {
    societe = entiteRaw;
  }

  const entitesVisibles = parseEntitesVisibles(block);

  return {
    prenom,
    nom,
    titre,
    societe,
    email: emailRaw,
    telephone: numeroRaw,
    notes: notesRaw,
    entites_visibles: entitesVisibles,
  };
}

/**
 * Parse le markdown complet en liste de contacts.
 */
export function parseContactsMarkdown(content: string): ParsedContact[] {
  // Ignore la section "Contacts à compléter par Thomas" et tout ce qui suit
  // (ce sont des placeholders, pas des contacts concrets)
  const stopIdx = content.indexOf('## Contacts à compléter par Thomas');
  const relevant = stopIdx >= 0 ? content.slice(0, stopIdx) : content;

  // Découpe par blocs `###` (chaque bloc = un contact potentiel)
  const blocks = relevant.split(/^###\s/m).slice(1).map((b) => '### ' + b);

  const contacts: ParsedContact[] = [];
  for (const block of blocks) {
    const parsed = parseContactBlock(block);
    if (parsed) contacts.push(parsed);
  }

  return contacts;
}

/**
 * Insère les contacts dans la DB. UPSERT par (prenom, nom) : skip si existe.
 * Retourne le nombre de contacts insérés et skippés.
 */
export function insertContacts(
  db: BetterSqlite3Database,
  contacts: ParsedContact[],
): { inserted: number; skipped: number } {
  const checkStmt = db.prepare(
    'SELECT id FROM contacts WHERE prenom = ? AND nom = ? LIMIT 1',
  );

  const insertStmt = db.prepare(`
    INSERT INTO contacts (
      id, prenom, nom, titre, societe, email, telephone,
      whatsapp_authorized, entites_visibles, notes, source,
      created_at, updated_at
    ) VALUES (
      @id, @prenom, @nom, @titre, @societe, @email, @telephone,
      0, @entites_visibles, @notes, 'import_initial',
      @now, @now
    )
  `);

  let inserted = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  const runTx = db.transaction((items: ParsedContact[]) => {
    for (const c of items) {
      const existing = checkStmt.get(c.prenom, c.nom);
      if (existing) {
        skipped += 1;
        continue;
      }

      insertStmt.run({
        id: crypto.randomUUID(),
        prenom: c.prenom,
        nom: c.nom,
        titre: c.titre,
        societe: c.societe,
        email: c.email,
        telephone: c.telephone,
        entites_visibles: c.entites_visibles
          ? JSON.stringify(c.entites_visibles)
          : null,
        notes: c.notes,
        now,
      });
      inserted += 1;
    }
  });

  runTx(contacts);
  return { inserted, skipped };
}

/**
 * Point d'entrée du script de seed.
 */
export function runSeed(sourcePath: string = DEFAULT_SOURCE_PATH): {
  parsed: number;
  inserted: number;
  skipped: number;
} {
  const log = getLogger();

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`[seed] fichier source introuvable : ${sourcePath}`);
  }

  const content = fs.readFileSync(sourcePath, 'utf8');
  const contacts = parseContactsMarkdown(content);

  log.info({ count: contacts.length, sourcePath }, '[seed] contacts parsés');

  initDatabase();
  const db = getDb();
  const { inserted, skipped } = insertContacts(db, contacts);

  log.info({ inserted, skipped }, '[seed] contacts importés');

  return { parsed: contacts.length, inserted, skipped };
}

// ------------------------------------------------------------
// CLI entry point — `npm run seed`
// ------------------------------------------------------------
if (require.main === module) {
  // Charge .env.local avant l'exécution (runSeed dépend de env.DB_PATH)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: '.env.local' });

  try {
    const result = runSeed();
    getLogger().info(result, '[seed] terminé');
    process.exit(0);
  } catch (err) {
    getLogger().error({ err }, '[seed] échec');
    process.exit(1);
  }
}
