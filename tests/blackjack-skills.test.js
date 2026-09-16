/*
  Blackjack skill generators (phase A).   Run:  node tests/blackjack-skills.test.js

  For every playable skill, hundreds of questions are generated and checked here
  independently of the generator: metadata, valid cards, options, answer recomputed
  with the engine, realistic dealer hands, and variety of situations.
*/
global.window = { DT: { data: {} } };
require('../js/modules/blackjack/engine.js');
require('../js/data/blackjack-skills.js');
require('../js/modules/blackjack/skills.js');

const B = window.DT.blackjack;
const { SKILLS } = window.DT.data.blackjackSkills;
const { createQuestion, GENERATOR_IDS } = window.DT.blackjackSkills;

const PER_SKILL = 500;
const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (q) => JSON.stringify(q.data);
const CARD = /^[A2-9TJQK][shdc]$/;

// The answer each skill must have, recomputed from the cards with the engine.
const EXPECT = {
  card_values: (q) => (q.data.cards[0][0] === 'A' ? 'ace' : String(B.cardValue(q.data.cards[0]))),
  hard_totals: (q) => String(B.handValue(q.data.cards).total),
  aces: (q) => String(B.handValue(q.data.cards).total),
  soft_hard: (q) => { const v = B.handValue(q.data.cards); return `${v.soft ? 'soft' : 'hard'}-${v.total}`; },
  blackjack_bust: (q) => { const v = B.handValue(q.data.cards); return v.blackjack ? 'blackjack' : v.total === 21 ? 'twentyone' : v.bust ? 'bust' : 'under'; },
  outcome: (q) => B.outcome(q.data.player, q.data.dealer),
};

// Situation rules of each skill.
const SITUATION = {
  card_values: (q) => q.data.cards.length === 1,
  hard_totals: (q) => q.data.cards.length >= 2 && q.data.cards.length <= 4 && q.data.cards.every((c) => c[0] !== 'A'),
  aces: (q) => q.data.cards.some((c) => c[0] === 'A'),
  soft_hard: (q) => { const v = B.handValue(q.data.cards); return !v.bust && !v.blackjack && v.total >= 12; },
  blackjack_bust: (q) => q.data.cards.length >= 2,
  outcome: (q) => {
    const d = B.handValue(q.data.dealer);
    // The dealer's final hand must be a legal end of play.
    return (d.blackjack || !B.dealerMustDraw(q.data.dealer)) && (q.data.dealer.length === 2 || B.dealerMustDraw(q.data.dealer.slice(0, -1)))
      && [5, 10, 15, 20, 25, 50, 75, 100].includes(q.data.bet);
  },
};

test('Phase A skills are exactly the playable ones, with a generator each', () => {
  const playable = SKILLS.filter((s) => s.available).map((s) => s.id);
  assert(JSON.stringify(playable) === JSON.stringify(GENERATOR_IDS), `playable ${playable} vs generators ${GENERATOR_IDS}`);
  assert(SKILLS.length === 18, '18 skills defined');
  SKILLS.forEach((s, i) => {
    assert(s.difficulty === i + 1, `${s.id}: difficulty follows the path`);
    assert(s.targetMs > 0 && s.exercise && s.errors.length, `${s.id}: target, exercise and errors defined`);
  });
});

const seenAnswers = {};

for (const id of GENERATOR_IDS) {
  test(`${id} — ${PER_SKILL} valid questions`, () => {
    const skill = SKILLS.find((s) => s.id === id);
    const answers = {};
    const unique = new Set();
    for (let i = 0; i < PER_SKILL; i++) {
      const q = createQuestion(id);
      assert(q.type === 'blackjack' && q.module === 'blackjack' && q.skill === id, 'type/module/skill');
      assert(q.level === skill.level && q.difficulty === skill.difficulty && q.targetMs === skill.targetMs, 'metadata');

      const all = q.data.cards || q.data.player.concat(q.data.dealer);
      assert(all.every((c) => CARD.test(c)), `invalid card: ${show(q)}`);

      assert(Array.isArray(q.options) && q.options.length >= 3 && q.options.length <= 4, 'options count');
      assert(new Set(q.options).size === q.options.length, `duplicate options: ${q.options}`);
      assert(q.options.includes(q.answer), `answer not in options: ${q.answer} / ${q.options}`);

      const expected = EXPECT[id](q);
      assert(q.answer === expected, `answer ${q.answer} but engine says ${expected}: ${show(q)}`);
      assert(SITUATION[id](q), `situation does not match "${id}": ${show(q)}`);

      answers[q.answer] = (answers[q.answer] || 0) + 1;
      unique.add(show(q));
    }
    seenAnswers[id] = answers;
    const minimum = id === 'card_values' ? 40 : PER_SKILL * 0.5; // only 52 different cards exist
    assert(unique.size > minimum, `not varied enough: ${unique.size}`);
  });
}

test('Every call and every result appears (no answer can be guessed)', () => {
  for (const k of ['blackjack', 'twentyone', 'bust', 'under']) assert(seenAnswers.blackjack_bust[k] > 60, `blackjack_bust: ${k} ${seenAnswers.blackjack_bust[k]}`);
  for (const k of ['win', 'lose', 'push']) assert(seenAnswers.outcome[k] > 100, `outcome: ${k} ${seenAnswers.outcome[k]}`);
  assert(seenAnswers.card_values.ace > 50 && seenAnswers.card_values['10'] > 80, 'aces and tens');
  const soft = Object.keys(seenAnswers.soft_hard).filter((k) => k.startsWith('soft')).length;
  const hard = Object.keys(seenAnswers.soft_hard).filter((k) => k.startsWith('hard')).length;
  assert(soft > 3 && hard > 3, `soft ${soft} / hard ${hard}`);
});

test('Tricky outcomes are generated: both bust, blackjack against 21, dealer blackjack', () => {
  let bothBust = 0, bjVs21 = 0, dealerBJ = 0;
  for (let i = 0; i < 4000; i++) {
    const q = createQuestion('outcome');
    const p = B.handValue(q.data.player), d = B.handValue(q.data.dealer);
    if (p.bust && d.bust) bothBust++;
    if (p.blackjack && d.total === 21 && !d.blackjack) bjVs21++;
    if (d.blackjack && !p.blackjack) dealerBJ++;
  }
  assert(bothBust > 0 && dealerBJ > 0, `both bust ${bothBust}, dealer BJ ${dealerBJ}`);
  assert(bjVs21 > 0, `blackjack vs 21: ${bjVs21}`);
});

test('Generation is fast enough for instant questions', () => {
  const start = Date.now();
  for (const id of GENERATOR_IDS) for (let i = 0; i < 100; i++) createQuestion(id);
  const avg = (Date.now() - start) / (GENERATOR_IDS.length * 100);
  assert(avg < 10, `average ${avg.toFixed(2)} ms`);
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
