/*
  Dealer rules and situations of the Hold'em beginner level.   Run:  node tests/dealer.test.js

  1. Rules: button, blinds, heads-up, dealing order, action order, rotation, chip amounts.
     Expected values are written by hand here, not taken from dealer.js.
  2. Generated situations (every stage, 2 to 6 players): the answer is recomputed from what the table shows
     (markers, statuses, chips), independently of the generator.
*/
global.window = { DT: { data: {} } };
require('../js/modules/holdem/engine.js');
require('../js/data/holdem-skills.js');
require('../js/modules/holdem/dealer.js');
require('../js/modules/holdem/ultimate.js');
require('../js/modules/holdem/skills.js');

const D = window.DT.holdemDealer;
const { createQuestion } = window.DT.holdemSkills;

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function equal(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const PER_STAGE = 400;
const show = (q) => JSON.stringify({ situation: q.situation, button: q.button, street: q.street, answer: q.answer, seats: q.seats.map((s) => [s.status, s.bet, s.cards, s.behind, s.chip]) });

// ---------------------------------------------------------------------------
// 1. Rules — positions
// ---------------------------------------------------------------------------

test('6 players, button on Player 1: SB Player 2, BB Player 3, UTG Player 4', () => {
  equal(D.positions(6, 0), { button: 0, sb: 1, bb: 2, firstCard: 1, firstPreflop: 3, firstPostflop: 1 }, 'positions');
});

test('Positions wrap around the table: 5 players, button on Player 4', () => {
  equal(D.positions(5, 3), { button: 3, sb: 4, bb: 0, firstCard: 4, firstPreflop: 1, firstPostflop: 4 }, 'positions');
});

test('3 players: the button acts first before the flop', () => {
  equal(D.positions(3, 1), { button: 1, sb: 2, bb: 0, firstCard: 2, firstPreflop: 1, firstPostflop: 2 }, 'positions');
});

test('Heads-up: button = small blind, first card to the big blind, button first preflop and last postflop', () => {
  equal(D.positions(2, 0), { button: 0, sb: 0, bb: 1, firstCard: 1, firstPreflop: 0, firstPostflop: 1 }, 'button on Player 1');
  equal(D.positions(2, 1), { button: 1, sb: 1, bb: 0, firstCard: 0, firstPreflop: 1, firstPostflop: 0 }, 'button on Player 2');
  equal(D.actionOrder(2, 0, 'preflop'), [0, 1], 'preflop order');
  equal(D.actionOrder(2, 0, 'river'), [1, 0], 'postflop order');
});

test('Every table size and button: blinds and first to act follow the rules', () => {
  for (let n = 2; n <= 6; n++) {
    for (let b = 0; b < n; b++) {
      const p = D.positions(n, b);
      if (n === 2) {
        assert(p.sb === b && p.bb === 1 - b, `heads-up blinds (${n}, ${b})`);
        continue;
      }
      assert(p.sb === (b + 1) % n && p.bb === (b + 2) % n, `blinds (${n}, ${b})`);
      assert(p.firstPreflop === (p.bb + 1) % n, `UTG left of BB (${n}, ${b})`);
      assert(p.firstPostflop === p.sb && p.firstCard === p.sb, `left of the button (${n}, ${b})`);
      assert(new Set([p.button, p.sb, p.bb]).size === 3, `three different seats (${n}, ${b})`);
    }
  }
});

test('Dealing: clockwise from the first card, every seat once, the button last', () => {
  equal(D.dealOrder(6, 4), [5, 0, 1, 2, 3, 4], '6 players, button on Player 5');
  equal(D.dealOrder(2, 0), [1, 0], 'heads-up');
  for (let n = 2; n <= 6; n++) {
    for (let b = 0; b < n; b++) {
      const order = D.dealOrder(n, b);
      assert(order.length === n && new Set(order).size === n, 'every seat once');
      assert(order[n - 1] === b, 'button last');
      order.forEach((seat, k) => k && assert(seat === (order[k - 1] + 1) % n, 'clockwise'));
    }
  }
});

test('Action order skips folded players', () => {
  equal(D.actionOrder(6, 0, 'preflop'), [3, 4, 5, 0, 1, 2], 'preflop, everyone in');
  equal(D.actionOrder(6, 0, 'flop', [0, 2, 4]), [2, 4, 0], 'flop: SB folded, first active left of the button acts');
  equal(D.actionOrder(4, 2, 'turn', [1, 2]), [1, 2], 'button acts last');
});

test('Rotation: the button moves one seat clockwise, the blinds follow, and it comes back after a full round', () => {
  equal(D.nextHand(6, 5), D.positions(6, 0), 'Player 6 → Player 1');
  equal([D.nextHand(4, 1).sb, D.nextHand(4, 1).bb], [3, 0], 'new blinds');
  equal([D.nextHand(2, 0).sb, D.nextHand(2, 0).bb], [1, 0], 'heads-up: the blinds swap');
  for (let n = 2; n <= 6; n++) {
    let b = 0;
    for (let k = 0; k < n; k++) b = D.nextHand(n, b).button;
    assert(b === 0, `full round at ${n} players`);
  }
});

test('Button and blinds: never on the same player from 3 players; heads-up, the button is the small blind', () => {
  for (let n = 3; n <= 6; n++) {
    for (let b = 0; b < n; b++) {
      const p = D.positions(n, b);
      assert(p.button !== p.sb && p.button !== p.bb && p.sb !== p.bb, `button and blinds on different players (${n}, ${b})`);
    }
  }
  for (const b of [0, 1]) {
    const p = D.positions(2, b);
    assert(p.sb === b && p.bb !== b, 'heads-up: button = small blind, the other player = big blind');
  }
});

// ---------------------------------------------------------------------------
// 1. Rules — table layout
// ---------------------------------------------------------------------------

test('Layout: the dealer sits at the top middle, the players clockwise from the dealer\'s left, evenly spaced', () => {
  for (let n = 2; n <= 6; n++) {
    const l = D.tableLayout(n, 0);
    assert(l.dealer === 0, 'dealer at the top middle (0°)');
    assert(l.seats.length === n, 'one place per player');
    assert(l.seats[0] > 0 && l.seats[0] < 180, 'Player 1 on the dealer\'s left (right side of the screen)');
    l.seats.forEach((a, i) => {
      assert(a > 0 && a < 360, 'no player on the dealer\'s place');
      if (i) assert(Math.abs(a - l.seats[i - 1] - l.step) < 1e-9, 'clockwise, evenly spaced');
    });
    assert(Math.abs(360 - l.seats[n - 1] - l.step) < 1e-9, 'last player on the dealer\'s right');
  }
  equal(D.tableLayout(6, 0).seats.map(Math.round), [51, 103, 154, 206, 257, 309], '6 players');
});

test('Layout: the dealer button sits on the table edge halfway between its owner and the next player', () => {
  for (let n = 2; n <= 6; n++) {
    for (let b = 0; b < n; b++) {
      const l = D.tableLayout(n, b);
      const owner = l.seats[b];
      const next = b === n - 1 ? 360 : l.seats[b + 1]; // after the last player comes the dealer's place
      assert(l.button > owner && l.button < next, `between the owner and the next place (${n}, ${b})`);
      assert(Math.abs((l.button - owner) - (next - l.button)) < 1e-9, 'halfway: the owner is the player just before it, clockwise');
      l.seats.forEach((a) => assert(Math.abs(a - l.button) > l.step * 0.2, 'never in front of a player'));
    }
  }
});

test('Layout: example — button of Player 1 between Player 1 and Player 2; Player 2 SB, Player 3 BB, Player 4 first preflop', () => {
  const l = D.tableLayout(6, 0);
  assert(l.button > l.seats[0] && l.button < l.seats[1], 'between Player 1 and Player 2');
  const p = D.positions(6, 0);
  equal([p.sb, p.bb, p.firstPreflop, p.firstPostflop], [1, 2, 3, 1], 'SB Player 2, BB Player 3, Player 4 first preflop, Player 2 first postflop');
  equal(D.actionOrder(6, 0, 'flop', [0, 2, 3, 4, 5])[0], 2, 'postflop, Player 2 folded: Player 3 first');
});

test('Layout: at the next hand the button moves one place clockwise (to the left of the players)', () => {
  for (let n = 2; n <= 6; n++) {
    for (let b = 0; b < n; b++) {
      const now = D.tableLayout(n, b).button;
      const next = D.tableLayout(n, D.nextHand(n, b).button).button;
      const moved = (next - now + 360) % 360;
      if (b === n - 1) assert(Math.abs(moved - 2 * D.tableLayout(n, b).step) < 1e-9, 'from the last player, past the dealer, to Player 1');
      else assert(Math.abs(moved - D.tableLayout(n, b).step) < 1e-9, `one place clockwise (${n}, ${b})`);
    }
  }
});

// ---------------------------------------------------------------------------
// 1. Rules — who acts (check)
// ---------------------------------------------------------------------------

/** Independent reading of the rule: from the start of the action, clockwise, the first player with cards who has not acted. */
function nextToAct(n, button, street, withCards, acted) {
  const hu = n === 2;
  let seat = street === 'preflop' ? (hu ? button : (button + 3) % n) : (hu ? (button + 1) % 2 : (button + 1) % n);
  for (let k = 0; k < n; k++, seat = (seat + 1) % n) if (withCards.includes(seat) && !acted.includes(seat)) return seat;
  return null;
}

test('Who acts after the flop: first player with cards clockwise from the button; checks and folds are skipped', () => {
  // 6 players, button Player 1: Player 2 checks → Player 3
  let order = D.actionOrder(6, 0, 'flop');
  equal(order[1], 2, 'after Player 2 checks');
  // Player 2 and 3 folded earlier: first with cards is Player 4
  order = D.actionOrder(6, 0, 'flop', [0, 3, 4, 5]);
  equal(order[0], 3, 'folded players skipped');
  // Only one player has not acted: it is that player's turn
  equal(nextToAct(4, 1, 'turn', [0, 1, 2, 3], [2, 3, 0]), 1, 'the last player without an action (the button)');
  for (let n = 2; n <= 6; n++) {
    for (let b = 0; b < n; b++) {
      for (let mask = 0; mask < 1 << n; mask++) {
        const withCards = [...Array(n).keys()].filter((i) => mask & (1 << i));
        if (withCards.length < 2) continue;
        for (const street of ['preflop', 'flop', 'river']) {
          const order = D.actionOrder(n, b, street, withCards);
          for (let acted = 0; acted < order.length; acted++) {
            equal(order[acted], nextToAct(n, b, street, withCards, order.slice(0, acted)), `${n} players, button ${b}, ${street}`);
          }
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// One common position rule for every Hold'em dealer exercise
// ---------------------------------------------------------------------------

/** The reference rule, written independently: clockwise BUTTON → SB → BB → first to act preflop; heads-up BUTTON = SB. */
function referenceRule(n, button) {
  if (n === 2) return { sb: button, bb: (button + 1) % 2, firstPreflop: button };
  return { sb: (button + 1) % n, bb: (button + 2) % n, firstPreflop: (button + 3) % n };
}

test('Reference example: 4 players, button between J2 and J3 (owner J2) → SB J3, BB J4, J1 first to act', () => {
  const l = D.tableLayout(4, 1);
  assert(l.button > l.seats[1] && l.button < l.seats[2], 'button drawn between J2 and J3');
  const p = D.positions(4, 1);
  equal([p.sb, p.bb, p.firstPreflop], [2, 3, 0], 'SB J3, BB J4, J1 first');
  equal(D.actionOrder(4, 1, 'preflop'), [0, 1, 2, 3], 'preflop order J1 → J2 → J3 → J4');
});

test('Common rule: every table size, every button position — positions and the drawn button agree with the reference', () => {
  for (let n = 2; n <= 6; n++) {
    for (let b = 0; b < n; b++) {
      const ref = referenceRule(n, b);
      const p = D.positions(n, b);
      equal([p.sb, p.bb, p.firstPreflop], [ref.sb, ref.bb, ref.firstPreflop], `positions (${n} players, button J${b + 1})`);
      const l = D.tableLayout(n, b);
      const next = b === n - 1 ? 360 : l.seats[b + 1];
      assert(l.button > l.seats[b] && l.button < next, `button drawn between its owner and the next player (${n}, J${b + 1})`);
    }
  }
});

test('Common rule: Mise en place, Déroulement and Jetons & mises all follow it, for every table size and button position', () => {
  const covered = { table_setup: new Set(), hand_flow: new Set(), chips_bets: new Set() };
  for (const id of Object.keys(covered)) {
    for (let i = 0; i < 6000; i++) {
      const n = 2 + (i % 5);
      const q = createQuestion(id, { players: n, stage: 1 + (i % 3) });
      const ref = referenceRule(n, q.button);
      const where = `${id} ${n} players, button J${q.button + 1}`;
      covered[id].add(`${n}:${q.button}`);

      // Blinds shown on the table sit on the reference SB / BB, with their chips engaged.
      if (D.blindsShown(q)) {
        assert(q.seats[ref.sb].bet >= q.blinds.sb && q.seats[ref.bb].bet >= q.blinds.bb, `blinds on SB / BB — ${where}`);
        q.seats.forEach((s, k) => {
          if (k !== ref.sb && k !== ref.bb && s.bet > 0) assert(['call', 'raise', 'bet', 'allIn'].includes(s.status), `only SB / BB have chips without acting — ${where}`);
        });
      }
      // Answers about positions use the reference rule.
      if (id === 'table_setup') {
        if (q.situation === 'sb') equal(q.answer, String(ref.sb), `SB answer — ${where}`);
        if (q.situation === 'bb') equal(q.answer, String(ref.bb), `BB answer — ${where}`);
        if (q.situation === 'firstPreflop') equal(q.answer, String(ref.firstPreflop), `first to act — ${where}`);
      }
      if (q.situation === 'whoActs' && q.street === 'preflop') equal(q.order[0], ref.firstPreflop, `preflop order starts with the reference first player — ${where}`);
      if (q.kind === 'chips' && q.street === 'preflop') {
        const bets = [ref.sb, ref.bb].map((k) => q.seats[k].bet);
        assert(bets[0] >= q.blinds.sb && bets[1] >= q.blinds.bb, `chips: blinds engaged by the reference SB / BB — ${where}`);
      }
    }
  }
  for (const [id, set] of Object.entries(covered)) {
    equal(set.size, 2 + 3 + 4 + 5 + 6, `${id}: every button position at every table size was generated`);
  }
});

test('Dealer table styles never redefine a global layout class of the app (.stack, .row, .grid…)', () => {
  const fs = require('fs');
  const path = require('path');
  const css = (file) => fs.readFileSync(path.join(__dirname, '..', 'css', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const classesDefined = (src) => new Set([...src.matchAll(/(^|[\s,}])\.([a-zA-Z][\w-]*)(?=[\s,{:.[>])/gm)].map((m) => m[2]));
  const global = classesDefined(css('main.css'));
  const clashes = [...classesDefined(css('dealer-table.css'))].filter((c) => global.has(c));
  equal(clashes, [], 'classes shared with main.css');
});

test('No second position logic: only dealer.js computes seats around the table', () => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', 'js', 'modules', 'holdem');
  for (const file of fs.readdirSync(dir)) {
    if (file === 'dealer.js') continue;
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    assert(!/button\s*[+-]\s*\d|%\s*n\b|\.sb\s*=\s*\(|\.bb\s*=\s*\(/.test(src), `${file} must use the shared rules of dealer.js`);
    // Who acts is decided in one place only: no other file reads the "first to act" seats directly.
    assert(!/firstPreflop|firstPostflop/.test(src.replace(/situation === '(firstPreflop|firstPostflop)'/g, '')), `${file} must ask getFirstToAct / getNextToAct`);
  }
  // Inside dealer.js, the generators ask the central functions instead of rebuilding the order.
  const dealer = fs.readFileSync(path.join(dir, 'dealer.js'), 'utf8');
  equal((dealer.match(/for \(const seat of clockwise\(n, start\)\)/g) || []).length, 1, 'a single loop looks for the player to act');
});

// ---------------------------------------------------------------------------
// Who acts — the central rule, exhaustively
// ---------------------------------------------------------------------------

const STREETS_ALL = ['preflop', 'flop', 'turn', 'river'];

/** Reference, written independently: after BB (preflop) or after the button (postflop), clockwise, first active seat not yet acted. */
function referenceNextToAct(n, button, street, active, acted = []) {
  const bb = n === 2 ? (button + 1) % 2 : (button + 2) % n;
  let seat = street === 'preflop' ? (bb + 1) % n : (button + 1) % n;
  for (let k = 0; k < n; k++, seat = (seat + 1) % n) {
    if (active.includes(seat) && !acted.includes(seat)) return seat;
  }
  return null;
}

test('getFirstToAct: 2 to 6 players, every button, every street, every set of folded players', () => {
  const kinds = new Set();
  let cases = 0;
  for (let n = 2; n <= 6; n++) {
    for (let b = 0; b < n; b++) {
      for (let mask = 0; mask < 1 << n; mask++) {
        const active = [...Array(n).keys()].filter((i) => mask & (1 << i));
        if (active.length < 2) continue; // a hand needs at least two players
        const folded = [...Array(n).keys()].filter((i) => !active.includes(i));
        for (const street of STREETS_ALL) {
          const r = D.getFirstToAct({ players: n, button: b, active }, street);
          const expected = referenceNextToAct(n, b, street, active);
          equal(r.seat, expected, `${n} players, button J${b + 1}, ${street}, folded [${folded.map((i) => 'J' + (i + 1))}]`);
          assert(active.includes(r.seat), 'the player who acts holds cards');
          assert(!folded.includes(r.seat), 'a folded player is never returned');
          r.skipped.forEach((i) => assert(folded.includes(i), 'only folded players are skipped'));
          cases++;
          if (street !== 'preflop') {
            const left = (b + 1) % n;
            if (!folded.length) kinds.add('no fold');
            if (folded.length === 1) kinds.add('one fold');
            if (folded.length > 1) kinds.add('several folds');
            if (folded.some((i) => folded.includes((i + 1) % n))) kinds.add('consecutive folds');
            if (folded.includes(left)) kinds.add('left of the button folded');
            if (folded.includes(left) && folded.includes((left + 1) % n)) kinds.add('several left of the button folded');
          }
        }
      }
    }
  }
  equal([...kinds].sort(), ['consecutive folds', 'left of the button folded', 'no fold', 'one fold', 'several folds', 'several left of the button folded'].sort(), 'situations covered');
  equal(cases, 2120, "every combination (2 to 6 players × buttons × streets × fold sets with 2+ players left)");
});

test('Reference example: button J3, 6 players, after the flop', () => {
  const all = [0, 1, 2, 3, 4, 5];
  const without = (...players) => all.filter((i) => !players.includes(i));
  equal(D.getFirstToAct({ players: 6, button: 2 }, 'flop').seat, 3, 'nobody folded: J4');
  equal(D.getFirstToAct({ players: 6, button: 2, active: without(3) }, 'flop').seat, 4, 'J4 folded: J5');
  equal(D.getFirstToAct({ players: 6, button: 2, active: without(3, 4) }, 'flop').seat, 5, 'J4, J5 folded: J6');
  equal(D.getFirstToAct({ players: 6, button: 2, active: without(3, 4, 5) }, 'river').seat, 0, 'J4, J5, J6 folded: J1');
  equal(D.getFirstToAct({ players: 6, button: 2, active: without(3, 4) }, 'turn').skipped, [3, 4], 'skipped: J4 and J5');
  equal(D.getFirstToAct({ players: 6, button: 2 }, 'preflop').seat, 5, 'preflop: first after the BB (J5) is J6');
});

test('getNextToAct: during a round, the next active player who has not acted — every table, button, street and fold', () => {
  let cases = 0;
  for (let n = 2; n <= 6; n++) {
    for (let b = 0; b < n; b++) {
      for (let mask = 0; mask < 1 << n; mask++) {
        const active = [...Array(n).keys()].filter((i) => mask & (1 << i));
        if (active.length < 2) continue;
        for (const street of STREETS_ALL) {
          const order = D.actionOrder(n, b, street, active);
          equal(order[0], D.getFirstToAct({ players: n, button: b, active }, street).seat, 'the order starts with getFirstToAct');
          for (let k = 0; k < order.length; k++) {
            const acted = order.slice(0, k);
            const r = D.getNextToAct({ players: n, button: b, active }, street, acted);
            equal(r.seat, referenceNextToAct(n, b, street, active, acted), `${n} players, button J${b + 1}, ${street}, acted ${acted}`);
            assert(active.includes(r.seat) && !acted.includes(r.seat), 'active and not acted yet');
            cases++;
          }
        }
      }
    }
  }
  equal(cases, 6536, "every combination, at every point of the round");
});

test('Generated "who acts" situations cover the fold patterns and always match the rule read from the table', () => {
  const kinds = new Set();
  let checked = 0;
  for (const id of ['table_setup', 'hand_flow']) {
    for (let i = 0; i < 20000; i++) {
      const n = 2 + (i % 5);
      const q = createQuestion(id, { players: n, stage: 2 + (i % 2) });
      if (!['firstPreflop', 'firstPostflop', 'whoActs'].includes(q.situation)) continue;
      const street = q.street;
      const active = q.seats.map((s, k) => (s.folded ? -1 : k)).filter((k) => k >= 0);
      const acted = q.situation === 'whoActs' ? q.seats.map((s, k) => (!s.folded && s.status ? k : -1)).filter((k) => k >= 0) : [];
      const where = `${id}/${q.situation} ${show(q)}`;
      equal(q.answer, String(referenceNextToAct(n, q.button, street, active, acted)), `answer = rule read from the table — ${where}`);
      assertReadable(q, where);
      checked++;
      if (street !== 'preflop' && !acted.length) {
        const folded = q.seats.map((s, k) => (s.folded ? k : -1)).filter((k) => k >= 0);
        const left = (q.button + 1) % n;
        if (!folded.length) kinds.add('no fold');
        if (folded.length === 1) kinds.add('one fold');
        if (folded.length > 1) kinds.add('several folds');
        if (folded.some((k) => folded.includes((k + 1) % n))) kinds.add('consecutive folds');
        if (folded.includes(left)) kinds.add('left of the button folded');
        if (folded.includes(left) && folded.includes((left + 1) % n)) kinds.add('several left of the button folded');
      }
    }
  }
  equal([...kinds].sort(), ['consecutive folds', 'left of the button folded', 'no fold', 'one fold', 'several folds', 'several left of the button folded'].sort(), 'fold patterns generated');
  assert(checked > 3000, `${checked} situations checked`);
});

test('The "check" label reads CHECK in both languages', () => {
  global.window.DT.translations = {};
  require('../js/i18n/en.js');
  require('../js/i18n/fr.js');
  const { en, fr } = window.DT.translations;
  equal([en.dealer.status.check, fr.dealer.status.check], ['Check', 'Check'], 'status');
  equal([fr.dealer.markers.sb, fr.dealer.markers.bb, fr.dealer.markers.button], ['SB', 'BB', 'DEALER'], 'markers');
  equal([fr.dealer.cave, en.dealer.cave, fr.dealer.pot, en.dealer.pot], ['Cave', 'Stack', 'Pot', 'Pot'], 'cave and pot');
  assert(fr.dealer.why.caveNotInPot.includes('cave') && en.dealer.why.caveNotInPot.includes('stack'), 'cave reminder in both languages');
});

// ---------------------------------------------------------------------------
// 1. Rules — chips
// ---------------------------------------------------------------------------

test('Chip stacks: exact amount, largest chips first, at most 5 chips per stack', () => {
  equal(D.toStacks(85, [1, 2, 5, 10, 25]), [{ value: 25, count: 3 }, { value: 10, count: 1 }], '85');
  equal(D.toStacks(37, [1, 2, 5, 10, 25]), [{ value: 25, count: 1 }, { value: 10, count: 1 }, { value: 2, count: 1 }], '37');
  equal(D.toStacks(20, [25, 50, 100]), null, 'impossible with these chips');
  equal(D.toStacks(900, [25, 50, 100]), null, 'too many chips');
  for (const level of D.BLINDS) {
    assert(level.chips.every((v) => D.CHIP_VALUES.includes(v)), 'known chip values');
    assert(level.chips.includes(level.bb) || D.toStacks(level.bb, level.chips), 'the big blind can be paid');
    for (let amount = level.sb; amount <= level.bb * 15; amount += level.sb) {
      const stacks = D.toStacks(amount, level.chips);
      if (!stacks) continue;
      assert(D.stacksTotal(stacks) === amount, `total ${amount}`);
      assert(stacks.every((s) => s.count >= 1 && s.count <= D.MAX_PER_STACK), 'stack size');
    }
  }
});

test('Amounts: call, raise, pot after collecting, change', () => {
  equal(D.toCall(60, 10), 50, 'big blind calls a raise to 60');
  equal(D.toCall(60, 0), 60, 'nothing in front');
  equal(D.toCall(20, 20), 0, 'already matched');
  equal(D.raiseSize(60, 20), 40, 'raise from 20 to 60');
  equal(D.potAfterCollect(120, [40, 40, 40]), 240, 'pot');
  equal(D.change(100, 35), 65, 'change');
});

test('Amount options: four different positive amounts, answer included', () => {
  for (let i = 0; i < 300; i++) {
    const answer = 5 * (1 + (i % 40));
    const options = D.amountOptions(answer, [answer, -5, 0, 2.5, answer + 5], 5, Math.random).map(Number);
    assert(options.length === 4 && new Set(options).size === 4, 'four different');
    assert(options.includes(answer) && options.every((v) => v > 0), 'answer included, positive');
    assert(options.every((v, k) => !k || v > options[k - 1]), 'ascending');
  }
});

// ---------------------------------------------------------------------------
// 2. Generated situations
// ---------------------------------------------------------------------------

/** Runs `check` on questions of every stage and table size; returns the situations seen per stage. */
function generate(skillId, check) {
  const seen = { 1: new Set(), 2: new Set(), 3: new Set() };
  for (const stage of [1, 2, 3]) {
    for (let i = 0; i < PER_STAGE; i++) {
      const players = 2 + (i % 5);
      const q = createQuestion(skillId, { players, stage });
      assert(q.seats.length === players, 'table size');
      assert(q.options.includes(q.answer), `answer among options: ${show(q)}`);
      try { check(q, players, stage); } catch (e) { throw new Error(`${e.message}\n      ${show(q)}`); }
      seen[stage].add(q.situation);
    }
  }
  return seen;
}

/** The blind a seat posts this hand (0 if none). */
function blindOf(q, i) {
  const p = D.positions(q.seats.length, q.button);
  return i === p.sb ? q.blinds.sb : i === p.bb ? q.blinds.bb : 0;
}

const stacksOk = (list) => list.every((s) => D.CHIP_VALUES.includes(s.value) && s.count >= 1 && s.count <= D.MAX_PER_STACK);

/** Independent reading of the table: from `start`, clockwise, the first seat that still holds its cards. */
function firstActiveFrom(q, start) {
  const n = q.seats.length;
  for (let k = 0; k < n; k++) {
    const seat = (start + k) % n;
    if (q.seats[seat].cards && !q.seats[seat].folded) return seat;
  }
  return -1;
}

/** What the screen must show for a "who acts" question: cards for every active player, COUCHÉ for every folded one. */
function assertReadable(q, where) {
  q.seats.forEach((s, i) => {
    if (s.folded) assert(!s.cards, `folded Player ${i + 1} holds no cards — ${where}`);
    else assert(s.cards === 'down' || s.cards === 'up', `active Player ${i + 1} shows cards — ${where}`);
  });
  const answer = Number(q.answer);
  assert(q.seats[answer].cards && !q.seats[answer].folded, `the player who acts is active — ${where}`);
  assert(q.seats.filter((s) => !s.folded).length >= 2, `at least two players still in the hand — ${where}`);
}

test('Table setup: every answer follows the rules, heads-up included; markers never give the answer away', () => {
  const seen = generate('table_setup', (q, n) => {
    const b = q.button;
    const hu = n === 2;
    const sb = hu ? b : (b + 1) % n;
    const bb = hu ? (b + 1) % 2 : (b + 2) % n;
    const expected = {
      sb, bb,
      firstCard: hu ? bb : sb,
      lastCard: b,
      nextCard: q.target != null ? (q.target + 1) % n : -1,
      // Read from the table: first seat after BB (preflop) / after the button (postflop) that still holds cards.
      firstPreflop: firstActiveFrom(q, (bb + 1) % n),
      firstPostflop: firstActiveFrom(q, (b + 1) % n),
      nextButton: (b + 1) % n,
      nextSB: hu ? (b + 1) % n : (b + 2) % n,
      nextBB: hu ? b : (b + 3) % n,
    }[q.situation];
    assert(q.answer === String(expected), `${q.situation}: expected Player ${expected + 1}`);
    if (q.situation === 'firstPreflop' || q.situation === 'firstPostflop') assertReadable(q, q.situation);
    assert(q.options.length === n, 'one option per player');
    if (['sb', 'bb', 'nextButton', 'nextSB', 'nextBB'].includes(q.situation)) assert(!q.showBlinds, 'blind markers hidden');
    if (q.situation === 'nextCard') assert(q.target !== q.answer && q.target !== b, 'the button never gets a card after the last one');
  });
  equal([...seen[1]].sort(), ['bb', 'firstCard', 'nextButton', 'nextCard', 'sb'], 'stage 1');
  assert(seen[2].has('firstPreflop') && seen[2].has('firstPostflop') && seen[2].has('lastCard'), 'stage 2 adds the order of action');
  assert(seen[3].has('nextSB') && seen[3].has('nextBB'), 'stage 3 adds the next blinds');
});

test('Flow of a hand: whose turn and what the dealer does, read from the table', () => {
  const seen = generate('hand_flow', (q, n) => {
    const inHand = q.seats.map((s, i) => (s.cards ? i : -1)).filter((i) => i >= 0);
    const bets = q.seats.map((s) => s.bet);
    const boardCount = { preflop: 0, flop: 3, turn: 4, river: 5 }[q.street];
    assert(q.boardCount === boardCount, 'board matches the street');
    q.seats.forEach((s) => {
      assert(stacksOk(s.betStacks) && D.stacksTotal(s.betStacks) === s.bet, 'bet stacks');
      if (!s.cards) assert(!s.bet || q.street === 'preflop', 'folded players have no bet in front');
    });
    assert(stacksOk(q.potStacks) && D.stacksTotal(q.potStacks) === q.pot, 'pot stacks');
    assert(q.situation === 'street' || inHand.length >= 1, 'players in the hand');

    switch (q.situation) {
      case 'street':
        assert(q.answer === q.street, 'street');
        break;
      case 'whoActs': {
        // Independent: first seat from the start of the action, clockwise, still in the hand and without a status.
        const hu = n === 2;
        const b = q.button;
        const start = q.street === 'preflop' ? (hu ? b : (b + 3) % n) : (hu ? (b + 1) % 2 : (b + 1) % n);
        let seat = start;
        while (!(q.seats[seat].cards && !q.seats[seat].folded && !q.seats[seat].status)) seat = (seat + 1) % n;
        assert(q.answer === String(seat), `whoActs: expected Player ${seat + 1}`);
        assertReadable(q, 'whoActs');
        q.seats.forEach((s, i) => { if (!s.cards) assert(s.folded, `a player without cards is shown COUCHÉ (Player ${i + 1})`); });
        const inHandCount = q.seats.filter((s) => s.cards).length;
        assert(inHandCount >= 2, 'at least two players still in the hand');
        // Everyone in the hand between the start and the answer has acted.
        for (let k = start; k !== seat; k = (k + 1) % n) assert(!q.seats[k].cards || q.seats[k].status, 'acted before');
        break;
      }
      case 'collect':
        assert(q.answer === 'collect', 'collect');
        assert(bets.some(Boolean), 'bets in front');
        assert(inHand.every((i) => q.seats[i].status && bets[i] === bets[inHand[0]]), 'round complete, bets equal');
        break;
      case 'dealNext':
        assert(bets.every((v) => !v) && q.pot > 0, 'bets already in the pot');
        assert(inHand.length >= 2 && inHand.every((i) => q.seats[i].status), 'round complete');
        equal(q.answer, { preflop: 'dealFlop', flop: 'dealTurn', turn: 'dealRiver' }[q.street], 'next street');
        break;
      case 'showdown':
        assert(q.street === 'river' && bets.every((v) => !v) && inHand.length >= 2, 'river complete');
        assert(inHand.every((i) => q.seats[i].cards === 'down' && q.seats[i].status), 'cards not shown yet');
        break;
      case 'announce':
        assert(q.street === 'river' && inHand.length >= 2 && inHand.every((i) => q.seats[i].cards === 'up'), 'cards shown');
        assert(!q.seats.some((s) => s.marked), 'no winner marked yet');
        break;
      case 'pushPot':
        assert(bets.every((v) => !v) && q.pot > 0, 'pot ready');
        if (q.variant === 'folds') assert(inHand.length === 1, 'one player left');
        else assert(q.seats.filter((s) => s.marked).length === 1 && q.street === 'river', 'one winner announced');
        break;
      default:
        throw new Error(`unknown situation ${q.situation}`);
    }
    if (q.optionKind === 'action') assert(q.options.length === 4 && q.options.every((o) => D.ACTIONS.includes(o)), 'four dealer actions');
  });
  equal([...seen[1]].sort(), ['collect', 'dealNext', 'street'], 'stage 1');
  assert(seen[2].has('whoActs') && seen[2].has('showdown') && seen[2].has('announce'), 'stage 2');
  assert(seen[3].has('pushPot'), 'stage 3');
});

test('Flow of a hand: pushing the pot after the showdown gives it to the real winner', () => {
  const P = window.DT.poker;
  let count = 0;
  for (let i = 0; count < 30 && i < 20000; i++) {
    const q = createQuestion('hand_flow', { players: 2 + (i % 5), stage: 3 });
    if (q.situation !== 'pushPot' || q.variant !== 'winner') continue;
    count++;
    const inHand = q.seats.map((s, k) => (s.cards ? k : -1)).filter((k) => k >= 0);
    const { winners } = P.showdown(q.board, inHand.map((k) => q.seats[k].hole));
    assert(winners.length === 1 && q.seats[inHand[winners[0]]].marked, 'marked winner = engine winner');
  }
  assert(count === 30, 'enough winner situations');
});

test('Chips & bets: every amount recomputed from the chips on the table', () => {
  const seen = generate('chips_bets', (q, n, stage) => {
    const bets = q.seats.map((s) => D.stacksTotal(s.betStacks));
    q.seats.forEach((s, i) => {
      assert(stacksOk(s.betStacks), 'bet stacks');
      if (!s.chip) assert(bets[i] === s.bet, 'stacks = bet');
      if (s.behind != null) assert(stacksOk(s.behindStacks) && D.stacksTotal(s.behindStacks) === s.behind, 'behind stacks');
      if (!s.cards) assert(s.bet === (q.street === 'preflop' ? blindOf(q, i) : 0), 'a folded player keeps only the blind');
    });
    const pot = D.stacksTotal(q.potStacks);
    const t = q.target;
    const othersMax = Math.max(0, ...bets.filter((_, i) => i !== t));
    const answer = Number(q.answer);
    assert(q.showValues === (stage < 3), 'chip values written on stages 1–2 only');

    switch (q.situation) {
      case 'stack':
      case 'committed':
        assert(answer === bets[t] && q.seats[t].cards, 'amount in front of the target');
        break;
      case 'pot':
        assert(answer === pot && bets.every((v) => !v), 'pot only');
        break;
      case 'toCall':
        assert(answer === Math.max(...bets) - bets[t] && answer > 0, 'highest bet − own bet');
        assert(q.seats[t].cards, 'target still in the hand');
        break;
      case 'raise':
        assert(q.seats[t].status === 'raise' && answer === bets[t] - othersMax && bets[t] >= 2 * othersMax, 'raise size');
        break;
      case 'potAfter':
        assert(answer === pot + bets.reduce((a, b) => a + b, 0), 'pot + bets');
        q.seats.forEach((s, i) => assert(s.cards ? bets[i] === Math.max(...bets) : bets[i] === (q.street === 'preflop' ? blindOf(q, i) : 0), 'round complete: equal bets, folded blinds keep the blind'));
        break;
      case 'allIn': {
        const empty = q.seats.map((s, i) => (s.behindStacks && s.behindStacks.length === 0 ? i : -1)).filter((i) => i >= 0);
        equal(empty, [Number(q.answer)], 'only the all-in player has no chips behind');
        assert(bets[Number(q.answer)] > 0, 'all-in player has a bet');
        break;
      }
      case 'action': {
        const behind = q.seats[t].behind;
        const expected = behind === 0 ? 'allIn' : othersMax === 0 ? 'bet' : bets[t] === othersMax ? 'call' : bets[t] >= 2 * othersMax ? 'raise' : 'invalid';
        assert(q.answer === expected, `action: expected ${expected}`);
        // The action is recorded (the view hides it for this player: it is the question).
        equal(q.seats[t].status, q.answer, 'recorded action = answer');
        break;
      }
      case 'change':
        assert(q.seats[t].chip && answer === q.seats[t].chip - othersMax && answer > 0, 'chip − amount to call');
        break;
      default:
        throw new Error(`unknown situation ${q.situation}`);
    }
    if (q.optionKind === 'amount') {
      assert(q.options.length === 4 && new Set(q.options).size === 4 && q.options.every((o) => Number(o) > 0), 'four positive amounts');
    }
  });
  equal([...seen[1]].sort(), ['pot', 'stack', 'toCall'], 'stage 1');
  equal([...seen[2]].sort(), ['action', 'allIn', 'pot', 'potAfter', 'raise', 'stack', 'toCall'], 'stage 2');
  assert(seen[3].has('change') && seen[3].has('committed'), 'stage 3');
});

test('Chips & bets: bets, raises and all-ins appear at 2 to 6 players', () => {
  for (let n = 2; n <= 6; n++) {
    const found = new Set();
    for (let i = 0; i < 600; i++) {
      const q = createQuestion('chips_bets', { players: n, stage: 2 + (i % 2) });
      found.add(q.situation === 'action' ? `action:${q.answer}` : q.situation);
    }
    for (const s of ['toCall', 'raise', 'allIn', 'potAfter', 'action:bet', 'action:call', 'action:raise', 'action:allIn']) {
      assert(found.has(s), `${s} missing at ${n} players`);
    }
  }
});

// ---------------------------------------------------------------------------
// Cave / engaged / pot
// ---------------------------------------------------------------------------

/** Every chips question, every stage, 2 to 6 players. */
function eachChips(fn, per = 300) {
  for (const stage of [1, 2, 3]) {
    for (let i = 0; i < per; i++) fn(createQuestion('chips_bets', { players: 2 + (i % 5), stage }), stage);
  }
}

test('Cave: every player has one, and its chips match its amount', () => {
  eachChips((q) => {
    q.seats.forEach((s, i) => {
      assert(Number.isInteger(s.behind) && s.behind >= 0, `Player ${i + 1} has a cave: ${show(q)}`);
      assert(Array.isArray(s.behindStacks) && stacksOk(s.behindStacks), 'cave chips');
      assert(D.stacksTotal(s.behindStacks) === s.behind, 'cave chips = cave amount');
      assert((s.behind === 0) === (s.behindStacks.length === 0), 'an empty cave has no chips');
    });
  });
});

test('Cave chips are never counted in the pot; engaged chips are', () => {
  eachChips((q) => {
    const caves = q.seats.reduce((sum, s) => sum + s.behind, 0);
    const engaged = q.seats.reduce((sum, s) => sum + D.stacksTotal(s.betStacks), 0);
    const pot = D.stacksTotal(q.potStacks);
    assert(caves > 0, 'there are chips in the caves');
    if (q.situation === 'pot') {
      equal(Number(q.answer), pot, 'pot = chips in the pot only');
      assert(!q.options.includes(String(pot + caves)), 'the caves are not a proposed pot');
    }
    if (q.situation === 'potAfter') {
      equal(Number(q.answer), pot + engaged, 'pot after collecting = pot + engaged chips');
      assert(Number(q.answer) !== pot + engaged + caves, 'caves never added');
    }
  });
});

test('Coherent caves: the player asked to call has enough chips in the cave to call', () => {
  eachChips((q) => {
    if (q.situation === 'toCall') assert(q.seats[q.target].behind >= Number(q.answer), `cave ${q.seats[q.target].behind} < call ${q.answer}`);
  });
});

test('All-in: no chips left in the cave; every other player still has some', () => {
  let allIns = 0;
  eachChips((q) => {
    const empty = q.seats.map((s, i) => (s.behind === 0 ? i : -1)).filter((i) => i >= 0);
    if (q.situation === 'allIn' || (q.situation === 'action' && q.answer === 'allIn')) {
      const player = q.situation === 'allIn' ? Number(q.answer) : q.target;
      equal(empty, [player], 'only the all-in player has an empty cave');
      assert(q.seats[player].bet > 0, 'the all-in player has engaged chips');
      allIns++;
    } else {
      equal(empty, [], `nobody else has an empty cave (${q.situation})`);
    }
  });
  assert(allIns > 30, 'enough all-in situations'); // about 110 on average, never under 85 in 15 samples
});

test('Amounts stay coherent: engaged chips on the felt, pot in the middle, caves off the table', () => {
  eachChips((q) => {
    q.seats.forEach((s, i) => {
      if (!s.chip) equal(D.stacksTotal(s.betStacks), s.bet, 'engaged chips = bet');
      if (!s.cards) equal(s.bet, q.street === 'preflop' ? blindOf(q, i) : 0, 'a folded player keeps only the blind');
    });
    equal(D.stacksTotal(q.potStacks), q.pot, 'pot chips = pot');
    if (q.street !== 'preflop' && q.situation !== 'pot') assert(q.pot > 0, 'after the flop there is a pot');
    if (q.street === 'preflop') equal(q.pot, 0, 'preflop: nothing in the pot yet, only blinds and bets in front');
  });
});

// ---------------------------------------------------------------------------
// Blinds and the ledger: starting stack = in the pot + engaged on the felt + cave
// ---------------------------------------------------------------------------

const engagedOf = (s) => s.chip || s.bet;
const ACTED = ['call', 'raise', 'bet', 'allIn'];

test('SB always has the small blind engaged, BB the big blind, whenever SB / BB are shown — every skill, 2 to 6 players', () => {
  let shown = 0;
  for (const id of ['chips_bets', 'hand_flow', 'table_setup']) {
    for (const stage of [1, 2, 3]) {
      for (let i = 0; i < 300; i++) {
        const q = createQuestion(id, { players: 2 + (i % 5), stage });
        if (!D.blindsShown(q)) continue;
        shown++;
        const p = D.positions(q.seats.length, q.button);
        const sbSeat = q.seats[p.sb];
        const bbSeat = q.seats[p.bb];
        const where = `${id} stage ${stage}: ${show(q)}`;
        if (ACTED.includes(sbSeat.status)) assert(sbSeat.bet >= q.blinds.sb, `SB engaged at least the blind — ${where}`);
        else equal(sbSeat.bet, q.blinds.sb, `SB engaged = small blind — ${where}`);
        if (ACTED.includes(bbSeat.status)) assert(bbSeat.bet >= q.blinds.bb, `BB engaged at least the blind — ${where}`);
        else equal(bbSeat.bet, q.blinds.bb, `BB engaged = big blind — ${where}`);
      }
    }
  }
  assert(shown > 500, `SB / BB shown on enough tables (${shown})`);
});

test('Chips & bets: SB / BB shown on every preflop table, never after the flop (the blinds are then in the pot)', () => {
  eachChips((q) => {
    if (q.street === 'preflop') assert(D.blindsShown(q), `preflop: blinds on the felt ${show(q)}`);
    else {
      assert(!D.blindsShown(q), 'after the flop: no SB / BB labels');
      assert(q.pot >= q.blinds.sb + q.blinds.bb, 'after the flop the pot holds at least the blinds');
    }
  });
});

test('Blinds are engaged, never counted in the cave: cave = starting stack − pot share − engaged', () => {
  eachChips((q) => {
    q.seats.forEach((s, i) => {
      equal(s.behind, s.start - s.prior - engagedOf(s), `cave = what is left (Player ${i + 1}) ${show(q)}`);
      assert(s.behind >= 0, 'never a negative cave');
      if (q.street === 'preflop' && blindOf(q, i) && !ACTED.includes(s.status) && s.status !== 'check') {
        equal(s.start - s.behind, blindOf(q, i), 'a blind who has not acted: only the blind left the cave');
      }
    });
  });
});

test('Pot + engaged + caves = starting stacks, and the pot holds exactly the earlier rounds', () => {
  eachChips((q) => {
    const starts = q.seats.reduce((sum, s) => sum + s.start, 0);
    const engaged = q.seats.reduce((sum, s) => sum + engagedOf(s), 0);
    const caves = q.seats.reduce((sum, s) => sum + s.behind, 0);
    equal(q.pot, q.seats.reduce((sum, s) => sum + s.prior, 0), 'pot = what was collected before');
    equal(q.pot + engaged + caves, starts, `pot + engaged + caves = stacks ${show(q)}`);
    if (q.street === 'preflop') equal(q.pot, 0, 'preflop: nothing collected yet');
  });
});

test('All-in: empty cave and the whole stack engaged; nobody else has an empty cave', () => {
  let allIns = 0;
  eachChips((q) => {
    q.seats.forEach((s, i) => {
      if (s.behind === 0) {
        equal(s.status, 'allIn', `an empty cave means all-in (Player ${i + 1})`);
        equal(s.prior + s.bet, s.start, 'the whole stack is in the pot or engaged');
        assert(s.bet > 0, 'all-in chips on the felt');
        allIns++;
      }
      if (s.status === 'allIn') equal(s.behind, 0, 'all-in: cave at 0');
    });
  });
  assert(allIns > 40, 'enough all-ins'); // about 110 on average, never under 80 in 40 samples
});

test('Folded: nothing new is engaged after the fold', () => {
  let folds = 0;
  eachChips((q) => {
    q.seats.forEach((s, i) => {
      if (s.cards) return;
      folds++;
      if (q.street === 'preflop') equal(s.bet, blindOf(q, i), 'preflop fold: only the blind stays engaged');
      else {
        equal(s.bet, 0, 'folded on this round: nothing engaged');
        if (s.status === null) equal(s.prior, blindOf(q, i), 'folded before the flop: only the blind went to the pot');
      }
    });
  });
  assert(folds > 200, 'enough folds');
});

test('The six situations of a hand all occur: blinds only, call, bet, raise, bets collected in the pot, all-in', () => {
  const seen = new Set();
  eachChips((q) => {
    const statuses = q.seats.map((s) => s.status);
    if (q.street === 'preflop' && statuses.every((st) => !st)) seen.add('blinds only');
    if (statuses.includes('call')) seen.add('call');
    if (statuses.includes('bet')) seen.add('bet');
    if (statuses.includes('raise')) seen.add('raise');
    if (q.situation === 'pot') seen.add('collected in the pot');
    if (statuses.includes('allIn')) seen.add('all-in');
  });
  equal([...seen].sort(), ['all-in', 'bet', 'blinds only', 'call', 'collected in the pot', 'raise'], 'situations');
});

test('Example table: 3–4 players, different caves, blinds, a bet, a player with chips engaged AND a cave, a pot', () => {
  let found = null;
  for (let i = 0; i < 5000 && !found; i++) {
    const q = createQuestion('chips_bets', { players: 3 + (i % 2), stage: 2 });
    const caves = q.seats.map((s) => s.behind);
    const both = q.seats.some((s) => s.bet > 0 && s.behind > 0);
    if (q.pot > 0 && new Set(caves).size > 1 && q.seats.some((s) => s.status === 'bet') && both) found = q;
  }
  assert(found, 'such a table is generated');
  const p = D.positions(found.seats.length, found.button);
  assert(p.sb !== p.bb && p.button !== p.bb, 'blinds on two players, not on the button');
});

test('Stage 1 of the chips stays simple: small blinds and short bets', () => {
  for (let i = 0; i < 500; i++) {
    const q = createQuestion('chips_bets', { players: 2 + (i % 5), stage: 1 });
    assert(q.blinds.bb <= 10, 'blinds 1/2 or 5/10');
    assert(q.seats.every((s) => s.bet <= q.blinds.bb * 10), 'short bets');
  }
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
