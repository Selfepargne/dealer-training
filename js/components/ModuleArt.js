(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const { Card, ChipStack } = DT.components;

  /** Quiet illustrative compositions built from the real Card / Chip components. */
  const ART = {
    holdem: () =>
      h('div', { class: 'row row-4' },
        h('div', { class: 'card-fan' }, Card({ code: 'As', size: 'sm' }), Card({ code: 'Kh', size: 'sm' })),
        h('div', { class: 'card-row' }, Card({ code: 'Qs', size: 'sm' }), Card({ code: 'Js', size: 'sm' }), Card({ code: 'Ts', size: 'sm' }))),

    blackjack: () =>
      h('div', { class: 'card-fan', style: { '--w': '64px' } }, Card({ code: 'Ad' }), Card({ code: '6c' }), Card({ code: '4h' })),

    chips: () =>
      h('div', { class: 'row row-3', style: { alignItems: 'flex-end' } },
        ChipStack({ value: 1, count: 7, size: 44 }),
        ChipStack({ value: 5, count: 8, size: 44 }),
        ChipStack({ value: 25, count: 4, size: 44 }),
        ChipStack({ value: 100, count: 2, size: 44 })),

    math: () =>
      h('div', { class: 'glyph-sum', 'aria-hidden': 'true' },
        h('div', null, '25 × 4'), h('div', null, '+ 5 × 3'), h('div', null, '+ 1 × 7'), h('strong', null, '122')),

    table: () => {
      const seats = [
        [4, 8, false], [16, 52, true], [36, 84, false], [50, 96, true], [64, 84, false], [84, 52, true], [96, 8, false],
      ];
      return h('div', { class: 'glyph-table', 'aria-hidden': 'true' },
        seats.map(([x, y, win]) =>
          h('span', { class: `glyph-table__seat${win ? ' is-win' : ''}`, style: { left: `${x}%`, top: `${y}%` } })));
    },

    mixed: () =>
      h('div', { class: 'row row-5', style: { alignItems: 'flex-end', gap: '20px' } },
        h('div', { class: 'card-fan' }, Card({ code: '9s', size: 'sm' }), Card({ code: '9h', size: 'sm' })),
        ChipStack({ value: 25, count: 5, size: 40 }),
        h('div', { class: 'glyph-sum', style: { fontSize: '1.5rem' }, 'aria-hidden': 'true' }, h('div', null, '50 × 1.5'), h('strong', null, '75')),
        ChipStack({ value: 5, count: 3, size: 40 })),

    cards: () =>
      h('div', { class: 'card-row' }, Card({ code: 'Ah', size: 'sm' }), Card({ code: 'Kc', size: 'sm' }), Card({ faceDown: true, size: 'sm' })),
  };

  function ModuleArt(id) {
    return (ART[id] || ART.cards)();
  }

  DT.components.ModuleArt = ModuleArt;
})(window.DT);
