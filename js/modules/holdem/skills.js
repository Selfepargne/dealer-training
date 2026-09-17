/*
  Hold'em question generators, one per skill (see js/data/holdem-skills.js).
  The dealer situations of the beginner level (table, flow, chips) come from dealer.js.
  The Ultimate Texas Hold'em settlements (ultimate_* skills, one per level) come from ultimate.js.

  How a generator works:
    1. seed()   places the few cards that create the situation (e.g. a pair on the board)
    2. the rest of the cards are dealt at random
    3. the engine evaluates the hands
    4. check() confirms the situation really is the one we want — otherwise we deal again

  The engine is always the source of truth: no answer is written by hand.
*/
(function (DT) {
  'use strict';

  const P = DT.poker;
  const D = DT.holdemDealer;
  const U = DT.holdemUltimate;
  const { SKILLS, byId } = DT.data.holdemSkills;

  // Leading values that define a hand; values after them are kickers.
  const DEFINING = { highCard: 0, pair: 1, twoPair: 2, trips: 1, straight: 1, flush: 0, fullHouse: 2, quads: 1, straightFlush: 1 };

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  const card = (value, suit) => P.RANKS[value - 2] + suit;
  const int = (min, max, random) => min + Math.floor(random() * (max - min + 1));
  const pick = (list, random) => list[Math.floor(random() * list.length)];

  /** `count` different rank values between 2 and 14. */
  function values(count, random, exclude = []) {
    const pool = [];
    for (let v = 2; v <= 14; v++) if (!exclude.includes(v)) pool.push(v);
    return P.shuffle(pool, random).slice(0, count);
  }

  /** `count` cards of the same rank, in different suits. */
  function sameRank(value, count, random) {
    return P.shuffle(P.SUITS.split(''), random).slice(0, count).map((s) => card(value, s));
  }

  const randomSuit = (random) => pick(P.SUITS.split(''), random);

  /**
   * Deal with some cards forced. Returns null if the forced cards conflict.
   * @param {{ board?: string[], hands?: string[][] }} seed
   */
  function deal(seed, players, random) {
    const board = (seed.board || []).slice();
    const hands = Array.from({ length: players }, (_, i) => ((seed.hands && seed.hands[i]) || []).slice());
    const used = board.concat(...hands);
    if (new Set(used).size !== used.length || board.length > 5 || hands.some((h) => h.length > 2)) return null;

    const deck = P.shuffle(P.newDeck().filter((c) => !used.includes(c)), random);
    while (board.length < 5) board.push(deck.pop());
    hands.forEach((h) => { while (h.length < 2) h.push(deck.pop()); });

    return { board: P.shuffle(board, random), hands: hands.map((h) => P.shuffle(h, random)) };
  }

  /** Index of the first value that differs between two hands of the same category (-1 if equal). */
  function firstDifference(a, b) {
    return a.values.findIndex((v, i) => v !== b.values[i]);
  }

  const category = (hand) => P.CATEGORIES[hand.category];
  const playsBoard = (hand, board) => hand.cards.every((c) => board.includes(c));
  const boardCategory = (board) => category(P.evaluate5(board));

  /** Two hands of the same category, decided (or tied) after the defining cards. */
  function sameHandDecidedByKicker(a, b) {
    if (a.category !== b.category) return false;
    const i = firstDifference(a, b);
    const d = DEFINING[category(a)];
    return d > 0 && i >= d;
  }

  // ---------------------------------------------------------------------------
  // "Who wins?" generators: seed(random) → forced cards, check(q) → true if valid
  // ---------------------------------------------------------------------------

  const WINNER = {
    // Beginner comparison, stage 1: a pair against a high card
    pair_vs_high: {
      seed(random) {
        const pair = sameRank(values(1, random)[0], 2, random);
        return { hands: random() < 0.5 ? [pair, []] : [[], pair] };
      },
      check: ({ hands, split }) => !split && hands.map(category).sort().join() === 'highCard,pair',
    },

    // Stage 2: two different hand types, one step apart (pair / two pair, two pair / three of a kind…)
    different_types: {
      seed: () => ({}),
      check: ({ hands, split }) => !split && Math.abs(hands[0].category - hands[1].category) === 1 && Math.min(hands[0].category, hands[1].category) >= 1,
    },

    // Stage 2: a simple tie — the board makes a straight and both players play it
    board_split: {
      seed(random) {
        const low = int(2, 10, random);
        return { board: [0, 1, 2, 3, 4].map((k) => card(low + k, randomSuit(random))) };
      },
      check: ({ board, hands, split }) => split && boardCategory(board) === 'straight' && hands.every((h) => playsBoard(h, board)),
    },

    // Stage 3: the same two pairs on the board, the kicker decides
    two_pair_kicker: {
      seed(random) {
        const [x, y, z, a, b] = values(5, random);
        return { board: [...sameRank(x, 2, random), ...sameRank(y, 2, random), card(z, randomSuit(random))], hands: [[card(a, randomSuit(random))], [card(b, randomSuit(random))]] };
      },
      check: ({ hands, split }) => !split && hands.every((h) => category(h) === 'twoPair')
        && hands[0].values[0] === hands[1].values[0] && hands[0].values[1] === hands[1].values[1] && firstDifference(hands[0], hands[1]) === 2,
    },

    // Stage 3: a strong-looking hand loses to the hand just above it (straight / flush, flush / full house, two pair / three of a kind)
    trap: {
      seed(random) {
        const [s, o1, o2, o3] = P.shuffle(P.SUITS.split(''), random);
        const swap = (hands) => (random() < 0.5 ? hands : hands.reverse());
        const variant = int(0, 2, random);
        if (variant === 0) {
          // Three suited cards in a row on the board: a straight with two cards, a flush with two suited cards
          const low = int(2, 10, random);
          const [f1, f2] = values(2, random, [low - 1, low, low + 1, low + 2, low + 3, low + 4]);
          return { board: [card(low, s), card(low + 1, s), card(low + 2, s)], hands: swap([[card(low + 3, o1), card(low + 4, o2)], [card(f1, s), card(f2, s)]]) };
        }
        const [x, y, z, f] = values(4, random);
        if (variant === 1) {
          // Four suited cards on the board and a pair: a flush with one suited card, a full house with the right two cards
          return { board: [card(x, s), card(x, o1), card(y, s), card(z, s)], hands: swap([[card(f, s)], [card(x, o2), card(y, o3)]]) };
        }
        // Two pair with both hole cards against a set
        return { board: [card(x, s), card(y, o1), card(z, o2)], hands: swap([[card(x, o3), card(y, o3)], [card(z, s), card(z, o3)]]) };
      },
      check: ({ hands, split }) => !split && Math.abs(hands[0].category - hands[1].category) === 1 && Math.min(hands[0].category, hands[1].category) >= 2,
    },

    simple_winner: {
      seed: () => ({}),
      check: ({ hands, split }) => !split && Math.abs(hands[0].category - hands[1].category) >= 2,
    },

    pair_vs_pair: {
      seed: () => ({}),
      check: ({ hands }) => hands.every((h) => category(h) === 'pair') && hands[0].values[0] !== hands[1].values[0],
    },

    two_pair: {
      seed(random) {
        if (random() < 0.5) {
          // Board pair; each player pairs a different board card.
          const [x, y, z, w] = values(4, random);
          return { board: [...sameRank(x, 2, random), card(y, 's'), card(z, 'h'), card(w, 'd')], hands: [[card(y, 'c')], [card(z, 'c')]] };
        }
        // Unpaired board; each player pairs two board cards.
        const [a, b, c, d, e] = values(5, random);
        return { board: [card(a, 's'), card(b, 's'), card(c, 'h'), card(d, 'h'), card(e, 'd')], hands: [[card(a, 'c'), card(b, 'd')], [card(c, 'c'), card(d, 'd')]] };
      },
      check: ({ hands }) => hands.every((h) => category(h) === 'twoPair') && firstDifference(hands[0], hands[1]) >= 0 && firstDifference(hands[0], hands[1]) < 2,
    },

    trips: {
      seed(random) {
        const [x, y] = values(2, random);
        if (random() < 0.5) return { board: [card(x, 's'), card(y, 's')], hands: [[card(x, 'h'), card(x, 'd')], [card(y, 'h'), card(y, 'd')]] };
        return { board: [card(x, 's'), card(x, 'h'), card(y, 's')], hands: [[card(x, 'd')], [card(y, 'h'), card(y, 'd')]] };
      },
      check: ({ hands }) => hands.every((h) => category(h) === 'trips') && hands[0].values[0] !== hands[1].values[0],
    },

    kicker: {
      seed(random) {
        const [r, k1, k2] = values(3, random);
        const [s1, s2, s3] = P.shuffle(P.SUITS.split(''), random);
        return { board: [card(r, s1)], hands: [[card(r, s2), card(k1, randomSuit(random))], [card(r, s3), card(k2, randomSuit(random))]] };
      },
      check: ({ hands, split }) => !split && sameHandDecidedByKicker(hands[0], hands[1]),
    },

    straight: {
      seed(random) {
        const low = int(2, 10, random); // board holds low..low+3
        const board = [0, 1, 2, 3].map((k) => card(low + k, randomSuit(random)));
        const above = low + 4 <= 14 ? low + 4 : null;
        const below = low - 1 >= 2 ? low - 1 : low === 2 ? 14 : null; // 2-3-4-5 + ace = wheel
        if (!above || !below) return null;
        const hands = [[card(above, randomSuit(random))], [card(below, randomSuit(random))]];
        return { board, hands: random() < 0.5 ? hands : hands.reverse() };
      },
      check: ({ hands, split }) => !split && hands.every((h) => category(h) === 'straight'),
    },

    flush: {
      seed(random) {
        const s = randomSuit(random);
        const v = values(7, random);
        return { board: [card(v[0], s), card(v[1], s), card(v[2], s)], hands: [[card(v[3], s), card(v[4], s)], [card(v[5], s), card(v[6], s)]] };
      },
      check: ({ hands, split }) => !split && hands.every((h) => category(h) === 'flush'),
    },

    full_house: {
      seed(random) {
        const [x, y, z] = values(3, random);
        const xs = sameRank(x, 3, random);
        const ys = sameRank(y, 3, random);
        const zs = sameRank(z, 2, random);
        // Board: x x y z ·   P1: y y (y full of x)   P2: x z (x full of z)
        const hands = [[ys[1], ys[2]], [xs[2], zs[1]]];
        return { board: [xs[0], xs[1], ys[0], zs[0]], hands: random() < 0.5 ? hands : hands.reverse() };
      },
      check: ({ hands, split }) => !split && hands.every((h) => category(h) === 'fullHouse'),
    },

    board_pair: {
      seed(random) {
        const [x] = values(1, random);
        return { board: sameRank(x, 2, random) };
      },
      check: ({ board, hands, split }) => {
        const counts = {};
        board.forEach((c) => { counts[c[0]] = (counts[c[0]] || 0) + 1; });
        const onePair = Object.values(counts).sort().join('') === '1112';
        return onePair && !split && Math.max(hands[0].category, hands[1].category) >= 2;
      },
    },

    board_plays: {
      seed(random) {
        if (random() < 0.5) {
          // Two pair on the board with a high kicker.
          const [x, y] = values(2, random, [14, 13]);
          return { board: [...sameRank(x, 2, random), ...sameRank(y, 2, random), card(pick([14, 13], random), randomSuit(random))] };
        }
        // Three of a kind on the board with two high kickers.
        const [x] = values(1, random, [14, 13, 12]);
        return { board: [...sameRank(x, 3, random), card(14, randomSuit(random)), card(pick([13, 12], random), randomSuit(random))] };
      },
      check: ({ board, hands }) => hands.some((h) => playsBoard(h, board)),
    },

    straight_on_board: {
      seed(random) {
        const low = int(2, 10, random);
        const board = [0, 1, 2, 3, 4].map((k) => card(low + k, randomSuit(random)));
        // Sometimes a player holds the card above the board straight.
        const hands = low + 5 <= 14 && random() < 0.4 ? [[card(low + 5, randomSuit(random))]] : [];
        return { board, hands: random() < 0.5 ? hands : [[], ...hands] };
      },
      check: ({ board }) => boardCategory(board) === 'straight',
    },

    flush_on_board: {
      seed(random) {
        const s = randomSuit(random);
        const v = values(6, random);
        const board = v.slice(0, 5).map((x) => card(x, s));
        const hands = random() < 0.5 ? [[card(v[5], s)]] : [];
        return { board, hands: random() < 0.5 ? hands : [[], ...hands] };
      },
      check: ({ board }) => boardCategory(board) === 'flush',
    },

    full_house_on_board: {
      seed(random) {
        const [x, y, z] = values(3, random);
        const xs = sameRank(x, 4, random);
        const board = [xs[0], xs[1], xs[2], ...sameRank(y, 2, random)];
        // Sometimes a player improves: the fourth card (quads) or a higher/lower pocket pair.
        const roll = random();
        const extra = roll < 0.25 ? [xs[3]] : roll < 0.5 ? sameRank(z, 2, random) : [];
        return { board, hands: random() < 0.5 ? [extra] : [[], extra] };
      },
      check: ({ board }) => boardCategory(board) === 'fullHouse',
    },

    complex_kicker: {
      seed(random) {
        // Paired board + three side cards: the last kicker decides, or nobody's kicker plays.
        const [x, a, b, c] = values(4, random);
        return { board: [...sameRank(x, 2, random), card(a, randomSuit(random)), card(b, randomSuit(random)), card(c, randomSuit(random))] };
      },
      check: ({ hands, split, players }) => {
        const [a, b] = hands;
        if (a.category !== b.category || a.values.length < 3) return false;
        if (split) {
          const holeRanks = (i) => players[i].map((c) => c[0]).sort().join('');
          return holeRanks(0) !== holeRanks(1);
        }
        return firstDifference(a, b) === a.values.length - 1;
      },
    },
  };

  // Beginner "hand comparison" gathers the basic comparisons; the situations get closer stage by stage.
  // Stage 1: clear winners · stage 2: same or neighbouring hand types, simple ties · stage 3: kickers, shared boards, traps.
  const COMPARISON_SOURCES = {
    1: ['pair_vs_high', 'simple_winner', 'pair_vs_pair'],
    2: ['pair_vs_pair', 'two_pair', 'trips', 'different_types', 'board_split'],
    3: ['kicker', 'two_pair_kicker', 'trips', 'board_pair', 'board_plays', 'trap'],
  };

  // Expert draws its situations from the closest intermediate and advanced skills.
  const CLOSE_CALL_SOURCES = ['kicker', 'full_house', 'board_plays', 'straight_on_board', 'flush_on_board', 'full_house_on_board', 'complex_kicker'];

  // ---------------------------------------------------------------------------
  // Hand recognition (one player, 2 hole cards + 5 on the board)
  //   bestHand  — "Best hand?"                        stage 1: a clear hand · stage 2: any · stage 3: something misleading
  //   bestFive  — "Which five cards make the hand?"   stage 2: any · stage 3: something misleading, or the board plays
  //   holeCards — "How many hole cards play?"         stage 2: any · stage 3: the board plays, or one hole card changes the hand
  // ---------------------------------------------------------------------------

  const RECOGNITION_TYPES = { 1: ['bestHand'], 2: ['bestHand', 'bestFive', 'holeCards'], 3: ['bestHand', 'bestFive', 'holeCards'] };

  const RECOGNITION_SEEDS = {
    highCard: () => [],
    pair: (r) => sameRank(values(1, r)[0], 2, r),
    twoPair: (r) => { const [x, y] = values(2, r); return [...sameRank(x, 2, r), ...sameRank(y, 2, r)]; },
    trips: (r) => sameRank(values(1, r)[0], 3, r),
    straight: (r) => { const low = int(2, 10, r); return [0, 1, 2, 3, 4].map((k) => card(low + k, randomSuit(r))); },
    flush: (r) => { const s = randomSuit(r); return values(5, r).map((v) => card(v, s)); },
    fullHouse: (r) => { const [x, y] = values(2, r); return [...sameRank(x, 3, r), ...sameRank(y, 2, r)]; },
    quads: (r) => sameRank(values(1, r)[0], 4, r),
    straightFlush: (r) => { const s = randomSuit(r); const low = int(2, 10, r); return [0, 1, 2, 3, 4].map((k) => card(low + k, s)); },
  };

  /** The 21 five-card hands of seven cards, evaluated by the engine. */
  function allFives(seven) {
    const fives = [];
    for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) {
      fives.push(P.evaluate5(seven.filter((_, k) => k !== a && k !== b)));
    }
    return fives;
  }

  /**
   * What can mislead the reader of seven cards, besides the best hand:
   *   straight / flush — also present, but not the best hand · threePairs · twoTrips · pairToo — a pair next to a straight or flush
   *   fourFlush / fourStraight — four cards that look like a flush or a straight
   */
  function decoys(seven, best) {
    const type = category(best);
    const ranks = {};
    const suits = {};
    seven.forEach((c) => { ranks[c[0]] = (ranks[c[0]] || 0) + 1; suits[c[1]] = (suits[c[1]] || 0) + 1; });
    const counts = Object.values(ranks);
    const maxSuit = Math.max(...Object.values(suits));
    const present = new Set(seven.map(P.rankValue));
    if (present.has(14)) present.add(1);
    let run = 0;
    let longest = 0;
    for (let v = 1; v <= 14; v++) { run = present.has(v) ? run + 1 : 0; longest = Math.max(longest, run); }
    const list = [];
    if (longest >= 5 && !['straight', 'straightFlush'].includes(type)) list.push('straight');
    if (maxSuit >= 5 && !['flush', 'straightFlush'].includes(type)) list.push('flush');
    if (counts.filter((c) => c === 2).length >= 3) list.push('threePairs');
    if (counts.filter((c) => c === 3).length >= 2) list.push('twoTrips');
    if (['straight', 'flush', 'straightFlush'].includes(type) && counts.some((c) => c >= 2)) list.push('pairToo');
    if (maxSuit === 4) list.push('fourFlush');
    if (longest === 4) list.push('fourStraight');
    return list;
  }

  /** How many hole cards play: one number, or null when two equal best hands use a different number. */
  function holeCardsPlaying(hole, seven, best) {
    const counts = new Set(allFives(seven).filter((f) => P.compare(f, best) === 0).map((f) => f.cards.filter((c) => hole.includes(c)).length));
    return counts.size === 1 ? [...counts][0] : null;
  }

  // The last hand types asked, so the same answer does not come back twice in a row.
  const recentTargets = [];

  /** Chosen once per question (like the comparison source), so the harder situations are not under-represented. */
  function recognitionPlan(stage, random) {
    const situation = pick(RECOGNITION_TYPES[stage], random);
    const flavor = stage === 3 && situation === 'holeCards' ? pick(['board', 'oneCard'], random)
      : stage === 3 && situation === 'bestFive' ? pick(['decoy', 'decoy', 'board'], random) : null;
    return { situation, flavor };
  }

  function recognitionQuestion(random, stage, { situation, flavor }) {
    const pool = P.CATEGORIES.filter((c) => !recentTargets.includes(c) && !(stage === 1 && c === 'highCard'));
    const target = pick(flavor === 'oneCard' ? pool.filter((c) => c !== 'highCard') : pool, random);
    const forced = RECOGNITION_SEEDS[target](random);
    const deck = P.shuffle(P.newDeck().filter((c) => !forced.includes(c)), random);
    let seven;
    if (flavor === 'board' && forced.length) {
      // The forced cards on the board, the two hole cards dealt at random
      const board = P.shuffle(forced.concat(deck.slice(0, 5 - forced.length)), random);
      seven = [...deck.slice(5 - forced.length, 7 - forced.length), ...board];
    } else if (flavor === 'oneCard') {
      // Exactly one forced card in the hand
      const [inHand, ...rest] = P.shuffle(forced.slice(), random);
      const board = P.shuffle(rest.concat(deck.slice(0, 5 - rest.length)), random);
      seven = [inHand, deck[5 - rest.length], ...board];
    } else {
      seven = P.shuffle(forced.concat(deck.slice(0, 7 - forced.length)), random);
    }
    if (new Set(seven).size !== 7) return null;
    const hole = seven.slice(0, 2);
    const board = seven.slice(2);
    const hand = P.bestHand(seven);
    if (category(hand) !== target) return null;
    const found = decoys(seven, hand);
    const playing = holeCardsPlaying(hole, seven, hand);

    let options;
    let answer;
    let optionKind;
    switch (situation) {
      case 'bestHand': {
        if (stage === 1 && found.length) return null; // stage 1: a clear hand
        if (stage === 3 && !found.length) return null; // stage 3: something misleading
        // Three wrong answers. First stage: any hand types. Later: the neighbouring types, the easiest to confuse.
        const index = P.CATEGORIES.indexOf(target);
        const distance = (c) => Math.abs(P.CATEGORIES.indexOf(c) - index);
        let others = P.shuffle(P.CATEGORIES.filter((c) => c !== target), random);
        if (stage > 1) others = others.sort((a, b) => distance(a) - distance(b));
        options = [target, ...others.slice(0, 3)].sort((a, b) => P.CATEGORIES.indexOf(a) - P.CATEGORIES.indexOf(b));
        answer = target;
        optionKind = 'category';
        break;
      }
      case 'bestFive': {
        if (flavor === 'decoy' && !found.length) return null;
        if (flavor === 'board' && playing !== 0) return null;
        // Wrong answers: weaker five-card hands sharing at least three cards with the right one (never an equal hand)
        const id = (five) => five.cards.join(' ');
        const worse = allFives(seven)
          .filter((f) => P.compare(f, hand) < 0)
          .map((f) => ({ f, shared: f.cards.filter((c) => hand.cards.includes(c)).length }))
          .filter((x) => x.shared >= 3)
          .sort((a, b) => b.shared - a.shared || P.compare(b.f, a.f));
        const picks = P.shuffle(worse.slice(0, 8), random).slice(0, 3).map((x) => id(x.f));
        if (picks.length < 3) return null;
        options = [id(hand), ...picks].sort();
        answer = id(hand);
        optionKind = 'cards';
        break;
      }
      case 'holeCards': {
        if (playing == null) return null; // two equal best hands use a different number of hole cards: ambiguous
        if (flavor === 'board' && playing !== 0) return null;
        if (flavor === 'oneCard' && !(playing === 1 && P.evaluate5(board).category < hand.category)) return null;
        options = ['0', '1', '2'];
        answer = String(playing);
        optionKind = 'holeCount';
        break;
      }
      default:
        return null;
    }

    recentTargets.push(target);
    if (recentTargets.length > 2) recentTargets.shift();

    return {
      kind: 'recognition',
      situation,
      flavor,
      decoys: found,
      board,
      players: [{ cards: hole, hand }],
      options,
      optionKind,
      answer,
      winners: [0],
      split: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Create a question for a skill
  // ---------------------------------------------------------------------------

  /** Extra time allowed per player beyond two: a bigger table takes longer to read. */
  const MS_PER_EXTRA_PLAYER = 700; // showdowns: every hand must be read
  const MS_PER_EXTRA_SEAT = 250; // dealer situations: seats, markers and chips
  const MS_PER_EXTRA_SPOT = 1000; // Ultimate: every other player's layout on the table

  /**
   * "Who wins?" at a table of 2 to 6 players.
   * The skill situation is built between two key players. Every other player gets random cards
   * but can never beat the key winner — so the question still trains the chosen skill.
   * Seats are shuffled: the key players can sit anywhere.
   */
  function winnerQuestion(generatorId, random, players) {
    const g = WINNER[generatorId];
    const seed = g.seed(random);
    if (!seed) return null;
    const dealt = deal(seed, 2, random);
    if (!dealt) return null;
    const keyResult = P.showdown(dealt.board, dealt.hands);
    const facts = { board: dealt.board, players: dealt.hands, hands: keyResult.hands, winners: keyResult.winners, split: keyResult.winners.length > 1 };
    if (!g.check(facts)) return null;

    // Extra players
    const bestKey = keyResult.hands[keyResult.winners[0]];
    const used = new Set(dealt.board.concat(...dealt.hands));
    const deck = P.shuffle(P.newDeck().filter((c) => !used.has(c)), random);
    const holes = dealt.hands.slice();
    for (let i = 2; i < players; i++) {
      const hole = [deck.pop(), deck.pop()];
      const cmp = P.compare(P.bestHand(hole.concat(dealt.board)), bestKey);
      // Never better than the key winner; a tie is only allowed when the key players already split.
      if (cmp > 0 || (cmp === 0 && !facts.split)) return null;
      holes.push(hole);
    }

    const order = P.shuffle(holes.map((_, i) => i), random); // seat → dealt hand
    const seated = order.map((i) => holes[i]);
    const { hands, winners } = P.showdown(dealt.board, seated);
    return {
      kind: 'winner',
      board: dealt.board,
      players: seated.map((cards, i) => ({ cards, hand: hands[i] })),
      keyPlayers: [order.indexOf(0), order.indexOf(1)],
      winners,
      split: winners.length > 1,
      answer: winners.length > 1 ? 'split' : String(winners[0]),
    };
  }

  /**
   * @param {string} skillId
   * @param {{ players?: number, random?: () => number, stage?: 1|2|3 }} options
   *   players: 2 to 6 (ignored for hand recognition) · stage: progressive difficulty inside a beginner skill
   * @returns question with: type, module, skill, level, difficulty, stage, targetMs, kind, answer, and
   *   showdowns (recognition, winner): board, players, winners, split
   *   dealer situations (table, flow, chips): see dealer.js
   *   Ultimate settlements (ultimate): see ultimate.js
   */
  function extraTime(q) {
    if (q.kind === 'winner') return (q.players.length - 2) * MS_PER_EXTRA_PLAYER;
    if (q.seats) return (q.seats.length - 2) * MS_PER_EXTRA_SEAT;
    if (q.kind === 'ultimate') return (q.spots.length - 1) * MS_PER_EXTRA_SPOT;
    return 0;
  }

  function createQuestion(skillId, { players = 2, random = Math.random, stage = 1 } = {}) {
    const skill = byId[skillId];
    if (!skill) throw new Error(`Unknown Hold'em skill: ${skillId}`);
    const seats = Math.min(6, Math.max(2, Math.round(players)));
    const level = Math.min(3, Math.max(1, Math.round(stage)));
    // Chosen once, so that situations that are harder to deal are not under-represented.
    const source = skillId === 'hand_comparison' ? pick(COMPARISON_SOURCES[level], random) : null;
    const recognition = skillId === 'hand_recognition' ? recognitionPlan(level, random) : null;

    for (let attempt = 0; attempt < 5000; attempt++) {
      let q;
      if (skillId === 'hand_recognition') q = recognitionQuestion(random, level, recognition);
      else if (skillId === 'hand_comparison') {
        q = winnerQuestion(source, random, seats);
        if (q) q.situation = source;
      }
      else if (skillId === 'table_setup') q = D.tableQuestion(level, seats, random);
      else if (skillId === 'hand_flow') q = D.flowQuestion(level, seats, random);
      else if (skillId === 'chips_bets') q = D.chipsQuestion(level, seats, random);
      else if (U.SKILL_IDS.includes(skillId)) q = U.ultimateQuestion(skillId, level, random, RECOGNITION_SEEDS);
      else if (skillId === 'close_calls') q = winnerQuestion(pick(CLOSE_CALL_SOURCES, random), random, seats);
      else q = winnerQuestion(skillId, random, seats);

      if (q) {
        return {
          type: 'holdem',
          module: 'holdem',
          skill: skill.id,
          level: skill.level,
          difficulty: skill.difficulty,
          stage: level,
          targetMs: skill.targetMs + extraTime(q),
          ...q,
        };
      }
    }
    throw new Error(`Could not generate a question for ${skillId}`);
  }

  DT.holdemSkills = { createQuestion, firstDifference, DEFINING, MS_PER_EXTRA_PLAYER, MS_PER_EXTRA_SEAT, MS_PER_EXTRA_SPOT, COMPARISON_SOURCES, CLOSE_CALL_SOURCES, RECOGNITION_TYPES, decoys, holeCardsPlaying, allFives, SKILL_IDS: SKILLS.map((s) => s.id) };
})(window.DT);
