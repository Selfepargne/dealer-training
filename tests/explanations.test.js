/*
  Explanations shown after an answer ("short" sentence and "Why?" details), in French.
  Run:  node tests/explanations.test.js
*/
global.window = { DT: { translations: {}, core: {}, data: {}, components: {}, exercises: {}, views: {} } };
global.navigator = { language: 'fr-FR' };
global.document = { documentElement: {} };

// Explanations are plain text: the display helpers are not needed here.
window.DT.core.dom = { h: () => null };
window.DT.components.Card = () => null;
window.DT.components.Chip = () => null;

for (const f of [
  '../js/i18n/en.js', '../js/i18n/fr.js', '../js/core/i18n.js', '../js/core/format.js',
  '../js/data/holdem-skills.js', '../js/data/blackjack-skills.js',
  '../js/modules/holdem/engine.js', '../js/modules/holdem/skills.js', '../js/modules/holdem/holdem.js',
  '../js/modules/blackjack/engine.js', '../js/modules/blackjack/skills.js', '../js/modules/blackjack/blackjack.js',
]) require(f);
window.DT.i18n.setLanguage('fr');

const P = window.DT.poker;
const HOLDEM = window.DT.exercises.holdem;
const BJ = window.DT.exercises.blackjack;
const B = window.DT.blackjack;

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function equal(a, b, msg) { assert(a === b, `${msg}:\n      expected: ${b}\n      got:      ${a}`); }
const cards = (text) => text.trim().split(/\s+/);

/** Build a showdown question from text: holdem('board', 'P1 cards', 'P2 cards', …) */
function holdem(board, ...holeTexts) {
  const b = cards(board);
  const holes = holeTexts.map(cards);
  const { hands, winners } = P.showdown(b, holes);
  return {
    kind: 'winner', board: b, winners, split: winners.length > 1,
    players: holes.map((c, i) => ({ cards: c, hand: hands[i] })),
    answer: winners.length > 1 ? 'split' : String(winners[0]),
  };
}
const plain = (text) => text.replace(/︎/g, '');

// ---------------------------------------------------------------------------
// Hold'em
// ---------------------------------------------------------------------------

test("Hold'em — kicker: short sentence and why details", () => {
  const ex = HOLDEM.explain(holdem('Kh Ac 9d 4s 2h', 'Kd Qs', 'Ks Jc'));
  equal(ex.headline, 'Joueur 1 gagne', 'headline');
  equal(ex.hand, 'Paire de Rois', 'hand');
  equal(ex.short, 'Même paire. Joueur 1 gagne avec le meilleur kicker.', 'short');
  equal(ex.why[0].label, 'Joueur 1', 'player 1 label');
  equal(plain(ex.why[0].cards), 'K♦ K♥ A♣ Q♠ 9♦', 'player 1 cards');
  equal(plain(ex.why[1].cards), 'K♠ K♥ A♣ J♣ 9♦', 'player 2 cards');
  equal(ex.why[2], 'Meilleure main : K K A Q 9', 'best hand');
  equal(ex.why[3], 'Le kicker Dame bat le kicker Valet.', 'decides');
  equal(ex.why[4].result, 'Joueur 1 gagne.', 'result');
});

test("Hold'em — two pair decided by the kicker (8 beats 7)", () => {
  const ex = HOLDEM.explain(holdem('As Ac 6s 2d 3h', '6d 8h', '6h 7h'));
  equal(ex.short, 'Mêmes deux paires. Joueur 1 gagne avec le meilleur kicker.', 'short');
  equal(ex.why[2], 'Meilleure main : A A 6 6 8', 'best hand');
  equal(ex.why[3], 'Le kicker 8 bat le kicker 7.', 'decides');
});

test("Hold'em — different hand types: \"Joueur 2 a une quinte.\"", () => {
  const ex = HOLDEM.explain(holdem('9h 8d 7c 2s Kh', 'Ah As', 'Tc 6d'));
  equal(ex.headline, 'Joueur 2 gagne', 'headline');
  equal(ex.short, 'Joueur 2 a une quinte.', 'short');
  equal(ex.why[3], "Quinte hauteur 10 bat Paire d'As.", 'why');
});

test("Hold'em — full house", () => {
  const ex = HOLDEM.explain(holdem('Kh Kd 9c 9s 2h', 'Ks 3d', 'Ac Qd'));
  equal(ex.short, 'Joueur 1 a un full.', 'short');
});

test("Hold'em — quads", () => {
  const ex = HOLDEM.explain(holdem('7h 7d Kc 2s 3h', '7s 7c', 'Kh Kd'));
  equal(ex.short, 'Joueur 1 a un carré.', 'short');
  equal(ex.hand, 'Carré de 7', 'hand');
});

test("Hold'em — same type, higher pair", () => {
  const ex = HOLDEM.explain(holdem('Kh 8d 7c 4s 2h', '9h 9s', '5c 5d'));
  equal(ex.short, 'Joueur 1 a la meilleure paire.', 'short');
  equal(ex.why[3], 'Le 9 bat le 5.', 'why');
});

test("Hold'em — board plays: split", () => {
  const ex = HOLDEM.explain(holdem('9h 8d 7c 6s 5h', '2c 3d', 'Ks Qh'));
  equal(ex.headline, 'Partage', 'headline');
  equal(ex.short, 'Le board donne la même main de cinq cartes à Joueur 1 et Joueur 2.', 'short');
  equal(ex.why[ex.why.length - 1].result, 'Partage : Joueur 1 et Joueur 2.', 'why');
});

test("Hold'em — split with hole cards playing", () => {
  const ex = HOLDEM.explain(holdem('Ah Kd 9c 5s 2h', 'Qc Jd', 'Qs Jh'));
  equal(ex.short, 'Joueur 1 et Joueur 2 ont la même main de cinq cartes.', 'short');
});

test("Hold'em — flush decided below the top card", () => {
  const ex = HOLDEM.explain(holdem('Ah 9h 7h 2c 3d', 'Kh 4h', 'Qh Jh'));
  equal(ex.short, 'Même couleur. Joueur 1 gagne avec une carte plus haute.', 'short');
  equal(ex.why[3], 'Le Roi bat la Dame.', 'why');
});

test("Hold'em — 4 players: compared with the strongest losing hand", () => {
  // P3 has trips, P4 has two pair (the closest), P1 and P2 a pair
  const ex = HOLDEM.explain(holdem('Qh 8d 3c 9s 2h', 'Ac 4d', 'Kc 5d', 'Qs Qd', '8h 9h'));
  equal(ex.headline, 'Joueur 3 gagne', 'headline');
  equal(ex.short, 'Joueur 3 a un brelan.', 'short');
  equal(ex.why[0].label, 'Joueur 3', 'winner shown first');
  equal(ex.why[1].label, 'Joueur 4', 'strongest loser shown second');
});

test("Hold'em — 6 players, split between three", () => {
  const ex = HOLDEM.explain(holdem('As Ks Qd Jc Th', '2c 3d', '4s 5h', '6c 7d', '8c 8d', '9c 9d', '2h 4c'));
  equal(ex.headline, 'Partage', 'headline');
  equal(ex.short, 'Le board donne la même main de cinq cartes à Joueur 1, Joueur 2, Joueur 3, Joueur 4, Joueur 5 et Joueur 6.', 'short');
  equal(ex.why.filter((w) => w.label).length, 3, 'at most three hands shown');
});

test("Hold'em — recognition: only the best five cards count", () => {
  const seven = cards('Ks Kh Kd 9c 9s 2h 3d');
  const q = { kind: 'recognition', board: seven.slice(2), players: [{ cards: seven.slice(0, 2), hand: P.bestHand(seven) }], winners: [0], split: false };
  const ex = HOLDEM.explain(q);
  equal(ex.headline, 'Full aux Rois par les 9', 'headline');
  equal(ex.short, 'Seules les cinq meilleures cartes comptent.', 'short');
});

test("Hold'em — every generated question has a short explanation, and why lines when relevant", () => {
  for (const id of window.DT.holdemSkills.SKILL_IDS) {
    for (let i = 0; i < 80; i++) {
      const ex = HOLDEM.explain(window.DT.holdemSkills.createQuestion(id));
      assert(ex.headline && ex.short && !/\{|\}|undefined/.test(ex.short + ex.headline), `${id}: ${ex.headline} / ${ex.short}`);
      assert(Array.isArray(ex.why) && ex.why.length >= 2 && ex.why.every((l) => !/\{|\}|undefined/.test(l)), `${id}: why ${ex.why}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Blackjack
// ---------------------------------------------------------------------------

const bj = (kind, data, answer) => ({ kind, data, answer, options: [answer] });

test('Blackjack — ace counted 1 to avoid bust', () => {
  const ex = BJ.explain(bj('total', { cards: cards('As 6h 9d') }, '16'));
  equal(ex.hand, '1 + 6 + 9 = 16', 'sum');
  equal(ex.short, "À 11, la main dépasserait 21 : l'As compte 1.", 'short');
  equal(ex.why[1], "Avec l'As à 11, le total serait 26 : trop haut.", 'why');
});

test('Blackjack — soft hand', () => {
  const ex = BJ.explain(bj('softHard', { cards: cards('As 6h') }, 'soft-17'));
  equal(ex.headline, '17 souple', 'headline');
  equal(ex.hand, '11 + 6 = 17', 'sum');
  equal(ex.short, 'Un As compte 11 : la main est souple.', 'short');
});

test('Blackjack — three-card 21 is not a blackjack', () => {
  const ex = BJ.explain(bj('call', { cards: cards('7s 7d 7h') }, 'twentyone'));
  equal(ex.short, '21 en plus de deux cartes : pas un blackjack.', 'short');
});

test('Blackjack — outcome: player bust loses even if dealer busts', () => {
  const ex = BJ.explain(bj('outcome', { player: cards('Ts 6h 8d'), dealer: cards('Tc 6d 9s'), bet: 25 }, 'lose'));
  equal(ex.headline, 'Perdu', 'headline');
  equal(ex.hand, 'Joueur Bust (24) · Croupier Bust (25)', 'versus');
  equal(ex.short, 'Le joueur a sauté : il perd, même si le croupier saute aussi.', 'short');
});

test('Blackjack — outcome: blackjack beats a three-card 21', () => {
  const ex = BJ.explain(bj('outcome', { player: cards('As Kh'), dealer: cards('7c 7d 7s'), bet: 25 }, 'win'));
  equal(ex.short, 'Le blackjack bat un 21 en trois cartes ou plus.', 'short');
});

test('Blackjack — outcome: push on equal totals', () => {
  const ex = BJ.explain(bj('outcome', { player: cards('Ts 8h'), dealer: cards('9c 9d'), bet: 10 }, 'push'));
  equal(ex.short, '18 partout : égalité.', 'short');
});

test('Blackjack — every generated question has a clean explanation', () => {
  for (const id of window.DT.blackjackSkills.GENERATOR_IDS) {
    for (let i = 0; i < 150; i++) {
      const ex = BJ.explain(window.DT.blackjackSkills.createQuestion(id));
      const text = [ex.headline, ex.hand, ex.short, ...(ex.why || [])].filter(Boolean).join(' | ');
      assert(ex.headline && ex.short && !/\{|\}|undefined|NaN/.test(text), `${id}: ${text}`);
    }
  }
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
