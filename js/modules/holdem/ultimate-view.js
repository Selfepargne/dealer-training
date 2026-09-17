/*
  Display and wording of the Ultimate Texas Hold'em settlements (question kind 'ultimate', see ultimate.js).
  A casino Ultimate table: the dealer and the board at the top, one betting layout per player below —
  TRIPS on top, ANTE = BLIND side by side, PLAY underneath — with the chips on each spot.
  Used by holdem.js.
*/
(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const { Card } = DT.components;
  const U = DT.holdemUltimate;
  const { stacks } = DT.holdemDealerView;

  const t = (key, vars) => DT.i18n.t(key, vars);
  const money = (amount) => t('dealer.money', { amount });
  const playerName = (i) => t('holdem.player', { n: Number(i) + 1 });
  const betName = (bet) => t(`ultimate.bets.${bet}`);
  const handName = (hand) => DT.exercises.holdem.handName(hand); // holdem.js, loaded after this file

  /** "2 × 100 € + 1 × 25 € + 3 × 5 €" */
  const chipsText = (amount) => U.paymentChips(amount).map((c) => `${c.count} × ${money(c.value)}`).join(' + ');

  // ---------------------------------------------------------------------------
  // Pieces
  // ---------------------------------------------------------------------------

  /** One betting spot of a player's layout: its name, the chips and the amount. */
  function zone(q, i, bet) {
    const spot = q.spots[i];
    const amount = spot.bets[bet];
    const asked = q.situation === 'zone' && q.target === i && q.zone === bet;
    return h('div', {
      class: `uth-zone uth-zone--${bet}${amount ? '' : ' is-empty'}${asked ? ' is-asked' : ''}`,
      dataset: { player: i, bet },
      role: 'group',
      'aria-label': q.situation === 'zone' ? t('ultimate.zoneShown', { amount: money(amount || 0) }) : `${betName(bet)} ${money(amount || 0)}`,
    },
    // A zone question tests the layout itself: the names are shown with the answer.
    h('span', { class: 'uth-zone__name', 'aria-hidden': 'true' }, q.situation === 'zone' ? '' : betName(bet)),
    h('span', { class: 'uth-zone__chips', 'aria-hidden': 'true' }, amount ? stacks(spot.piles[bet], { showValues: false }) : null),
    h('span', { class: 'uth-zone__amount num', 'aria-hidden': 'true' }, amount ? money(amount) : ''),
    h('span', { class: 'uth-zone__settle num' }));
  }

  function spot(q, i) {
    const s = q.spots[i];
    const several = q.spots.length > 1;
    return h('div', { class: `uth-spot${several && i === q.target ? ' is-target' : ''}`, dataset: { player: i } },
      h('div', { class: 'uth-spot__head' },
        h('span', { class: 'uth-spot__name' }, playerName(i)),
        h('span', { class: `uth-tag uth-tag--${s.settlement.result}` }, t(`ultimate.results.${s.settlement.result}`))),
      h('div', { class: 'uth-hand' },
        h('div', { class: 'card-row' }, s.cards.map((code) => Card({ code, size: 'sm' }))),
        h('span', { class: 'uth-hand__name' }, handName(s.hand))),
      h('div', { class: 'uth-layout' },
        zone(q, i, 'trips'),
        h('div', { class: 'uth-layout__row' },
          zone(q, i, 'ante'),
          h('span', { class: 'uth-layout__equal', 'aria-hidden': 'true' }, '='),
          zone(q, i, 'blind')),
        zone(q, i, 'play')),
      h('p', { class: 'uth-spot__total num', 'aria-live': 'polite' }));
  }

  function dealer(q) {
    return h('div', { class: 'uth-dealer' },
      h('span', { class: 'uth-dealer__label' }, t('ultimate.dealer')),
      h('div', { class: 'uth-hand' },
        h('div', { class: 'card-row' }, q.dealer.cards.map((code) => Card({ code, size: 'sm' }))),
        h('span', { class: 'uth-hand__name' }, handName(q.dealer.hand))),
      h('span', { class: `uth-tag ${q.qualifies ? 'uth-tag--qualified' : 'uth-tag--not-qualified'}` }, t(q.qualifies ? 'ultimate.qualified' : 'ultimate.notQualified')));
  }

  /** The two pay tables, under the table while they are being learnt. */
  function paytables() {
    const table = (name, pays) => h('div', { class: 'uth-paytable' },
      h('span', { class: 'uth-paytable__title' }, betName(name)),
      h('dl', null, Object.entries(pays).map(([type, ratio]) => [
        h('dt', null, t(`ultimate.types.${type}`)),
        h('dd', { class: 'num' }, U.ratioText(ratio)),
      ])));
    return h('div', { class: 'uth-paytables', 'aria-label': t('ultimate.paytables') },
      table('blind', U.BLIND_PAYS),
      table('trips', U.TRIPS_PAYS));
  }

  // ---------------------------------------------------------------------------
  // Exercise interface
  // ---------------------------------------------------------------------------

  const outcomeName = (outcome) => t(`ultimate.outcomes.${outcome}`);

  function optionLabel(q, id) {
    switch (q.optionKind) {
      case 'bet': return betName(id);
      case 'outcome': return outcomeName(id);
      case 'amount': return id === '0' ? t('ultimate.nothing') : money(id);
      case 'chips': return chipsText(Number(id));
      case 'settle': return id.split(',').map((part) => { const [bet, outcome] = part.split(':'); return `${betName(bet)} ${t(`ultimate.outcomesInline.${outcome}`)}`; }).join(' · ');
      case 'bets': {
        if (id === 'none') return t('ultimate.noBet');
        const names = id.split('+').map(betName);
        return names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t('common.and')} ${names[names.length - 1]}` : names[0];
      }
      default: return id;
    }
  }

  function prompt(q) {
    const text = t(`ultimate.prompts.${q.situation}`);
    return q.spots.length > 1 ? `${playerName(q.target)} · ${text}` : text;
  }

  function view(q) {
    return {
      stage: h('div', { class: 'uth-table', dataset: { players: q.spots.length, situation: q.situation } },
        h('div', { class: 'uth-felt' },
          h('div', { class: 'uth-felt__top' },
            dealer(q),
            h('div', { class: 'uth-board', role: 'group', 'aria-label': t('holdem.board') },
              h('span', { class: 'uth-dealer__label' }, t('holdem.board')),
              h('div', { class: 'card-row' }, q.board.map((code) => Card({ code, size: 'sm' }))))),
          h('div', { class: 'uth-spots' }, q.spots.map((s, i) => spot(q, i)))),
        q.showPaytable && paytables()),
      prompt: prompt(q),
      options: q.options.map((id) => ({ id, label: optionLabel(q, id) })),
    };
  }

  /** Every bet shows how it is settled: "+15 €", "Rendue", "Perdue"; each player shows what they pick up. */
  function reveal(q, stage) {
    stage.classList.add('is-revealed');
    stage.querySelectorAll('.uth-zone').forEach((el) => {
      const i = Number(el.dataset.player);
      const line = q.spots[i].settlement.byBet[el.dataset.bet];
      if (q.situation === 'zone') el.querySelector('.uth-zone__name').textContent = betName(el.dataset.bet);
      if (!line) return;
      el.classList.add(`is-${line.outcome}`);
      el.querySelector('.uth-zone__settle').textContent = line.outcome === 'paid' ? `+${money(line.win)} · ${U.ratioText(line.ratio)}` : outcomeName(line.outcome);
    });
    stage.querySelectorAll('.uth-spot').forEach((el) => {
      const i = Number(el.dataset.player);
      if (i === q.target) el.classList.add('is-focus');
      el.querySelector('.uth-spot__total').textContent = t('ultimate.receivesTotal', { amount: money(q.spots[i].settlement.receives) });
    });
  }

  // ---------------------------------------------------------------------------
  // Explanations: every bet of the player, one line each, then the totals
  // ---------------------------------------------------------------------------

  function betLine(q, line) {
    const hand = handName(q.spots[q.target].hand);
    const cause = t(`ultimate.causes.${line.reason}`, { hand });
    const vars = { bet: betName(line.bet), amount: money(line.amount), cause, ratio: line.ratio ? U.ratioText(line.ratio) : '', win: money(line.win) };
    return t(`ultimate.why.${line.outcome}`, vars);
  }

  function explain(q) {
    const s = q.spots[q.target].settlement;
    const headline = optionLabel(q, q.answer);
    const vars = { player: playerName(q.target) };
    const why = [];

    if (q.situation === 'zone') {
      return {
        headline,
        short: t('ultimate.short.zone'),
        why: [t('ultimate.why.layout'), { result: t('dealer.why.answer', { answer: headline }) }],
      };
    }

    why.push(t(s.qualifies ? 'ultimate.why.qualified' : 'ultimate.why.notQualified', { hand: handName(q.dealer.hand) }));
    why.push(t(`ultimate.why.result.${s.result}`, { ...vars, hand: handName(q.spots[q.target].hand) }));
    const lines = q.situation === 'anteOutcome' ? [s.byBet.ante]
      : q.situation === 'blindOutcome' || q.situation === 'blindPay' ? [s.byBet.blind]
        : q.situation === 'antePay' ? [s.byBet.ante]
          : q.situation === 'playPay' ? [s.byBet.play]
            : q.situation === 'tripsPay' ? [s.byBet.trips]
              : s.lines;
    lines.forEach((line) => why.push(betLine(q, line)));

    const totals = ['paid', 'receives', 'push', 'chipsPay', 'chipsReturn'];
    if (totals.includes(q.situation)) {
      const wins = s.lines.filter((l) => l.win > 0).map((l) => money(l.win));
      why.push(t('ultimate.why.paidTotal', { detail: wins.length ? wins.join(' + ') : money(0), amount: money(s.paid) }));
      if (q.situation !== 'paid' && q.situation !== 'chipsPay') {
        const backs = s.lines.filter((l) => l.back > 0).map((l) => money(l.back));
        why.push(t('ultimate.why.returnedTotal', { detail: backs.length ? backs.join(' + ') : money(0), amount: money(s.returned) }));
        why.push(t('ultimate.why.receivesTotal', { paid: money(s.paid), returned: money(s.returned), amount: money(s.receives) }));
      }
    }
    if (q.optionKind === 'chips') why.push(t('ultimate.why.chips', { chips: chipsText(Number(q.answer)) }));
    why.push({ result: t('dealer.why.answer', { answer: headline }) });

    return { headline, short: t(`ultimate.short.${q.situation}`), why };
  }

  DT.holdemUltimateView = { view, reveal, explain, optionLabel, chipsText };
})(window.DT);
