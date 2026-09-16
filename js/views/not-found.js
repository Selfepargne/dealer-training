(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const { PageHeader, Button } = DT.components;

  function render() {
    const t = DT.i18n.t;
    return h('div', { class: 'view' },
      PageHeader({
        eyebrow: t('notFound.eyebrow'),
        title: t('notFound.title'),
        lead: t('notFound.lead'),
        actions: Button({ label: t('notFound.back'), href: '#/dashboard', arrow: true }),
      }));
  }

  DT.views.notFound = { title: 'notFound.eyebrow', render };
})(window.DT);
