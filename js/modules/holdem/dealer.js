/*
  Dealer skills of the Hold'em beginner level: table setup, flow of a hand, chips and bets.

  Two parts:
    1. Rules — pure functions (positions, dealing and action order, chip amounts). Tested in tests/dealer.test.js.
    2. Question generators — build a table situation from the rules; the answer always comes from the rules.

  Seats are numbered clockwise (index 0 = Player 1). Cards and action always go clockwise.
  `stage` (1 to 3) makes the situations progressively harder.
*/
(function (DT) {
  'use strict';

  const P = DT.poker;

  const randomInt = (min, max, random) => min + Math.floor(random() * (max - min + 1));
  const pick = (list, random) => list[Math.floor(random() * list.length)];
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  // ---------------------------------------------------------------------------
  // 1. Rules — positions
  // ---------------------------------------------------------------------------

  /** Seats from `from`, clockwise, once around the table. */
  const clockwise = (n, from) => range(n).map((k) => (from + k) % n);

  /**
   * Who is where for one hand.
   *   3+ players: SB left of the button, BB left of SB; first card to SB;
   *               first to act preflop left of BB, postflop the first player left of the button.
   *   Heads-up:   the button is the small blind. The big blind receives the first card,
   *               the button acts first preflop and last after the flop.
   */
  function positions(n, button) {
    if (n === 2) {
      const other = (button + 1) % 2;
      return { button, sb: button, bb: other, firstCard: other, firstPreflop: button, firstPostflop: other };
    }
    const left = (k) => (button + k) % n;
    return { button, sb: left(1), bb: left(2), firstCard: left(1), firstPreflop: left(3), firstPostflop: left(1) };
  }

  /** Order in which seats receive their cards: the button always gets the last card. */
  const dealOrder = (n, button) => clockwise(n, positions(n, button).firstCard);

  /** Order of action on a street, among the players still in the hand (folded players are skipped). */
  function actionOrder(n, button, street, active = range(n)) {
    const p = positions(n, button);
    return clockwise(n, street === 'preflop' ? p.firstPreflop : p.firstPostflop).filter((i) => active.includes(i));
  }

  /** Next hand: the button moves one seat clockwise, the blinds follow. */
  const nextHand = (n, button) => positions(n, (button + 1) % n);

  /** Where the dealer button sits between its owner and the next place clockwise (1 = on the owner, 0 = on the next place). */
  const BUTTON_BETWEEN = 0.72;

  /**
   * Places around the table, as angles in degrees clockwise from the top.
   * The dealer sits at the top middle (0°); the players are spread evenly from the dealer's left, clockwise.
   * The dealer button sits on the table edge between its owner and the next place clockwise (the small blind's side),
   * closer to its owner — never in front of a player. Example: button of Player 1 between Player 1 and Player 2.
   */
  function tableLayout(n, button) {
    const step = 360 / (n + 1);
    const seats = range(n).map((i) => (i + 1) * step);
    const buttonAngle = button == null ? null : seats[button] + (1 - BUTTON_BETWEEN) * step;
    return { dealer: 0, step, seats, button: buttonAngle };
  }

  // ---------------------------------------------------------------------------
  // 1. Rules — chips
  // ---------------------------------------------------------------------------

  const CHIP_VALUES = [1, 2, 5, 10, 25, 50, 100]; // same denominations as components/Chip.js
  const MAX_PER_STACK = 5; // short stacks stay easy to count

  /** Blind levels and the chips used at each level. */
  const BLINDS = [
    { sb: 1, bb: 2, chips: [1, 2, 5, 10, 25] },
    { sb: 5, bb: 10, chips: [5, 10, 25, 50, 100] },
    { sb: 25, bb: 50, chips: [25, 50, 100] },
  ];

  /** Amount → stacks [{ value, count }], largest chips first, at most 5 chips per stack. null if impossible. */
  function toStacks(amount, chips) {
    const stacks = [];
    let rest = amount;
    for (const value of chips.slice().sort((a, b) => b - a)) {
      const count = Math.min(MAX_PER_STACK, Math.floor(rest / value));
      if (count > 0) {
        stacks.push({ value, count });
        rest -= value * count;
      }
    }
    return rest === 0 ? stacks : null;
  }

  const stacksTotal = (stacks) => stacks.reduce((sum, s) => sum + s.value * s.count, 0);

  /** Amount a player must add to call: the highest bet minus what is already in front of them. */
  const toCall = (highestBet, ownBet) => Math.max(0, highestBet - ownBet);

  /** Size of a raise: the new total minus the bet it raises. */
  const raiseSize = (raiseTo, previousBet) => raiseTo - previousBet;

  /** Pot once the bets in front of the players are collected. */
  const potAfterCollect = (pot, bets) => bets.reduce((sum, b) => sum + b, pot);

  /** Change to give back when a player pays with one chip. */
  const change = (chipValue, amountDue) => chipValue - amountDue;

  // ---------------------------------------------------------------------------
  // 2. Generators — shared helpers
  // ---------------------------------------------------------------------------

  const STREETS = ['preflop', 'flop', 'turn', 'river'];
  const BOARD_COUNT = { preflop: 0, flop: 3, turn: 4, river: 5 };
  const ACTIONS = ['collect', 'dealFlop', 'dealTurn', 'dealRiver', 'showdown', 'announce', 'pushPot'];
  const BET_TYPES = ['bet', 'call', 'raise', 'allIn'];

  const blindsFor = (stage, random) => pick(stage === 1 ? BLINDS.slice(0, 2) : BLINDS, random);

  /** Stacks for an amount, sometimes without the largest chip (the same amount is not always built the same way). */
  function stacksFor(amount, blinds, random, maxStacks = Infinity) {
    if (!amount) return [];
    const chips = blinds.chips.slice().sort((a, b) => b - a);
    const fits = (stacks) => stacks && stacks.length <= maxStacks;
    if (random() < 0.4) {
      const other = toStacks(amount, chips.slice(1));
      if (fits(other)) return other;
    }
    const stacks = toStacks(amount, chips);
    return fits(stacks) ? stacks : null;
  }

  /** Engaged chips and the pot: at most 3 piles, so the felt stays readable. */
  const MAX_PILES_ON_FELT = 3;
  /** A cave: at most 4 piles, so it stays inside the player's place. */
  const MAX_PILES_IN_CAVE = 4;

  /** Four amounts: the answer and three plausible mistakes, in ascending order. */
  function amountOptions(answer, near, unit, random) {
    const set = new Set([answer]);
    for (const v of P.shuffle(near.slice(), random)) {
      if (set.size === 4) break;
      if (Number.isInteger(v) && v > 0) set.add(v);
    }
    for (let k = 1; set.size < 4; k++) {
      if (answer - k * unit > 0) set.add(answer - k * unit);
      if (set.size < 4) set.add(answer + k * unit);
    }
    return [...set].sort((a, b) => a - b).map(String);
  }

  const seatBase = () => ({ status: null, bet: 0, cards: 'down', behind: null, chip: null, marked: false });

  /** Converts the amounts of a situation into chip stacks. null when an amount cannot be shown. */
  function withStacks(q, blinds, random) {
    for (const s of q.seats) {
      s.betStacks = s.chip ? [] : stacksFor(s.bet, blinds, random, MAX_PILES_ON_FELT);
      s.behindStacks = s.behind == null ? null : stacksFor(s.behind, blinds, random, MAX_PILES_IN_CAVE);
      if (!s.betStacks || (s.behind != null && !s.behindStacks)) return null;
    }
    q.potStacks = stacksFor(q.pot || 0, blinds, random, MAX_PILES_ON_FELT);
    return q.potStacks ? q : null;
  }

  /**
   * SB / BB labels are shown only while the blinds are engaged on the felt in front of those players —
   * never once they went to the pot. (Table setup: when the blinds are not the question; flow: first stages.)
   */
  function blindsShown(q) {
    const allowed = q.kind === 'table' ? q.showBlinds : q.kind === 'flow' ? q.stage < 3 : q.kind === 'chips';
    if (!allowed || !q.blinds || (q.street && q.street !== 'preflop')) return false;
    const p = positions(q.seats.length, q.button);
    return q.seats[p.sb].bet >= q.blinds.sb && q.seats[p.bb].bet >= q.blinds.bb;
  }

  // ---------------------------------------------------------------------------
  // 2. Generators — table setup
  // ---------------------------------------------------------------------------

  const TABLE_TYPES = {
    1: ['sb', 'bb', 'firstCard', 'nextButton', 'nextCard'],
    2: ['sb', 'bb', 'firstCard', 'lastCard', 'nextCard', 'firstPreflop', 'firstPostflop', 'nextButton'],
    3: ['sb', 'bb', 'firstCard', 'lastCard', 'firstPreflop', 'firstPostflop', 'nextButton', 'nextSB', 'nextBB'],
  };

  function tableQuestion(stage, n, random) {
    const int = (min, max) => randomInt(min, max, random);
    const type = pick(TABLE_TYPES[stage], random);
    const button = int(0, n - 1);
    const pos = positions(n, button);
    const next = nextHand(n, button);
    const order = dealOrder(n, button);
    let target = null;
    const answer = {
      sb: () => pos.sb,
      bb: () => pos.bb,
      firstCard: () => pos.firstCard,
      lastCard: () => order[n - 1],
      nextCard: () => { const k = int(0, n - 2); target = order[k]; return order[k + 1]; },
      firstPreflop: () => pos.firstPreflop,
      firstPostflop: () => pos.firstPostflop,
      nextButton: () => next.button,
      nextSB: () => next.sb,
      nextBB: () => next.bb,
    }[type]();

    // Blind markers help at first; they are hidden when the question is about the blinds.
    const asksBlinds = ['sb', 'bb', 'nextButton', 'nextSB', 'nextBB'].includes(type);
    const showBlinds = !asksBlinds && (stage === 1 || (stage === 2 && random() < 0.5));
    const blinds = pick(BLINDS.slice(0, 2), random);
    const seats = range(n).map(() => ({ ...seatBase(), cards: null }));
    // Shown blinds are posted: their chips are in front of SB and BB.
    if (showBlinds) { seats[pos.sb].bet = blinds.sb; seats[pos.bb].bet = blinds.bb; }

    return withStacks({
      kind: 'table',
      situation: type,
      headsUp: n === 2,
      button,
      showBlinds,
      blinds: { sb: blinds.sb, bb: blinds.bb },
      seats,
      target,
      answer: String(answer),
      options: range(n).map(String),
      optionKind: 'player',
    }, blinds, random);
  }

  // ---------------------------------------------------------------------------
  // 2. Generators — flow of a hand
  // ---------------------------------------------------------------------------

  const FLOW_TYPES = {
    1: ['street', 'dealNext', 'dealNext', 'collect', 'collect'],
    2: ['street', 'dealNext', 'collect', 'whoActs', 'whoActs', 'showdown', 'announce'],
    3: ['dealNext', 'collect', 'whoActs', 'whoActs', 'whoActs', 'showdown', 'announce', 'pushPot'],
  };
  const NEXT_DEAL = { preflop: 'dealFlop', flop: 'dealTurn', turn: 'dealRiver' };

  function flowQuestion(stage, n, random) {
    const int = (min, max) => randomInt(min, max, random);
    const type = pick(FLOW_TYPES[stage], random);
    const button = int(0, n - 1);
    const blinds = blindsFor(stage, random);
    const { bb, sb } = blinds;
    const pos = positions(n, button);
    const deck = P.shuffle(P.newDeck(), random);
    const board = deck.splice(0, 5);
    const seats = range(n).map(() => ({ ...seatBase(), hole: deck.splice(0, 2) }));
    const q = { kind: 'flow', situation: type, headsUp: n === 2, button, blinds: { sb, bb }, board, seats, pot: 0, optionKind: 'action' };

    const fold = (i, status = 'fold') => { seats[i].cards = null; seats[i].status = status; };
    const inHand = () => range(n).filter((i) => seats[i].cards);

    /** Postflop, from stage 2: some players already folded on an earlier street (no cards, no status). */
    function earlierFolds(keep) {
      if (stage === 1) return;
      for (const i of P.shuffle(range(n), random)) {
        if (inHand().length > keep && random() < 0.3) fold(i, null);
      }
    }

    /** A complete betting round among the players in the hand. `collected`: the bets are already in the pot. */
    function completeRound(street, collected) {
      const players = inHand();
      if (street === 'preflop') {
        const raise = random() < 0.4 ? bb * int(2, 4) : 0;
        const amount = raise || bb;
        const order = actionOrder(n, button, 'preflop', players);
        const raiser = raise ? order.find((i) => i !== pos.sb && i !== pos.bb) : null;
        order.forEach((i) => {
          const blind = i === pos.sb || i === pos.bb;
          if (!blind && i !== raiser && random() < 0.3 && inHand().length > 2) return fold(i);
          seats[i].bet = amount;
          seats[i].status = i === raiser ? 'raise' : i === pos.bb && !raise ? 'check' : 'call';
        });
        if (raise && raiser == null) return false;
      } else if (random() < 0.5) {
        players.forEach((i) => { seats[i].status = 'check'; });
      } else {
        const bettor = pick(players, random);
        const amount = bb * int(1, 5);
        players.forEach((i) => {
          if (i !== bettor && random() < 0.3 && inHand().length > 2) return fold(i);
          seats[i].bet = amount;
          seats[i].status = i === bettor ? 'bet' : 'call';
        });
      }
      if (collected) {
        q.pot += seats.reduce((sum, s) => sum + s.bet, 0);
        seats.forEach((s) => { s.bet = 0; });
      }
      return inHand().length >= 2;
    }

    const street = {
      street: () => pick(STREETS, random),
      dealNext: () => pick(['preflop', 'flop', 'turn'], random),
      collect: () => pick(STREETS, random),
      whoActs: () => (stage === 2 ? pick(['preflop', 'flop'], random) : pick(STREETS, random)),
      showdown: () => 'river',
      announce: () => 'river',
      pushPot: () => pick(STREETS, random),
    }[type]();
    q.street = street;
    q.boardCount = BOARD_COUNT[street];
    if (street !== 'preflop') q.pot = bb * int(n, 4 * n);

    switch (type) {
      case 'street': {
        if (street === 'preflop') { seats[pos.sb].bet = sb; seats[pos.bb].bet = bb; }
        q.answer = street;
        q.options = STREETS.slice();
        q.optionKind = 'street';
        break;
      }
      case 'dealNext':
      case 'collect':
      case 'showdown': {
        if (street !== 'preflop') earlierFolds(2);
        const collected = type !== 'collect';
        if (!completeRound(street, collected)) return null;
        if (type === 'collect' && seats.every((s) => !s.bet)) return null; // nothing to collect: another situation
        q.answer = type === 'dealNext' ? NEXT_DEAL[street] : type;
        break;
      }
      case 'announce': {
        earlierFolds(2);
        inHand().forEach((i) => { seats[i].cards = 'up'; });
        q.answer = 'announce';
        break;
      }
      case 'pushPot': {
        if (street !== 'preflop') earlierFolds(2);
        if (street === 'river' && random() < 0.5) {
          // Showdown done, the winner is announced.
          const players = inHand();
          const { winners } = P.showdown(board, players.map((i) => seats[i].hole));
          if (winners.length > 1) return null;
          players.forEach((i) => { seats[i].cards = 'up'; });
          seats[players[winners[0]]].marked = true;
          q.variant = 'winner';
        } else {
          // Everybody else folded.
          const players = inHand();
          const winner = pick(players, random);
          seats[winner].status = street === 'preflop' ? 'raise' : 'bet';
          players.forEach((i) => { if (i !== winner) fold(i); });
          if (street === 'preflop') q.pot = bb * int(3, 6) + sb + bb;
          q.variant = 'folds';
        }
        q.answer = 'pushPot';
        break;
      }
      case 'whoActs': {
        if (street !== 'preflop') earlierFolds(2);
        const order = actionOrder(n, button, street, inHand());
        const acted = int(0, order.length - 1);
        let highest = street === 'preflop' ? bb : 0;
        if (street === 'preflop') {
          seats[pos.sb].bet = sb;
          seats[pos.bb].bet = bb;
        }
        order.slice(0, acted).forEach((i) => {
          const blind = street === 'preflop' && (i === pos.sb || i === pos.bb);
          const roll = random();
          if (!blind && roll < 0.3 && stage === 3) return fold(i);
          if (highest === 0) {
            if (stage === 3 && roll > 0.7) { highest = bb * int(1, 4); seats[i].bet = highest; seats[i].status = 'bet'; } else seats[i].status = 'check';
          } else if (stage === 3 && roll > 0.85) {
            highest *= 2; seats[i].bet = highest; seats[i].status = 'raise';
          } else {
            seats[i].bet = highest; seats[i].status = 'call';
          }
        });
        if (inHand().length < 2) return null;
        q.order = order;
        q.acted = order.slice(0, acted);
        q.answer = String(order[acted]);
        q.options = range(n).map(String);
        q.optionKind = 'player';
        break;
      }
      default:
        return null;
    }

    if (q.optionKind === 'action') {
      const others = P.shuffle(ACTIONS.filter((a) => a !== q.answer), random).slice(0, 3);
      q.options = ACTIONS.filter((a) => a === q.answer || others.includes(a));
    }
    return withStacks(q, blinds, random);
  }

  // ---------------------------------------------------------------------------
  // 2. Generators — chips and bets
  // ---------------------------------------------------------------------------

  const CHIP_TYPES = {
    1: ['stack', 'stack', 'pot', 'toCall', 'toCall'],
    2: ['stack', 'pot', 'toCall', 'raise', 'potAfter', 'allIn', 'action'],
    3: ['committed', 'toCall', 'raise', 'potAfter', 'allIn', 'action', 'change', 'change'],
  };

  /**
   * Chips & bets. Every player keeps a ledger:
   *     starting stack = prior (earlier rounds, now in the pot) + engaged (on the felt) + cave (still available)
   * The table is built by playing the actions in order, so every amount is coherent:
   *   preflop — the small and big blinds are engaged on the felt from the start;
   *   flop    — the preflop chips (blinds included) are already in the pot.
   * A folded player keeps what was engaged before folding (a folded blind leaves the blind) and adds nothing.
   * An all-in player has engaged the whole stack: empty cave.
   */
  function chipsQuestion(stage, n, random) {
    const int = (min, max) => randomInt(min, max, random);
    const type = pick(CHIP_TYPES[stage], random);
    const actionAnswer = type === 'action' ? pick(BET_TYPES, random) : null;
    const button = int(0, n - 1);
    const blinds = blindsFor(stage, random);
    const { sb, bb } = blinds;
    const pos = positions(n, button);
    const unit = Math.min(...blinds.chips);
    const street = type === 'pot' || actionAnswer === 'bet' ? 'flop' : random() < 0.5 ? 'preflop' : 'flop';
    const raises = stage > 1;

    // Starting stacks, showable with this level's chips (at most 5 chips per pile in the cave).
    const most = Math.max(12, Math.floor((0.8 * 5 * blinds.chips.reduce((a, b) => a + b, 0)) / bb));
    const seats = range(n).map(() => ({ ...seatBase(), start: bb * int(12, most), prior: 0 }));
    const q = { kind: 'chips', situation: type, headsUp: n === 2, button, blinds: { sb, bb }, seats, pot: 0, street, showValues: stage < 3, optionKind: 'amount' };

    let highest = 0;
    let highestSeat = null;
    const inHand = () => range(n).filter((i) => seats[i].cards);
    const room = (i) => seats[i].start - seats[i].prior - seats[i].bet;

    // ---- The hand so far ------------------------------------------------------
    if (street === 'preflop') {
      seats[pos.sb].bet = sb;
      seats[pos.bb].bet = bb;
      highest = bb;
      highestSeat = pos.bb;
    } else {
      // Preflop is over: every player still in paid the same amount; a blind who folded left the blind in the pot.
      const paid = bb * int(1, 4);
      P.shuffle(range(n), random).forEach((i) => {
        const blind = i === pos.sb ? sb : i === pos.bb ? bb : 0;
        const canFold = stage > 1 && inHand().length > 2 && !(i === pos.bb && paid === bb);
        if (canFold && random() < 0.25) {
          seats[i].cards = null;
          seats[i].prior = blind;
        } else seats[i].prior = paid;
      });
    }
    q.pot = seats.reduce((sum, s) => sum + s.prior, 0);
    const order = actionOrder(n, button, street, inHand());

    // ---- Actions ----------------------------------------------------------------
    const act = {
      check: (i) => { seats[i].status = 'check'; },
      fold: (i) => { seats[i].cards = null; seats[i].status = 'fold'; },
      call: (i) => { seats[i].bet = highest; seats[i].status = 'call'; },
      bet: (i, amount) => { seats[i].bet = amount; seats[i].status = 'bet'; highest = amount; highestSeat = i; },
      raise: (i, to) => { seats[i].bet = to; seats[i].status = 'raise'; highest = to; highestSeat = i; },
      allIn: (i) => {
        seats[i].bet = seats[i].start - seats[i].prior;
        seats[i].status = 'allIn';
        if (seats[i].bet > highest) { highest = seats[i].bet; highestSeat = i; }
      },
    };
    const betSize = () => bb * int(1, 5);
    const raiseTo = () => highest * 2 + bb * int(0, 2);

    /** A believable betting round for the players of `list`, in order. */
    function play(list, { raise = raises } = {}) {
      list.forEach((i) => {
        if (!seats[i].cards) return;
        const r = random();
        if (seats[i].bet === highest) {
          if (street === 'flop' && highest === 0 && r < 0.35) act.bet(i, betSize());
          else if (raise && highest > 0 && r < 0.2) act.raise(i, raiseTo());
          else act.check(i);
        } else if (inHand().length > 2 && r < 0.3) act.fold(i);
        else if (raise && r > 0.85) act.raise(i, raiseTo());
        else act.call(i);
      });
    }

    /** Flop: the players before `bi` check, `bi` bets, the players up to `ti` play. Preflop: everybody before `ti` plays. */
    function upTo(ti, options) {
      if (street === 'flop') {
        const bi = int(0, ti - 1);
        order.slice(0, bi).forEach(act.check);
        act.bet(order[bi], betSize());
        play(order.slice(bi + 1, ti), options);
      } else play(order.slice(0, ti), options);
    }
    const first = street === 'flop' ? 1 : 0; // after the flop somebody must bet before the target

    let near = [];
    switch (type) {
      case 'stack':
      case 'committed': {
        play(order.slice(0, int(1, order.length)));
        const inFront = range(n).filter((i) => seats[i].cards && seats[i].bet > 0);
        // "Total engaged": a blind who put more in — the blind is part of the amount.
        const blindsIn = inFront.filter((i) => (i === pos.sb || i === pos.bb) && seats[i].bet > (i === pos.sb ? sb : bb));
        const pool = type === 'committed' && blindsIn.length ? blindsIn : inFront;
        if (!pool.length) return null;
        q.target = pick(pool, random);
        q.answer = seats[q.target].bet;
        near = [q.answer + bb, q.answer - bb, q.answer + sb, q.answer - sb];
        break;
      }
      case 'pot': {
        order.slice(0, int(0, order.length - 1)).forEach(act.check);
        q.answer = q.pot;
        near = [q.pot + bb, q.pot - bb, q.pot + unit, q.pot - unit];
        break;
      }
      case 'toCall': {
        let t;
        if (street === 'flop' && stage === 3 && random() < 0.5) {
          // The player bet, and was raised.
          const ti = int(0, order.length - 2);
          const ri = int(ti + 1, order.length - 1);
          order.slice(0, ti).forEach(act.check);
          act.bet(order[ti], betSize());
          play(order.slice(ti + 1, ri), { raise: false });
          if (!seats[order[ri]].cards) return null;
          act.raise(order[ri], raiseTo());
          t = order[ti];
          q.variant = 'raised';
        } else {
          const ti = int(first, order.length - 1);
          upTo(ti);
          t = order[ti];
        }
        if (!seats[t].cards || seats[t].bet >= highest) return null;
        q.target = t;
        q.own = seats[t].bet;
        q.highest = { seat: highestSeat, amount: highest };
        q.answer = highest - q.own;
        // The player can afford the call (otherwise it would be an all-in).
        if (room(t) < q.answer) seats[t].start += q.answer - room(t) + bb * int(1, 6);
        near = [highest, q.own, highest + q.own, q.answer + bb, q.answer - bb, q.answer - sb];
        break;
      }
      case 'raise': {
        const ri = int(first, order.length - 1);
        upTo(ri, { raise: false });
        const r = order[ri];
        if (!seats[r].cards) return null;
        q.previous = { seat: highestSeat, amount: highest };
        act.raise(r, raiseTo());
        q.target = r;
        q.raiseTo = seats[r].bet;
        q.answer = q.raiseTo - q.previous.amount;
        near = [q.raiseTo, q.previous.amount, q.raiseTo + q.previous.amount, q.answer + bb, q.answer - bb];
        break;
      }
      case 'potAfter': {
        // A complete round: every player still in has the same amount in front; a folded blind leaves the blind.
        const raised = street === 'flop' || (raises && random() < 0.5);
        const amount = street === 'flop' ? betSize() : raised ? bb * int(2, 4) : bb;
        const opener = street === 'preflop' && !raised ? pos.bb : pick(order, random);
        order.forEach((i) => {
          if (i !== opener && inHand().length > 2 && random() < 0.3) return act.fold(i);
          seats[i].bet = amount;
          seats[i].status = i !== opener ? 'call' : street === 'flop' ? 'bet' : raised ? 'raise' : 'check';
        });
        const engaged = seats.reduce((sum, s) => sum + s.bet, 0);
        q.answer = q.pot + engaged;
        near = [q.pot, engaged, q.answer - amount, q.answer + amount, q.answer - bb];
        break;
      }
      case 'allIn': {
        // Everybody still has chips in the cave except the all-in player. No statuses: read the chips.
        play(order.slice(0, int(0, order.length - 1)));
        const a = pick(order.filter((i) => seats[i].cards), random);
        seats[a].start = seats[a].prior + Math.max(seats[a].bet, highest) + bb * int(1, 6);
        act.allIn(a);
        q.target = a;
        q.hideStatus = true;
        q.answer = String(a);
        q.options = range(n).map(String);
        q.optionKind = 'player';
        break;
      }
      case 'action': {
        // What did the player do? Read from the chips in front and in the cave (the player's status is hidden).
        const ti = int(actionAnswer === 'bet' ? 0 : first, order.length - 1);
        if (actionAnswer === 'bet') order.slice(0, ti).forEach(act.check);
        else upTo(ti, { raise: false });
        const t = order[ti];
        if (!seats[t].cards || (actionAnswer !== 'bet' && seats[t].bet >= highest)) return null;
        if (highest > 0) q.previous = { seat: highestSeat, amount: highest };
        if (actionAnswer === 'bet') act.bet(t, betSize());
        if (actionAnswer === 'call') act.call(t);
        if (actionAnswer === 'raise') act.raise(t, raiseTo());
        if (actionAnswer === 'allIn') {
          const short = highest - bb > seats[t].bet && random() < 0.5; // all-in for less than the call
          seats[t].start = seats[t].prior + (short ? highest - bb : highest + bb * int(1, 5));
          act.allIn(t);
        }
        q.target = t;
        q.answer = actionAnswer;
        q.options = BET_TYPES.slice();
        q.optionKind = 'betType';
        break;
      }
      case 'change': {
        const ti = int(first, order.length - 1);
        upTo(ti, { raise: false });
        const t = order[ti];
        if (!seats[t].cards || seats[t].bet !== 0) return null; // nothing in front yet: pays with one chip
        const value = pick(blinds.chips.filter((v) => v > highest), random);
        if (!value) return null;
        seats[t].chip = value;
        q.target = t;
        q.highest = { seat: highestSeat, amount: highest };
        q.chip = value;
        q.answer = value - highest;
        near = [highest, value, q.answer + bb, q.answer - bb, highest + unit];
        break;
      }
      default:
        return null;
    }

    // ---- Caves: what is left. A player who is not all-in always keeps some chips. ----
    for (const s of seats) {
      const engaged = s.chip || s.bet;
      if (s.status !== 'allIn' && s.start - s.prior - engaged <= 0) s.start = s.prior + engaged + bb * int(2, 8);
      s.behind = s.start - s.prior - engaged;
    }

    if (q.optionKind === 'amount') {
      if (!(q.answer > 0)) return null;
      q.options = amountOptions(q.answer, near, unit, random);
      q.answer = String(q.answer);
    }
    return withStacks(q, blinds, random);
  }

  DT.holdemDealer = {
    // rules
    positions, dealOrder, actionOrder, nextHand, clockwise, tableLayout, BUTTON_BETWEEN, blindsShown,
    CHIP_VALUES, MAX_PER_STACK, MAX_PILES_ON_FELT, BLINDS, toStacks, stacksTotal, toCall, raiseSize, potAfterCollect, change,
    // generators
    STREETS, BOARD_COUNT, ACTIONS, BET_TYPES, TABLE_TYPES, FLOW_TYPES, CHIP_TYPES,
    tableQuestion, flowQuestion, chipsQuestion, amountOptions,
  };
})(window.DT);
