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
   * The blinds: clockwise BUTTON → SB → BB. Heads-up: the button is the small blind, the other player the big blind.
   */
  function blindSeats(n, button) {
    if (n === 2) return { sb: button, bb: (button + 1) % 2 };
    return { sb: (button + 1) % n, bb: (button + 2) % n };
  }

  /**
   * WHO ACTS — the single rule of the Hold'em module for the order of action. Every skill, question,
   * answer and explanation goes through getFirstToAct / getNextToAct / actionOrder.
   *   preflop:  the first ACTIVE player after the big blind, clockwise;
   *   postflop: the first ACTIVE player after the button (to its left), clockwise.
   * Folded players are skipped and can never be returned. Heads-up follows from the same rule
   * (preflop: after the big blind comes the button; postflop: after the button comes the big blind).
   *
   * @param {{ players: number, button: number, active?: number[] }} state  active: seats still holding cards (default: all)
   * @param {'preflop'|'flop'|'turn'|'river'} street
   * @returns {{ start: number, seat: number|null, skipped: number[] }}
   *   start: the seat where the search begins · seat: the player who acts first · skipped: folded seats passed over
   */
  function getFirstToAct(state, street) {
    return getNextToAct(state, street, []);
  }

  /**
   * The player to act while a betting round is under way: from the start seat, clockwise, the first ACTIVE player
   * who has not acted yet. skipped: the folded seats passed over since the last player who acted.
   * @param {number[]} acted  active seats that already acted on this street
   */
  function getNextToAct(state, street, acted = []) {
    const n = state.players;
    const active = state.active || range(n);
    const after = street === 'preflop' ? blindSeats(n, state.button).bb : state.button;
    const start = (after + 1) % n;
    let skipped = [];
    for (const seat of clockwise(n, start)) {
      if (!active.includes(seat)) { skipped.push(seat); continue; }
      if (acted.includes(seat)) { skipped = []; continue; }
      return { start, seat, skipped };
    }
    return { start, seat: null, skipped };
  }

  /**
   * Who is where for one hand (everybody still in).
   *   SB / BB: see blindSeats · first card: the player after the button (heads-up: the big blind)
   *   firstPreflop / firstPostflop: getFirstToAct with every player active.
   */
  function positions(n, button) {
    const { sb, bb } = blindSeats(n, button);
    const firstCard = (button + 1) % n;
    return {
      button, sb, bb, firstCard,
      firstPreflop: getFirstToAct({ players: n, button }, 'preflop').seat,
      firstPostflop: getFirstToAct({ players: n, button }, 'flop').seat,
    };
  }

  /**
   * WHO STILL HAS TO ACT during a betting round: the active players (not all-in) who have not acted on this street,
   * or who have less in front than the highest bet — a bet or a raise reopens the action for them.
   * Preflop the big blind has not acted until it speaks, even when nobody raised (its option).
   * @param {{ active: number[], acted: number[], bets: number[], allIn?: number[] }} round
   */
  function pendingPlayers({ active, acted, bets, allIn = [] }) {
    const highest = Math.max(0, ...active.map((i) => bets[i]));
    return active.filter((i) => !allIn.includes(i) && (!acted.includes(i) || bets[i] < highest));
  }

  /** A betting round is over when nobody still has to act. */
  const roundComplete = (round) => pendingPlayers(round).length === 0;

  /**
   * The player to act after `last` has acted: clockwise from `last`, the first player who still has to act.
   * It is also the first pending player clockwise after the last bet or raise (every player in between has answered it).
   * @param {{ players: number, active: number[], pending: number[] }} state
   * @returns {{ seat: number|null, skipped: number[] }}  skipped: folded seats passed over
   */
  function getNextAfter(state, last) {
    const skipped = [];
    for (const seat of clockwise(state.players, (last + 1) % state.players)) {
      if (!state.active.includes(seat)) { skipped.push(seat); continue; }
      if (state.pending.includes(seat)) return { seat, skipped };
    }
    return { seat: null, skipped };
  }

  /**
   * SHOWDOWN: who shows first. This is a HOUSE RULE, not a universal rule: it is set in js/data/house-rules.js.
   *   'lastAggressor' (default) — the last player who bet or raised on the river; if nobody bet, the first active player
   *                               after the button (the order of action of the river)
   *   'leftOfButton'            — always the first active player after the button
   * Assumptions: the river betting round is over; no all-in player, no side pot.
   */
  const SHOWDOWN_ORDERS = ['lastAggressor', 'leftOfButton'];
  function showdownRule() {
    const rule = DT.data && DT.data.houseRules && DT.data.houseRules.showdownOrder;
    return SHOWDOWN_ORDERS.includes(rule) ? rule : 'lastAggressor';
  }
  function showdownFirst({ players, button, active, lastAggressor = null }, rule = showdownRule()) {
    if (rule === 'lastAggressor' && lastAggressor != null && active.includes(lastAggressor)) return lastAggressor;
    return getFirstToAct({ players, button, active }, 'river').seat;
  }

  /** Order in which seats receive their cards: the button always gets the last card. */
  const dealOrder = (n, button) => clockwise(n, positions(n, button).firstCard);

  /** Order of action on a street: from the first player to act (getFirstToAct), clockwise, active players only. */
  function actionOrder(n, button, street, active = range(n)) {
    const first = getFirstToAct({ players: n, button, active }, street).seat;
    return first == null ? [] : clockwise(n, first).filter((i) => active.includes(i));
  }

  /** Next hand: the button moves one seat clockwise, the blinds follow. */
  const nextHand = (n, button) => positions(n, (button + 1) % n);

  /** Where the dealer button sits between its owner and the next place clockwise: halfway, clear of both places. */
  const BUTTON_BETWEEN = 0.5;

  /**
   * Places around the table, as angles in degrees clockwise from the top.
   * The dealer sits at the top middle (0°); the players are spread evenly from the dealer's left, clockwise.
   * The dealer button sits on the table edge halfway between its owner and the next place clockwise — never in front
   * of a player. Its owner is the player just before it clockwise. Example: button between Player 1 and Player 2 = Player 1.
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
  const ACTIONS = ['wait', 'collect', 'dealFlop', 'dealTurn', 'dealRiver', 'showdown', 'announce', 'pushPot', 'splitPot'];
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

  // folded: the player gave up the hand (shown COUCHÉ, no cards). Only active players (not folded) can act.
  const seatBase = () => ({ status: null, bet: 0, cards: 'down', behind: null, chip: null, marked: false, folded: false });

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

  /**
   * Stage 1 — read a table at rest: button, blinds, dealing (first, last, next card).
   * Stage 2 — the order of action at the start of a hand, the next hand, the n-th card dealt.
   * Stage 3 — hands in progress on every street with folded players, the button several hands later.
   */
  const TABLE_TYPES = {
    1: ['button', 'sb', 'bb', 'firstCard', 'lastCard', 'nextCard'],
    2: ['firstPreflop', 'firstPostflop', 'nextButton', 'nextSB', 'nextBB', 'nthCard'],
    3: ['firstActive', 'firstActive', 'firstActive', 'buttonIn', 'nextSB', 'nextBB', 'nthCard'],
  };

  function tableQuestion(stage, n, random) {
    const int = (min, max) => randomInt(min, max, random);
    const type = pick(TABLE_TYPES[stage], random);
    const button = int(0, n - 1);
    const pos = positions(n, button);
    const next = nextHand(n, button);
    const order = dealOrder(n, button);
    const q = { kind: 'table', situation: type, headsUp: n === 2, button, street: null, target: null };
    let answer = {
      button: () => button,
      sb: () => pos.sb,
      bb: () => pos.bb,
      firstCard: () => pos.firstCard,
      lastCard: () => order[n - 1],
      nextCard: () => { const k = int(0, n - 2); q.target = order[k]; return order[k + 1]; },
      // The n-th card of the deal: one card at a time, two rounds, always in the same order
      nthCard: () => { q.nth = int(2, 2 * n); return order[(q.nth - 1) % n]; },
      firstPreflop: () => null, // set below from the table
      firstPostflop: () => null,
      firstActive: () => null,
      nextButton: () => next.button,
      nextSB: () => next.sb,
      nextBB: () => next.bb,
      // A few hands later: the button moves one place per hand (a full round brings it back)
      buttonIn: () => { q.hands = int(2, n); let b = button; for (let k = 0; k < q.hands; k++) b = nextHand(n, b).button; return b; },
    }[type]();

    // Where is the button? It is hidden, the posted blinds give it away. Questions about the blinds hide the blind markers.
    const asksBlinds = ['sb', 'bb', 'nextButton', 'nextSB', 'nextBB', 'buttonIn'].includes(type);
    q.hideButton = type === 'button';
    q.showBlinds = type === 'button' || (!asksBlinds && (stage === 1 || (stage === 2 && random() < 0.5)));
    const blinds = pick(BLINDS.slice(0, 2), random);
    const seats = range(n).map(() => ({ ...seatBase(), cards: null }));
    if (['firstPreflop', 'firstPostflop', 'firstActive'].includes(type)) {
      // A hand in progress: the active players hold their cards. Stage 3: after the flop some players already folded.
      q.street = type === 'firstPreflop' ? 'preflop' : type === 'firstPostflop' ? 'flop' : pick(STREETS, random);
      seats.forEach((s) => { s.cards = 'down'; });
      if (type === 'firstActive' && q.street !== 'preflop' && n > 2) {
        const folds = random() < 0.6 ? clockwise(n, (button + 1) % n).slice(0, int(1, n - 2)) : P.shuffle(range(n), random).slice(0, int(1, n - 2));
        folds.forEach((i) => { seats[i].cards = null; seats[i].folded = true; });
      }
      const active = range(n).filter((i) => !seats[i].folded);
      answer = getFirstToAct({ players: n, button, active }, q.street).seat;
    }
    // Shown blinds are posted: their chips are in front of SB and BB (preflop only — after the flop they are in the pot).
    if (q.showBlinds && (!q.street || q.street === 'preflop')) { seats[pos.sb].bet = blinds.sb; seats[pos.bb].bet = blinds.bb; }

    return withStacks({
      ...q,
      blinds: { sb: blinds.sb, bb: blinds.bb },
      seats,
      answer: String(answer),
      options: range(n).map(String),
      optionKind: 'player',
    }, blinds, random);
  }

  // ---------------------------------------------------------------------------
  // 2. Generators — flow of a hand
  // ---------------------------------------------------------------------------

  /**
   * Stage 1 — the street, what comes next after a complete round, whose turn at the start (no fold).
   * Stage 2 — whose turn after checks, calls and bets; is the round over; earlier folds.
   * Stage 3 — a raise reopens the action, round not over, who shows first, winner, pot pushed or split.
   */
  const FLOW_TYPES = {
    1: ['street', 'street', 'dealNext', 'collect', 'whoActs'],
    2: ['whoActs', 'whoActs', 'roundOver', 'roundOver', 'dealNext', 'collect', 'showdown'],
    3: ['afterRaise', 'afterRaise', 'whoActs', 'roundOver', 'showOrder', 'announce', 'pushPot', 'pushPot'],
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

    const fold = (i, status = 'fold') => { seats[i].cards = null; seats[i].folded = true; seats[i].status = status; };
    const inHand = () => range(n).filter((i) => seats[i].cards);
    const asPlayer = () => { q.options = range(n).map(String); q.optionKind = 'player'; };

    /** Postflop, from stage 2: some players already folded on an earlier street (no cards, no status). */
    function earlierFolds(keep) {
      if (stage === 1) return;
      // Often the players right after the button: the first active player is then further round the table.
      if (random() < 0.5) {
        for (const i of clockwise(n, (button + 1) % n).slice(0, int(1, n - 1))) if (inHand().length > keep) fold(i, null);
      }
      for (const i of P.shuffle(range(n), random)) {
        if (inHand().length > keep && random() < 0.25) fold(i, null);
      }
    }

    /** A complete betting round among the players in the hand. `collected`: the bets are already in the pot. Folds from stage 2. */
    function completeRound(street, collected) {
      const players = inHand();
      const folds = stage > 1;
      if (street === 'preflop') {
        const raise = random() < 0.4 ? bb * int(2, 4) : 0;
        const amount = raise || bb;
        const order = actionOrder(n, button, 'preflop', players);
        const raiser = raise ? order.find((i) => i !== pos.sb && i !== pos.bb) : null;
        order.forEach((i) => {
          const blind = i === pos.sb || i === pos.bb;
          if (folds && !blind && i !== raiser && random() < 0.3 && inHand().length > 2) return fold(i);
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
          if (folds && i !== bettor && random() < 0.3 && inHand().length > 2) return fold(i);
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

    /**
     * A betting round played action by action with the module rules (getFirstToAct, pendingPlayers, getNextAfter).
     * Returns the table after every action. At most one raise. A player folds only with nothing new in front
     * (a posted blind stays on the felt).
     */
    function simulateRound(street, { raise, folds }) {
      const acted = [];
      const snapshots = [];
      let lastAggressor = null;
      let raises = 0;
      const posted = (i) => (street === 'preflop' ? (i === pos.sb ? sb : i === pos.bb ? bb : 0) : 0);
      let current = getFirstToAct({ players: n, button, active: inHand() }, street).seat;
      for (let guard = 0; current != null && guard < 4 * n; guard++) {
        const i = current;
        const s = seats[i];
        const highest = Math.max(0, ...inHand().map((k) => seats[k].bet));
        const canRaise = raise && raises === 0 && highest > 0;
        const r = random();
        if (s.bet === highest) {
          if (highest === 0 && r < 0.45) { s.bet = bb * int(1, 4); s.status = 'bet'; lastAggressor = i; }
          else if (canRaise && r < 0.35) { s.bet = highest * 2; s.status = 'raise'; raises++; lastAggressor = i; }
          else s.status = 'check';
        } else if (folds && inHand().length > 2 && s.bet === posted(i) && r < 0.25) fold(i);
        else if (canRaise && r > 0.6) { s.bet = highest * 2; s.status = 'raise'; raises++; lastAggressor = i; }
        else { s.bet = highest; s.status = 'call'; }
        if (!acted.includes(i)) acted.push(i);
        const active = inHand();
        const round = { active, acted: acted.filter((k) => active.includes(k)), bets: seats.map((x) => x.bet) };
        const pending = pendingPlayers(round);
        snapshots.push({ seats: seats.map((x) => ({ ...x })), acted: round.acted, last: i, lastAggressor, raises, pending, players: active.length });
        current = pending.length ? getNextAfter({ players: n, active, pending }, i).seat : null;
      }
      return snapshots;
    }
    const restore = (snapshot) => snapshot.seats.forEach((x, i) => Object.assign(seats[i], x));
    const saved = () => seats.map((x) => ({ ...x }));

    const street = {
      street: () => pick(STREETS, random),
      dealNext: () => pick(['preflop', 'flop', 'turn'], random),
      collect: () => pick(STREETS, random),
      whoActs: () => (stage === 1 ? 'preflop' : stage === 2 ? pick(['preflop', 'flop'], random) : pick(STREETS, random)),
      roundOver: () => pick(STREETS, random),
      afterRaise: () => pick(['flop', 'turn', 'river'], random),
      showdown: () => 'river',
      showOrder: () => 'river',
      announce: () => 'river',
      pushPot: () => pick(STREETS, random),
    }[type]();
    q.street = street;
    q.boardCount = BOARD_COUNT[street];
    if (street !== 'preflop') q.pot = bb * int(n, 4 * n);
    const postBlinds = () => { if (street === 'preflop') { seats[pos.sb].bet = sb; seats[pos.bb].bet = bb; } };

    switch (type) {
      case 'street': {
        postBlinds();
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
      case 'roundOver': {
        // Is the betting round over? Over: collect the bets (or, if everybody checked, go straight on). Not over: wait.
        if (street !== 'preflop') earlierFolds(2);
        postBlinds();
        const snapshots = simulateRound(street, { raise: stage === 3, folds: stage === 3 }).filter((s) => s.players >= 2);
        const over = snapshots.filter((s) => !s.pending.length);
        // Stage 3: every player spoke but a raise is still to be answered — the round only looks over.
        const open = snapshots.filter((s) => s.pending.length && (stage < 3 || s.pending.every((k) => s.acted.includes(k))));
        const chosen = pick(random() < 0.45 ? over : open, random);
        if (!chosen) return null;
        restore(chosen);
        if (chosen.pending.length) {
          q.answer = 'wait';
          q.next = getNextAfter({ players: n, active: inHand(), pending: chosen.pending }, chosen.last).seat;
          q.variant = chosen.acted.includes(q.next) ? 'reopened' : 'notActed';
        } else if (seats.some((s) => s.bet > 0)) {
          q.answer = 'collect';
          q.variant = 'bets';
        } else {
          q.answer = street === 'river' ? 'showdown' : NEXT_DEAL[street];
          q.variant = 'checked';
        }
        break;
      }
      case 'afterRaise': {
        // A raise reopens the action: the players who only matched the earlier bet must speak again.
        earlierFolds(2);
        const start = saved();
        let chosen = null;
        for (let k = 0; k < 40 && !chosen; k++) {
          start.forEach((x, i) => Object.assign(seats[i], x));
          const snapshots = simulateRound(street, { raise: true, folds: true }).filter((s) => s.raises === 1 && s.pending.length && s.players >= 2);
          const reopened = snapshots.filter((s) => s.pending.some((p) => s.acted.includes(p)));
          chosen = pick(reopened.length && random() < 0.8 ? reopened : snapshots, random) || null;
        }
        if (!chosen) return null;
        restore(chosen);
        const state = { players: n, active: inHand(), pending: chosen.pending };
        const nextSeat = getNextAfter(state, chosen.last).seat;
        // Readable from the table: the first player after the raise who has not matched it.
        if (getNextAfter(state, chosen.lastAggressor).seat !== nextSeat) return null;
        Object.assign(q, { lastAggressor: chosen.lastAggressor, acted: chosen.acted, pending: chosen.pending, answer: String(nextSeat) });
        asPlayer();
        break;
      }
      case 'showOrder': {
        // River over: who shows first? The house rule decides (js/data/house-rules.js).
        earlierFolds(2);
        const start = saved();
        let chosen = null;
        for (let k = 0; k < 40 && !chosen; k++) {
          start.forEach((x, i) => Object.assign(seats[i], x));
          const last = simulateRound('river', { raise: true, folds: true }).pop();
          if (last && !last.pending.length && last.players >= 2 && (random() < 0.6 || last.lastAggressor == null)) chosen = last;
        }
        if (!chosen) return null;
        restore(chosen);
        q.lastAggressor = chosen.lastAggressor;
        q.showdownRule = showdownRule();
        q.variant = q.showdownRule === 'leftOfButton' ? 'leftOfButton' : chosen.lastAggressor == null ? 'checked' : 'aggressor';
        q.answer = String(showdownFirst({ players: n, button, active: inHand(), lastAggressor: chosen.lastAggressor }, q.showdownRule));
        asPlayer();
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
          // Showdown done, the winning hands are marked: one winner takes the pot, a tie splits it.
          const players = inHand();
          if (random() < 0.4) {
            // The board makes a straight: often every player plays the board
            const used = new Set(seats.flatMap((s) => s.hole));
            const low = int(2, 10);
            const straight = [0, 1, 2, 3, 4].map((k) => pick(P.SUITS.split('').map((suit) => P.RANKS[low + k - 2] + suit).filter((c) => !used.has(c)), random));
            if (straight.some((c) => !c)) return null;
            board.splice(0, 5, ...P.shuffle(straight, random));
          }
          const { winners } = P.showdown(board, players.map((i) => seats[i].hole));
          players.forEach((i) => { seats[i].cards = 'up'; });
          winners.forEach((w) => { seats[players[w]].marked = true; });
          q.variant = winners.length > 1 ? 'split' : 'winner';
          q.answer = winners.length > 1 ? 'splitPot' : 'pushPot';
        } else {
          // Everybody else folded.
          const players = inHand();
          const winner = pick(players, random);
          seats[winner].status = street === 'preflop' ? 'raise' : 'bet';
          players.forEach((i) => { if (i !== winner) fold(i); });
          if (street === 'preflop') q.pot = bb * int(3, 6) + sb + bb;
          q.variant = 'folds';
          q.answer = 'pushPot';
        }
        break;
      }
      case 'whoActs': {
        if (street !== 'preflop') earlierFolds(2);
        const order = actionOrder(n, button, street, inHand());
        const acted = int(0, order.length - 1);
        let highest = street === 'preflop' ? bb : 0;
        postBlinds();
        // Stage 1: calls and checks. Stage 2: a bet may open the round. Stage 3: raises and folds during the round.
        order.slice(0, acted).forEach((i) => {
          const blind = street === 'preflop' && (i === pos.sb || i === pos.bb);
          const roll = random();
          if (!blind && roll < 0.3 && stage === 3) return fold(i);
          if (highest === 0) {
            if (stage > 1 && roll > 0.7) { highest = bb * int(1, 4); seats[i].bet = highest; seats[i].status = 'bet'; } else seats[i].status = 'check';
          } else if (stage === 3 && roll > 0.85) {
            highest *= 2; seats[i].bet = highest; seats[i].status = 'raise';
          } else {
            seats[i].bet = highest; seats[i].status = 'call';
          }
        });
        if (inHand().length < 2) return null;
        q.order = order;
        q.acted = order.slice(0, acted).filter((i) => !seats[i].folded);
        // The answer comes from the module rule, from what the table shows: active players and who already acted.
        const next = getNextToAct({ players: n, button, active: inHand() }, street, q.acted).seat;
        if (next !== order[acted]) return null;
        q.answer = String(next);
        asPlayer();
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

  /**
   * Stage 1 — read amounts: a bet in front, a cave, the pot, the amount to call (no raise, no fold).
   * Stage 2 — one step of calculation: to call, the cave after calling, can the player call, total engaged, pot after, bet or call or raise.
   * Stage 3 — full table reading: raise size, all-in, every action type, change, pot after raises, chip values no longer written.
   */
  const CHIP_TYPES = {
    1: ['stack', 'cave', 'pot', 'toCall'],
    2: ['toCall', 'caveAfter', 'canCall', 'committed', 'potAfter', 'action'],
    3: ['raise', 'allIn', 'action', 'change', 'potAfter', 'toCall', 'committed'],
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
    // Stage 2 reads bet / call / raise; the all-in comes at stage 3.
    const actionAnswer = type === 'action' ? pick(stage === 2 ? BET_TYPES.filter((b) => b !== 'allIn') : BET_TYPES, random) : null;
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
          seats[i].folded = true;
          seats[i].prior = blind;
        } else seats[i].prior = paid;
      });
    }
    q.pot = seats.reduce((sum, s) => sum + s.prior, 0);
    const order = actionOrder(n, button, street, inHand());

    // ---- Actions ----------------------------------------------------------------
    const act = {
      check: (i) => { seats[i].status = 'check'; },
      fold: (i) => { seats[i].cards = null; seats[i].folded = true; seats[i].status = 'fold'; },
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
        } else if (stage > 1 && inHand().length > 2 && r < 0.3) act.fold(i);
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
      case 'cave': {
        // How much does the player still have? Read the chips of the cave (its amount is hidden for this player).
        play(order.slice(0, int(0, order.length)));
        q.target = pick(inHand(), random);
        break;
      }
      case 'caveAfter':
      case 'canCall': {
        // Facing a bet: the cave after calling, or whether the cave covers the call.
        const ti = int(first, order.length - 1);
        upTo(ti, { raise: false });
        const t = order[ti];
        if (!seats[t].cards || seats[t].bet >= highest) return null;
        q.target = t;
        q.own = seats[t].bet;
        q.highest = { seat: highestSeat, amount: highest };
        q.toCall = highest - q.own;
        if (type === 'canCall' && random() < 0.5) {
          // Short: fewer chips in the cave than the amount to call (in chips of the table)
          if (q.toCall <= unit) return null;
          seats[t].start = seats[t].prior + q.own + unit * int(1, Math.floor((q.toCall - 1) / unit));
        } else if (room(t) < q.toCall + unit) seats[t].start += q.toCall - room(t) + bb * int(1, 6);
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

    // ---- Answers read from the caves ----
    if (type === 'cave') {
      q.answer = seats[q.target].behind;
      q.hideCave = q.target;
      near = [q.answer + bb, q.answer - bb, q.answer + unit, q.answer - unit, q.answer + seats[q.target].bet];
    }
    if (type === 'caveAfter') {
      q.answer = seats[q.target].behind - q.toCall;
      near = [seats[q.target].behind, q.answer - q.own, q.answer + q.own, q.answer - bb, q.answer + bb];
    }
    if (type === 'canCall') {
      q.answer = seats[q.target].behind >= q.toCall ? 'yes' : 'no';
      q.options = ['yes', 'no'];
      q.optionKind = 'yesNo';
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
    positions, blindSeats, getFirstToAct, getNextToAct, pendingPlayers, roundComplete, getNextAfter, showdownFirst, showdownRule, SHOWDOWN_ORDERS, dealOrder, actionOrder, nextHand, clockwise, tableLayout, BUTTON_BETWEEN, blindsShown,
    CHIP_VALUES, MAX_PER_STACK, MAX_PILES_ON_FELT, BLINDS, toStacks, stacksTotal, toCall, raiseSize, potAfterCollect, change,
    // generators
    STREETS, BOARD_COUNT, ACTIONS, BET_TYPES, TABLE_TYPES, FLOW_TYPES, CHIP_TYPES,
    tableQuestion, flowQuestion, chipsQuestion, amountOptions,
  };
})(window.DT);
