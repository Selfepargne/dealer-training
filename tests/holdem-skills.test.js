/*
  Hold'em skill generators.   Run:  node tests/holdem-skills.test.js

  For every skill, at every table size (2 to 6 players), questions are generated and checked here
  independently of the generator:
    - valid cards, no duplicates
    - metadata (type, module, skill, level, difficulty, target time)
    - the stored answer matches a fresh engine showdown (split included)
    - the situation really matches the skill (between the two key players)
    - extra players never beat the key winner
  Dealer situations (table setup, flow, chips): metadata and options here, rules in tests/dealer.test.js.
  Ultimate settlements: metadata, cards and options here, rules and situations in tests/ultimate.test.js.
*/
global.window = { DT: { data: {} } };
require('../js/modules/holdem/engine.js');
require('../js/data/holdem-skills.js');
require('../js/modules/holdem/dealer.js');
require('../js/modules/holdem/ultimate.js');
require('../js/modules/holdem/skills.js');

const P = window.DT.poker;
const { SKILLS } = window.DT.data.holdemSkills;
const { createQuestion, firstDifference, COMPARISON_SOURCES, RECOGNITION_TYPES } = window.DT.holdemSkills;
const DEALER_KINDS = ['table', 'flow', 'chips'];

const PER_SKILL = 500;
const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function equal(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const cat = (h) => P.CATEGORIES[h.category];
const show = (q) => `board ${q.board.join(' ')} | ${q.players.map((p) => p.cards.join(' ')).join(' / ')}`;
const boardCat = (q) => cat(P.evaluate5(q.board));
const playsBoard = (h, board) => h.cards.every((c) => board.includes(c));

/** The 21 five-card hands of seven cards, written here independently of skills.js. */
function fivesOf(seven) {
  const out = [];
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) out.push(seven.filter((_, k) => k !== a && k !== b));
  return out;
}

/** Recognition questions, checked against the engine for each family. */
function recognitionOk(q) {
  const hole = q.players[0].cards;
  const seven = hole.concat(q.board);
  const best = P.bestHand(seven);
  if (q.kind !== 'recognition' || !RECOGNITION_TYPES[q.stage].includes(q.situation)) return false;
  const unique = q.options.includes(q.answer) && new Set(q.options).size === q.options.length;
  switch (q.situation) {
    case 'bestHand':
      return unique && q.options.length === 4 && q.answer === cat(best);
    case 'bestFive': {
      const five = q.answer.split(' ');
      return unique && q.options.length === 4 && five.every((c) => seven.includes(c)) && new Set(five).size === 5
        && P.compare(P.evaluate5(five), best) === 0
        && q.options.filter((o) => o !== q.answer).every((o) => P.compare(P.evaluate5(o.split(' ')), best) < 0);
    }
    case 'holeCards': {
      const counts = new Set(fivesOf(seven).filter((f) => P.compare(P.evaluate5(f), best) === 0).map((f) => f.filter((c) => hole.includes(c)).length));
      return unique && counts.size === 1 && String([...counts][0]) === q.answer && q.options.join() === '0,1,2';
    }
    default:
      return false;
  }
}

// What each skill must look like, written from the engine's point of view.
const EXPECT = {
  hand_recognition: (q) => recognitionOk(q),
  // Beginner comparison: each question must match the situation it was built from (the former beginner skills).
  hand_comparison: (q, hands) => COMPARISON_SOURCES[q.stage].includes(q.situation) && EXPECT[q.situation](q, hands),
  simple_winner: (q, [a, b]) => !q.split && Math.abs(a.category - b.category) >= 2,
  pair_vs_high: (q, [a, b]) => !q.split && [cat(a), cat(b)].sort().join() === 'highCard,pair',
  different_types: (q, [a, b]) => !q.split && Math.abs(a.category - b.category) === 1 && Math.min(a.category, b.category) >= 1,
  board_split: (q, hands) => q.split && boardCat(q) === 'straight' && hands.every((h) => playsBoard(h, q.board)),
  two_pair_kicker: (q, [a, b]) => !q.split && cat(a) === 'twoPair' && cat(b) === 'twoPair' && a.values[0] === b.values[0] && a.values[1] === b.values[1] && a.values[2] !== b.values[2],
  trap: (q, [a, b]) => !q.split && Math.abs(a.category - b.category) === 1 && Math.min(a.category, b.category) >= 2,
  pair_vs_pair: (q, [a, b]) => cat(a) === 'pair' && cat(b) === 'pair' && a.values[0] !== b.values[0],
  two_pair: (q, [a, b]) => cat(a) === 'twoPair' && cat(b) === 'twoPair' && (a.values[0] !== b.values[0] || a.values[1] !== b.values[1]),
  trips: (q, [a, b]) => cat(a) === 'trips' && cat(b) === 'trips' && a.values[0] !== b.values[0],
  // Dealer situations: checked in detail by tests/dealer.test.js
  table_setup: (q) => q.kind === 'table',
  hand_flow: (q) => q.kind === 'flow',
  chips_bets: (q) => q.kind === 'chips',
  // Ultimate Texas Hold'em settlements: checked in detail by tests/ultimate.test.js
  ultimate_basics: (q) => q.kind === 'ultimate',
  ultimate_bets: (q) => q.kind === 'ultimate',
  ultimate_payouts: (q) => q.kind === 'ultimate',
  ultimate_settlement: (q) => q.kind === 'ultimate',
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
  assert(SKILLS.filter((s) => s.level === 'beginner').map((s) => s.id).join() === 'hand_recognition,hand_comparison,table_setup,hand_flow,chips_bets,ultimate_basics', 'beginner path');
  assert(SKILLS.length === 20, `20 skills expected, got ${SKILLS.length}`);
  assert(SKILLS.filter((s) => s.id.startsWith('ultimate_')).map((s) => s.level).join() === LEVEL_ORDER.join(), 'one Ultimate skill per level');
  SKILLS.forEach((s, i) => {
    assert(EXPECT[s.id], `no expectation for ${s.id}`);
    assert(s.difficulty === i + 1, `${s.id}: difficulty should follow the path order`);
    if (i > 0) assert(LEVEL_ORDER.indexOf(s.level) >= LEVEL_ORDER.indexOf(SKILLS[i - 1].level), `${s.id}: level goes backwards`);
    assert(s.targetMs > 0, `${s.id}: target time`);
  });
});

const splitCounts = {};

const { MS_PER_EXTRA_PLAYER, MS_PER_EXTRA_SEAT, MS_PER_EXTRA_SPOT } = window.DT.holdemSkills;

for (const skill of SKILLS) {
  test(`${skill.id} — ${PER_SKILL} valid questions, 2 to 6 players`, () => {
    let splits = 0;
    const seen = new Set();
    for (let i = 0; i < PER_SKILL; i++) {
      const players = 2 + (i % 5);
      const stage = 1 + (i % 3);
      const q = createQuestion(skill.id, { players, stage });

      // Metadata
      assert(q.type === 'holdem' && q.module === 'holdem', 'type/module');
      assert(q.skill === skill.id && q.level === skill.level && q.difficulty === skill.difficulty && q.stage === stage, 'skill metadata');

      if (DEALER_KINDS.includes(q.kind)) {
        assert(EXPECT[skill.id](q), 'question kind');
        assert(q.seats.length === players, `${players} seats expected, got ${q.seats.length}`);
        assert(q.targetMs === skill.targetMs + (players - 2) * MS_PER_EXTRA_SEAT, 'target time grows with the table');
        assert(q.options.includes(q.answer) && new Set(q.options).size === q.options.length, 'answer among unique options');
        continue;
      }
      if (q.kind === 'ultimate') {
        assert(EXPECT[skill.id](q), 'question kind');
        assert(q.targetMs === skill.targetMs + (q.spots.length - 1) * MS_PER_EXTRA_SPOT, 'target time grows with the players');
        const cardsUsed = q.board.concat(q.dealer.cards, ...q.spots.map((s) => s.cards));
        assert(cardsUsed.length === 7 + 2 * q.spots.length && new Set(cardsUsed).size === cardsUsed.length, 'cards: no duplicate');
        assert(q.options.includes(q.answer) && new Set(q.options).size === q.options.length, 'answer among unique options');
        continue;
      }
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
    if (['winner', 'recognition'].includes(createQuestion(skill.id).kind)) assert(seen.size > PER_SKILL * 0.95, `not varied enough: ${seen.size} unique of ${PER_SKILL}`);
    splitCounts[skill.id] = splits;
  });
}

test('Hand recognition covers all 9 hand types', () => {
  const found = new Set();
  for (let i = 0; i < 600; i++) found.add(cat(createQuestion('hand_recognition', { stage: 2 }).players[0].hand));
  assert(found.size === 9, `only ${[...found].join(', ')}`);
});

test('Split pots appear where they should, and never where they should not', () => {
  for (const id of ['straight_on_board', 'flush_on_board', 'full_house_on_board', 'complex_kicker', 'close_calls']) {
    assert(splitCounts[id] > 0, `${id}: no split generated`);
  }
  for (const id of ['kicker', 'straight', 'flush', 'full_house', 'board_pair']) {
    assert(splitCounts[id] === 0, `${id}: split generated`);
  }
});

test('Hand comparison: progressive stages, every former beginner situation still generated', () => {
  const EXPECTED = {
    1: ['pair_vs_high', 'simple_winner', 'pair_vs_pair'],
    2: ['pair_vs_pair', 'two_pair', 'trips', 'different_types', 'board_split'],
    3: ['kicker', 'two_pair_kicker', 'trips', 'board_pair', 'board_plays', 'trap'],
  };
  for (const stage of [1, 2, 3]) {
    const seen = {};
    let splits = 0;
    for (let i = 0; i < 400; i++) {
      const q = createQuestion('hand_comparison', { players: 2 + (i % 2), stage });
      seen[q.situation] = (seen[q.situation] || 0) + 1;
      if (q.split) splits++;
      if (q.split) assert(stage > 1 && q.situation !== 'pair_vs_pair', `stage ${stage}: unexpected split (${q.situation})`);
      if (stage === 2 && q.split) assert(q.situation === 'board_split', 'stage 2: only the simple tie is split');
    }
    assert(JSON.stringify(Object.keys(seen).sort()) === JSON.stringify(EXPECTED[stage].slice().sort()), `stage ${stage}: ${Object.keys(seen)}`);
    Object.entries(seen).forEach(([id, n]) => assert(n > 400 / EXPECTED[stage].length / 2, `stage ${stage}: ${id} under-represented (${n})`));
    if (stage === 1) assert(splits === 0, 'stage 1: no split');
    else assert(splits > 0, `stage ${stage}: split pots appear`);
  }
});

test('Hand recognition: the same hand type never comes back twice in a row', () => {
  let previous = null;
  for (let i = 0; i < 300; i++) {
    const q = createQuestion('hand_recognition', { stage: 1 + (i % 3) });
    const type = cat(q.players[0].hand);
    assert(type !== previous, `${type} twice in a row`);
    previous = type;
  }
});

test('Hand recognition: three stages — a clear hand, then the five cards and hole cards, then misleading hands', () => {
  const seen = { 1: {}, 2: {}, 3: {} };
  for (const stage of [1, 2, 3]) {
    for (let i = 0; i < 600; i++) {
      const q = createQuestion('hand_recognition', { stage });
      const seven = q.players[0].cards.concat(q.board);
      const best = P.bestHand(seven);
      const key = q.situation === 'holeCards' ? `holeCards:${q.answer}` : q.situation;
      seen[stage][key] = (seen[stage][key] || 0) + 1;
      if (stage === 1) {
        assert(q.situation === 'bestHand' && cat(best) !== 'highCard', 'stage 1: name a made hand');
        assert(!q.decoys.length, `stage 1: nothing misleading (${q.decoys})`);
      }
      if (stage === 3 && q.situation === 'bestHand') assert(q.decoys.length > 0, 'stage 3: something misleading');
      if (stage === 3 && q.situation === 'holeCards') {
        const boardOnly = P.evaluate5(q.board);
        assert(q.answer === '0' || (q.answer === '1' && boardOnly.category < best.category), 'stage 3: the board plays, or one hole card changes the hand');
      }
    }
  }
  equal(Object.keys(seen[1]), ['bestHand'], 'stage 1');
  for (const stage of [2, 3]) ['bestHand', 'bestFive'].forEach((s) => assert(seen[stage][s] > 100, `stage ${stage}: ${s} ${seen[stage][s]}`));
  ['holeCards:1', 'holeCards:2'].forEach((k) => assert(seen[2][k] > 5, `stage 2: ${k}`));
  ['holeCards:0', 'holeCards:1'].forEach((k) => assert(seen[3][k] > 30, `stage 3: ${k}`));
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
