/*
  Texas Hold'em exercise screen (2 to 6 players).
  Questions come from skills.js (checked by the engine); this file only handles display and wording.

  Every exercise module provides the same small set of functions, used by js/views/session.js:
    create(skillId, { players })  → a new question
    view(q)                       → { stage, prompt, options }
    correct(q)                    → id of the right option
    isHard(q)                     → true if the question earns the "hard" XP bonus
    reveal(q, stage)              → highlight the answer on the stage
    explain(q)                    → { headline, hand?, short, why? }
  Hold'em also offers a table size choice (tableSizes, playersFor).
*/
(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const { Card } = DT.components;
  const P = DT.poker;
  const { createQuestion, firstDifference, DEFINING } = DT.holdemSkills;

  const t = (key, vars) => DT.i18n.t(key, vars);
  const rankChar = (value) => P.RANKS[value - 2];

  // ---------------------------------------------------------------------------
  // Table size
  // ---------------------------------------------------------------------------

  const TABLE_SIZES = [2, 3, 4, 5, 6];

  /** "Auto": the table grows with the level of the skill. */
  const AUTO_PLAYERS = { beginner: [2, 2], intermediate: [2, 3], advanced: [3, 4], expert: [4, 6] };

  function playersFor(skillId, setting, random = Math.random) {
    if (TABLE_SIZES.includes(Number(setting))) return Number(setting);
    const level = DT.data.holdemSkills.byId[skillId].level;
    const [min, max] = AUTO_PLAYERS[level];
    return min + Math.floor(random() * (max - min + 1));
  }

  /** Seat positions around the table, clockwise from the top. */
  const SEATS = {
    2: ['top', 'bottom'],
    3: ['top', 'right', 'left'],
    4: ['top', 'right', 'bottom', 'left'],
    5: ['top', 'top-right', 'bottom-right', 'bottom-left', 'top-left'],
    6: ['top', 'top-right', 'bottom-right', 'bottom', 'bottom-left', 'top-left'],
  };

  // ---------------------------------------------------------------------------
  // Wording
  // ---------------------------------------------------------------------------

  const rankName = (value) => t(`cards.ranks.${rankChar(value)}`);

  /** "Two pair, Kings and 9s" / "Deux paires, Rois et 9" */
  function handName(hand) {
    let key = P.CATEGORIES[hand.category];
    if (key === 'straightFlush' && hand.values[0] === 14) key = 'royalFlush';
    const [v1, v2] = hand.values;
    return t(`poker.hands.${key}`, {
      high: rankName(v1),
      r1: t(`cards.plural.${rankChar(v1)}`),
      r2: v2 ? t(`cards.plural.${rankChar(v2)}`) : '',
      ofR1: t(`cards.ofPlural.${rankChar(v1)}`),
    });
  }

  const playerName = (i) => t('holdem.player', { n: i + 1 });

  /** "Joueur 1, Joueur 3 et Joueur 4" */
  function playerList(indexes) {
    const names = indexes.map(playerName);
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t('common.and')} ${names[names.length - 1]}` : names[0];
  }

  const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const cardText = (c) => `${c[0] === 'T' ? '10' : c[0]}${SUIT_SYMBOLS[c[1]]}︎`;
  const cardsText = (cards) => cards.map(cardText).join(' ');
  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  // ---------------------------------------------------------------------------
  // Exercise
  // ---------------------------------------------------------------------------

  function create(skillId, { players = 2 } = {}) {
    return createQuestion(skillId, { players });
  }

  /** Cards come in with a very short fade; `order` staggers them by a few milliseconds. */
  function dealt(code, order) {
    const el = Card({ code, size: 'lg' });
    el.classList.add('is-dealt');
    el.style.setProperty('--deal-delay', `${order * 22}ms`);
    return el;
  }

  function seat(q, i, position, label) {
    return h('div', { class: 'seat', dataset: { player: i, pos: position } },
      h('div', { class: 'seat__head' },
        h('span', { class: 'seat__label' }, label),
        h('span', { class: 'seat__status' })),
      h('div', { class: 'card-row' }, q.players[i].cards.map((code, k) => dealt(code, 5 + i * 2 + k))),
      h('p', { class: 'seat__hand', 'aria-live': 'polite' }));
  }

  /** The board is the centre: flop, turn, river — five cards, clear hierarchy. */
  function felt(q) {
    const street = (name, cards, from) =>
      h('div', { class: `street street--${name}` },
        h('span', { class: 'street__label' }, t(`holdem.streets.${name}`)),
        h('div', { class: 'card-row' }, cards.map((code, k) => dealt(code, from + k))));
    return h('div', { class: 'felt' },
      h('div', { class: 'board', role: 'group', 'aria-label': t('holdem.board') },
        street('flop', q.board.slice(0, 3), 0),
        street('turn', q.board.slice(3, 4), 3),
        street('river', q.board.slice(4, 5), 4)));
  }

  function view(q) {
    if (q.kind === 'recognition') {
      return {
        stage: h('div', { class: 'holdem table--solo' }, felt(q), seat(q, 0, 'bottom', t('holdem.hole'))),
        prompt: t('exercises.holdem.recognition'),
        options: q.options.map((c) => ({ id: c, label: t(`poker.categories.${c}`) })),
      };
    }

    const count = q.players.length;
    return {
      stage: h('div', { class: `holdem table--${count}` },
        felt(q),
        q.players.map((p, i) => seat(q, i, SEATS[count][i], playerName(i)))),
      prompt: t('exercises.holdem.question'),
      options: [
        ...q.players.map((p, i) => ({ id: String(i), label: playerName(i) })),
        { id: 'split', label: t('holdem.split') },
      ],
    };
  }

  function correct(q) {
    return q.answer;
  }

  function isHard(q) {
    return q.difficulty >= 6;
  }

  /** Winners marked, their five cards stay bright, everything else is dimmed. */
  function reveal(q, stage) {
    stage.classList.add('is-revealed');
    const bright = new Set();
    q.winners.forEach((w) => q.players[w].hand.cards.forEach((c) => bright.add(c)));

    stage.querySelectorAll('.seat').forEach((el) => {
      const i = Number(el.dataset.player);
      const won = q.kind === 'winner' && q.winners.includes(i);
      if (q.kind === 'winner') el.classList.add(won ? 'is-winner' : 'is-loser');
      el.querySelector('.seat__hand').textContent = handName(q.players[i].hand);
      if (won) el.querySelector('.seat__status').textContent = `✓ ${q.split ? t('holdem.splitShort') : t('holdem.winner')}`;
    });
    stage.querySelectorAll('.pcard').forEach((el) => {
      if (!bright.has(el.dataset.card)) el.classList.add('is-dim');
    });
  }

  /**
   * headline — "Player 2 wins" / "Split pot" / the hand (recognition)
   * hand     — the winning hand
   * short    — one short sentence
   * why      — on request: the hands that matter, the best hand, what decides, the result
   *            items are strings, { label, cards, hand } or { result }
   */
  function explain(q) {
    if (q.kind === 'recognition') {
      const hand = q.players[0].hand;
      return {
        headline: handName(hand),
        short: t('holdem.short.recognition'),
        why: [
          { label: t('holdem.why.bestFive'), cards: cardsText(hand.cards), hand: handName(hand) },
          t('holdem.why.othersIgnored'),
        ],
      };
    }

    const handsOf = (indexes) => indexes.map((i) => ({ label: playerName(i), cards: cardsText(q.players[i].hand.cards), hand: handName(q.players[i].hand) }));
    const bestRanks = (hand) => hand.cards.map((c) => (c[0] === 'T' ? '10' : c[0])).join(' ');

    // Strongest hand that did not win: the one to compare with.
    const losers = q.players.map((p, i) => i).filter((i) => !q.winners.includes(i));
    const runnerUp = losers.sort((a, b) => P.compare(q.players[b].hand, q.players[a].hand))[0];
    const winnerHand = q.players[q.winners[0]].hand;

    if (q.split) {
      const shown = q.winners.slice(0, 3);
      const boardPlays = q.winners.every((w) => q.players[w].hand.cards.every((c) => q.board.includes(c)));
      return {
        headline: t('holdem.splitHeadline'),
        hand: handName(winnerHand),
        short: boardPlays ? t('holdem.short.boardPlays', { players: playerList(q.winners) }) : t('holdem.short.split', { players: playerList(q.winners) }),
        why: [
          ...handsOf(shown),
          t('holdem.why.best', { cards: bestRanks(winnerHand) }),
          t('holdem.why.sameFive'),
          { result: t('holdem.why.splitResult', { players: playerList(q.winners) }) },
        ],
      };
    }

    const w = q.winners[0];
    const loser = q.players[runnerUp].hand;
    const player = playerName(w);
    const category = P.CATEGORIES[winnerHand.category];
    const base = { headline: t('holdem.winsHeadline', { player }), hand: handName(winnerHand) };
    const why = [...handsOf([w, runnerUp]), t('holdem.why.best', { cards: bestRanks(winnerHand) })];
    const result = { result: t('holdem.why.result', { player }) };

    // Different hand types: "Player 2 has a straight."
    if (winnerHand.category !== loser.category) {
      return {
        ...base,
        short: t('holdem.short.has', { player, hand: t(`poker.article.${category}`) }),
        why: [...why, t('holdem.why.category', { winner: handName(winnerHand), loser: handName(loser) }), result],
      };
    }

    // Same hand type: the first different value decides.
    const i = firstDifference(winnerHand, loser);
    const a = winnerHand.values[i];
    const b = loser.values[i];
    const kicker = DEFINING[category] > 0 && i >= DEFINING[category];
    const decides = kicker
      ? t('holdem.why.kickerBeats', { a: rankName(a), b: rankName(b) })
      : t('holdem.why.beats', { a: capitalize(t(`cards.the.${rankChar(a)}`)), b: t(`cards.the.${rankChar(b)}`) });

    let short;
    if (kicker) short = t('holdem.short.kicker', { same: t(`poker.same.${category}`), player });
    else if (DEFINING[category] > 0) short = t('holdem.short.better', { player, better: t(`poker.better.${category}`) });
    else short = t('holdem.short.nextCard', { same: t(`poker.same.${category}`), player });
    return { ...base, short, why: [...why, decides, result] };
  }

  DT.exercises.holdem = { create, view, correct, isHard, reveal, explain, handName, TABLE_SIZES, playersFor };
})(window.DT);
