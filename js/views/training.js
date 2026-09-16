(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const fmt = DT.core.format;
  const progression = DT.core.progression;
  const { MODULES, REFLEX } = DT.data.modules;
  const { PageHeader, Badge, ModuleArt, Icon } = DT.components;

  function tile(m, data, wide = false) {
    const t = DT.i18n.t;
    let foot;
    if (m.available) {
      const s = progression.tierStatus(data, m.id);
      foot = s.recent.count
        ? `${t(`tiers.${s.tier.id}`)} · ${t('stats.accuracyShort', { pct: fmt.percent(s.recent.accuracy) })}`
        : t(`tiers.${s.tier.id}`);
    } else {
      foot = t('common.soon');
    }

    return h('a', { class: `tile${wide ? ' tile--wide' : ''}${m.available ? '' : ' is-soon'}`, href: `#/training/${m.id}` },
      h('div', { class: 'tile__art' },
        h('span', { class: 'tile__art-index', 'aria-hidden': 'true' }, m.index),
        m.available ? Badge(t('common.available'), 'accent') : Badge(t('common.soon')),
        ModuleArt(m.id)),
      h('div', { class: 'tile__body' },
        h('span', { class: 'eyebrow' }, m.reflex.map((r) => t(`reflex.${r}`)).join(' · ')),
        h('h2', { class: 'tile__title' }, t(`modules.${m.id}.name`)),
        h('p', { class: 'tile__text' }, wide ? t(`modules.${m.id}.description`) : t(`modules.${m.id}.tagline`)),
        h('div', { class: 'tile__foot' }, h('span', { class: 'num' }, foot), Icon('arrow'))));
  }

  function render({ data }) {
    const t = DT.i18n.t;
    return h('div', { class: 'view' },
      PageHeader({ eyebrow: t('nav.training'), title: t('training.title'), lead: t('training.lead') }),
      h('div', { class: 'flow', style: { marginBottom: '24px' } },
        REFLEX.map((step, i) => [
          i > 0 && h('span', { class: 'flow__sep', 'aria-hidden': 'true' }),
          h('span', { class: 'flow__step' }, t(`reflex.${step}`)),
        ])),
      h('div', { class: 'grid stagger' },
        MODULES.filter((m) => m.skill).map((m) => h('div', { class: 'span-4' }, tile(m, data))),
        h('div', { class: 'span-8' }, tile(MODULES.find((m) => m.id === 'mixed'), data, true))));
  }

  DT.views.training = { title: 'nav.training', render };
})(window.DT);
