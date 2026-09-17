/*
  Ultimate Texas Hold'em — settling the bets.   Run:  node tests/ultimate.test.js

  1. Rules, on hands written by hand: ANTE, PLAY, BLIND and TRIPS pay tables, dealer qualification, win / loss / tie, totals.
  2. The rules against an oracle written separately here, on thousands of random hands.
  3. The generated questions of the four levels: situations, players, amounts, chips, cards, answers — no incoherent table —
     and a clear progression: each level asks what the previous levels never ask.
  4. Texts: every option and explanation, in French and English.
*/
global.window = { DT: { translations: {}, core: {}, data: {}, components: {}, exercises: {}, views: {} } };
global.navigator = { language: 'fr-FR' };
global.document = { documentElement: {} };
window.DT.core.dom = { h: () => ({ classList: { add() {} }, style: { setProperty() {}, getPropertyValue: () => '' } }) };
window.DT.components.Card = () => null;
window.DT.components.Chip = () => null;

for (const f of [
  '../js/i18n/en.js', '../js/i18n/fr.js', '../js/core/i18n.js', '../js/core/format.js', '../js/data/holdem-skills.js',
  '../js/components/DealerPov.js', '../js/modules/holdem/engine.js', '../js/modules/holdem/dealer.js', '../js/modules/holdem/ultimate.js', '../js/modules/holdem/skills.js',
  '../js/modules/holdem/dealer-view.js', '../js/modules/holdem/ultimate-view.js', '../js/modules/holdem/holdem.js',
]) require(f);

const P = window.DT.poker;
const D = window.DT.holdemDealer;
const U = window.DT.holdemUltimate;
const VIEW = window.DT.holdemUltimateView;
const HOLDEM = window.DT.exercises.holdem;
const { createQuestion } = window.DT.holdemSkills;
const { byId } = window.DT.data.holdemSkills;

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function equal(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

/** Best hand of seven cards written as text: hand('As Ks', 'Qs Js Ts 2d 3c') */
const hand = (hole, board) => P.bestHand(`${hole} ${board}`.trim().split(/\s+/));
const outcomes = (s) => Object.fromEntries(s.lines.map((l) => [l.bet, l.outcome]));
const wins = (s) => Object.fromEntries(s.lines.map((l) => [l.bet, l.win]));

const BETS = { ante: 10, blind: 10, play: 30 };
// A board that gives nothing by itself, and a dealer pair of 5s (qualifies)
const BOARD = '2c 7d 9h Js 5c';
const DEALER_PAIR = hand('5d 3s', BOARD);
const DEALER_HIGH = hand('4d 3s', '2c 7d 9h Js Kc'); // K-J-9-7-4: does not qualify

// ---------------------------------------------------------------------------
// 1. Rules
// ---------------------------------------------------------------------------

test('Dealer qualification: a pair or better', () => {
  assert(U.dealerQualifies(DEALER_PAIR), 'a pair qualifies');
  assert(!U.dealerQualifies(DEALER_HIGH), 'high card does not qualify');
  assert(U.dealerQualifies(hand('Ad Kd', 'Qd Jd Td 2c 3s')), 'royal flush qualifies');
});

test('ANTE paid 1:1 and PLAY paid 1:1 when the player beats a qualified dealer', () => {
  const s = U.settle(BETS, hand('Kh Kd', BOARD), DEALER_PAIR);
  equal([s.result, s.qualifies], ['win', true], 'result');
  equal(outcomes(s), { ante: 'paid', blind: 'push', play: 'paid' }, 'outcomes');
  equal([wins(s).ante, wins(s).play], [10, 30], 'ANTE 10 → 10, PLAY 30 → 30');
});

test('BLIND push: the player wins with less than a straight', () => {
  const s = U.settle(BETS, hand('Jh 9d', BOARD), DEALER_PAIR); // two pair
  equal(s.byBet.blind, { bet: 'blind', amount: 10, outcome: 'push', reason: 'belowStraight', ratio: null, win: 0, back: 10 }, 'blind');
});

const BLIND_CASES = [
  ['straight 1:1', hand('8s Tc', BOARD), 10],
  ['flush 3:2', hand('Kc 3c', '2c 7c 9c Js 5d'), 15],
  ['full house 3:1', hand('Jh Jd', '2c 7d 9h Js 9c'), 30],
  ['four of a kind 10:1', hand('9s 9c', '2c 9d 9h Js 5c'), 100],
  ['straight flush 50:1', hand('8c 6c', '2c 7c 9c Js 5c'), 500],
  ['royal flush 500:1', hand('Ac Kc', 'Qc Jc Tc 2d 3s'), 5000],
];
for (const [name, playerHand, expected] of BLIND_CASES) {
  test(`BLIND ${name}`, () => {
    const s = U.settle({ ante: 10, blind: 10, play: 10 }, playerHand, DEALER_HIGH);
    equal([s.result, s.byBet.blind.outcome, s.byBet.blind.win, s.byBet.blind.back], ['win', 'paid', expected, 10], 'blind 10');
  });
}

const TRIPS_CASES = [
  ['three of a kind 3:1', hand('9s 9c', BOARD), 30],
  ['straight 4:1', hand('8s Tc', BOARD), 40],
  ['flush 7:1', hand('Kc 3c', '2c 7c 9c Js 5d'), 70],
  ['full house 8:1', hand('Jh Jd', '2c 7d 9h Js 9c'), 80],
  ['four of a kind 30:1', hand('9s 9c', '2c 9d 9h Js 5c'), 300],
  ['straight flush 40:1', hand('8c 6c', '2c 7c 9c Js 5c'), 400],
  ['royal flush 50:1', hand('Ac Kc', 'Qc Jc Tc 2d 3s'), 500],
];
for (const [name, playerHand, expected] of TRIPS_CASES) {
  test(`TRIPS ${name}`, () => {
    const s = U.settle({ ante: 10, blind: 10, play: 10, trips: 10 }, playerHand, DEALER_HIGH);
    equal([s.byBet.trips.outcome, s.byBet.trips.win, s.byBet.trips.back], ['paid', expected, 10], 'trips 10');
  });
}

test('TRIPS lost below three of a kind; no TRIPS bet, no TRIPS line', () => {
  const s = U.settle({ ...BETS, trips: 5 }, hand('Jh 9d', BOARD), DEALER_PAIR);
  equal([s.byBet.trips.outcome, s.byBet.trips.reason, s.byBet.trips.win], ['lost', 'belowTrips', 0], 'two pair');
  assert(!U.settle(BETS, hand('Jh 9d', BOARD), DEALER_PAIR).byBet.trips, 'no line without a bet');
});

test('Dealer does not qualify: ANTE pushed, PLAY and BLIND still follow the result', () => {
  const win = U.settle(BETS, hand('Ah 8d', '2c 7d 9h Js Kc'), DEALER_HIGH); // A-K-J-9-8 beats K-J-9-7-4
  equal([win.result, win.qualifies], ['win', false], 'player wins');
  equal(outcomes(win), { ante: 'push', blind: 'push', play: 'paid' }, 'win');
  const straight = U.settle(BETS, hand('Th 8d', '2c 7d 9h Js Kc'), DEALER_HIGH);
  equal(outcomes(straight), { ante: 'push', blind: 'paid', play: 'paid' }, 'straight: BLIND paid even if the dealer does not qualify');
  const lose = U.settle(BETS, hand('4h 3c', '2c 7d 8h Js Kc'), hand('6d 3s', '2c 7d 8h Js Kc')); // K-J-8-7-4 loses to K-J-8-7-6
  equal([lose.result, lose.qualifies], ['lose', false], 'dealer wins without qualifying');
  equal(outcomes(lose), { ante: 'push', blind: 'lost', play: 'lost' }, 'ANTE pushed, BLIND and PLAY lost');
});

test('Dealer qualifies and wins: every main bet lost', () => {
  const s = U.settle(BETS, hand('Ah 3d', BOARD), hand('Jd Jc', BOARD));
  equal([s.result, s.qualifies], ['lose', true], 'result');
  equal(outcomes(s), { ante: 'lost', blind: 'lost', play: 'lost' }, 'outcomes');
  equal([s.paid, s.returned, s.receives, s.lost], [0, 0, 0, 50], 'totals');
});

test('Tie: ANTE, BLIND and PLAY pushed', () => {
  const s = U.settle(BETS, hand('2d 3d', '8c 9d Th Js Qc'), hand('2h 4s', '8c 9d Th Js Qc'));
  equal(s.result, 'tie', 'both play the board straight');
  equal(outcomes(s), { ante: 'push', blind: 'push', play: 'push' }, 'outcomes');
  equal([s.paid, s.returned, s.receives], [0, 50, 50], 'totals');
});

test('TRIPS paid whatever the main result: win, tie and loss', () => {
  const trips = { ...BETS, trips: 5 };
  const loss = U.settle(trips, hand('9s 9c', BOARD), hand('8d Tc', BOARD)); // trips loses to a straight
  equal([loss.result, loss.byBet.trips.outcome, loss.byBet.trips.win], ['lose', 'paid', 15], 'loss: TRIPS 3:1');
  equal([loss.paid, loss.returned, loss.receives], [15, 5, 20], 'only the TRIPS is picked up');
  const tie = U.settle(trips, hand('2d 3d', '8c 9d Th Js Qc'), hand('2h 4s', '8c 9d Th Js Qc'));
  equal([tie.result, tie.byBet.trips.win], ['tie', 20], 'tie: straight on the board, TRIPS 4:1');
});

test('Several winning bets in the same hand, and the totals', () => {
  // Flush against a qualified dealer: ANTE 10 + BLIND 15 (3:2) + PLAY 30 + TRIPS 35 (7:1)
  const s = U.settle({ ante: 10, blind: 10, play: 30, trips: 5 }, hand('Kc 3c', '2c 7c 9c Js 5d'), hand('Jd 4s', '2c 7c 9c Js 5d'));
  equal(wins(s), { ante: 10, blind: 15, play: 30, trips: 35 }, 'winnings');
  equal([s.paid, s.returned, s.receives, s.lost], [90, 55, 145, 0], 'paid 90, bets 55, picked up 145');
});

test('Chips for a payment: largest values first', () => {
  equal(U.paymentChips(145), [{ value: 100, count: 1 }, { value: 25, count: 1 }, { value: 10, count: 2 }], '145');
  equal(U.paymentChips(0), [], '0');
  equal(U.paymentChips(5000), [{ value: 100, count: 50 }], '5000');
});

// ---------------------------------------------------------------------------
// 2. Rules against an oracle written separately
// ---------------------------------------------------------------------------

/** The rules as written in the French regulation, independently of ultimate.js. */
function oracle(bets, player, dealer) {
  const cats = P.CATEGORIES;
  const rank = (h) => (cats[h.category] === 'straightFlush' && h.values[0] === 14 ? 9 : h.category); // 9 = royal
  const cmp = P.compare(player, dealer);
  const qualifies = dealer.category >= 1;
  const blindTable = { 4: 1, 5: 1.5, 6: 3, 7: 10, 8: 50, 9: 500 };
  const tripsTable = { 3: 3, 4: 4, 5: 7, 6: 8, 7: 30, 8: 40, 9: 50 };
  const r = rank(player);
  const out = {};
  out.ante = !qualifies ? ['push', 0] : cmp > 0 ? ['paid', bets.ante] : cmp === 0 ? ['push', 0] : ['lost', 0];
  out.blind = cmp > 0 ? (blindTable[r] ? ['paid', bets.blind * blindTable[r]] : ['push', 0]) : cmp === 0 ? ['push', 0] : ['lost', 0];
  out.play = cmp > 0 ? ['paid', bets.play] : cmp === 0 ? ['push', 0] : ['lost', 0];
  if (bets.trips) out.trips = tripsTable[r] ? ['paid', bets.trips * tripsTable[r]] : ['lost', 0];
  return out;
}

test('4 000 random hands: settle() matches the oracle, totals add up', () => {
  const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    const deck = P.shuffle(P.newDeck());
    const board = deck.slice(0, 5);
    const player = P.bestHand(deck.slice(5, 7).concat(board));
    const dealer = P.bestHand(deck.slice(7, 9).concat(board));
    const bets = { ante: 10, blind: 10, play: 10 * (1 + (i % 4)), trips: i % 2 ? 10 : 0 };
    const s = U.settle(bets, player, dealer);
    const expected = oracle(bets, player, dealer);
    for (const l of s.lines) {
      equal([l.outcome, l.win], expected[l.bet], `${l.bet} (${deck.slice(0, 9).join(' ')})`);
      equal(l.back, l.outcome === 'lost' ? 0 : l.amount, 'bet returned unless lost');
      seen.add(`${l.bet}:${l.outcome}`);
    }
    equal(s.lines.length, bets.trips ? 4 : 3, 'one line per bet');
    equal(s.receives, s.paid + s.returned, 'receives = paid + returned');
    equal(s.returned + s.lost, bets.ante + bets.blind + bets.play + bets.trips, 'every bet is returned or lost');
  }
  ['ante:paid', 'ante:push', 'ante:lost', 'blind:paid', 'blind:push', 'blind:lost', 'play:paid', 'play:push', 'play:lost', 'trips:paid', 'trips:lost']
    .forEach((k) => assert(seen.has(k), `never seen: ${k}`));
});

// ---------------------------------------------------------------------------
// 3. Generated questions: the four levels
// ---------------------------------------------------------------------------

/** What a question asks, recomputed here from the table only. */
function expectedAnswer(q) {
  if (q.situation === 'tablePaid') return String(q.spots.reduce((sum, spot) => sum + spot.settlement.paid, 0));
  const s = q.spots[q.target].settlement;
  const group = (outcome) => s.lines.filter((l) => l.outcome === outcome).map((l) => l.bet).join('+') || 'none';
  switch (q.situation) {
    case 'zone': return q.zone;
    case 'antePay': return String(s.byBet.ante.win);
    case 'playPay': return String(s.byBet.play.win);
    case 'blindPay': return String(s.byBet.blind.win);
    case 'tripsPay': return String(s.byBet.trips.win);
    case 'paid': case 'chipsPay': return String(s.paid);
    case 'receives': case 'chipsReturn': return String(s.receives);
    case 'anteOutcome': return s.byBet.ante.outcome;
    case 'blindOutcome': return s.byBet.blind.outcome;
    case 'tripsOutcome': return s.byBet.trips.outcome;
    case 'winningBets': return group('paid');
    case 'lostBets': return group('lost');
    case 'returnedBets': return group('push');
    case 'qualifies': return q.dealer.hand.category >= 1 ? 'yes' : 'no';
    case 'returned': return String(s.returned);
    case 'settle': return s.lines.map((l) => `${l.bet}:${l.outcome}`).join(',');
    default: throw new Error(`unknown situation ${q.situation}`);
  }
}

const PER_STAGE = 250;
const stats = {};
const HIGH_ROWS = ['fullHouse', 'quads', 'straightFlush', 'royalFlush'];

for (const skillId of U.SKILL_IDS) {
  test(`${skillId} (${byId[skillId].level}) — ${PER_STAGE * 3} coherent tables, 3 stages`, () => {
    const st = (stats[skillId] = {
      plans: {}, situations: {}, answers: {}, blindRatios: new Set(), tripsRatios: new Set(), tripsWhileLosing: 0, players: new Set(), amounts: new Set(),
      questions: [],
    });
    for (const stage of [1, 2, 3]) {
      const situations = new Set();
      for (let i = 0; i < PER_STAGE; i++) {
        const q = createQuestion(skillId, { stage });
        const where = `${skillId} stage ${stage} ${q.situation}`;
        situations.add(q.situation);
        st.questions.push(q);
        st.plans[q.plan] = (st.plans[q.plan] || 0) + 1;
        st.situations[q.situation] = (st.situations[q.situation] || 0) + 1;
        st.answers[`${q.situation}=${q.answer}`] = (st.answers[`${q.situation}=${q.answer}`] || 0) + 1;

        // Metadata and players
        equal([q.type, q.module, q.skill, q.level, q.kind, q.stage], ['holdem', 'holdem', skillId, byId[skillId].level, 'ultimate', stage], `${where}: metadata`);
        const [min, max] = U.PLAYERS[skillId][stage];
        assert(q.spots.length >= min && q.spots.length <= max, `${where}: players`);
        assert(q.situation === 'tablePaid' ? q.target == null : q.target >= 0 && q.target < q.spots.length, `${where}: target`);
        st.players.add(q.spots.length);

        // Cards: 5 on the board, 2 for the dealer and each player, all different, hands from the engine
        const all = q.board.concat(q.dealer.cards, ...q.spots.map((s) => s.cards));
        assert(q.board.length === 5 && q.dealer.cards.length === 2 && q.spots.every((s) => s.cards.length === 2), `${where}: card counts`);
        assert(new Set(all).size === all.length && all.every((c) => /^[2-9TJQKA][shdc]$/.test(c)), `${where}: cards`);
        const dealerHand = P.bestHand(q.dealer.cards.concat(q.board));
        assert(P.compare(dealerHand, q.dealer.hand) === 0, `${where}: dealer hand`);
        equal(q.qualifies, dealerHand.category >= 1, `${where}: qualification flag`);

        q.spots.forEach((spot, k) => {
          const b = spot.bets;
          // Bets of a real Ultimate layout
          assert(U.ANTES[skillId].includes(b.ante) && b.blind === b.ante, `${where}: ANTE = BLIND (${b.ante}/${b.blind})`);
          assert((U.PLAY_SIZES[skillId] || U.PLAY_MULTIPLES).includes(b.play / b.ante), `${where}: PLAY size (${b.play})`);
          assert(b.trips >= 0, `${where}: TRIPS`);
          if (skillId === 'ultimate_basics') assert(!b.trips || (q.situation === 'zone' && k === q.target), `${where}: beginner TRIPS only in the zone question`);
          st.amounts.add(b.ante);
          // Chips on every bet: the right total, at most 4 piles, real denominations
          for (const bet of U.BETS) {
            if (!b[bet]) { assert(!spot.piles[bet], `${where}: chips on an empty spot`); continue; }
            const piles = spot.piles[bet];
            assert(piles.length <= U.MAX_PILES && D.stacksTotal(piles) === b[bet] && piles.every((p) => D.CHIP_VALUES.includes(p.value)), `${where}: chips of ${bet}`);
          }
          // Settlement: the engine hand, the rules, whole euros, each player independent of the others
          const playerHand = P.bestHand(spot.cards.concat(q.board));
          assert(P.compare(playerHand, spot.hand) === 0, `${where}: player hand`);
          equal(spot.settlement, U.settle(b, playerHand, dealerHand), `${where}: settlement of player ${k + 1}`);
          const expected = oracle(b, playerHand, dealerHand);
          spot.settlement.lines.forEach((l) => equal([l.outcome, l.win], expected[l.bet], `${where}: oracle ${l.bet}`));
          assert(spot.settlement.lines.every((l) => Number.isInteger(l.win)), `${where}: whole euros`);
        });

        // Answer and options
        equal(q.answer, expectedAnswer(q), `${where}: answer`);
        assert(q.options.includes(q.answer) && new Set(q.options).size === q.options.length, `${where}: options`);
        assert(q.options.length === ({ outcome: 3, yesNo: 2 }[q.optionKind] || 4), `${where}: option count`);
        if (q.situation === 'qualifies') assert(q.hideQualification, `${where}: the qualification badge is the answer: hidden`);
        if (['returned', 'receives', 'tablePaid'].includes(q.situation)) assert(Number(q.answer) > 0, `${where}: something to hand back`);
        if (q.optionKind === 'amount' || q.optionKind === 'chips') assert(q.options.every((o) => /^\d+$/.test(o)), `${where}: amounts`);
        if (q.optionKind === 'chips') assert(Number(q.answer) > 0, `${where}: something to pay`);
        if (q.situation === 'zone') assert(q.spots[q.target].bets[q.zone] > 0, `${where}: the zone asked holds a bet`);
        if (['tripsPay', 'tripsOutcome'].includes(q.situation)) assert(q.spots[q.target].bets.trips > 0, `${where}: a TRIPS bet`);

        if (q.target == null) continue;
        const s = q.spots[q.target].settlement;
        const blind = s.byBet.blind;
        if (blind.outcome === 'paid') st.blindRatios.add(U.ratioText(blind.ratio));
        if (s.byBet.trips && s.byBet.trips.outcome === 'paid') {
          st.tripsRatios.add(U.ratioText(s.byBet.trips.ratio));
          if (s.result === 'lose') st.tripsWhileLosing++;
        }
      }
      equal([...situations].sort(), U.SITUATIONS[skillId][stage].slice().sort(), `${skillId} stage ${stage}: situations`);
    }
  });
}

/** Every question a level asks, all stages together. */
const asks = (skillId) => new Set([1, 2, 3].flatMap((stage) => U.SITUATIONS[skillId][stage]));

test('Four distinct levels: each one asks something the previous levels never ask', () => {
  const [B, I, A, E] = U.SKILL_IDS.map(asks);
  equal([...B].sort(), ['antePay', 'lostBets', 'paid', 'playPay', 'receives', 'returnedBets', 'winningBets', 'zone'], 'beginner: layout, 1:1, winning / lost / returned bets');
  assert([...B].every((x) => !I.has(x)), 'beginner and intermediate share no question');
  ['qualifies', 'anteOutcome', 'blindOutcome', 'tripsOutcome', 'blindPay', 'tripsPay', 'settle'].forEach((x) => assert(I.has(x) && !B.has(x), `intermediate introduces ${x}`));
  ['paid', 'receives'].forEach((x) => assert(A.has(x) && !I.has(x), `advanced: total payout ${x}`));
  ['chipsPay', 'chipsReturn', 'tablePaid'].forEach((x) => assert(E.has(x) && ![B, I, A].some((level) => level.has(x)), `expert introduces ${x}`));
  assert(!E.has('settle') && !E.has('blindPay') && !E.has('tripsPay'), 'expert does not repeat the bet-by-bet questions');
});

test('Beginner: the dealer always qualifies, no straight, no pay table, very simple amounts, one player', () => {
  const st = stats.ultimate_basics;
  equal([...st.players], [1], 'one player');
  equal([...st.amounts].sort((a, b) => a - b), [5, 10], 'ANTE 5 or 10');
  equal(st.blindRatios.size + st.tripsRatios.size, 0, 'no BLIND nor TRIPS payout');
  st.questions.forEach((q) => {
    const s = q.spots[0].settlement;
    assert(s.qualifies, 'the dealer always qualifies');
    assert(s.result === 'tie' || ['pair', 'twoPair'].includes(s.type), `a simple hand: ${s.type}`);
    assert(!q.paytable, 'no pay table');
  });
  ['winningBets=ante+play', 'lostBets=ante+blind+play', 'returnedBets=blind', 'returnedBets=ante+blind+play'].forEach((k) => assert(st.answers[k] > 3, `answer seen: ${k}`));
});

test('Intermediate: qualification, every result, first BLIND and TRIPS payouts only', () => {
  const st = stats.ultimate_bets;
  ['winQualified', 'winNotQualified', 'loseQualified', 'loseNotQualified', 'tie'].forEach((p) => assert(st.plans[p] > 10, `${p}: ${st.plans[p]}`));
  ['qualifies=yes', 'qualifies=no', 'tripsOutcome=paid', 'tripsOutcome=lost', 'blindOutcome=push', 'anteOutcome=push'].forEach((k) => assert(st.answers[k] > 3, `answer seen: ${k}`));
  const taught = U.TAUGHT_TYPES.ultimate_bets;
  st.questions.forEach((q) => {
    const s = q.spots[q.target].settlement;
    if (q.situation === 'blindPay' && s.byBet.blind.outcome === 'paid') assert(taught.blind.includes(s.type), `BLIND taught rows: ${s.type}`);
    if (['tripsPay', 'tripsOutcome'].includes(q.situation) && s.byBet.trips.outcome === 'paid') assert(taught.trips.includes(s.type), `TRIPS taught rows: ${s.type}`);
    if (q.paytable) equal(q.paytable, taught, 'the pay table shows the taught rows only');
  });
  equal([...st.blindRatios].filter((r) => !['1:1', '3:2'].includes(r)), [], 'BLIND: straight and flush');
  assert(st.questions.some((q) => q.paytable) && st.questions.some((q) => q.stage === 3 && !q.paytable), 'pay table shown at stage 2, then hidden');
});

test('Advanced: full pay tables, the rows not taught before, several winning bets, the total', () => {
  const st = stats.ultimate_payouts;
  for (let i = 0; i < 1500; i++) {
    const q = createQuestion('ultimate_payouts', { stage: 1 });
    const s = q.spots[q.target].settlement;
    if (s.byBet.blind.outcome === 'paid') st.blindRatios.add(U.ratioText(s.byBet.blind.ratio));
    if (s.byBet.trips && s.byBet.trips.outcome === 'paid') st.tripsRatios.add(U.ratioText(s.byBet.trips.ratio));
  }
  equal([...st.blindRatios].sort(), ['1:1', '3:2', '3:1', '10:1', '50:1', '500:1'].sort(), 'BLIND ratios');
  equal([...st.tripsRatios].sort(), ['3:1', '4:1', '7:1', '8:1', '30:1', '40:1', '50:1'].sort(), 'TRIPS ratios');
  assert(st.tripsWhileLosing > 5, `TRIPS paid on a lost hand: ${st.tripsWhileLosing}`);
  const payQuestions = st.questions.filter((q) => ['blindPay', 'tripsPay'].includes(q.situation));
  const high = payQuestions.filter((q) => HIGH_ROWS.includes(q.spots[q.target].settlement.type)).length;
  assert(high > payQuestions.length * 0.4, `full house and above come often: ${high} / ${payQuestions.length}`);
  const paid = st.questions.filter((q) => q.situation === 'paid');
  const several = paid.filter((q) => q.spots[q.target].settlement.lines.filter((l) => l.outcome === 'paid').length >= 3).length;
  assert(several > paid.length * 0.5, `several winning bets: ${several} / ${paid.length}`);
  assert(st.questions.filter((q) => q.stage < 3).every((q) => q.paytable === U.TAUGHT_TYPES.ultimate_payouts), 'full pay tables at stages 1 and 2');
});

test('Expert: 2 to 3 players, the table total, payment and hand-back in chips, less round amounts', () => {
  const st = stats.ultimate_settlement;
  equal([...st.players].sort(), [2, 3], 'two or three players');
  assert([...st.amounts].some((a) => a % 10 !== 0), `less round amounts: ${[...st.amounts]}`);
  assert(st.situations.chipsPay > 50 && st.situations.chipsReturn > 50 && st.situations.tablePaid > 100, 'chips and table questions');
  assert(st.questions.every((q) => !q.paytable), 'no pay table');
});

test('Target time and "hard" bonus follow the level; the table size setting does not apply', () => {
  for (const id of U.SKILL_IDS) {
    const q = createQuestion(id, { stage: 3 });
    equal(q.targetMs, byId[id].targetMs + (q.spots.length - 1) * window.DT.holdemSkills.MS_PER_EXTRA_SPOT, `${id}: target time`);
    equal(HOLDEM.isHard(q), byId[id].level !== 'beginner', `${id}: hard`);
    assert(!HOLDEM.hasTableSize(id), `${id}: no table size`);
  }
  assert(HOLDEM.hasTableSize('chips_bets') && !HOLDEM.hasTableSize('hand_recognition'), 'other skills unchanged');
});

test('Progressive difficulty: the stage follows the questions answered on the skill', () => {
  const record = { questions: 0 };
  window.DT.core.state = { get: () => ({ stats: { skills: { holdem: { skills: { ultimate_payouts: record } } } } }) };
  equal(HOLDEM.stageFor('ultimate_payouts'), 1, 'new');
  record.questions = 20;
  equal(HOLDEM.stageFor('ultimate_payouts'), 2, 'after 15');
  record.questions = 45;
  equal(HOLDEM.stageFor('ultimate_payouts'), 3, 'after 40');
  delete window.DT.core.state;
});

// ---------------------------------------------------------------------------
// 4. Texts, French and English
// ---------------------------------------------------------------------------

const clean = (text) => typeof text === 'string' && text.length > 0 && !/\{|\}|undefined|NaN|null/.test(text);

for (const lang of ['fr', 'en']) {
  test(`${lang.toUpperCase()}: every option, prompt and explanation is complete`, () => {
    window.DT.i18n.setLanguage(lang);
    for (const id of U.SKILL_IDS) {
      for (let i = 0; i < 150; i++) {
        const q = createQuestion(id, { stage: 1 + (i % 3) });
        const where = `${lang} ${id} ${q.situation}`;
        const screen = VIEW.view(q);
        assert(clean(screen.prompt), `${where}: prompt ${screen.prompt}`);
        screen.options.forEach((o) => assert(clean(o.label), `${where}: option ${o.id} → ${o.label}`));
        const ex = HOLDEM.explain(q);
        assert(clean(ex.headline) && clean(ex.short), `${where}: ${ex.headline} / ${ex.short}`);
        assert(ex.why.length >= 2 && ex.why.every((l) => clean(typeof l === 'string' ? l : l.result)), `${where}: why ${JSON.stringify(ex.why)}`);
      }
    }
  });
}

test('FR: a full explanation, bet by bet', () => {
  window.DT.i18n.setLanguage('fr');
  const board = '2c 7c 9c Js 5d'.split(' ');
  const playerCards = ['Kc', '3c'];
  const dealerCards = ['Jd', '4s'];
  const bets = { ante: 10, blind: 10, play: 30, trips: 5 };
  const playerHand = P.bestHand(playerCards.concat(board));
  const dealerHand = P.bestHand(dealerCards.concat(board));
  const settlement = U.settle(bets, playerHand, dealerHand);
  const q = {
    kind: 'ultimate', situation: 'receives', board, dealer: { cards: dealerCards, hand: dealerHand }, qualifies: true, target: 0,
    spots: [{ cards: playerCards, hand: playerHand, bets, piles: {}, settlement }], optionKind: 'amount', options: ['90', '145', '150', '160'], answer: '145',
  };
  const ex = HOLDEM.explain(q);
  equal(ex.headline, '145 €', 'headline');
  equal(ex.short, 'Le joueur récupère les gains et chaque mise payée ou rendue.', 'short');
  equal(ex.why.slice(0, 6), [
    'Croupier : Paire de Valets, qualifié (une paire ou mieux).',
    'Joueur 1 gagne avec Couleur hauteur Roi.',
    'ANTE 10 € — le joueur bat le croupier : payée 1:1, soit 10 €.',
    'BLIND 10 € — le joueur gagne avec Couleur hauteur Roi : payée 3:2, soit 15 €.',
    'PLAY 30 € — le joueur bat le croupier : payée 1:1, soit 30 €.',
    'TRIPS 5 € — Couleur hauteur Roi, quel que soit le résultat : payée 7:1, soit 35 €.',
  ], 'bet lines');
  equal(ex.why.slice(6, 9), [
    'Gains payés : 10 € + 15 € + 30 € + 35 € = 90 €.',
    'Mises qui restent au joueur : 10 € + 10 € + 30 € + 5 € = 55 €.',
    'Le joueur récupère 90 € + 55 € = 145 €.',
  ], 'totals');
  equal(VIEW.optionLabel({ optionKind: 'settle' }, 'ante:paid,blind:push,play:paid,trips:lost'), 'ANTE payée · BLIND rendue · PLAY payée · TRIPS perdue', 'settle label');
  equal(VIEW.optionLabel({ optionKind: 'chips' }, '145'), '1 × 100 € + 1 × 25 € + 2 × 10 €', 'chips label');
  window.DT.i18n.setLanguage('en');
  equal(VIEW.optionLabel({ optionKind: 'settle' }, 'ante:push,blind:lost,play:lost'), 'ANTE pushed · BLIND lost · PLAY lost', 'EN settle label');
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
