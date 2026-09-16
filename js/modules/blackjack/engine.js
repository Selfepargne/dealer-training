/*
  Blackjack engine — no display, no text. Pure logic, tested in tests/blackjack-engine.test.js.

  Cards use the same codes as Hold'em: rank + suit, e.g. 'As', 'Td', '7h'.
  Table rules live here and only here.
*/
(function (DT) {
  'use strict';

  const RANKS = 'A23456789TJQK';
  const SUITS = 'shdc';

  const RULES = {
    dealerStandsOnSoft17: true, // dealer stands on all 17s
    insurancePays: 2,           // 2:1
    decks: 6,
  };

  /** Low value of a card: Ace 1, face cards 10. */
  function cardValue(card) {
    const r = card[0];
    if (r === 'A') return 1;
    if ('TJQK'.includes(r)) return 10;
    return Number(r);
  }

  /**
   * Value of a hand.
   *   total     — best total: one ace counts 11 if that does not go over 21
   *   soft      — true when an ace is counting 11
   *   hardTotal — every ace counted as 1
   *   blackjack — exactly two cards making 21
   *   bust      — total over 21
   */
  function handValue(cards) {
    const hardTotal = cards.reduce((sum, c) => sum + cardValue(c), 0);
    const hasAce = cards.some((c) => c[0] === 'A');
    const soft = hasAce && hardTotal + 10 <= 21;
    const total = soft ? hardTotal + 10 : hardTotal;
    return { total, soft, hardTotal, blackjack: cards.length === 2 && total === 21, bust: total > 21 };
  }

  /**
   * Result for the player against the dealer's final hand.
   * @returns {'win'|'lose'|'push'}
   */
  function outcome(playerCards, dealerCards) {
    const p = handValue(playerCards);
    const d = handValue(dealerCards);
    if (p.bust) return 'lose';                  // a busted player loses, whatever the dealer does
    if (p.blackjack && d.blackjack) return 'push';
    if (p.blackjack) return 'win';              // blackjack beats any other 21
    if (d.blackjack) return 'lose';
    if (d.bust) return 'win';
    if (p.total > d.total) return 'win';
    if (p.total < d.total) return 'lose';
    return 'push';
  }

  /** Does the dealer draw another card? */
  function dealerMustDraw(cards) {
    const v = handValue(cards);
    if (v.total < 17) return true;
    return v.total === 17 && v.soft && !RULES.dealerStandsOnSoft17;
  }

  /** Dealer plays from the shoe until standing. Returns the final cards. */
  function dealerPlay(startCards, shoe) {
    const cards = startCards.slice();
    if (handValue(cards).blackjack) return cards;
    while (dealerMustDraw(cards)) cards.push(shoe.pop());
    return cards;
  }

  /** '3:2' → 1.5, '6:5' → 1.2, '1:1' → 1 */
  function parseRatio(text) {
    const m = /^(\d+):(\d+)$/.exec(String(text || '').trim());
    if (!m || Number(m[2]) === 0) throw new Error(`Invalid payout ratio: ${text}`);
    return Number(m[1]) / Number(m[2]);
  }

  /**
   * Amount the dealer pays on a bet (winnings only; the original bet is returned separately).
   *   win → bet × 1 · blackjack win → bet × ratio · push → 0 · lose → −bet (bet taken)
   * Rounded to the cent.
   */
  function payout(bet, result, { blackjack = false, ratio = '3:2' } = {}) {
    let amount;
    if (result === 'push') amount = 0;
    else if (result === 'lose') amount = -bet;
    else amount = blackjack ? bet * parseRatio(ratio) : bet;
    return Math.round(amount * 100) / 100;
  }

  function newShoe(decks = RULES.decks) {
    const shoe = [];
    for (let d = 0; d < decks; d++) for (const r of RANKS) for (const s of SUITS) shoe.push(r + s);
    return shoe;
  }

  function shuffle(list, random = Math.random) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  DT.blackjack = { RANKS, SUITS, RULES, cardValue, handValue, outcome, dealerMustDraw, dealerPlay, parseRatio, payout, newShoe, shuffle };
})(window.DT);
