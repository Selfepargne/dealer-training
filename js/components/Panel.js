(function (DT) {
  'use strict';

  const { h } = DT.core.dom;

  /** Surface with an optional eyebrow / title / description header and an action slot. */
  function Panel({ eyebrow, title, description, action, flush = false, className = '', tag = 'section', labelledBy } = {}, ...children) {
    const titleId = title ? `panel-${Math.random().toString(36).slice(2, 8)}` : null;
    const head =
      eyebrow || title || action
        ? h(
            'header',
            { class: 'panel__head' },
            h(
              'div',
              { class: 'panel__titles' },
              eyebrow && h('span', { class: 'eyebrow' }, eyebrow),
              title && h('h2', { class: 'panel__title', id: titleId }, title),
              description && h('p', { class: 'panel__desc' }, description)
            ),
            action && h('div', { class: 'panel__action' }, action)
          )
        : null;

    return h(
      tag,
      {
        class: ['panel', flush && 'panel--flush', className].filter(Boolean).join(' '),
        'aria-labelledby': labelledBy || titleId,
      },
      head,
      children
    );
  }

  /** Standard page header used by every top-level view. */
  function PageHeader({ eyebrow, title, lead, actions, back }) {
    return h(
      'header',
      { class: 'page-head-wrap' },
      back && h('a', { class: 'back-link', href: back.href }, DT.components.Icon('arrow'), back.label),
      h(
        'div',
        { class: 'page-head' },
        h(
          'div',
          { class: 'page-head__titles' },
          eyebrow && h('span', { class: 'eyebrow eyebrow--accent' }, eyebrow),
          h('h1', { class: 'display page-title' }, title),
          lead && h('p', { class: 'page-lead' }, lead)
        ),
        actions && h('div', { class: 'row row-3 wrap' }, actions)
      )
    );
  }

  DT.components.Panel = Panel;
  DT.components.PageHeader = PageHeader;
})(window.DT);
