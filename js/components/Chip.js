(function (DT) {
  'use strict';

  const { h } = DT.core.dom;

  const DENOMINATIONS = [1, 2, 5, 10, 25, 50, 100];

  function assertDenomination(value) {
    if (!DENOMINATIONS.includes(value)) throw new Error(`Unsupported chip denomination: ${value}`);
  }

  /** Top-down chip showing its value. */
  function Chip({ value, size = 'md' }) {
    assertDenomination(value);
    const sizeClass = size === 'md' ? '' : ` chip--${size}`;
    return h(
      'span',
      { class: `chip chip--d${value}${sizeClass}`, role: 'img', 'aria-label': DT.i18n.t('chips.chip', { value }) },
      h('span', { class: 'chip__value', 'aria-hidden': 'true' }, value)
    );
  }

  /** Side-on stack of `count` chips of one denomination. */
  function ChipStack({ value, count, size = 56, label = false }) {
    assertDenomination(value);
    const discs = Array.from({ length: count }, () => h('span', { class: 'chip-stack__disc' }));
    return h(
      'span',
      {
        class: `chip-stack chip--d${value}`,
        style: { '--size': `${size}px` },
        role: 'img',
        'aria-label': DT.i18n.t('chips.stack', { count, value }),
      },
      discs,
      label && h('span', { class: 'chip-stack__label', 'aria-hidden': 'true' }, `€${value}`)
    );
  }

  DT.components.Chip = Chip;
  DT.components.ChipStack = ChipStack;
  DT.components.Chip.DENOMINATIONS = DENOMINATIONS;
})(window.DT);
