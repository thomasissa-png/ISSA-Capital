/**
 * Base de contacts récurrents — Secrétariat ISSA Capital.
 *
 * Injecté dans le system prompt Claude via le placeholder
 * [INJECTION_DATABASE_CONTACTS_ICI]. Quand Claude voit un nom de cette
 * liste, il enrichit automatiquement (titre + société + qualité).
 *
 * Format attendu par le system prompt (Règle 2) :
 * "Prénom Nom — Titre, Société (entités visibles : [IC, GO, VI, VV]). Notes : ..."
 *
 * À compléter par Thomas au fil du temps.
 */

export interface Contact {
  prenom: string;
  nom: string;
  titre: string;
  societe: string;
  entitesVisibles: string[];
  notes?: string;
}

export const CONTACTS: Contact[] = [
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
    nom: '[NOM]',
    titre: 'Co-actionnaire',
    societe: 'Gradient One',
    entitesVisibles: ['GO', 'VI', 'VV'],
    notes: 'Co-actionnaire Gradient One. Accès GO/VI/VV uniquement, JAMAIS IC.',
  },
  {
    prenom: 'Maxime',
    nom: '[NOM]',
    titre: 'Co-actionnaire',
    societe: 'Gradient One',
    entitesVisibles: ['GO', 'VI', 'VV'],
    notes: 'Co-actionnaire Gradient One. Accès GO/VI/VV uniquement, JAMAIS IC.',
  },
];

/**
 * Formate la base de contacts pour injection dans le system prompt.
 */
export function formatContactsForPrompt(): string {
  if (CONTACTS.length === 0) return '(Aucun contact récurrent enregistré)';

  return CONTACTS.map((c) => {
    const entites = c.entitesVisibles.join(', ');
    const notes = c.notes ? `. Notes : ${c.notes}` : '';
    return `- ${c.prenom} ${c.nom} — ${c.titre}, ${c.societe} (entités visibles : [${entites}])${notes}`;
  }).join('\n');
}
