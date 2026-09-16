/*
  Texas Hold'em engine — no display, no text. Pure logic, tested in tests/poker.test.js.

  A card is a 2-character string: rank + suit.
    ranks: 2 3 4 5 6 7 8 9 T J Q K A
    suits: s (spades) h (hearts) d (diamonds) c (clubs)
  Example: 'As' = ace of spades, 'Td' = ten of diamonds.
*/
(function (DT) {
  'use strict';

  const RANKS = '23456789TJQKA';
  const SUITS = 'shdc';

  // Hand categories from weakest (0) to strongest (8).
  // A royal flush is simply a straight flush with an ace high.
  const CATEGORIES = ['highCard', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush'];

  /** '2' → 2 … 'T' → 10, 'J' → 11, 'Q' → 12, 'K' → 13, 'A' → 14 */
  function rankValue(card) {
    return RANKS.indexOf(card[0]) + 2;
  }

  function newDeck() {
    const deck = [];
    for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
    return deck;
  }

  /** Fisher–Yates shuffle, in place. */
  function shuffle(deck, random = Math.random) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  /**
   * Evaluate exactly 5 cards.
   * Returns { category, values, cards }:
   *   category — index in CATEGORIES
   *   values   — numbers compared left to right to break ties
   *   cards    — the 5 cards, most important first (for display)
   */
  function evaluate5(cards) {
    const values = cards.map(rankValue).sort((a, b) => b - a);
    const isFlush = cards.every((c) => c[1] === cards[0][1]);

    // Straight: 5 different values in a row. A-2-3-4-5 (the "wheel") is 5-high.
    let straightHigh = 0;
    if (new Set(values).size === 5) {
      if (values[0] - values[4] === 4) straightHigh = values[0];
      else if (values.join(',') === '14,5,4,3,2') straightHigh = 5;
    }

    // Group equal values: biggest group first, then highest value.
    const counts = {};
    for (const v of values) counts[v] = (counts[v] || 0) + 1;
    const groups = Object.keys(counts)
      .map((v) => ({ value: Number(v), count: counts[v] }))
      .sort((a, b) => b.count - a.count || b.value - a.value);
    const groupValues = groups.map((g) => g.value);
    const shape = groups.map((g) => g.count).join('');

    let category;
    let tiebreak;
    if (straightHigh && isFlush) { category = 8; tiebreak = [straightHigh]; }
    else if (shape === '41') { category = 7; tiebreak = groupValues; }
    else if (shape === '32') { category = 6; tiebreak = groupValues; }
    else if (isFlush) { category = 5; tiebreak = values; }
    else if (straightHigh) { category = 4; tiebreak = [straightHigh]; }
    else if (shape === '311') { category = 3; tiebreak = groupValues; }
    else if (shape === '221') { category = 2; tiebreak = groupValues; }
    else if (shape === '2111') { category = 1; tiebreak = groupValues; }
    else { category = 0; tiebreak = values; }

    // Display order: grouped cards first; in a wheel the ace counts as 1.
    const sortKey = (card) => {
      const v = rankValue(card);
      const lowAce = straightHigh === 5 && v === 14 ? 1 : v;
      return counts[v] * 100 + lowAce;
    };
    const ordered = cards.slice().sort((a, b) => sortKey(b) - sortKey(a));

    return { category, values: tiebreak, cards: ordered };
  }

  /** > 0 if hand a beats hand b, < 0 if b wins, 0 if exactly equal. */
  function compare(a, b) {
    if (a.category !== b.category) return a.category - b.category;
    for (let i = 0; i < a.values.length; i++) {
      if (a.values[i] !== b.values[i]) return a.values[i] - b.values[i];
    }
    return 0;
  }

  /** Best 5-card hand from 5, 6 or 7 cards: tries every 5-card combination. */
  function bestHand(cards) {
    let best = null;
    const n = cards.length;
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++)
        for (let c = b + 1; c < n; c++)
          for (let d = c + 1; d < n; d++)
            for (let e = d + 1; e < n; e++) {
              const hand = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
              if (!best || compare(hand, best) > 0) best = hand;
            }
    return best;
  }

  /**
   * Showdown between players sharing one board.
   * @param {string[]} board 5 cards
   * @param {string[][]} holeCards one pair of cards per player
   * @returns {{ hands: object[], winners: number[] }} winners = indexes (several = split pot)
   */
  function showdown(board, holeCards) {
    const hands = holeCards.map((hole) => bestHand(hole.concat(board)));
    let best = hands[0];
    for (const hand of hands) if (compare(hand, best) > 0) best = hand;
    const winners = [];
    hands.forEach((hand, i) => { if (compare(hand, best) === 0) winners.push(i); });
    return { hands, winners };
  }

  /**
   * Generate a "who wins?" question.
   * Every answer is computed by the engine — nothing is written by hand.
   */
  function createWinnerQuestion({ players = 2, random = Math.random } = {}) {
    const deck = shuffle(newDeck(), random);
    const holeCards = [];
    for (let p = 0; p < players; p++) holeCards.push([deck.pop(), deck.pop()]);
    const board = deck.splice(0, 5);
    const { hands, winners } = showdown(board, holeCards);

    // "Hard" when the two strongest hands share the same category (kickers, higher pair…).
    const ranked = hands.slice().sort((a, b) => compare(b, a));
    const hard = ranked.length > 1 && ranked[0].category === ranked[1].category;

    return {
      type: 'holdem_winner',
      board,
      players: holeCards.map((cards, i) => ({ cards, hand: hands[i] })),
      winners,
      split: winners.length > 1,
      hard,
    };
  }

  DT.poker = { RANKS, SUITS, CATEGORIES, rankValue, newDeck, shuffle, evaluate5, compare, bestHand, showdown, createWinnerQuestion };
})(window.DT);
