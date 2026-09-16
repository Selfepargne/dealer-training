(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const { DASH } = DT.core.format;
  const { Icon } = DT.components;

  /** Key figure: label, large editorial number, unit, supporting hint. */
  function StatTile({ label, value, unit, hint, icon }) {
    const empty = value == null || value === DASH;
    return h(
      'article',
      { class: 'stat' },
      h('div', { class: 'stat__label' }, h('span', { class: 'eyebrow' }, label), icon && Icon(icon)),
      h(
        'div',
        { class: 'stat__value' },
        h('span', { class: `figure stat__figure${empty ? ' stat__figure--empty' : ''}` }, empty ? DASH : value),
        !empty && unit && h('span', { class: 'stat__unit' }, unit)
      ),
      h('p', { class: 'stat__hint' }, hint || '')
    );
  }

  DT.components.StatTile = StatTile;
})(window.DT);
