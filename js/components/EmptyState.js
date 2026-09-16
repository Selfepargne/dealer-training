(function (DT) {
  'use strict';

  const { h } = DT.core.dom;

  /** Honest placeholder when there is no data yet — never invented figures. */
  function EmptyState({ title, text, action }) {
    return h(
      'div',
      { class: 'empty' },
      h('p', { class: 'empty__title' }, title),
      text && h('p', { class: 'empty__text' }, text),
      action
    );
  }

  DT.components.EmptyState = EmptyState;
})(window.DT);
