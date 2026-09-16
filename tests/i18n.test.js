/*
  Translation check: run with   node tests/i18n.test.js
  1. fr.js and en.js contain exactly the same keys
  2. every fixed key used in the code, t('some.key'), exists
*/
const fs = require('fs');
const path = require('path');

global.window = { DT: { translations: {} } };
require('../js/i18n/en.js');
require('../js/i18n/fr.js');
const { en, fr } = window.DT.translations;

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
}

const problems = [];
const enKeys = new Set(keys(en));
const frKeys = new Set(keys(fr));
for (const k of enKeys) if (!frKeys.has(k)) problems.push(`missing in fr.js: ${k}`);
for (const k of frKeys) if (!enKeys.has(k)) problems.push(`missing in en.js: ${k}`);

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'i18n' ? [] : jsFiles(p);
    return p.endsWith('.js') ? [p] : [];
  });
}

let used = 0;
for (const file of jsFiles(path.join(__dirname, '..', 'js'))) {
  const src = fs.readFileSync(file, 'utf8');
  // t('a.b'), DT.i18n.t("a.b"), and view titles such as title: 'nav.dashboard'
  const pattern = /(?:\bt\(|title: )'([a-zA-Z]+\.[a-zA-Z0-9_.]+)'/g;
  let m;
  while ((m = pattern.exec(src))) {
    used++;
    if (!enKeys.has(m[1])) problems.push(`${path.relative(process.cwd(), file)} uses unknown key: ${m[1]}`);
  }
}

// Every rank, module, tier and achievement needs its texts.
global.window.DT.data = {};
require('../js/data/ranks.js');
require('../js/data/achievements.js');
require('../js/data/holdem-skills.js');
require('../js/data/blackjack-skills.js');
for (const [module, list] of [['holdem', window.DT.data.holdemSkills.SKILLS], ['blackjack', window.DT.data.blackjackSkills.SKILLS]]) {
  for (const s of list) for (const f of ['name', 'short', 'desc']) if (!enKeys.has(`${module}Skills.${s.id}.${f}`)) problems.push(`skill text missing: ${module}Skills.${s.id}.${f}`);
}
// Keys built from a variable in the code (t(`skills.states.${state}`) …)
const CATEGORIES = ['highCard', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush'];
for (const k of [
  ...['new', 'learning', 'progressing', 'almost', 'mastered'].map((x) => `skills.states.${x}`),
  ...['practice', 'speed'].map((x) => `session.modeHint.${x}`),
  ...['practice', 'speed'].map((x) => `session.modes.${x}`),
  ...['path', 'skill', 'mistakes', 'challenge'].map((x) => `sessionTypes.${x}`),
  ...['article', 'better', 'same'].flatMap((g) => CATEGORIES.map((c) => `poker.${g}.${c}`)),
  ...['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].map((r) => `cards.the.${r}`),
  ...['value', 'total', 'softHard', 'call', 'outcome'].map((x) => `exercises.blackjack.${x}`),
  ...['blackjack', 'twentyone', 'bust', 'under', 'win', 'lose', 'push', 'soft', 'hard'].map((x) => `blackjack.labels.${x}`),
  ...['blackjack', 'twentyone', 'bust', 'under', 'playerBust', 'bothBlackjack', 'blackjackBeats21', 'playerBlackjack', 'dealerBlackjack', 'dealerBust', 'higher', 'lower', 'equal', 'soft', 'hardAce', 'hardNoAce', 'sum', 'aceEleven', 'aceOne'].map((x) => `blackjack.short.${x}`),
  ...['accuracy', 'maintain', 'speed', 'next', 'mastered'].map((x) => `advice.${x}`),
  ...['accuracy', 'maintain', 'speed', 'next'].map((x) => `advice.button.${x}`),
  ...['exercises', 'speed', 'levelSkills', 'xp', 'accuracy', 'fast', 'streak', 'skills', 'correct'].map((x) => `req.${x}`),
  ...['highCard', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush'].map((x) => `poker.categories.${x}`),
]) if (!enKeys.has(k)) problems.push(`dynamic key missing: ${k}`);
for (const r of window.DT.data.ranks) for (const f of ['name', 'quote']) if (!enKeys.has(`ranks.${r.id}.${f}`)) problems.push(`rank text missing: ranks.${r.id}.${f}`);
for (const a of window.DT.data.achievements) for (const f of ['name', 'text']) if (!enKeys.has(`achievements.${a.id}.${f}`)) problems.push(`achievement text missing: achievements.${a.id}.${f}`);

if (problems.length) {
  problems.forEach((p) => console.log('✗ ' + p));
  process.exit(1);
}
console.log(`✓ ${enKeys.size} texts in both languages, ${used} fixed keys used in code — all present`);
