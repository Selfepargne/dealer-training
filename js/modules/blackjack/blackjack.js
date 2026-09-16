/*
  Blackjack exercise screen.
  Questions come from skills.js (answers computed by engine.js); this file only handles display and wording.

  Same functions as every exercise module (used by js/views/session.js):
    create, view, correct, isHard, reveal, explain → { headline, hand?, short, why? }
*/
(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const fmt = DT.core.format;
  const { Card, Chip } = DT.components;
  const B = DT.blackjack;
  const { createQuestion } = DT.blackjackSkills;

  const t = (key, vars) => DT.i18n.t(key, vars);

  // ---------------------------------------------------------------------------
  // Wording helpers
  // ---------------------------------------------------------------------------

  /** Values as counted in the best total: the first ace counts 11 when the hand is soft. */
  function countedValues(cards) {
    const soft = B.handValue(cards).soft;
    let aceAsEleven = soft;
    return cards.map((c) => {
      if (c[0] === 'A' && aceAsEleven) { aceAsEleven = false; return 11; }
      return B.cardValue(c);
    });
  }

  /** "10 + 6 + 1 = 17" */
  function sum(cards) {
    return `${countedValues(cards).join(' + ')} = ${B.handValue(cards).total}`;
  }

  /** "Blackjack", "Bust (24)", "17 soft", "18" */
  function describe(cards) {
    const v = B.handValue(cards);
    if (v.blackjack) return t('blackjack.labels.blackjack');
    if (v.bust) return t('blackjack.labels.bustTotal', { n: v.total });
    return v.soft ? t('blackjack.labels.soft', { n: v.total }) : String(v.total);
  }

  function optionLabel(q, id) {
    if (q.kind === 'value') return id === 'ace' ? t('blackjack.labels.aceValue') : id;
    if (q.kind === 'softHard') {
      const [kind, n] = id.split('-');
      return t(`blackjack.labels.${kind}`, { n });
    }
    if (q.kind === 'call' || q.kind === 'outcome') return t(`blackjack.labels.${id}`);
    return id;
  }

  // ---------------------------------------------------------------------------
  // Exercise
  // ---------------------------------------------------------------------------

  function create(skillId) {
    return createQuestion(skillId);
  }

  function hand(label, cards, extra) {
    return h('div', { class: 'bj-spot' },
      h('div', { class: 'bj-spot__head' }, h('span', { class: 'bj-spot__label' }, label), extra),
      h('div', { class: 'card-row' }, cards.map((code) => Card({ code, size: 'lg' }))),
      h('p', { class: 'bj-total', 'aria-live': 'polite' }));
  }

  /** Printed on the felt, as on a real table. Ratio comes from Settings. */
  function inscription() {
    const ratio = DT.core.state.get().settings.blackjackPayout;
    return h('div', { class: 'bj-arc', 'aria-hidden': 'true' },
      h('span', null, t('blackjack.table.pays', { ratio })),
      h('span', { class: 'bj-arc__dot' }),
      h('span', null, t('blackjack.table.dealerRule')));
  }

  function view(q) {
    const options = q.options.map((id) => ({ id, label: optionLabel(q, id) }));
    const prompts = { value: 'value', total: 'total', softHard: 'softHard', call: 'call', outcome: 'outcome' };
    const prompt = t(`exercises.blackjack.${prompts[q.kind]}`);

    if (q.kind === 'outcome') {
      const { bet } = q.data;
      const betEl = h('span', { class: 'bj-bet' },
        DT.components.Chip.DENOMINATIONS.includes(bet) ? Chip({ value: bet, size: 'sm' }) : null,
        h('span', { class: 'num' }, t('blackjack.bet', { amount: fmt.number(bet) })));
      return {
        stage: h('div', { class: 'bj-table' },
          h('div', { class: 'bj-dealer' }, hand(t('blackjack.dealer'), q.data.dealer)),
          inscription(),
          hand(t('holdem.player', { n: 1 }), q.data.player, betEl)),
        prompt,
        options,
      };
    }

    const label = q.kind === 'value' ? t('blackjack.card') : t('blackjack.hand');
    return {
      stage: h('div', { class: `bj-table bj-table--single${q.kind === 'value' ? ' bj-table--card' : ''}` }, inscription(), hand(label, q.data.cards)),
      prompt,
      options,
    };
  }

  function correct(q) {
    return q.answer;
  }

  function isHard(q) {
    return q.difficulty >= 6;
  }

  /** Show every total once the answer is given. */
  function reveal(q, stage) {
    stage.classList.add('is-revealed');
    const spots = stage.querySelectorAll('.bj-spot');
    if (q.kind === 'outcome') {
      spots[0].querySelector('.bj-total').textContent = describe(q.data.dealer);
      spots[1].querySelector('.bj-total').textContent = describe(q.data.player);
      spots[1].classList.add(`is-${q.answer}`);
    } else if (q.kind !== 'value') {
      spots[0].querySelector('.bj-total').textContent = describe(q.data.cards);
    }
  }

  function explain(q) {
    if (q.kind === 'value') {
      const card = q.data.cards[0];
      if (card[0] === 'A') return { headline: t('blackjack.explain.ace'), short: t('blackjack.short.ace') };
      const tenValue = 'TJQK'.includes(card[0]);
      return {
        // "Roi = 10" for tens and faces; just "7" for a number card.
        headline: tenValue ? t('blackjack.explain.value', { card: t(`cards.ranks.${card[0]}`), value: 10 }) : String(B.cardValue(card)),
        short: tenValue ? t('blackjack.short.tenValue') : t('blackjack.short.number'),
      };
    }

    if (q.kind === 'total' || q.kind === 'softHard' || q.kind === 'call') {
      const cards = q.data.cards;
      const v = B.handValue(cards);
      const hasAce = cards.some((c) => c[0] === 'A');
      const why = [t('blackjack.why.sum', { sum: sum(cards) })];
      if (hasAce && !v.soft) why.push(t('blackjack.why.aceOne', { total: v.hardTotal + 10 }));
      if (hasAce && v.soft) why.push(t('blackjack.why.aceEleven', { total: v.total, low: v.hardTotal }));

      let short;
      if (q.kind === 'call') short = t(`blackjack.short.${q.answer}`, { n: v.total });
      else if (q.kind === 'softHard') short = v.soft ? t('blackjack.short.soft') : hasAce ? t('blackjack.short.hardAce') : t('blackjack.short.hardNoAce');
      else short = !hasAce ? t('blackjack.short.sum') : v.soft ? t('blackjack.short.aceEleven') : t('blackjack.short.aceOne');

      return { headline: optionLabel(q, q.answer), hand: sum(cards), short, why };
    }

    // Outcome
    const { player, dealer } = q.data;
    const p = B.handValue(player);
    const d = B.handValue(dealer);
    let reason;
    if (p.bust) reason = 'playerBust';
    else if (p.blackjack && d.blackjack) reason = 'bothBlackjack';
    else if (p.blackjack) reason = d.total === 21 ? 'blackjackBeats21' : 'playerBlackjack';
    else if (d.blackjack) reason = 'dealerBlackjack';
    else if (d.bust) reason = 'dealerBust';
    else reason = q.answer === 'win' ? 'higher' : q.answer === 'lose' ? 'lower' : 'equal';

    return {
      headline: optionLabel(q, q.answer),
      hand: t('blackjack.explain.versus', { player: describe(player), dealer: describe(dealer) }),
      short: t(`blackjack.short.${reason}`, { p: p.total, d: d.total }),
      why: [
        t('blackjack.why.playerSum', { sum: sum(player) }),
        t('blackjack.why.dealerSum', { sum: sum(dealer) }),
      ],
    };
  }

  DT.exercises.blackjack = { create, view, correct, isHard, reveal, explain };
})(window.DT);
