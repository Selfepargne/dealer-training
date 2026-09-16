/*
  Blackjack question generators, one per playable skill (see js/data/blackjack-skills.js).

  Cards are dealt from a shuffled 6-deck shoe. Every answer is computed by the engine (engine.js).
  A generator returns null when the deal does not fit the skill, and we deal again.

  Question shape:
    { type, module, skill, level, difficulty, targetMs, kind, data, options, answer }
*/
(function (DT) {
  'use strict';

  const B = DT.blackjack;
  const { byId } = DT.data.blackjackSkills;

  const int = (min, max, random) => min + Math.floor(random() * (max - min + 1));
  const pick = (list, random) => list[Math.floor(random() * list.length)];
  const BETS = [5, 10, 15, 20, 25, 50, 75, 100];

  /** A shoe we can draw from, with a helper to draw a card of a given kind. */
  function shoe(random) {
    const cards = B.shuffle(B.newShoe(), random);
    return {
      draw: () => cards.pop(),
      /** Draw the first card matching the test (keeps suits random). */
      drawWhere(test) {
        const i = cards.findIndex(test);
        return cards.splice(i, 1)[0];
      },
      cards,
    };
  }

  const isAce = (c) => c[0] === 'A';
  const isTen = (c) => 'TJQK'.includes(c[0]);

  /** Three wrong numbers near the answer, never negative, never equal to it. */
  function numberOptions(answer, candidates, random) {
    const wrong = [...new Set(candidates.filter((n) => n !== answer && n > 0))];
    B.shuffle(wrong, random);
    let spread = 1;
    while (wrong.length < 3) {
      for (const n of [answer + spread, answer - spread]) if (n > 0 && n !== answer && !wrong.includes(n)) wrong.push(n);
      spread++;
    }
    return [answer, ...wrong.slice(0, 3)].sort((a, b) => a - b).map(String);
  }

  // ---------------------------------------------------------------------------
  // Generators: (random) → { kind, data, options, answer } or null
  // ---------------------------------------------------------------------------

  const GENERATORS = {
    card_values(random) {
      const s = shoe(random);
      // Aces and face cards more often: that is where the mistakes are.
      const roll = random();
      const card = roll < 0.25 ? s.drawWhere(isAce) : roll < 0.55 ? s.drawWhere(isTen) : s.drawWhere((c) => !isAce(c) && !isTen(c));
      if (isAce(card)) return { kind: 'value', data: { cards: [card] }, options: ['1', '11', 'ace', '10'], answer: 'ace' };
      const v = B.cardValue(card);
      return { kind: 'value', data: { cards: [card] }, options: numberOptions(v, [v + 1, v - 1, isTen(card) ? { J: 11, Q: 12, K: 13, T: 9 }[card[0]] : v + 2], random), answer: String(v) };
    },

    hard_totals(random) {
      const s = shoe(random);
      const count = int(2, 4, random);
      const cards = Array.from({ length: count }, () => s.drawWhere((c) => !isAce(c)));
      const { total } = B.handValue(cards);
      if (total > 30) return null;
      return { kind: 'total', data: { cards }, options: numberOptions(total, [total - 1, total + 1, total - 2, total + 2, total + 10, total - 10], random), answer: String(total) };
    },

    aces(random) {
      const s = shoe(random);
      const aces = random() < 0.75 ? 1 : 2;
      const others = int(1, 3, random);
      const cards = B.shuffle([
        ...Array.from({ length: aces }, () => s.drawWhere(isAce)),
        ...Array.from({ length: others }, () => s.drawWhere((c) => !isAce(c))),
      ], random);
      const v = B.handValue(cards);
      if (v.bust && random() < 0.7) return null; // mostly hands that do not bust
      // Classic mistakes: every ace as 1, one ace as 11 when it should not, two aces as 11.
      const wrong = [v.hardTotal, v.hardTotal + 10, v.hardTotal + 20, v.total - 1, v.total + 1];
      return { kind: 'total', data: { cards }, options: numberOptions(v.total, wrong, random), answer: String(v.total) };
    },

    soft_hard(random) {
      const s = shoe(random);
      const roll = random();
      let cards;
      if (roll < 0.5) cards = [s.drawWhere(isAce), s.draw()];                         // often soft
      else if (roll < 0.85) cards = [s.drawWhere(isAce), s.draw(), s.draw()];          // soft or hard
      else cards = [s.drawWhere((c) => !isAce(c)), s.drawWhere((c) => !isAce(c))];      // no ace: hard
      B.shuffle(cards, random);
      const v = B.handValue(cards);
      if (v.bust || v.blackjack || v.total < 12) return null;
      const answer = `${v.soft ? 'soft' : 'hard'}-${v.total}`;
      const near = v.total < 21 ? v.total + 1 : v.total - 1;
      // Soft hand: the classic mistake is the hard total (every ace as 1).
      const options = v.soft
        ? [`soft-${v.total}`, `hard-${v.total}`, `hard-${v.hardTotal}`, `soft-${near}`]
        : [`soft-${v.total}`, `hard-${v.total}`, `soft-${near}`, `hard-${near}`];
      const order = (o) => Number(o.split('-')[1]) * 2 + (o.startsWith('hard') ? 1 : 0);
      return { kind: 'softHard', data: { cards }, options: options.sort((a, b) => order(a) - order(b)), answer };
    },

    blackjack_bust(random) {
      // The four calls are equally likely: choose the call first, then deal until it happens.
      const target = pick(['blackjack', 'twentyone', 'bust', 'under'], random);
      for (let attempt = 0; attempt < 1000; attempt++) {
        const s = shoe(random);
        const cards = target === 'blackjack'
          ? B.shuffle([s.drawWhere(isAce), s.drawWhere(isTen)], random)
          : Array.from({ length: int(target === 'under' ? 2 : 3, 4, random) }, () => s.draw());
        const v = B.handValue(cards);
        const kind = v.blackjack ? 'blackjack' : v.total === 21 ? 'twentyone' : v.bust ? 'bust' : 'under';
        if (kind !== target || (kind === 'under' && v.total < 15)) continue; // "under": close to 21, where the call matters
        return { kind: 'call', data: { cards }, options: ['blackjack', 'twentyone', 'bust', 'under'], answer: kind };
      }
      return null;
    },

    outcome(random) {
      // Win, lose and push equally likely: choose the result first, then deal until it happens.
      const target = pick(['win', 'lose', 'push'], random);
      for (let attempt = 0; attempt < 1000; attempt++) {
        const q = dealOutcome(random);
        if (q.answer === target) return q;
      }
      return null;
    },
  };

  function dealOutcome(random) {
    const s = shoe(random);

    // Player: draws until a random standing total, or busts.
    const player = [s.draw(), s.draw()];
    const stand = int(12, 21, random);
    while (!B.handValue(player).blackjack && B.handValue(player).total < stand) player.push(s.draw());

    // Dealer: real dealer rule (draws to 17, stands on all 17s).
    const dealer = B.dealerPlay([s.draw(), s.draw()], s.cards);

    return {
      kind: 'outcome',
      data: { player, dealer, bet: pick(BETS, random) },
      options: ['win', 'lose', 'push'],
      answer: B.outcome(player, dealer),
    };
  }

  /**
   * @param {string} skillId
   * @param {{ random?: () => number }} options
   */
  function createQuestion(skillId, { random = Math.random } = {}) {
    const skill = byId[skillId];
    if (!skill || !GENERATORS[skillId]) throw new Error(`No blackjack generator for: ${skillId}`);
    for (let attempt = 0; attempt < 5000; attempt++) {
      const q = GENERATORS[skillId](random);
      if (q) {
        return { type: 'blackjack', module: 'blackjack', skill: skill.id, level: skill.level, difficulty: skill.difficulty, targetMs: skill.targetMs, ...q };
      }
    }
    throw new Error(`Could not generate a question for ${skillId}`);
  }

  DT.blackjackSkills = { createQuestion, GENERATOR_IDS: Object.keys(GENERATORS) };
})(window.DT);
