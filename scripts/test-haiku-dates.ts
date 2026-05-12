/**
 * Script de validation empirique de la résolution de dates par Haiku 4.5
 * dans le contexte du workflow inbox-message-router.
 *
 * Exécution : `npx tsx scripts/test-haiku-dates.ts`
 * Pré-requis : ANTHROPIC_API_KEY dans l'env (Replit Secrets ou .env.local).
 *
 * Le script appelle Haiku 4.5 avec le même system prompt que le router
 * et teste 14 expressions temporelles françaises typiques.
 */

import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('ERREUR : ANTHROPIC_API_KEY non défini.');
  process.exit(1);
}

const MODEL = 'claude-haiku-4-5-20251001';
const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const today = new Date();
const todayIso = today.toISOString().split('T')[0]!;

function addDays(base: Date, n: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]!;
}

function nextWeekday(base: Date, targetDow: number, isProchain: boolean): string {
  const d = new Date(base);
  const baseDow = d.getDay();
  let delta = (targetDow - baseDow + 7) % 7;
  if (delta === 0) delta = 7;
  if (isProchain && delta <= 7) delta += 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString().split('T')[0]!;
}

const cases = [
  { msg: 'rdv médecin demain',                    expectedDate: addDays(today, 1) },
  { msg: 'appeler maman après-demain',            expectedDate: addDays(today, 2) },
  { msg: 'sortie enfants aquaboulevard vendredi', expectedDate: nextWeekday(today, 5, false) },
  { msg: 'déjeuner avec Pierre vendredi prochain', expectedDate: nextWeekday(today, 5, true) },
  { msg: 'courses samedi',                        expectedDate: nextWeekday(today, 6, false) },
  { msg: 'anniversaire ce dimanche',              expectedDate: nextWeekday(today, 0, false) },
  { msg: 'rdv dentiste lundi',                    expectedDate: nextWeekday(today, 1, false) },
  { msg: 'RDV dans 3 jours',                      expectedDate: addDays(today, 3) },
  { msg: 'rappeler Marie dans 2 semaines',        expectedDate: addDays(today, 14) },
  { msg: 'sortie enfants aquaboulevard le 12/05/2026', expectedDate: '2026-05-12' },
  { msg: 'rdv avocat le 25 juin',                 expectedDate: `${today.getMonth() + 1 > 6 ? today.getFullYear() + 1 : today.getFullYear()}-06-25` },
  { msg: 'appeler banque',                        expectedDate: null },
  { msg: 'préparer présentation Versi',           expectedDate: null },
  { msg: 'RDV notaire aujourd\'hui',              expectedDate: todayIso },
];

const systemPrompt = `Tu es Anya, secrétariat IA de Thomas Issa. Tu reçois un message Telegram court (texte ou vocal transcrit) qui décrit soit une tâche, soit un événement. Tu DOIS retourner un JSON strict de la forme :

{
  "titre": "string court 3-8 mots, première lettre majuscule, sans date ni lieu dedans",
  "date": "YYYY-MM-DD" | null,
  "heure": "HH:MM" | null,
  "lieu": "string" | null,
  "description": "string" | null
}

Règles :
- Date du jour actuelle : ${todayIso}.
- Si l'utilisateur dit "demain", "après-demain", "vendredi prochain", "le 15", résous en date absolue YYYY-MM-DD.
- Si aucune date n'est mentionnée explicitement ou implicitement, date=null.
- Si heure non mentionnée, heure=null.
- Si lieu non mentionné, lieu=null.
- Description = info utile non couverte par les autres champs (participants, contexte) ; null si rien à ajouter.
- Ne JAMAIS inventer. Si tu hésites, mets null.
- Sortie : JSON brut uniquement, pas de markdown, pas d'explication.`;

console.log(`\nTest Haiku 4.5 — résolution dates FR`);
console.log(`Date du jour : ${todayIso} (${['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][today.getDay()]})\n`);
console.log('─'.repeat(100));

let ok = 0;
let ko = 0;

for (const c of cases) {
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: c.msg }],
    });
    const text = resp.content[0]?.type === 'text' ? resp.content[0].text : '';
    const parsed = JSON.parse(text);
    const dateOk = parsed.date === c.expectedDate;
    const status = dateOk ? '✅' : '❌';
    if (dateOk) ok++; else ko++;
    console.log(`${status}  ${c.msg.padEnd(55)} → ${String(parsed.date).padEnd(12)} (attendu : ${String(c.expectedDate).padEnd(12)}) titre="${parsed.titre}"`);
  } catch (err) {
    ko++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`💥  ${c.msg.padEnd(55)} → ERREUR : ${msg}`);
  }
}

console.log('─'.repeat(100));
console.log(`\nRésultat : ${ok}/${cases.length} OK, ${ko}/${cases.length} KO`);
if (ko === 0) {
  console.log('✅ Haiku 4.5 maîtrise toutes les expressions temporelles FR testées.');
} else {
  console.log('⚠️  Cas en échec — vérifier le détail ci-dessus avant déploiement.');
}
