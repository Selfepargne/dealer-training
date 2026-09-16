/*
  Texas Hold'em engine tests.

  Run in a terminal:   node tests/poker.test.js
  Or in a browser:     open tests/index.html

  Three kinds of checks:
  1. Named scenarios (every hand type, kickers, board plays, split pots…)
  2. A second, independent evaluator compared with the engine on 200,000 random hands
  3. Hand-type frequencies compared with the known mathematical probabilities
*/
(function () {
  'use strict';

  const isNode = typeof module !== 'undefined' && typeof require === 'function';
  if (isNode) {
    global.window = { DT: {} };
    require('../js/modules/holdem/engine.js');
  }
  const P = window.DT.poker;

  const results = [];
  function test(name, fn) {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
    }
  }
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  function equal(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    assert(a === e, `${label}: expected ${e}, got ${a}`);
  }

  const cards = (text) => text.trim().split(/\s+/);
  const best = (text) => P.bestHand(cards(text));
  const categoryOf = (text) => P.CATEGORIES[best(text).category];
  const winners = (board, ...players) => P.showdown(cards(board), players.map(cards)).winners;

  // -------------------------------------------------------------------------
  // 1. Hand types (7 cards each)
  // -------------------------------------------------------------------------

  test('High card', () => {
    const h = best('As Jd 9c 7h 4s 3d 2c');
    equal(P.CATEGORIES[h.category], 'highCard', 'category');
    equal(h.values, [14, 11, 9, 7, 4], 'top five values');
  });

  test('Pair', () => {
    const h = best('Ks Kd 9c 7h 4s 3d 2c');
    equal(P.CATEGORIES[h.category], 'pair', 'category');
    equal(h.values, [13, 9, 7, 4], 'pair + three kickers');
  });

  test('Two pair — three pairs available keeps the two highest and best kicker', () => {
    const h = best('Ks Kd 9c 9h 4s 4d Qc');
    equal(P.CATEGORIES[h.category], 'twoPair', 'category');
    equal(h.values, [13, 9, 12], 'K K 9 9 with Q kicker');
  });

  test('Two pair — the third pair can be the kicker', () => {
    const h = best('Ks Kd 9c 9h 7s 7d 2c');
    equal(h.values, [13, 9, 7], 'K K 9 9 with 7 kicker');
  });

  test('Three of a kind', () => {
    const h = best('7s 7d 7c Ah 9s 3d 2c');
    equal(P.CATEGORIES[h.category], 'trips', 'category');
    equal(h.values, [7, 14, 9], 'trips + two kickers');
  });

  test('Straight', () => {
    const h = best('9s 8d 7c 6h 5s Kd 2c');
    equal(P.CATEGORIES[h.category], 'straight', 'category');
    equal(h.values, [9], '9-high');
  });

  test('Straight — six cards in a row uses the highest five', () => {
    equal(best('Ts 9d 8c 7h 6s 5d 2c').values, [10], 'T-high');
  });

  test('Straight — wheel A-2-3-4-5 is 5-high', () => {
    const h = best('As 2d 3c 4h 5s Kd 9c');
    equal(P.CATEGORIES[h.category], 'straight', 'category');
    equal(h.values, [5], '5-high');
    equal(h.cards[4][0], 'A', 'ace displayed last in a wheel');
  });

  test('Straight — broadway A-K-Q-J-T is ace-high', () => {
    equal(best('As Kd Qc Jh Ts 2d 3c').values, [14], 'A-high');
  });

  test('Straight — no wrap-around (Q-K-A-2-3 is not a straight)', () => {
    equal(categoryOf('Qs Kd Ac 2h 3s 8d 9c'), 'highCard', 'category');
  });

  test('Flush — six suited cards keep the five highest', () => {
    const h = best('Ah Jh 9h 6h 4h 2h Kd');
    equal(P.CATEGORIES[h.category], 'flush', 'category');
    equal(h.values, [14, 11, 9, 6, 4], 'values');
  });

  test('Flush beats straight when both are present', () => {
    equal(categoryOf('9h 8h 7c 6h 5d 2h Kh'), 'flush', 'category');
  });

  test('Full house', () => {
    const h = best('Qs Qd Qc 7h 7s 3d 2c');
    equal(P.CATEGORIES[h.category], 'fullHouse', 'category');
    equal(h.values, [12, 7], 'queens full of sevens');
  });

  test('Full house — two sets of trips use the higher as trips', () => {
    equal(best('7s 7d 7c Qh Qs Qd 2c').values, [12, 7], 'queens full of sevens');
  });

  test('Four of a kind — kicker is the best remaining card', () => {
    const h = best('8s 8d 8c 8h As Kd Qc');
    equal(P.CATEGORIES[h.category], 'quads', 'category');
    equal(h.values, [8, 14], 'quads + ace kicker');
  });

  test('Straight flush', () => {
    const h = best('9s 8s 7s 6s 5s Ad Ac');
    equal(P.CATEGORIES[h.category], 'straightFlush', 'category');
    equal(h.values, [9], '9-high');
  });

  test('Straight flush — steel wheel A-2-3-4-5 suited', () => {
    const h = best('Ad 2d 3d 4d 5d Kd Qc');
    equal(P.CATEGORIES[h.category], 'straightFlush', 'category');
    equal(h.values, [5], '5-high, not a K-high flush');
  });

  test('Royal flush', () => {
    const h = best('As Ks Qs Js Ts 9s 2d');
    equal(P.CATEGORIES[h.category], 'straightFlush', 'category');
    equal(h.values, [14], 'ace-high straight flush');
  });

  test('Straight + separate flush is not a straight flush', () => {
    equal(categoryOf('9s 8s 7s 6s 5d 2s Kc'), 'flush', 'category');
  });

  test('Best 5 of 7 is always a subset of the 7 cards', () => {
    const seven = cards('Ah Kh 2c 2d 9s 9h 5h');
    const h = P.bestHand(seven);
    assert(h.cards.length === 5, 'five cards');
    assert(h.cards.every((c) => seven.includes(c)), 'subset');
    assert(new Set(h.cards).size === 5, 'no duplicates');
  });

  // -------------------------------------------------------------------------
  // 2. Showdowns
  // -------------------------------------------------------------------------

  test('Kicker — same pair, better kicker wins', () => {
    equal(winners('Ah 9d 5c 3s 2h', 'Ac Kd', 'As Qh'), [0], 'A-K beats A-Q');
  });

  test('Kicker — fifth card decides', () => {
    // Both: pair of aces with K Q, then 9 vs 8 decides against board's 5
    equal(winners('Ah Kd Qc 4s 2h', 'As 9d', 'Ac 8h'), [0], '9 kicker wins');
  });

  test('Kicker does not play when the board is better', () => {
    // Pair of aces, board kickers K Q J beat both hole kickers → split
    equal(winners('Ah Kd Qc Js 2h', 'As 3d', 'Ac 4h'), [0, 1], 'split');
  });

  test('Board pair — higher pocket pair wins with two pair', () => {
    equal(winners('8h 8d 5c 3s 2h', 'Kc Kd', 'Qs Qh'), [0], 'KK88 beats QQ88');
  });

  test('Board two pair — highest kicker plays', () => {
    equal(winners('Jh Jd 7c 7s 2h', 'As 3d', 'Kc Qh'), [0], 'ace kicker');
  });

  test('Straight on board — everyone plays the board', () => {
    equal(winners('9h 8d 7c 6s 5h', '2c 3d', 'Ks Qh'), [0, 1], 'split');
  });

  test('Straight on board — a higher straight wins', () => {
    equal(winners('9h 8d 7c 6s 5h', 'Tc 2d', 'Ks Qh'), [0], 'T-high straight');
  });

  test('Flush on board — higher flush card wins', () => {
    equal(winners('Kh 9h 7h 4h 2h', 'Ah 3c', 'Qh Jd'), [0], 'ace-high flush');
  });

  test('Flush on board — a low suited card below the board does not play', () => {
    equal(winners('Kh 9h 7h 4h 3h', '2h Ac', 'Qs Jd'), [0, 1], 'board flush split');
  });

  test('Full house on board — split unless someone improves', () => {
    equal(winners('Kh Kd Ks 4h 4c', '2c 3d', '5s 6h'), [0, 1], 'split');
    equal(winners('Kh Kd Ks 4h 4c', 'Ac 2d', '5s 6h'), [0, 1], 'ace does not play');
    equal(winners('Kh Kd Ks 4h 4c', '9c 9d', '5s 6h'), [0], 'kings full of nines');
  });

  test('Quads on board — best kicker wins', () => {
    equal(winners('7h 7d 7s 7c 2h', 'Ac 3d', 'Ks Qh'), [0], 'ace kicker');
    equal(winners('7h 7d 7s 7c Ah', 'Kc 3d', 'Qs Jh'), [0, 1], 'board ace plays');
  });

  test('Split pot — identical ranks, different suits', () => {
    equal(winners('Ah Kd 9c 5s 2h', 'Qc Jd', 'Qs Jh'), [0, 1], 'split');
  });

  test('Multiple players — one winner among four', () => {
    equal(winners('Th 9d 4c 4s 2h', 'Ac Kd', 'Tc 8d', '9s 9h', 'Qs Jh'), [2], 'nines full');
  });

  test('Multiple players — three-way split', () => {
    equal(winners('As Ks Qd Jc Th', '2c 3d', '4s 5h', '6c 7d', 'Tc Td'), [0, 1, 2, 3], 'broadway on board');
  });

  test('Multiple players — two share the pot, one loses', () => {
    equal(winners('Ah Kd 9c 5s 2h', 'Ac Qd', 'As Qh', 'Kc Kh'), [2], 'set of kings');
    equal(winners('Ah Kd 9c 5s 3h', 'Ac Qd', 'As Qh', '2c 4h'), [2], 'wheel');
    equal(winners('Ah Kd 9c 6s 3h', 'Ac Qd', 'As Qh', 'Kc Jh'), [0, 1], 'A-Q split');
  });

  test('Question generator — consistent answers', () => {
    for (let i = 0; i < 2000; i++) {
      const q = P.createWinnerQuestion({ players: 2 + (i % 5) });
      const all = q.board.concat(...q.players.map((p) => p.cards));
      assert(new Set(all).size === all.length, 'no duplicate card dealt');
      const again = P.showdown(q.board, q.players.map((p) => p.cards));
      equal(again.winners, q.winners, 'winners recomputed');
      assert(q.split === q.winners.length > 1, 'split flag');
    }
  });

  // -------------------------------------------------------------------------
  // 3. Independent reference evaluator
  //    Works directly on 7 cards by counting ranks and suits,
  //    without trying 5-card combinations. Must always agree with the engine.
  // -------------------------------------------------------------------------

  function referenceEvaluate(seven) {
    const value = (c) => '23456789TJQKA'.indexOf(c[0]) + 2;
    const desc = (arr) => arr.slice().sort((a, b) => b - a);

    function straightHigh(values) {
      const set = new Set(values);
      if (set.has(14)) set.add(1);
      for (let high = 14; high >= 5; high--) {
        let run = true;
        for (let k = 0; k < 5; k++) if (!set.has(high - k)) run = false;
        if (run) return high;
      }
      return 0;
    }

    const bySuit = {};
    for (const c of seven) (bySuit[c[1]] = bySuit[c[1]] || []).push(value(c));
    const flushSuit = Object.keys(bySuit).find((s) => bySuit[s].length >= 5);

    if (flushSuit) {
      const sf = straightHigh(bySuit[flushSuit]);
      if (sf) return [8, sf];
    }

    const count = {};
    for (const c of seven) count[value(c)] = (count[value(c)] || 0) + 1;
    const valuesWith = (n) => desc(Object.keys(count).filter((v) => count[v] >= n).map(Number));
    const kickers = (exclude, n) => desc(seven.map(value).filter((v) => !exclude.includes(v))).slice(0, n);

    const quads = valuesWith(4);
    if (quads.length) return [7, quads[0], ...kickers([quads[0]], 1)];

    const trips = valuesWith(3);
    if (trips.length) {
      const pairCandidates = valuesWith(2).filter((v) => v !== trips[0]);
      if (pairCandidates.length) return [6, trips[0], pairCandidates[0]];
    }

    if (flushSuit) return [5, ...desc(bySuit[flushSuit]).slice(0, 5)];

    const st = straightHigh(seven.map(value));
    if (st) return [4, st];

    if (trips.length) return [3, trips[0], ...kickers([trips[0]], 2)];

    const pairs = valuesWith(2);
    if (pairs.length >= 2) return [2, pairs[0], pairs[1], ...kickers([pairs[0], pairs[1]], 1)];
    if (pairs.length === 1) return [1, pairs[0], ...kickers([pairs[0]], 3)];

    return [0, ...kickers([], 5)];
  }

  // Deterministic random numbers so any failure can be reproduced.
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SAMPLES = 200000;
  const frequencies = new Array(9).fill(0);

  test(`Engine agrees with the independent evaluator on ${SAMPLES.toLocaleString('en-GB')} random 7-card hands`, () => {
    const random = seeded(20260916);
    for (let i = 0; i < SAMPLES; i++) {
      const seven = P.shuffle(P.newDeck(), random).slice(0, 7);
      const engine = P.bestHand(seven);
      const reference = referenceEvaluate(seven);
      const engineKey = [engine.category, ...engine.values];
      if (JSON.stringify(engineKey) !== JSON.stringify(reference)) {
        throw new Error(`Mismatch on ${seven.join(' ')}: engine ${JSON.stringify(engineKey)} vs reference ${JSON.stringify(reference)}`);
      }
      assert(engine.cards.every((c) => seven.includes(c)), `best cards not a subset for ${seven.join(' ')}`);
      assert(P.compare(P.evaluate5(engine.cards), engine) === 0, `best cards re-evaluate differently for ${seven.join(' ')}`);
      frequencies[engine.category]++;
    }
  });

  test('Engine and reference agree on random 2-player showdowns (50,000)', () => {
    const random = seeded(42);
    const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0); return 0; };
    for (let i = 0; i < 50000; i++) {
      const q = P.createWinnerQuestion({ players: 2, random });
      const r0 = referenceEvaluate(q.players[0].cards.concat(q.board));
      const r1 = referenceEvaluate(q.players[1].cards.concat(q.board));
      const c = cmp(r0, r1);
      const expected = c > 0 ? [0] : c < 0 ? [1] : [0, 1];
      equal(q.winners, expected, `winners for board ${q.board.join(' ')}`);
    }
  });

  test('Hand-type frequencies match 7-card probabilities', () => {
    // Known probabilities (%) for the best 5-card hand from 7 random cards.
    const expected = [17.4, 43.8, 23.5, 4.83, 4.62, 3.03, 2.6, 0.168, 0.0311];
    const tolerance = [0.4, 0.5, 0.4, 0.2, 0.2, 0.2, 0.15, 0.05, 0.02];
    frequencies.forEach((n, i) => {
      const pct = (n / SAMPLES) * 100;
      assert(Math.abs(pct - expected[i]) <= tolerance[i],
        `${P.CATEGORIES[i]}: ${pct.toFixed(3)}% observed, ${expected[i]}% expected`);
    });
  });

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------

  const failed = results.filter((r) => !r.ok);

  if (isNode) {
    for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`);
    console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
    process.exit(failed.length ? 1 : 0);
  } else {
    const list = document.getElementById('results');
    for (const r of results) {
      const li = document.createElement('li');
      li.className = r.ok ? 'ok' : 'fail';
      li.textContent = `${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ` — ${r.error}`}`;
      list.appendChild(li);
    }
    document.getElementById('summary').textContent = `${results.length - failed.length} passed, ${failed.length} failed`;
  }
})();
