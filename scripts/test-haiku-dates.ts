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

type TestCase = { msg: string; expectedDate: string | null; expectedTime: string | null };

const cases: TestCase[] = [
  // Dates uniquement (heure attendue null)
  { msg: 'rdv médecin demain',                          expectedDate: addDays(today, 1),               expectedTime: null },
  { msg: 'appeler maman après-demain',                  expectedDate: addDays(today, 2),               expectedTime: null },
  { msg: 'sortie enfants aquaboulevard vendredi',       expectedDate: nextWeekday(today, 5, false),    expectedTime: null },
  { msg: 'déjeuner avec Pierre vendredi prochain',      expectedDate: nextWeekday(today, 5, true),     expectedTime: null },
  { msg: 'courses samedi',                              expectedDate: nextWeekday(today, 6, false),    expectedTime: null },
  { msg: 'anniversaire ce dimanche',                    expectedDate: nextWeekday(today, 0, false),    expectedTime: null },
  { msg: 'rdv dentiste lundi',                          expectedDate: nextWeekday(today, 1, false),    expectedTime: null },
  { msg: 'RDV dans 3 jours',                            expectedDate: addDays(today, 3),               expectedTime: null },
  { msg: 'rappeler Marie dans 2 semaines',              expectedDate: addDays(today, 14),              expectedTime: null },
  { msg: 'sortie enfants aquaboulevard le 12/05/2026',  expectedDate: '2026-05-12',                    expectedTime: null },
  { msg: 'rdv avocat le 25 juin',                       expectedDate: `${today.getMonth() + 1 > 6 ? today.getFullYear() + 1 : today.getFullYear()}-06-25`, expectedTime: null },
  { msg: 'appeler banque',                              expectedDate: null,                            expectedTime: null },
  { msg: 'préparer présentation Versi',                 expectedDate: null,                            expectedTime: null },
  { msg: 'RDV notaire aujourd\'hui',                    expectedDate: todayIso,                        expectedTime: null },

  // Date + heure
  { msg: 'rdv médecin demain 14h30',                    expectedDate: addDays(today, 1),               expectedTime: '14:30' },
  { msg: 'rdv médecin demain à 14h',                    expectedDate: addDays(today, 1),               expectedTime: '14:00' },
  { msg: 'appeler Pierre à 9h',                         expectedDate: null,                            expectedTime: '09:00' },
  { msg: 'RDV dentiste vendredi 18h',                   expectedDate: nextWeekday(today, 5, false),    expectedTime: '18:00' },
  { msg: 'sortie 8h du matin samedi',                   expectedDate: nextWeekday(today, 6, false),    expectedTime: '08:00' },
  { msg: 'rdv 12/05/2026 à 15h45',                      expectedDate: '2026-05-12',                    expectedTime: '15:45' },
  { msg: 'déjeuner demain midi',                        expectedDate: addDays(today, 1),               expectedTime: '12:00' },
  { msg: 'rdv lundi 8h30',                              expectedDate: nextWeekday(today, 1, false),    expectedTime: '08:30' },

  // Cas ambigus — l'IA doit retourner null pour l'heure (pas inventer)
  { msg: 'rdv médecin demain matin',                    expectedDate: addDays(today, 1),               expectedTime: null },
  { msg: 'sortie ce soir',                              expectedDate: todayIso,                        expectedTime: null },
  { msg: 'rappeler après-midi',                         expectedDate: null,                            expectedTime: null },
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

console.log(`\nTest Haiku 4.5 — résolution dates + heures FR`);
console.log(`Date du jour : ${todayIso} (${['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][today.getDay()]})\n`);
console.log('─'.repeat(120));

let dateOk = 0;
let timeOk = 0;
let fullOk = 0;
let errors = 0;

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
    const dOk = parsed.date === c.expectedDate;
    const tOk = parsed.heure === c.expectedTime;
    if (dOk) dateOk++;
    if (tOk) timeOk++;
    if (dOk && tOk) fullOk++;
    const dStatus = dOk ? '✅' : '❌';
    const tStatus = tOk ? '✅' : '❌';
    console.log(
      `${dStatus}${tStatus}  ${c.msg.padEnd(50)} → date=${String(parsed.date).padEnd(11)} (att. ${String(c.expectedDate).padEnd(11)})  heure=${String(parsed.heure).padEnd(7)} (att. ${String(c.expectedTime).padEnd(7)})`,
    );
  } catch (err) {
    errors++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`💥  ${c.msg.padEnd(50)} → ERREUR : ${msg}`);
  }
}

console.log('─'.repeat(120));
console.log(`\nRésultat :`);
console.log(`  Dates correctes  : ${dateOk}/${cases.length}`);
console.log(`  Heures correctes : ${timeOk}/${cases.length}`);
console.log(`  Date + heure OK  : ${fullOk}/${cases.length}`);
if (errors > 0) console.log(`  Erreurs API      : ${errors}`);
if (fullOk === cases.length) {
  console.log('\n✅ Haiku 4.5 maîtrise toutes les expressions temporelles FR (date + heure) testées.');
} else {
  console.log('\n⚠️  Cas en échec — vérifier le détail ci-dessus avant déploiement.');
}
