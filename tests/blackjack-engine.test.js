/*
  Blackjack engine tests.   Run:  node tests/blackjack-engine.test.js

  1. Named cases (aces, soft/hard, blackjack, bust, outcomes, dealer rule, payouts)
  2. Every hand of 1 to 5 cards compared with an independent calculation
     (try every ace as 1 or 11, keep the best total not over 21)
*/
global.window = { DT: {} };
require('../js/modules/blackjack/engine.js');
const B = window.DT.blackjack;

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function equal(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
const cards = (text) => text.trim().split(/\s+/);
const value = (text) => B.handValue(cards(text));

// ---------------------------------------------------------------------------
// Card values and totals
// ---------------------------------------------------------------------------

test('Card values: faces are 10, ace is 1 (low value)', () => {
  equal(['As', '2h', '9d', 'Tc', 'Js', 'Qh', 'Kd'].map(B.cardValue), [1, 2, 9, 10, 10, 10, 10], 'values');
});

test('Hard totals without aces', () => {
  equal(value('7s 5h 9d'), { total: 21, soft: false, hardTotal: 21, blackjack: false, bust: false }, '7+5+9');
  equal(value('Ks Qh').total, 20, 'K+Q');
  equal(value('Ks Qh 2d'), { total: 22, soft: false, hardTotal: 22, blackjack: false, bust: true }, 'bust');
});

test('One ace: 11 when it fits', () => {
  equal(value('As 6h'), { total: 17, soft: true, hardTotal: 7, blackjack: false, bust: false }, 'A+6 = soft 17');
  equal(value('As 6h 9d'), { total: 16, soft: false, hardTotal: 16, blackjack: false, bust: false }, 'A+6+9 = hard 16');
  equal(value('As 9h Kd').total, 20, 'A+9+K = 20, not bust');
});

test('Two or more aces: only one can count 11', () => {
  equal(value('As Ah'), { total: 12, soft: true, hardTotal: 2, blackjack: false, bust: false }, 'A+A = soft 12');
  equal(value('As Ah 9d').total, 21, 'A+A+9 = 21');
  equal(value('As Ah Kd').total, 12, 'A+A+K = hard 12');
  equal(value('As Ah Ad Ac').total, 14, 'four aces = soft 14');
});

test('Blackjack: exactly two cards making 21', () => {
  assert(value('As Kd').blackjack, 'A+K');
  assert(value('Th Ac').blackjack, '10+A');
  assert(!value('As 5d 5h').blackjack && value('As 5d 5h').total === 21, 'three-card 21 is not blackjack');
  assert(!value('7s 7d 7h').blackjack, '7-7-7 is not blackjack');
});

test('Soft 21 with three cards stays soft', () => {
  equal(value('As 5d 5h').soft, true, 'soft');
});

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

const outcome = (p, d) => B.outcome(cards(p), cards(d));

test('Outcome: higher total wins, lower loses, equal pushes', () => {
  equal(outcome('Ts 9h', 'Tc 8d'), 'win', '19 v 18');
  equal(outcome('Ts 7h', 'Tc 8d'), 'lose', '17 v 18');
  equal(outcome('Ts 8h', '9c 9d'), 'push', '18 v 18');
});

test('Outcome: a busted player loses even if the dealer busts', () => {
  equal(outcome('Ts 6h 8d', 'Tc 6d 9s'), 'lose', 'both bust');
});

test('Outcome: dealer bust pays every standing player', () => {
  equal(outcome('Ts 2h', 'Tc 6d 9s'), 'win', '12 v bust');
});

test('Outcome: blackjack beats a three-card 21', () => {
  equal(outcome('As Kh', '7c 7d 7s'), 'win', 'player BJ');
  equal(outcome('7c 7d 7s', 'As Kh'), 'lose', 'dealer BJ');
});

test('Outcome: blackjack against blackjack is a push', () => {
  equal(outcome('As Kh', 'Ac Qd'), 'push', 'both BJ');
});

test('Outcome: soft totals compare by best total', () => {
  equal(outcome('As 7h', 'Tc 8d'), 'push', 'soft 18 v 18');
  equal(outcome('As 7h 9d', 'Tc 8d'), 'lose', 'hard 17 v 18');
});

// ---------------------------------------------------------------------------
// Dealer
// ---------------------------------------------------------------------------

test('Dealer draws on 16, stands on hard and soft 17', () => {
  assert(B.dealerMustDraw(cards('Ts 6h')), '16 draws');
  assert(!B.dealerMustDraw(cards('Ts 7h')), 'hard 17 stands');
  assert(!B.dealerMustDraw(cards('As 6h')), 'soft 17 stands');
  assert(B.dealerMustDraw(cards('As 5h')), 'soft 16 draws');
});

test('Dealer play always ends at 17 or more, or with blackjack', () => {
  for (let i = 0; i < 20000; i++) {
    const shoe = B.shuffle(B.newShoe());
    const final = B.dealerPlay([shoe.pop(), shoe.pop()], shoe);
    const v = B.handValue(final);
    assert(v.total >= 17, `stopped at ${v.total}: ${final.join(' ')}`);
    assert(!B.dealerMustDraw(final), `should have drawn: ${final.join(' ')}`);
    if (final.length > 2) assert(B.dealerMustDraw(final.slice(0, -1)), `drew one card too many: ${final.join(' ')}`);
  }
});

// ---------------------------------------------------------------------------
// Payouts (configurable ratio)
// ---------------------------------------------------------------------------

test('Payout ratios', () => {
  equal(['3:2', '6:5', '1:1'].map(B.parseRatio), [1.5, 1.2, 1], 'ratios');
  let threw = false;
  try { B.parseRatio('3-2'); } catch (e) { threw = true; }
  assert(threw, 'invalid ratio rejected');
});

test('Payouts: win, lose, push, blackjack at 3:2, 6:5 and 1:1', () => {
  equal(B.payout(25, 'win'), 25, 'win');
  equal(B.payout(25, 'lose'), -25, 'lose');
  equal(B.payout(25, 'push'), 0, 'push');
  equal(B.payout(25, 'win', { blackjack: true, ratio: '3:2' }), 37.5, 'BJ 3:2');
  equal(B.payout(25, 'win', { blackjack: true, ratio: '6:5' }), 30, 'BJ 6:5');
  equal(B.payout(25, 'win', { blackjack: true, ratio: '1:1' }), 25, 'BJ 1:1');
  equal(B.payout(15, 'win', { blackjack: true, ratio: '6:5' }), 18, 'BJ 6:5 on 15');
  equal(B.payout(7, 'win', { blackjack: true, ratio: '3:2' }), 10.5, 'BJ 3:2 on 7');
  equal(B.payout(25, 'push', { blackjack: true, ratio: '3:2' }), 0, 'BJ push');
});

// ---------------------------------------------------------------------------
// Exhaustive check against an independent calculation
// ---------------------------------------------------------------------------

function referenceTotal(ranks) {
  // Try every ace as 1 or 11; keep the best total ≤ 21, else the smallest total.
  let totals = [0];
  for (const r of ranks) {
    const options = r === 'A' ? [1, 11] : ['T', 'J', 'Q', 'K'].includes(r) ? [10] : [Number(r)];
    totals = totals.flatMap((t) => options.map((o) => t + o));
  }
  const ok = totals.filter((t) => t <= 21);
  return ok.length ? Math.max(...ok) : Math.min(...totals);
}

test('Every hand of 1 to 5 cards matches the independent calculation (402,233 hands)', () => {
  let count = 0;
  const ranks = B.RANKS.split('');
  function walk(hand) {
    if (hand.length) {
      count++;
      const v = B.handValue(hand.map((r) => r + 's'));
      const expected = referenceTotal(hand);
      if (v.total !== expected) throw new Error(`${hand.join('')}: engine ${v.total}, reference ${expected}`);
      if (v.bust !== expected > 21) throw new Error(`${hand.join('')}: bust flag`);
      if (v.blackjack !== (hand.length === 2 && expected === 21)) throw new Error(`${hand.join('')}: blackjack flag`);
      if (v.soft !== (hand.includes('A') && v.hardTotal + 10 === v.total)) throw new Error(`${hand.join('')}: soft flag`);
    }
    if (hand.length === 5) return;
    for (const r of ranks) walk(hand.concat(r));
  }
  walk([]);
  assert(count === 402233, `count ${count}`);
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
