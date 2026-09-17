/*
  Display and wording of the dealer situations (table setup, flow of a hand, chips and bets).
  An oval table: the dealer at the top middle, the players clockwise from the dealer's left,
  the dealer button on the gold line, the bets on the felt in front of each player.
  Used by holdem.js for the question kinds 'table', 'flow' and 'chips'.
*/
(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const { Card, Chip } = DT.components;
  const D = DT.holdemDealer;

  const t = (key, vars) => DT.i18n.t(key, vars);
  const playerName = (i) => t('holdem.player', { n: Number(i) + 1 });
  const money = (amount) => t('dealer.money', { amount });

  // ---------------------------------------------------------------------------
  // Pieces
  // ---------------------------------------------------------------------------

  /** Side-on stacks of chips; the value is written under each stack while the colours are being learnt. */
  function stacks(list, { showValues = true, small = false } = {}) {
    return h('div', { class: `bet-stacks${small ? ' bet-stacks--small' : ''}` },
      list.map((s) =>
        h('span', {
          class: `pile chip--d${s.value}`,
          role: 'img',
          'aria-label': t('chips.stack', { count: s.count, value: s.value }),
        },
        h('span', { class: 'pile__discs', 'aria-hidden': 'true' }, Array.from({ length: s.count }, () => h('span', { class: 'pile__disc' }))),
        showValues && !small && h('span', { class: 'pile__value', 'aria-hidden': 'true' }, s.value))));
  }

  /** Position on an ellipse around the centre of the table: CSS turns sin/cos into left/top with its own radii. */
  function at(angle) {
    const r = (angle * Math.PI) / 180;
    return { '--sin': Math.sin(r).toFixed(4), '--cos': Math.cos(r).toFixed(4) };
  }

  /** SB / BB under a player: only while the blinds are engaged on the felt (see blindsShown in dealer.js). */
  function blindTags(q, i) {
    if (!D.blindsShown(q)) return [];
    const pos = D.positions(q.seats.length, q.button);
    const tags = [];
    if (pos.sb === i) tags.push(h('span', { class: 'tag tag--blind' }, t('dealer.markers.sb')));
    if (pos.bb === i) tags.push(h('span', { class: 'tag tag--blind' }, t('dealer.markers.bb')));
    return tags;
  }

  function seat(q, i, angle) {
    const s = q.seats[i];
    const hideStatus = q.hideStatus || (q.kind === 'chips' && q.situation === 'action' && q.target === i);
    // A folded player is always shown COUCHÉ (public information), whatever the question.
    const status = s.marked ? `✓ ${t('holdem.winner')}` : s.folded ? t('dealer.status.fold') : !hideStatus && s.status ? t(`dealer.status.${s.status}`) : '';
    const cards = s.cards === 'up'
      ? s.hole.map((code) => Card({ code, size: 'sm' }))
      : s.cards === 'down' ? [Card({ code: 'As', faceDown: true, size: 'sm' }), Card({ code: 'As', faceDown: true, size: 'sm' })] : [];

    return h('div', {
      // Upper half of the table: the cave goes on the outer side of the place, away from the felt and the bets.
      class: `seat seat--dealer on-ring${Math.cos((angle * Math.PI) / 180) > 0.2 ? ' seat--upper' : ''}${s.folded ? ' is-folded' : ''}${s.marked ? ' is-winner' : ''}`,
      dataset: { player: i },
      style: at(angle),
    },
    h('span', { class: 'seat__label' }, playerName(i)),
    h('div', { class: 'seat__tags' },
      blindTags(q, i),
      h('span', { class: `tag tag--status seat__status${s.folded ? ' tag--folded' : ''}` }, status)),
    cards.length > 0 && h('div', { class: 'card-row seat__cards' }, cards),
    cave(q, i),
    q.kind !== 'chips' && betSpot(q, i, 'in-seat'));
  }

  /**
   * CAVE — the chips the player still has, NOT in play: in the player's place, off the felt.
   * The chips in play sit on the felt (betSpot); the chips of earlier rounds are in the pot.
   */
  function cave(q, i) {
    const s = q.seats[i];
    if (s.behindStacks == null) return null;
    return h('div', {
      class: `cave${s.behind ? '' : ' is-empty'}`,
      role: 'group',
      'aria-label': t('dealer.caveOf', { player: playerName(i), amount: money(s.behind) }),
    },
    h('span', { class: 'cave__label', 'aria-hidden': 'true' }, t('dealer.cave')),
    h('span', { class: 'cave__chips', 'aria-hidden': 'true' },
      s.behindStacks.length ? stacks(s.behindStacks, { small: true }) : h('span', { class: 'seat__empty' })),
    h('span', { class: 'cave__amount num', 'aria-hidden': 'true' }, money(s.behind)));
  }

  /**
   * ENGAGED — the chips a player has put in this round: on the felt, in front of the player.
   * Chips & bets: 'on-felt', on an inner oval of the felt, measured to stay clear of the pot.
   * Flow of a hand: 'in-seat', pushed from the player towards the centre (inside the player's box on phones, the board takes the felt).
   */
  function betSpot(q, i, where, angle) {
    const s = q.seats[i];
    if (!s.chip && !(s.betStacks && s.betStacks.length)) return null;
    return h('div', { class: `bet-spot bet-spot--${where}${where === 'on-felt' ? ' on-bets' : ''}`, dataset: { player: i }, style: where === 'on-felt' ? at(angle) : null },
      s.chip && Chip({ value: s.chip, size: 'sm' }),
      s.betStacks && s.betStacks.length > 0 && stacks(s.betStacks, { showValues: q.showValues !== false }),
      h('span', { class: 'seat__amount num' }));
  }

  function centre(q) {
    const parts = [];
    if (q.kind === 'flow') {
      const slots = [0, 1, 2, 3, 4].map((k) => (k < q.boardCount
        ? Card({ code: q.board[k], size: 'sm' })
        : h('span', { class: 'card-slot', 'aria-hidden': 'true' })));
      parts.push(h('div', { class: 'dealer-board', role: 'group', 'aria-label': t('holdem.board') }, slots));
    }
    if (q.kind === 'table') {
      parts.push(h('div', { class: 'dealer-deck' }, Card({ code: 'As', faceDown: true, size: 'sm' }), h('span', { class: 'felt__label' }, t('dealer.clockwise'))));
    }
    // Chips & bets: the stage of the hand explains where the blinds are (on the felt preflop, in the pot after).
    if (q.kind === 'chips') parts.push(h('span', { class: 'felt__label felt__street' }, t(`dealer.streets.${q.street}`)));
    if (q.potStacks && q.potStacks.length) {
      parts.push(h('div', { class: 'pot' },
        h('span', { class: 'felt__label' }, t('dealer.pot')),
        stacks(q.potStacks, { showValues: q.showValues !== false }),
        h('span', { class: 'pot__amount num' })));
    }
    return h('div', { class: 'felt-oval' }, h('div', { class: 'felt-centre' }, parts));
  }

  /** Chip colours at the table: always visible under the chips exercises. */
  function legend(q) {
    const level = D.BLINDS.find((b) => b.bb === q.blinds.bb);
    return h('div', { class: 'chip-legend', 'aria-label': t('dealer.legend') },
      h('span', { class: 'chip-legend__blinds' }, t('dealer.blinds', { sb: money(q.blinds.sb), bb: money(q.blinds.bb) })),
      h('span', { class: 'chip-legend__chips' }, level.chips.map((value) => Chip({ value, size: 'sm' }))));
  }

  // ---------------------------------------------------------------------------
  // Exercise interface
  // ---------------------------------------------------------------------------

  function optionLabel(q, id) {
    switch (q.optionKind) {
      case 'player': return playerName(id);
      case 'amount': return money(id);
      case 'action': return t(`dealer.actions.${id}`);
      case 'street': return t(`dealer.streets.${id}`);
      case 'betType': return t(`dealer.betTypes.${id}`);
      default: return id;
    }
  }

  function prompt(q) {
    const vars = { player: q.target != null ? playerName(q.target) : '', chip: q.chip ? money(q.chip) : '' };
    return t(`dealer.prompts.${q.kind}.${q.situation}`, vars);
  }

  /**
   * The table: the dealer at the top middle, the players clockwise from the dealer's left,
   * the dealer button on the gold line between two places, the bets on the felt in front of each player.
   */
  function view(q) {
    const n = q.seats.length;
    const layout = D.tableLayout(n, q.button);
    return {
      stage: h('div', { class: `dealer-table dealer-table--${q.kind}`, dataset: { players: n } },
        h('div', { class: 'dealer-table__surface' },
          centre(q),
          h('div', { class: 'place place--dealer on-ring', style: at(layout.dealer) }, h('span', { class: 'place__label' }, t('dealer.dealerSeat'))),
          q.kind === 'chips' && q.seats.map((s, i) => betSpot(q, i, 'on-felt', layout.seats[i])),
          q.seats.map((s, i) => seat(q, i, layout.seats[i])),
          h('div', {
            class: 'dealer-button on-rail',
            style: at(layout.button),
            role: 'img',
            'aria-label': t('dealer.buttonOf', { player: playerName(q.button) }),
          }, h('span', { 'aria-hidden': 'true' }, t('dealer.markers.button')))),
        q.kind === 'chips' && legend(q)),
      prompt: prompt(q),
      options: q.options.map((id) => ({ id, label: optionLabel(q, id) })),
    };
  }

  /** The seat of the answer is marked; amounts are written under every bet and the pot. */
  function reveal(q, stage) {
    stage.classList.add('is-revealed');
    const focus = new Set();
    if (q.optionKind === 'player') focus.add(Number(q.answer));
    if (q.target != null) focus.add(q.target);
    if (q.highest) focus.add(q.highest.seat);
    if (q.previous) focus.add(q.previous.seat);

    stage.querySelectorAll('.seat').forEach((el) => {
      const i = Number(el.dataset.player);
      if (focus.has(i)) el.classList.add('is-focus');
      if (q.optionKind === 'player' && Number(q.answer) === i) el.classList.add('is-answer');
      if (q.kind === 'chips' && q.situation === 'action' && q.target === i) el.querySelector('.seat__status').textContent = t(`dealer.betTypes.${q.answer}`);
    });
    stage.querySelectorAll('.bet-spot').forEach((el) => {
      const s = q.seats[Number(el.dataset.player)];
      el.querySelector('.seat__amount').textContent = money(s.chip || s.bet);
    });
    const pot = stage.querySelector('.pot__amount');
    if (pot && q.pot) pot.textContent = money(q.pot);
  }

  // ---------------------------------------------------------------------------
  // Explanations
  // ---------------------------------------------------------------------------

  const breakdown = (list) => list.map((s) => `${s.count} × ${money(s.value)}`).join(' + ');
  const sequence = (seats) => seats.map(playerName).join(' → ');

  /** "Joueur 4, Joueur 5 et Joueur 6" */
  function names(seats) {
    const list = seats.map(playerName);
    return list.length > 1 ? `${list.slice(0, -1).join(', ')} ${t('common.and')} ${list[list.length - 1]}` : list[0];
  }

  /**
   * Who acts — explained from the table actually shown, with the module rule (getNextToAct):
   * where the action starts, the folded players passed over, the player who acts.
   */
  function explainTurn(q, acted) {
    const n = q.seats.length;
    const street = q.street;
    const active = q.seats.map((s, i) => (s.folded ? -1 : i)).filter((i) => i >= 0);
    const turn = D.getNextToAct({ players: n, button: q.button, active }, street, acted);
    const player = playerName(turn.seat);
    const preflop = street === 'preflop';
    const rule = acted.length ? t('dealer.turn.continues') : t(preflop ? 'dealer.turn.preflopStart' : 'dealer.turn.postflopStart');
    const moment = acted.length ? 'next' : 'first';
    const detail = !turn.skipped.length
      ? t(`dealer.turn.${moment}NoFold`, { player })
      : t(`dealer.turn.${moment}${turn.skipped.length === 1 ? 'OneFold' : 'ManyFolds'}`, { player, folded: names(turn.skipped) });
    const folded = q.seats.map((s, i) => (s.folded ? i : -1)).filter((i) => i >= 0);
    const why = [
      t('dealer.why.button', { player: playerName(q.button) }),
      preflop && t('dealer.why.bigBlind', { player: playerName(D.positions(n, q.button).bb) }),
      preflop && q.headsUp && t('dealer.turn.headsUpPreflop'),
      t('dealer.why.actionOrder', { order: sequence(D.actionOrder(n, q.button, street, active)) }),
      folded.length > 0 && t('dealer.why.foldedPlayers', { players: names(folded) }),
      acted.length > 0 && t('dealer.why.acted', { players: acted.map(playerName).join(', ') }),
      { result: t('dealer.why.answer', { answer: player }) },
    ].filter(Boolean);
    return { headline: player, short: `${rule} ${detail}`, why };
  }

  function explainTable(q) {
    if (q.situation === 'firstPreflop' || q.situation === 'firstPostflop') return explainTurn(q, []);
    const n = q.seats.length;
    const pos = D.positions(n, q.button);
    const hu = q.headsUp ? 'headsUp' : 'normal';
    const short = t(`dealer.short.table.${q.situation}.${hu}`);
    const why = [
      t('dealer.why.button', { player: playerName(pos.button) }),
      t('dealer.why.blinds', { sb: playerName(pos.sb), bb: playerName(pos.bb) }),
    ];
    if (['firstCard', 'lastCard', 'nextCard'].includes(q.situation)) why.push(t('dealer.why.dealOrder', { order: sequence(D.dealOrder(n, q.button)) }));
    if (['nextButton', 'nextSB', 'nextBB'].includes(q.situation)) {
      const next = D.nextHand(n, q.button);
      why.push(t('dealer.why.nextHand', { button: playerName(next.button), sb: playerName(next.sb), bb: playerName(next.bb) }));
    }
    return { headline: playerName(q.answer), short, why: [...why, { result: t('dealer.why.answer', { answer: playerName(q.answer) }) }] };
  }

  function explainFlow(q) {
    if (q.situation === 'street') {
      return {
        headline: t(`dealer.streets.${q.answer}`),
        short: q.boardCount ? t('dealer.short.flow.street', { n: q.boardCount, street: t(`dealer.streets.${q.answer}`) }) : t('dealer.short.flow.preflop'),
        why: [t('dealer.why.streets'), { result: t('dealer.why.answer', { answer: t(`dealer.streets.${q.answer}`) }) }],
      };
    }
    if (q.situation === 'whoActs') return explainTurn(q, q.acted);
    const key = q.answer === 'pushPot' ? `pushPot.${q.variant}` : q.answer;
    return {
      headline: t(`dealer.actions.${q.answer}`),
      short: t(`dealer.short.flow.${key}`),
      why: [t('dealer.why.sequence'), { result: t('dealer.why.answer', { answer: t(`dealer.actions.${q.answer}`) }) }],
    };
  }

  function explainChips(q) {
    const answer = q.optionKind === 'amount' ? money(q.answer) : optionLabel(q, q.answer);
    const seatOf = (i) => q.seats[i];
    const result = { result: t('dealer.why.answer', { answer }) };
    const stackLine = (label, list) => t('dealer.why.stacks', { label, stacks: breakdown(list) });

    switch (q.situation) {
      case 'stack':
      case 'committed':
        return {
          headline: answer,
          short: t('dealer.short.chips.stack'),
          why: [stackLine(playerName(q.target), seatOf(q.target).betStacks), result],
        };
      case 'pot':
        return { headline: answer, short: t('dealer.short.chips.stack'), why: [stackLine(t('dealer.pot'), q.potStacks), t('dealer.why.caveNotInPot'), result] };
      case 'toCall':
        return {
          headline: answer,
          short: t('dealer.short.chips.toCall'),
          why: [
            t('dealer.why.highest', { amount: money(q.highest.amount), player: playerName(q.highest.seat) }),
            t('dealer.why.already', { amount: money(q.own), player: playerName(q.target) }),
            { result: `${money(q.highest.amount)} − ${money(q.own)} = ${answer}` },
          ],
        };
      case 'raise':
        return {
          headline: answer,
          short: t('dealer.short.chips.raise'),
          why: [
            t('dealer.why.previousBet', { amount: money(q.previous.amount), player: playerName(q.previous.seat) }),
            t('dealer.why.raiseTo', { amount: money(q.raiseTo), player: playerName(q.target) }),
            { result: `${money(q.raiseTo)} − ${money(q.previous.amount)} = ${answer}` },
          ],
        };
      case 'potAfter': {
        const bets = q.seats.filter((s) => s.bet).map((s) => money(s.bet));
        return {
          headline: answer,
          short: t('dealer.short.chips.potAfter'),
          why: [t('dealer.why.potBefore', { amount: money(q.pot) }), t('dealer.why.bets', { bets: bets.join(' + ') }), t('dealer.why.caveNotInPot'), result],
        };
      }
      case 'allIn':
        return { headline: answer, short: t('dealer.short.chips.allIn'), why: [t('dealer.why.noChipsBehind', { player: answer }), result] };
      case 'action': {
        const why = [];
        if (q.previous) why.push(t('dealer.why.previousBet', { amount: money(q.previous.amount), player: playerName(q.previous.seat) }));
        why.push(t('dealer.why.targetBet', { amount: money(seatOf(q.target).bet), player: playerName(q.target) }));
        return { headline: answer, short: t(`dealer.short.chips.action.${q.answer}`), why: [...why, result] };
      }
      case 'change':
        return {
          headline: answer,
          short: t('dealer.short.chips.change'),
          why: [
            t('dealer.why.highest', { amount: money(q.highest.amount), player: playerName(q.highest.seat) }),
            { result: `${money(q.chip)} − ${money(q.highest.amount)} = ${answer}` },
          ],
        };
      default:
        return { headline: answer, short: '' };
    }
  }

  function explain(q) {
    if (q.kind === 'table') return explainTable(q);
    if (q.kind === 'flow') return explainFlow(q);
    return explainChips(q);
  }

  DT.holdemDealerView = { view, reveal, explain, optionLabel, stacks };
})(window.DT);
