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
  '../js/modules/holdem/engine.js', '../js/modules/holdem/dealer.js', '../js/modules/holdem/skills.js', '../js/modules/holdem/dealer-view.js', '../js/modules/holdem/holdem.js',
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
// Hold'em beginner — dealer situations
// ---------------------------------------------------------------------------

const D = window.DT.holdemDealer;
const seats = (n, extra = {}) => Array.from({ length: n }, () => ({ status: null, bet: 0, cards: 'down', behind: null, chip: null, betStacks: [], behindStacks: null, ...extra }));

test("Hold'em — table setup: small blind at 6 players, and the heads-up rule", () => {
  const q = { kind: 'table', situation: 'sb', button: 2, seats: seats(6), headsUp: false, answer: '3', options: ['0', '1', '2', '3', '4', '5'], optionKind: 'player' };
  let ex = HOLDEM.explain(q);
  equal(ex.headline, 'Joueur 4', 'headline');
  equal(ex.short, 'La petite blinde est à gauche du bouton.', 'short');
  equal(ex.why[0], 'Bouton : Joueur 3', 'button');
  equal(ex.why[1], 'Petite blinde : Joueur 4 · Grosse blinde : Joueur 5', 'blinds');

  ex = HOLDEM.explain({ ...q, situation: 'firstPostflop', button: 0, seats: seats(2), headsUp: true, answer: '1' });
  equal(ex.short, 'En tête-à-tête, la grosse blinde parle en premier après le flop.', 'heads-up short');
  equal(ex.why[2], 'Ordre de parole : Joueur 2 → Joueur 1', 'order');
});

test("Hold'em — flow: whose turn, with folded players skipped", () => {
  const s = seats(5);
  s[4] = { ...s[4], cards: null, status: 'fold' };
  s[0] = { ...s[0], status: 'check' };
  const q = { kind: 'flow', situation: 'whoActs', street: 'flop', button: 3, seats: s, order: [0, 1, 2, 3], acted: [0], answer: '1', optionKind: 'player' };
  const ex = HOLDEM.explain(q);
  equal(ex.headline, 'Joueur 2', 'headline');
  equal(ex.short, 'Après le flop, la parole part du premier joueur actif à gauche du bouton.', 'short');
  equal(ex.why[0], 'Ordre de parole : Joueur 1 → Joueur 2 → Joueur 3 → Joueur 4', 'order');
  equal(ex.why[1], 'Ont déjà parlé : Joueur 1', 'acted');
  equal(ex.why[2], 'Les joueurs sans cartes sont sautés.', 'skipped');
});

test("Hold'em — flow: what the dealer does now", () => {
  const ex = HOLDEM.explain({ kind: 'flow', situation: 'dealNext', street: 'flop', seats: seats(3), answer: 'dealTurn', optionKind: 'action' });
  equal(ex.headline, 'Distribuer la turn', 'headline');
  equal(ex.short, 'Enchères du flop terminées, mises au pot : on distribue la turn.', 'short');
  const folds = HOLDEM.explain({ kind: 'flow', situation: 'pushPot', variant: 'folds', street: 'turn', seats: seats(3), answer: 'pushPot', optionKind: 'action' });
  equal(folds.short, 'Tous les autres joueurs se sont couchés : le pot va au dernier joueur.', 'push pot');
});

test("Hold'em — chips: amount to call for the big blind", () => {
  const s = seats(4);
  s[1] = { ...s[1], bet: 60, status: 'raise' };
  s[3] = { ...s[3], bet: 10 };
  const q = { kind: 'chips', situation: 'toCall', variant: 'blinds', button: 1, seats: s, target: 3, highest: { seat: 1, amount: 60 }, own: 10, answer: '50', optionKind: 'amount' };
  const ex = HOLDEM.explain(q);
  equal(ex.headline, '50 €', 'headline');
  equal(ex.short, "Pour suivre, le joueur complète jusqu'à la mise la plus haute.", 'short');
  equal(ex.why[0], 'Mise la plus haute : 60 € (Joueur 2)', 'highest');
  equal(ex.why[1], 'Déjà devant Joueur 4 : 10 €', 'own');
  equal(ex.why[2].result, '60 € − 10 € = 50 €', 'result');
});

test("Hold'em — chips: stack breakdown, raise and change", () => {
  const s = seats(3);
  s[0] = { ...s[0], bet: 85, betStacks: D.toStacks(85, [1, 2, 5, 10, 25]) };
  let ex = HOLDEM.explain({ kind: 'chips', situation: 'stack', seats: s, target: 0, answer: '85', optionKind: 'amount' });
  equal(ex.why[0], 'Joueur 1 : 3 × 25 € + 1 × 10 €', 'breakdown');
  ex = HOLDEM.explain({ kind: 'chips', situation: 'raise', seats: s, target: 2, previous: { seat: 0, amount: 20 }, raiseTo: 60, answer: '40', optionKind: 'amount' });
  equal(ex.why[2].result, '60 € − 20 € = 40 €', 'raise');
  ex = HOLDEM.explain({ kind: 'chips', situation: 'change', seats: s, target: 1, highest: { seat: 0, amount: 35 }, chip: 100, answer: '65', optionKind: 'amount' });
  equal(ex.short, 'Monnaie = valeur du jeton − montant à suivre.', 'change short');
  equal(ex.why[1].result, '100 € − 35 € = 65 €', 'change');
});

test("Hold'em — dealer situations: complete texts in French and English, at every stage", () => {
  const clean = (text) => typeof text === 'string' && text.length > 0 && !/\{|\}|undefined|dealer\.|NaN/.test(text);
  for (const lang of ['fr', 'en']) {
    window.DT.i18n.setLanguage(lang);
    for (const id of ['table_setup', 'hand_flow', 'chips_bets']) {
      for (let i = 0; i < 300; i++) {
        const q = window.DT.holdemSkills.createQuestion(id, { players: 2 + (i % 5), stage: 1 + (i % 3) });
        const ex = HOLDEM.explain(q);
        const where = `${lang} ${id}/${q.situation}`;
        assert(clean(ex.headline) && clean(ex.short), `${where}: ${ex.headline} / ${ex.short}`);
        assert(ex.why.length >= 2 && ex.why.every((l) => clean(typeof l === 'string' ? l : l.result)), `${where}: why ${JSON.stringify(ex.why)}`);
        // Speed mode shows the label of the right option: every label must exist.
        q.options.forEach((o) => assert(clean(window.DT.holdemDealerView.optionLabel(q, o)), `${where}: option ${o}`));
        const prompt = window.DT.i18n.t(`dealer.prompts.${q.kind}.${q.situation}`, { player: 'X', chip: 'Y' });
        assert(clean(prompt), `${where}: prompt ${prompt}`);
      }
    }
  }
  window.DT.i18n.setLanguage('fr');
  equal(window.DT.i18n.t('dealer.money', { amount: 35 }), '35 €', 'FR amount');
});

test("Hold'em — progressive stages follow the practice of the skill", () => {
  const record = { questions: 0, masteredAt: null };
  window.DT.core.state = { get: () => ({ stats: { skills: { holdem: { skills: { chips_bets: record } } } } }) };
  const stage = () => HOLDEM.stageFor('chips_bets');
  equal(stage(), 1, 'new skill');
  record.questions = 15;
  equal(stage(), 2, 'after 15 questions');
  record.questions = 40;
  equal(stage(), 3, 'after 40 questions');
  Object.assign(record, { questions: 5, masteredAt: 1 });
  equal(stage(), 3, 'mastered: full range');
  equal(HOLDEM.stageFor('table_setup'), 1, 'never practised');
  equal(HOLDEM.create('chips_bets', { players: 4 }).stage, 3, 'create uses the stage');
  delete window.DT.core.state;
  equal(HOLDEM.stageFor('chips_bets'), 1, 'no saved data');
});

test("Hold'em — Auto table size: dealer skills use 2 to 6 players, comparison 2 to 3", () => {
  const sizes = (id) => new Set(Array.from({ length: 400 }, () => HOLDEM.playersFor(id, 'auto')));
  equal([...sizes('table_setup')].sort().join(), '2,3,4,5,6', 'table setup');
  equal([...sizes('hand_comparison')].sort().join(), '2,3', 'comparison');
  equal([...sizes('kicker')].sort().join(), '2,3', 'intermediate unchanged');
  equal(HOLDEM.playersFor('chips_bets', '5'), 5, 'fixed setting wins');
  assert(!HOLDEM.isHard(window.DT.holdemSkills.createQuestion('chips_bets')), 'beginner questions are not "hard"');
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
