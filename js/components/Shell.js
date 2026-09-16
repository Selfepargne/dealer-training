(function (DT) {
  'use strict';

  const { h, clear } = DT.core.dom;
  const { Icon, Logo, ProgressBar, RankBadge } = DT.components;
  const { MODULES } = DT.data.modules;

  const NAV = [
    { id: 'dashboard', href: '#/dashboard', icon: 'dashboard' },
    { id: 'training', href: '#/training', icon: 'training' },
    { id: 'challenges', href: '#/challenges', icon: 'challenges' },
    { id: 'progress', href: '#/progress', icon: 'progress' },
    { id: 'settings', href: '#/settings', icon: 'settings' },
  ];

  /**
   * Application frame: sidebar (desktop), icon rail (tablet), tab bar (mobile).
   * Screens are drawn inside `main`.
   */
  function createShell(root) {
    const t = DT.i18n.t;

    const navLinks = NAV.map((item) =>
      h('a', { class: 'nav__item', href: item.href, dataset: { nav: item.id }, title: t(`nav.${item.id}`) },
        h('span', { class: 'nav__icon' }, Icon(item.icon)),
        h('span', { class: 'nav__label' }, t(`nav.${item.id}`))));

    const subLinks = MODULES.map((m) =>
      h('a', { class: 'nav__sub', href: `#/training/${m.id}`, dataset: { sub: m.id } },
        h('span', { class: 'nav__sub-mark', 'aria-hidden': 'true' }),
        t(`modules.${m.id}.name`),
        !m.available && h('span', { class: 'nav__sub-meta' }, t('common.soon'))));

    const foot = h('a', { class: 'sidebar__foot', href: '#/progress' });

    const sidebar = h(
      'aside',
      { class: 'sidebar' },
      h('a', { class: 'brand', href: '#/dashboard', 'aria-label': t('app.name') },
        h('span', { class: 'brand__mark' }, Logo({ size: 40 })),
        h('span', { class: 'brand__text' },
          h('span', { class: 'brand__name' }, t('app.name')),
          h('span', { class: 'brand__sub' }, t('app.academy')))),
      h('nav', { 'aria-label': t('nav.primary') }, h('div', { class: 'nav' }, navLinks)),
      h('div', { class: 'nav__group', role: 'navigation', 'aria-label': t('nav.modules') },
        h('span', { class: 'eyebrow' }, t('nav.tables')),
        h('div', { class: 'nav' }, subLinks)),
      foot
    );

    const tabbar = h('nav', { class: 'tabbar', 'aria-label': t('nav.primary') },
      h('div', { class: 'tabbar__list' },
        NAV.map((item) =>
          h('a', { class: 'tabbar__item', href: item.href, dataset: { nav: item.id } }, Icon(item.icon), h('span', null, t(`navShort.${item.id}`))))));

    const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });

    clear(root);
    root.append(sidebar, main, tabbar);

    function setActive(path) {
      const [, section, sub] = path.split('/');
      const active = section === 'train' ? 'training' : section;
      root.classList.toggle('in-session', section === 'train'); // more room for the exercise on phones
      for (const link of root.querySelectorAll('[data-nav]')) {
        if (link.dataset.nav === active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      for (const link of subLinks) {
        if ((section === 'training' || section === 'train') && link.dataset.sub === sub) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    }

    function renderRank(status) {
      clear(foot).append(
        h('div', { class: 'row row-3' },
          RankBadge(status.level, { size: 40, state: 'current' }),
          h('div', { class: 'grow' },
            h('span', { class: 'eyebrow' }, t('rank.level', { n: status.level })),
            h('p', { class: 'rank-mini__name' }, t(`ranks.${status.rank.id}.name`)))),
        ProgressBar({ value: status.progress, thin: true, label: t('rank.progressTo', { rank: status.next ? t(`ranks.${status.next.id}.name`) : '' }) }),
        h('p', { class: 'rank-mini__meta' },
          status.next ? t('rank.nextShort', { rank: t(`ranks.${status.next.id}.name`), pct: Math.round(status.progress * 100) }) : t('rank.top'))
      );
      foot.setAttribute('aria-label', t('rank.current', { rank: t(`ranks.${status.rank.id}.name`) }));
    }

    return { main, setActive, renderRank };
  }

  DT.components.createShell = createShell;
})(window.DT);
