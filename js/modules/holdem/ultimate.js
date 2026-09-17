/*
  Ultimate Texas Hold'em — settling the bets: what the dealer pays, returns and takes.
  Four skills of the Hold'em path, one per level (see js/data/holdem-skills.js).

  Two parts, like dealer.js:
    1. Rules — pure functions: dealer qualification, pay tables, the result of every bet, the totals.
       Tested in tests/ultimate.test.js.
    2. Question generators — deal a real hand (shared board, dealer, 1 to 3 players), then ask about the settlement.
       The answer always comes from settle().

  The game: each player bets ANTE and BLIND (always equal) and may add TRIPS. Then PLAY: 4× or 3× the ante
  before the flop, 2× on the flop, 1× on the river. Everybody makes the best five cards with the board.

  Words used everywhere:
    paid     — the dealer pays the winnings next to the bet; the bet stays with the player
    push     — the bet is returned, nothing is paid
    lost     — the dealer takes the bet
    receives — what the player picks up: the winnings + every bet paid or pushed
*/
(function (DT) {
  'use strict';

  const P = DT.poker;
  const D = DT.holdemDealer;

  const pick = (list, random) => list[Math.floor(random() * list.length)];
  const randomInt = (min, max, random) => min + Math.floor(random() * (max - min + 1));

  // ---------------------------------------------------------------------------
  // 1. Rules
  // ---------------------------------------------------------------------------

  /** Betting spots, in the order they are settled. */
  const BETS = ['ante', 'blind', 'play', 'trips'];

  /** PLAY = ante × 4 or 3 (preflop), × 2 (flop), × 1 (river). */
  const PLAY_MULTIPLES = [1, 2, 3, 4];

  /** Pay tables used for the training (French rules). Ratios are [paid, for]: 3:2 = [3, 2]. */
  const BLIND_PAYS = { straight: [1, 1], flush: [3, 2], fullHouse: [3, 1], quads: [10, 1], straightFlush: [50, 1], royalFlush: [500, 1] };
  const TRIPS_PAYS = { trips: [3, 1], straight: [4, 1], flush: [7, 1], fullHouse: [8, 1], quads: [30, 1], straightFlush: [40, 1], royalFlush: [50, 1] };
  const EVEN = [1, 1];

  /** The training rules; a mistake is modelled by changing one of them (see nearAnswers). */
  const RULES = { anteNeedsQualifier: true, blindPays: BLIND_PAYS, tripsPays: TRIPS_PAYS };

  /** Hand types of the pay tables: the engine categories, with the royal flush apart. */
  const HAND_TYPES = [...P.CATEGORIES, 'royalFlush'];

  function handType(hand) {
    const category = P.CATEGORIES[hand.category];
    return category === 'straightFlush' && hand.values[0] === 14 ? 'royalFlush' : category;
  }

  /** The dealer qualifies with a pair or better. */
  const dealerQualifies = (dealerHand) => dealerHand.category >= P.CATEGORIES.indexOf('pair');

  const payout = (amount, [paid, per]) => (amount * paid) / per;

  const ratioText = (ratio) => `${ratio[0]}:${ratio[1]}`;

  /**
   * Settles one player's bets against the dealer.
   *   ANTE  — pushed if the dealer does not qualify; otherwise paid 1:1 / pushed / lost with the result
   *   BLIND — player wins: paid by the BLIND table from a straight, pushed below; tie: pushed; dealer wins: lost
   *   PLAY  — paid 1:1 / pushed / lost with the result (qualification does not matter)
   *   TRIPS — paid by the TRIPS table from three of a kind, whatever the result; lost below
   * @param {{ ante: number, blind: number, play: number, trips?: number }} bets
   * @returns {{ result: 'win'|'lose'|'tie', qualifies: boolean, type: string, lines: object[], byBet: object,
   *   paid: number, returned: number, receives: number, lost: number }}
   *   a line: { bet, amount, outcome: 'paid'|'push'|'lost', reason, ratio, win, back }
   */
  function settle(bets, playerHand, dealerHand, rules = RULES) {
    const cmp = P.compare(playerHand, dealerHand);
    const result = cmp > 0 ? 'win' : cmp < 0 ? 'lose' : 'tie';
    const qualifies = dealerQualifies(dealerHand);
    const type = handType(playerHand);

    const line = (bet, outcome, reason, ratio = null) => ({
      bet, amount: bets[bet], outcome, reason, ratio,
      win: outcome === 'paid' ? payout(bets[bet], ratio) : 0,
      back: outcome === 'lost' ? 0 : bets[bet],
    });
    const withResult = (bet, ratio) => (result === 'win' ? line(bet, 'paid', 'win', ratio) : result === 'tie' ? line(bet, 'push', 'tie') : line(bet, 'lost', 'lose'));

    const lines = [
      !qualifies && rules.anteNeedsQualifier ? line('ante', 'push', 'notQualified') : withResult('ante', EVEN),
      result === 'win' ? (rules.blindPays[type] ? line('blind', 'paid', 'blindHand', rules.blindPays[type]) : line('blind', 'push', 'belowStraight')) : withResult('blind'),
      withResult('play', EVEN),
    ];
    if (bets.trips) lines.push(rules.tripsPays[type] ? line('trips', 'paid', 'tripsHand', rules.tripsPays[type]) : line('trips', 'lost', 'belowTrips'));

    const sum = (key) => lines.reduce((total, l) => total + l[key], 0);
    const paid = sum('win');
    const returned = sum('back');
    return {
      result, qualifies, type, lines,
      byBet: Object.fromEntries(lines.map((l) => [l.bet, l])),
      paid, returned, receives: paid + returned,
      lost: lines.filter((l) => l.outcome === 'lost').reduce((total, l) => total + l.amount, 0),
    };
  }

  /** Paying an amount with the fewest chips: the largest values first. */
  function paymentChips(amount) {
    const chips = [];
    let rest = amount;
    for (const value of D.CHIP_VALUES.slice().sort((a, b) => b - a)) {
      const count = Math.floor(rest / value);
      if (count > 0) { chips.push({ value, count }); rest -= count * value; }
    }
    return chips;
  }

  // ---------------------------------------------------------------------------
  // 2. Question generators
  // ---------------------------------------------------------------------------

  const SKILL_IDS = ['ultimate_basics', 'ultimate_bets', 'ultimate_payouts', 'ultimate_settlement'];

  /** Questions asked, by skill and stage (1 to 3). */
  const SITUATIONS = {
    ultimate_basics: { 1: ['zone', 'antePay', 'playPay'], 2: ['zone', 'antePay', 'playPay', 'push', 'winningBets'], 3: ['push', 'winningBets', 'paid', 'receives'] },
    ultimate_bets: { 1: ['anteOutcome', 'blindOutcome'], 2: ['anteOutcome', 'blindOutcome', 'settle', 'paid'], 3: ['settle', 'paid', 'receives'] },
    ultimate_payouts: { 1: ['blindPay', 'tripsPay'], 2: ['blindPay', 'tripsPay', 'settle', 'paid'], 3: ['tripsPay', 'settle', 'paid', 'receives'] },
    ultimate_settlement: { 1: ['receives', 'settle', 'paid'], 2: ['receives', 'settle', 'chipsPay'], 3: ['receives', 'chipsPay', 'chipsReturn'] },
  };

  /** Players at the table [min, max], by skill and stage. The question is about one of them. */
  const PLAYERS = {
    ultimate_basics: { 1: [1, 1], 2: [1, 1], 3: [1, 1] },
    ultimate_bets: { 1: [1, 1], 2: [1, 2], 3: [2, 3] },
    ultimate_payouts: { 1: [1, 1], 2: [1, 2], 3: [1, 2] },
    ultimate_settlement: { 1: [1, 2], 2: [2, 3], 3: [2, 3] },
  };

  /** Bet sizes: round amounts first, less obvious ones at the expert level. */
  const ANTES = {
    ultimate_basics: [5, 10, 25],
    ultimate_bets: [5, 10, 15, 20, 25, 50],
    ultimate_payouts: [5, 10, 20, 25, 50],
    ultimate_settlement: [15, 20, 30, 35, 40, 45, 60, 75],
  };
  const TRIPS_SIZES = [5, 10, 15, 20, 25];
  /** How often a player adds a TRIPS bet (the beginner level only shows it to be recognised). */
  const TRIPS_CHANCE = { ultimate_basics: 0.5, ultimate_bets: 0, ultimate_payouts: 0.7, ultimate_settlement: 0.6 };

  /** A zone of the layout holds at most 4 piles, so it stays readable. */
  const MAX_PILES = 4;

  const BELOW_STRAIGHT = ['pair', 'twoPair', 'trips'];
  const PAYING_BLIND = Object.keys(BLIND_PAYS);
  const PAYING_TRIPS = Object.keys(TRIPS_PAYS);
  const BOARD_TIES = ['straight', 'flush', 'fullHouse'];
  /** The rarest hands come a little less often. */
  const weightedType = (list, random) => pick(list.flatMap((type) => (type === 'straightFlush' || type === 'royalFlush' ? [type] : [type, type])), random);

  /**
   * The hand the question is built on. result/qualifies: what must happen against the dealer;
   * type: the player's final hand type; trips: the player has a TRIPS bet.
   */
  const CASES = {
    winQualified: (types, random) => ({ result: 'win', qualifies: true, type: weightedType(types.filter((t) => t !== 'highCard'), random) }),
    winNotQualified: (types, random) => ({ result: 'win', qualifies: false, type: weightedType(types, random) }),
    loseQualified: (types, random) => ({ result: 'lose', qualifies: true, type: weightedType(types.filter((t) => HAND_TYPES.indexOf(t) <= HAND_TYPES.indexOf('fullHouse')), random) }),
    loseNotQualified: () => ({ result: 'lose', qualifies: false, type: 'highCard' }),
    tie: (types, random) => ({ result: 'tie', qualifies: true, type: pick(BOARD_TIES, random) }),
  };

  const cases = (list, types, random) => {
    const name = pick(list, random);
    return { case: name, ...CASES[name](types, random) };
  };

  const ALL_BELOW_FLUSH = ['highCard', 'pair', 'twoPair', 'trips', 'straight'];

  /** The hand behind each question. */
  function planFor(skillId, situation, random) {
    const tripsChance = TRIPS_CHANCE[skillId];
    const trips = () => random() < tripsChance;

    if (skillId === 'ultimate_basics') {
      const win = (types) => ({ case: 'winQualified', ...CASES.winQualified(types, random) });
      switch (situation) {
        case 'zone': return { ...cases(['winQualified', 'loseQualified'], BELOW_STRAIGHT, random), trips: trips() };
        case 'antePay':
        case 'playPay': return { ...win(BELOW_STRAIGHT), trips: false };
        case 'push': return { ...cases(['tie'], BOARD_TIES, random), trips: false };
        case 'winningBets': return random() < 0.33 ? { ...cases(['loseQualified'], BELOW_STRAIGHT, random), trips: false } : { ...win(random() < 0.5 ? BELOW_STRAIGHT : ['straight']), trips: false };
        default: return { ...(random() < 0.25 ? cases(['tie'], BOARD_TIES, random) : win(random() < 0.7 ? BELOW_STRAIGHT : ['straight'])), trips: false };
      }
    }

    if (skillId === 'ultimate_bets') {
      const all = ['winQualified', 'winNotQualified', 'loseQualified', 'loseNotQualified', 'tie'];
      if (situation === 'anteOutcome') return { ...cases(['winNotQualified', 'winNotQualified', 'winQualified', 'loseQualified', 'loseNotQualified', 'tie'], ALL_BELOW_FLUSH, random), trips: false };
      if (situation === 'blindOutcome') {
        const types = random() < 0.4 ? ['straight'] : BELOW_STRAIGHT;
        return { ...cases(['winQualified', 'winQualified', 'winNotQualified', 'loseQualified', 'tie'], types, random), trips: false };
      }
      return { ...cases(all, ALL_BELOW_FLUSH, random), trips: false };
    }

    // Advanced and expert: the full pay tables
    const chipsAnswer = situation === 'chipsPay' || situation === 'chipsReturn';
    const payingBlind = chipsAnswer ? PAYING_BLIND.slice(0, 4) : PAYING_BLIND;
    const payingTrips = chipsAnswer ? PAYING_TRIPS.slice(0, 5) : PAYING_TRIPS;

    if (situation === 'blindPay') {
      const types = random() < 0.8 ? payingBlind : BELOW_STRAIGHT;
      return { ...cases(['winQualified', 'winQualified', 'winNotQualified'], types, random), trips: trips() };
    }
    if (situation === 'tripsPay') {
      const types = random() < 0.85 ? payingTrips : ['pair', 'twoPair'];
      return { ...cases(['winQualified', 'winNotQualified', 'loseQualified', 'loseQualified', 'tie'], types, random), trips: true };
    }
    const types = random() < 0.6 ? payingTrips : ['highCard', 'pair', 'twoPair'];
    const plan = cases(['winQualified', 'winQualified', 'winNotQualified', 'loseQualified', 'tie'], types, random);
    // Chips questions pay something: the player does not lose everything
    if (situation === 'chipsPay' && plan.result === 'lose') return { ...cases(['winQualified'], payingTrips, random), trips: trips() };
    return { ...plan, trips: trips() };
  }

  /** Types the dealer can be given to beat the player's hand. */
  function dealerTypeFor(plan) {
    if (plan.result !== 'lose') return null;
    const index = HAND_TYPES.indexOf(plan.type);
    if (index < HAND_TYPES.indexOf('trips')) return null; // random cards beat a small hand often enough
    return HAND_TYPES[index + 1];
  }

  /**
   * Deals a shared board, the dealer's two cards and the players' two cards, with some cards forced:
   *   forced.player — cards placed in the target player's seven cards (onBoard: on the board only, for a tie)
   *   forced.dealer — cards placed in the dealer's seven cards
   * Returns null when the forced cards cannot all be placed.
   */
  function dealTable(count, target, forced, random) {
    const board = [null, null, null, null, null];
    const holes = Array.from({ length: count + 1 }, () => [null, null]); // the last one is the dealer
    const used = [...forced.player, ...forced.dealer];
    if (new Set(used).size !== used.length) return null;

    const place = (cards, owner, boardOnly) => {
      const slots = [];
      board.forEach((c, k) => { if (!c) slots.push(['board', k]); });
      if (!boardOnly) holes[owner].forEach((c, k) => { if (!c) slots.push(['hole', k]); });
      if (slots.length < cards.length) return false;
      P.shuffle(slots, random);
      cards.forEach((code, i) => {
        const [where, k] = slots[i];
        if (where === 'board') board[k] = code;
        else holes[owner][k] = code;
      });
      return true;
    };
    if (!place(forced.player, target, forced.onBoard) || !place(forced.dealer, count, false)) return null;

    const deck = P.shuffle(P.newDeck().filter((c) => !used.includes(c)), random);
    const fill = (list) => list.map((c) => c || deck.pop());
    return { board: fill(board), players: holes.slice(0, count).map(fill), dealer: fill(holes[count]) };
  }

  const royal = (random) => { const suit = pick(P.SUITS.split(''), random); return ['T', 'J', 'Q', 'K', 'A'].map((r) => r + suit); };
  const forcedCards = (type, seeds, random) => (type === 'royalFlush' ? royal(random) : seeds[type](random));

  /** Chips for a bet: sometimes without the largest value, so different denominations appear. */
  function pilesFor(amount, random) {
    const chips = D.CHIP_VALUES.filter((v) => v <= amount).sort((a, b) => b - a);
    if (chips.length > 1 && random() < 0.35) {
      const other = D.toStacks(amount, chips.slice(1));
      if (other && other.length <= MAX_PILES) return other;
    }
    const stacks = D.toStacks(amount, chips);
    return stacks && stacks.length <= MAX_PILES ? stacks : null;
  }

  /** Bets of one player, with their chips. null if an amount cannot be shown or paid in whole euros. */
  function betsFor(skillId, withTrips, hand, dealerHand, random) {
    const ante = pick(ANTES[skillId], random);
    const bets = { ante, blind: ante, play: ante * pick(PLAY_MULTIPLES, random), trips: withTrips ? pick(TRIPS_SIZES, random) : 0 };
    const settlement = settle(bets, hand, dealerHand);
    if (settlement.lines.some((l) => !Number.isInteger(l.win))) return null;
    const piles = {};
    for (const bet of BETS) {
      if (!bets[bet]) continue;
      piles[bet] = pilesFor(bets[bet], random);
      if (!piles[bet]) return null;
    }
    return { bets, piles, settlement };
  }

  const matches = (plan, s) => s.result === plan.result && s.qualifies === plan.qualifies && s.type === plan.type;

  // ---- Answers and options ------------------------------------------------------------------

  /** Which value an amount question asks for. */
  function asked(situation, s) {
    switch (situation) {
      case 'antePay': return s.byBet.ante.win;
      case 'playPay': return s.byBet.play.win;
      case 'blindPay': return s.byBet.blind.win;
      case 'tripsPay': return s.byBet.trips.win;
      case 'paid':
      case 'chipsPay': return s.paid;
      default: return s.receives; // receives, push, chipsReturn
    }
  }

  /** A pay table moved one row: a common mix-up between neighbouring hands. */
  function shifted(table, step) {
    const types = Object.keys(table);
    return Object.fromEntries(types.map((type, i) => [type, table[types[Math.min(types.length - 1, Math.max(0, i + step))]]]));
  }

  /** Plausible wrong amounts: the same hand settled with one classic mistake. */
  function nearAnswers(situation, spot, dealerHand) {
    const { bets, hand, settlement } = spot;
    const wrongRules = [
      { ...RULES, anteNeedsQualifier: false },
      { ...RULES, blindPays: TRIPS_PAYS, tripsPays: BLIND_PAYS },
      { ...RULES, blindPays: Object.fromEntries(PAYING_BLIND.map((t) => [t, EVEN])) },
      { ...RULES, blindPays: shifted(BLIND_PAYS, 1) },
      { ...RULES, blindPays: shifted(BLIND_PAYS, -1) },
      { ...RULES, tripsPays: shifted(TRIPS_PAYS, 1) },
      { ...RULES, tripsPays: shifted(TRIPS_PAYS, -1) },
    ];
    const near = wrongRules.map((rules) => asked(situation, settle(bets, hand, dealerHand, rules)));
    const stake = { antePay: bets.ante, playPay: bets.play, blindPay: bets.blind, tripsPay: bets.trips }[situation];
    if (stake != null) near.push(asked(situation, settlement) + stake, stake);
    if (asked(situation, settlement) === settlement.paid) near.push(settlement.receives, settlement.paid - (settlement.byBet.trips ? settlement.byBet.trips.win : 0));
    else near.push(settlement.paid, settlement.receives - bets.play, settlement.receives - (settlement.byBet.trips ? settlement.byBet.trips.back : 0));
    return near;
  }

  const settleId = (s) => s.lines.map((l) => `${l.bet}:${l.outcome}`).join(',');

  /** Four settlements of the bets: the right one and three with a single bet settled wrongly. */
  function settleOptions(s, random) {
    const answer = settleId(s);
    const wrong = [];
    for (const l of s.lines) {
      for (const outcome of ['paid', 'push', 'lost']) {
        if (outcome === l.outcome) continue;
        wrong.push(s.lines.map((m) => `${m.bet}:${m === l ? outcome : m.outcome}`).join(','));
      }
    }
    return [answer, ...P.shuffle(wrong, random).slice(0, 3)].sort();
  }

  const WINNING_BETS = ['ante+play', 'ante+blind+play', 'play', 'none'];
  const winningId = (s) => s.lines.filter((l) => l.outcome === 'paid').map((l) => l.bet).join('+') || 'none';

  // ---- The question ----------------------------------------------------------------------------

  /**
   * @param {string} skillId  one of SKILL_IDS
   * @param {1|2|3} stage
   * @param {object} seeds    cards that force a hand type, by type (skills.js)
   * @returns question, or null when the hand could not be dealt (the caller tries again)
   *   { kind: 'ultimate', situation, board, dealer: { cards, hand }, qualifies, spots: [{ cards, hand, bets, piles, settlement }],
   *     target, zone?, optionKind, options, answer }
   */
  function ultimateQuestion(skillId, stage, random, seeds) {
    const situation = pick(SITUATIONS[skillId][stage], random);
    const plan = planFor(skillId, situation, random);
    const [min, max] = PLAYERS[skillId][stage];
    const count = randomInt(min, max, random);
    const dealerType = dealerTypeFor(plan);

    for (let attempt = 0; attempt < 400; attempt++) {
      const target = randomInt(0, count - 1, random);
      const forced = {
        player: forcedCards(plan.type, seeds, random),
        onBoard: plan.result === 'tie',
        dealer: dealerType ? forcedCards(dealerType, seeds, random) : [],
      };
      const dealt = dealTable(count, target, forced, random);
      if (!dealt) continue;

      const dealerHand = P.bestHand(dealt.dealer.concat(dealt.board));
      const hands = dealt.players.map((cards) => P.bestHand(cards.concat(dealt.board)));
      if (!matches(plan, settle({ ante: 1, blind: 1, play: 1 }, hands[target], dealerHand))) continue;

      const spots = [];
      for (let i = 0; i < count; i++) {
        let bets = null;
        for (let k = 0; k < 20 && !bets; k++) bets = betsFor(skillId, i === target ? plan.trips : random() < TRIPS_CHANCE[skillId], hands[i], dealerHand, random);
        if (!bets) break;
        spots.push({ cards: dealt.players[i], hand: hands[i], ...bets });
      }
      if (spots.length < count) continue;

      const s = spots[target].settlement;
      const q = {
        kind: 'ultimate', situation, plan: plan.case, board: dealt.board,
        dealer: { cards: dealt.dealer, hand: dealerHand }, qualifies: s.qualifies,
        spots, target,
        showPaytable: skillId === 'ultimate_payouts' && stage < 3,
      };

      switch (situation) {
        case 'zone': {
          const zones = BETS.filter((bet) => spots[target].bets[bet]);
          q.zone = pick(zones, random);
          q.optionKind = 'bet';
          q.options = BETS.slice();
          q.answer = q.zone;
          break;
        }
        case 'winningBets':
          q.optionKind = 'bets';
          q.options = WINNING_BETS.slice();
          q.answer = winningId(s);
          break;
        case 'anteOutcome':
        case 'blindOutcome':
          q.optionKind = 'outcome';
          q.options = ['paid', 'push', 'lost'];
          q.answer = s.byBet[situation === 'anteOutcome' ? 'ante' : 'blind'].outcome;
          break;
        case 'settle':
          q.optionKind = 'settle';
          q.options = settleOptions(s, random);
          q.answer = settleId(s);
          break;
        default: {
          const answer = asked(situation, s);
          if (situation.startsWith('chips') && answer <= 0) return null;
          q.optionKind = situation.startsWith('chips') ? 'chips' : 'amount';
          const unit = situation === 'tripsPay' ? spots[target].bets.trips : 5;
          q.options = D.amountOptions(answer, nearAnswers(situation, spots[target], dealerHand).filter((v) => v !== answer), unit, random);
          q.answer = String(answer);
        }
      }
      if (!q.options.includes(q.answer) || new Set(q.options).size !== q.options.length) return null;
      return q;
    }
    return null;
  }

  DT.holdemUltimate = {
    BETS, PLAY_MULTIPLES, BLIND_PAYS, TRIPS_PAYS, RULES, HAND_TYPES, SKILL_IDS, SITUATIONS, PLAYERS, ANTES, MAX_PILES, WINNING_BETS,
    handType, dealerQualifies, payout, ratioText, settle, paymentChips, settleId, winningId,
    ultimateQuestion,
  };
})(window.DT);
