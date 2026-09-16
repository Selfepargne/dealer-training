/*
  Hold'em skill generators.   Run:  node tests/holdem-skills.test.js

  For every skill, at every table size (2 to 6 players), questions are generated and checked here
  independently of the generator:
    - valid cards, no duplicates
    - metadata (type, module, skill, level, difficulty, target time)
    - the stored answer matches a fresh engine showdown (split included)
    - the situation really matches the skill (between the two key players)
    - extra players never beat the key winner
*/
global.window = { DT: { data: {} } };
require('../js/modules/holdem/engine.js');
require('../js/data/holdem-skills.js');
require('../js/modules/holdem/skills.js');

const P = window.DT.poker;
const { SKILLS } = window.DT.data.holdemSkills;
const { createQuestion, firstDifference } = window.DT.holdemSkills;

const PER_SKILL = 500;
const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const cat = (h) => P.CATEGORIES[h.category];
const show = (q) => `board ${q.board.join(' ')} | ${q.players.map((p) => p.cards.join(' ')).join(' / ')}`;
const boardCat = (q) => cat(P.evaluate5(q.board));
const playsBoard = (h, board) => h.cards.every((c) => board.includes(c));

// What each skill must look like, written from the engine's point of view.
const EXPECT = {
  hand_recognition: (q) => q.kind === 'recognition' && q.answer === cat(P.bestHand(q.players[0].cards.concat(q.board)))
    && q.options.length === 4 && q.options.includes(q.answer) && new Set(q.options).size === 4,
  simple_winner: (q, [a, b]) => !q.split && Math.abs(a.category - b.category) >= 2,
  pair_vs_pair: (q, [a, b]) => cat(a) === 'pair' && cat(b) === 'pair' && a.values[0] !== b.values[0],
  two_pair: (q, [a, b]) => cat(a) === 'twoPair' && cat(b) === 'twoPair' && (a.values[0] !== b.values[0] || a.values[1] !== b.values[1]),
  trips: (q, [a, b]) => cat(a) === 'trips' && cat(b) === 'trips' && a.values[0] !== b.values[0],
  kicker: (q, [a, b]) => !q.split && a.category === b.category && a.values[0] === b.values[0] && firstDifference(a, b) >= 1,
  straight: (q, [a, b]) => !q.split && cat(a) === 'straight' && cat(b) === 'straight',
  flush: (q, [a, b]) => !q.split && cat(a) === 'flush' && cat(b) === 'flush',
  full_house: (q, [a, b]) => !q.split && cat(a) === 'fullHouse' && cat(b) === 'fullHouse',
  board_pair: (q, [a, b]) => {
    const ranks = q.board.map((c) => c[0]);
    return new Set(ranks).size === 4 && !q.split && Math.max(a.category, b.category) >= 2;
  },
  board_plays: (q, hands) => hands.some((h) => playsBoard(h, q.board)),
  straight_on_board: (q) => boardCat(q) === 'straight',
  flush_on_board: (q) => boardCat(q) === 'flush',
  full_house_on_board: (q) => boardCat(q) === 'fullHouse',
  complex_kicker: (q, [a, b]) => a.category === b.category && (q.split || firstDifference(a, b) === a.values.length - 1),
  // Expert questions must match one of the close situations they are drawn from.
  close_calls: (q, hands) => ['kicker', 'full_house', 'board_plays', 'straight_on_board', 'flush_on_board', 'full_house_on_board', 'complex_kicker']
    .some((id) => EXPECT[id](q, hands)),
};

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced', 'expert'];

test('Every skill has an expectation, a unique id and a coherent difficulty', () => {
  assert(SKILLS.length === 16, `16 skills expected, got ${SKILLS.length}`);
  SKILLS.forEach((s, i) => {
    assert(EXPECT[s.id], `no expectation for ${s.id}`);
    assert(s.difficulty === i + 1, `${s.id}: difficulty should follow the path order`);
    if (i > 0) assert(LEVEL_ORDER.indexOf(s.level) >= LEVEL_ORDER.indexOf(SKILLS[i - 1].level), `${s.id}: level goes backwards`);
    assert(s.targetMs > 0, `${s.id}: target time`);
  });
});

const splitCounts = {};

const { MS_PER_EXTRA_PLAYER } = window.DT.holdemSkills;

for (const skill of SKILLS) {
  test(`${skill.id} — ${PER_SKILL} valid questions, 2 to 6 players`, () => {
    let splits = 0;
    const seen = new Set();
    for (let i = 0; i < PER_SKILL; i++) {
      const players = 2 + (i % 5);
      const q = createQuestion(skill.id, { players });

      // Metadata
      assert(q.type === 'holdem' && q.module === 'holdem', 'type/module');
      assert(q.skill === skill.id && q.level === skill.level && q.difficulty === skill.difficulty, 'skill metadata');
      const seats = q.kind === 'winner' ? players : 1;
      assert(q.players.length === seats, `${seats} players expected, got ${q.players.length}`);
      assert(q.targetMs === skill.targetMs + (seats === 1 ? 0 : (seats - 2) * MS_PER_EXTRA_PLAYER), 'target time grows with the table');

      // Cards
      const all = q.board.concat(...q.players.map((p) => p.cards));
      assert(q.board.length === 5 && q.players.every((p) => p.cards.length === 2), `card counts: ${show(q)}`);
      assert(all.every((c) => /^[2-9TJQKA][shdc]$/.test(c)), `invalid card: ${show(q)}`);
      assert(new Set(all).size === all.length, `duplicate card: ${show(q)}`);

      // Answer = engine
      const hands = q.players.map((p) => P.bestHand(p.cards.concat(q.board)));
      if (q.kind === 'winner') {
        const { winners } = P.showdown(q.board, q.players.map((p) => p.cards));
        assert(JSON.stringify(winners) === JSON.stringify(q.winners), `winners differ from engine: ${show(q)}`);
        const expected = winners.length > 1 ? 'split' : String(winners[0]);
        assert(q.answer === expected, `answer ${q.answer} but engine says ${expected}: ${show(q)}`);
        assert(q.split === (winners.length > 1), 'split flag');
        if (q.split) splits++;
      }
      hands.forEach((h, k) => assert(P.compare(h, q.players[k].hand) === 0, 'stored hand differs from engine'));

      // Situation, between the two key players
      if (q.kind === 'winner') {
        const [k0, k1] = q.keyPlayers;
        assert(k0 !== k1 && hands[k0] && hands[k1], 'key players seated');
        const keyHands = [hands[k0], hands[k1]];
        const keyWinners = P.showdown(q.board, [q.players[k0].cards, q.players[k1].cards]).winners;
        const keyQ = { ...q, split: keyWinners.length > 1, players: [q.players[k0], q.players[k1]] };
        assert(EXPECT[skill.id](keyQ, keyHands), `situation does not match "${skill.id}": ${show(q)}`);
        const bestKey = keyHands[keyWinners[0]];
        hands.forEach((h, k) => {
          if (k === k0 || k === k1) return;
          const cmp = P.compare(h, bestKey);
          assert(cmp < 0 || (cmp === 0 && keyWinners.length > 1), `extra player ${k + 1} beats or ties the key winner: ${show(q)}`);
        });
      } else {
        assert(EXPECT[skill.id](q, hands), `situation does not match "${skill.id}": ${show(q)}`);
      }
      seen.add(all.join(''));
    }
    assert(seen.size > PER_SKILL * 0.95, `not varied enough: ${seen.size} unique of ${PER_SKILL}`);
    splitCounts[skill.id] = splits;
  });
}

test('Hand recognition covers all 9 hand types', () => {
  const found = new Set();
  for (let i = 0; i < 600; i++) found.add(createQuestion('hand_recognition').answer);
  assert(found.size === 9, `only ${[...found].join(', ')}`);
});

test('Split pots appear where they should, and never where they should not', () => {
  for (const id of ['straight_on_board', 'flush_on_board', 'full_house_on_board', 'complex_kicker', 'close_calls']) {
    assert(splitCounts[id] > 0, `${id}: no split generated`);
  }
  for (const id of ['simple_winner', 'kicker', 'straight', 'flush', 'full_house', 'board_pair']) {
    assert(splitCounts[id] === 0, `${id}: split generated`);
  }
});

test('Every seat can win: the winner is not always Player 1 or 2', () => {
  const winnerSeats = new Set();
  for (let i = 0; i < 600; i++) {
    const q = createQuestion('kicker', { players: 6 });
    winnerSeats.add(q.winners[0]);
  }
  assert(winnerSeats.size === 6, `winning seats seen: ${[...winnerSeats]}`);
});

test('Split pots with several players: every tied player is a winner', () => {
  let bigSplit = 0;
  for (let i = 0; i < 400; i++) {
    const q = createQuestion('straight_on_board', { players: 6 });
    if (q.winners.length >= 3) bigSplit++;
    const best = q.players[q.winners[0]].hand;
    q.players.forEach((p, k) => assert((P.compare(p.hand, best) === 0) === q.winners.includes(k), 'winner list'));
  }
  assert(bigSplit > 0, 'no split between 3 or more players');
});

test('Straight on board: both outcomes exist (split and a higher straight)', () => {
  let split = 0, win = 0;
  for (let i = 0; i < 300; i++) (createQuestion('straight_on_board').split ? split++ : win++);
  assert(split > 0 && win > 0, `split ${split}, win ${win}`);
});

test('Generation is fast enough for instant questions', () => {
  const start = Date.now();
  for (const s of SKILLS) for (let i = 0; i < 50; i++) createQuestion(s.id, { players: 6 });
  const avg = (Date.now() - start) / (SKILLS.length * 50);
  assert(avg < 15, `average ${avg.toFixed(2)} ms per question`);
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
