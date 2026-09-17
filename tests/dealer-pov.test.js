/*
  The dealer's view — one shared table for every exercise.   Run:  node tests/dealer-pov.test.js

  1. The places: an angle of the table layout becomes screen coordinates (the dealer at the bottom, players around).
  2. Every Hold'em view that shows a table goes through the shared scene: no view draws its own table.
  3. The rendered scene of each exercise: the dealer's place, the players at their own angle, the button on the edge
     of the felt, the bets, the centre — all read from the question, never from the coordinates.
*/
const fs = require('fs');
const path = require('path');

global.window = { DT: { translations: {}, core: {}, data: {}, components: {}, exercises: {}, views: {} } };
global.navigator = { language: 'fr-FR' };
global.document = { documentElement: {} };

/** A minimal element: keeps its tag, props, children and CSS custom properties. */
function h(tag, props, ...children) {
  const style = {};
  return {
    tag,
    props: props || {},
    children: children.flat(Infinity).filter((c) => c != null && c !== false),
    classList: { add() {}, contains() { return false; } },
    style: {
      setProperty(name, value) { style[name] = String(value); },
      getPropertyValue(name) { return style[name] || (props && props.style && props.style[name]) || ''; },
      props: style,
    },
  };
}
window.DT.core.dom = { h };
window.DT.components.Card = () => h('span', { class: 'pcard' });
window.DT.components.Chip = () => h('span', { class: 'chip' });

const load = (f) => require(f);
['../js/i18n/en.js', '../js/i18n/fr.js', '../js/core/i18n.js', '../js/core/format.js', '../js/data/holdem-skills.js', '../js/data/house-rules.js',
  '../js/components/DealerPov.js', '../js/modules/holdem/engine.js', '../js/modules/holdem/dealer.js', '../js/modules/holdem/ultimate.js',
  '../js/modules/holdem/skills.js', '../js/modules/holdem/dealer-view.js', '../js/modules/holdem/ultimate-view.js', '../js/modules/holdem/holdem.js'].forEach(load);
window.DT.i18n.setLanguage('fr');

const POV = window.DT.components.DealerPov;
const D = window.DT.holdemDealer;
const HOLDEM = window.DT.exercises.holdem;
const { createQuestion } = window.DT.holdemSkills;

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function equal(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const round = (v) => Math.round(Number(v) * 100) / 100;
const coords = (el) => [round(el.props.style['--px']), round(el.props.style['--py'])];
/** Every node of a rendered stage that matches. */
function all(node, match, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (match(node)) out.push(node);
  (node.children || []).forEach((c) => all(c, match, out));
  return out;
}
const hasClass = (cls) => (n) => String((n.props && n.props.class) || '').split(' ').includes(cls);

// ---------------------------------------------------------------------------
// 1. Places
// ---------------------------------------------------------------------------

test('The dealer sits at the bottom: an angle of the table layout becomes screen coordinates', () => {
  equal([round(POV.place(0)['--px']), round(POV.place(0)['--py'])], [0, 1], 'the dealer (0°) is at the bottom');
  equal([round(POV.place(180)['--px']), round(POV.place(180)['--py'])], [0, -1], 'the far side is at the top');
  equal([round(POV.place(90)['--px']), round(POV.place(90)['--py'])], [-1, 0], "the dealer's left is on the left of the screen");
  equal([round(POV.place(270)['--px']), round(POV.place(270)['--py'])], [1, 0], "the dealer's right is on the right");
  // Clockwise from the dealer's left, as the cards are dealt
  const angles = D.tableLayout(4).seats;
  const xs = angles.map((a) => Number(POV.place(a)['--px']));
  assert(xs[0] < 0 && xs[3] > 0, `Player 1 on the left, Player 4 on the right: ${xs}`);
  equal(angles.map(POV.side), ['near', 'far', 'far', 'near'], "sides of the table: the first and last places are on the dealer side");
  equal([POV.side(0), POV.side(200), POV.side(20)], ['near', 'far', 'near'], 'near, far, near');
});

test('Every table size: the places never sit on the dealer, and they follow the table layout', () => {
  for (let n = 1; n <= 6; n++) {
    const angles = D.tableLayout(n).seats;
    equal(angles.length, n, `${n} places`);
    angles.forEach((a) => {
      const { '--px': px, '--py': py } = POV.place(a);
      assert(Math.abs(Number(px)) <= 1 && Math.abs(Number(py)) <= 1, 'inside the table');
      assert(Number(py) < 0.98, `no place in the dealer's own seat (${n} players)`);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. One shared table
// ---------------------------------------------------------------------------

test('No second table: only the shared component draws the felt, and every view uses its scene', () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const views = ['js/modules/holdem/holdem.js', 'js/modules/holdem/dealer-view.js', 'js/modules/holdem/ultimate-view.js'];
  views.forEach((file) => {
    const src = read(file);
    if (/DealerPov\.scene/.test(src)) return;
    assert(!/pov-table|pov-felt|pov-scene/.test(src), `${file} must not draw a table of its own`);
  });
  assert(views.filter((f) => /DealerPov\.scene/.test(read(f))).length === 3, 'the three table views use the shared scene');
  assert(/pov-table/.test(read('js/components/DealerPov.js')), 'the component draws the table');
  // The table stylesheets never redefine a global layout class of the app
  const classesDefined = (src) => new Set([...src.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|[\s,}])\.([a-zA-Z][\w-]*)(?=[\s,{:.[>])/gm)].map((m) => m[2]));
  const global = classesDefined(read('css/main.css'));
  ['css/dealer-pov.css', 'css/dealer-table.css', 'css/ultimate-table.css', 'css/holdem.css'].forEach((file) => {
    equal([...classesDefined(read(file))].filter((c) => global.has(c)), [], `${file}: classes shared with main.css`);
  });
});

// ---------------------------------------------------------------------------
// 3. The rendered scene of each exercise
// ---------------------------------------------------------------------------

/** Checks common to every table: the shared scene, the dealer at the bottom, one felt. */
function assertScene(stage, where) {
  assert(hasClass('pov')(stage), `${where}: the shared scene`);
  equal(all(stage, hasClass('pov-table')).length, 1, `${where}: one table`);
  equal(all(stage, hasClass('pov-felt')).length, 1, `${where}: one felt`);
  equal(all(stage, hasClass('pov-dealer')).length, 1, `${where}: the dealer's place`);
  equal(all(stage, hasClass('pov-rack')).length, 1, `${where}: the dealer's chip rack`);
  assert(all(stage, hasClass('pov-centre')).length <= 1, `${where}: a single centre`);
}

test('Showdown (hand recognition, who wins): the players around the table, the board in the centre', () => {
  for (const [skill, players] of [['hand_recognition', 1], ['hand_comparison', 3], ['kicker', 2], ['close_calls', 6]]) {
    const q = createQuestion(skill, { players, stage: 3 });
    const stage = HOLDEM.view(q).stage;
    const where = `${skill} (${q.players.length} players)`;
    assertScene(stage, where);
    const seats = all(stage, hasClass('pov-seat'));
    equal(seats.length, q.players.length, `${where}: one place per player`);
    const angles = D.tableLayout(q.players.length).seats;
    seats.forEach((el, i) => equal(coords(el), [round(POV.place(angles[i])['--px']), round(POV.place(angles[i])['--py'])], `${where}: place ${i + 1} at its angle`));
    equal(all(stage, hasClass('board')).length, 1, `${where}: the board in the centre`);
    assert(all(stage, hasClass('pcard')).length === 5 + 2 * q.players.length, `${where}: every card`);
  }
});

test('Dealer situations: places, dealer button on the edge of the felt, bets, board and pot', () => {
  for (const [skill, players] of [['table_setup', 6], ['hand_flow', 5], ['chips_bets', 4]]) {
    for (let k = 0; k < 40; k++) {
      const q = createQuestion(skill, { players, stage: 1 + (k % 3) });
      const stage = HOLDEM.view(q).stage;
      const where = `${skill}/${q.situation}`;
      assertScene(stage, where);
      const seats = all(stage, hasClass('pov-seat'));
      equal(seats.length, q.seats.length, `${where}: one place per player`);
      const layout = D.tableLayout(q.seats.length, q.button);
      seats.forEach((el, i) => equal(coords(el), [round(POV.place(layout.seats[i])['--px']), round(POV.place(layout.seats[i])['--py'])], `${where}: place ${i + 1}`));
      // The dealer button: on the edge of the felt, at the angle of the shared layout (never in front of a player)
      const button = all(stage, hasClass('dealer-button'));
      equal(button.length, q.hideButton ? 0 : 1, `${where}: the button is shown unless it is the question`);
      if (button.length) {
        equal(coords(button[0]), [round(POV.place(layout.button)['--px']), round(POV.place(layout.button)['--py'])], `${where}: button between two places`);
        assert(hasClass('pov-on-rail')(button[0]), `${where}: the button sits on the edge of the felt`);
      }
      // Bets: on the felt for the table and the chips, in the player's place for the flow of a hand
      const onFelt = all(stage, hasClass('pov-on-bets'));
      const inPlace = all(stage, hasClass('bet-spot--in-place'));
      const betting = q.seats.filter((s) => s.chip || (s.betStacks && s.betStacks.length)).length;
      equal(onFelt.length + inPlace.length, betting, `${where}: one bet per engaged player`);
      equal(skill === 'hand_flow' ? onFelt.length : inPlace.length, 0, `${where}: bets of this exercise in one place only`);
      onFelt.forEach((el) => assert(Math.abs(Number(el.props.style['--px'])) <= 1, `${where}: a bet on the felt has a place`));
      // The pot is in front of the dealer, in the dealer's place
      const dealerPlace = all(stage, hasClass('pov-dealer'))[0];
      equal(all(dealerPlace, hasClass('pot')).length, q.potStacks && q.potStacks.length ? 1 : 0, `${where}: the pot is in front of the dealer`);
      equal(all(stage, hasClass('pot')).length, all(dealerPlace, hasClass('pot')).length, `${where}: the pot is nowhere else`);
      // Folded players keep their place and their COUCHÉ badge, active players their cards
      q.seats.forEach((s, i) => {
        const el = seats[i];
        const cards = all(el, hasClass('pcard')).length;
        if (s.folded) assert(cards === 0 && /is-folded/.test(el.props.class), `${where}: Player ${i + 1} folded`);
        else if (s.cards) assert(cards === 2, `${where}: Player ${i + 1} shows two cards`);
      });
    }
  }
});

test('Ultimate: the dealer and their hand at the bottom, the board in the middle, the players on the far curve', () => {
  for (const skill of window.DT.holdemUltimate.SKILL_IDS) {
    for (let k = 0; k < 20; k++) {
      const q = createQuestion(skill, { stage: 1 + (k % 3) });
      const stage = HOLDEM.view(q).stage;
      const where = `${skill}/${q.situation}`;
      assertScene(stage, where);
      assert(/pov--rows/.test(stage.props.class) && /pov--halfmoon/.test(stage.props.class), `${where}: rows on a half-moon table`);
      const spots = all(stage, hasClass('uth-spot'));
      equal(spots.length, q.spots.length, `${where}: one layout per player`);
      // The places are spread across the far side, in the order of the players, left to right
      const xs = spots.map((el) => Number(el.props.style['--px']));
      spots.forEach((el) => assert(Number(el.props.style['--py']) < -0.5, `${where}: the players sit away from the dealer`));
      assert(xs.every((x, i) => i === 0 || x > xs[i - 1]), `${where}: players from the dealer's left to the right (${xs})`);
      // The dealer's own hand is in the dealer's place, with the board in the centre
      const dealerPlace = all(stage, hasClass('pov-dealer'))[0];
      equal(all(dealerPlace, hasClass('uth-dealer')).length, 1, `${where}: the dealer's hand in front of the dealer`);
      equal(all(all(stage, hasClass('pov-centre'))[0], hasClass('uth-board')).length, 1, `${where}: the board in the centre`);
      // Every betting spot of the layout is shown
      equal(all(spots[0], hasClass('uth-zone')).length, 4, `${where}: ANTE, BLIND, PLAY and TRIPS`);
    }
  }
});

test('The table never becomes the source of truth: the same question always gives the same places', () => {
  const q = createQuestion('table_setup', { players: 5, stage: 2 });
  const first = all(HOLDEM.view(q).stage, hasClass('pov-seat')).map(coords);
  const again = all(HOLDEM.view(q).stage, hasClass('pov-seat')).map(coords);
  equal(again, first, 'the view is a pure reading of the question');
  // Moving the button changes only the button, never the places
  const moved = { ...q, button: (q.button + 1) % 5 };
  equal(all(HOLDEM.view(moved).stage, hasClass('pov-seat')).map(coords), first, 'the places do not depend on the button');
  const layout = window.DT.holdemDealer.tableLayout(5, moved.button);
  const button = all(HOLDEM.view(moved).stage, hasClass('dealer-button'))[0];
  if (button) equal(coords(button), [round(POV.place(layout.button)['--px']), round(POV.place(layout.button)['--py'])], 'the button follows the shared layout');
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
