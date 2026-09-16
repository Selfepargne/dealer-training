(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const progression = DT.core.progression;
  const { Panel, TextLink, ProgressBar, RankBadge, Requirements } = DT.components;

  /** Current rank, quote, progress to next rank and the conditions still needed. */
  function RankPanel(data, { className = '', link = true, badgeSize = 64 } = {}) {
    const t = DT.i18n.t;
    const s = progression.rankStatus(data);

    return Panel(
      { className: `rank-panel ${className}`, eyebrow: t('dashboard.currentRank'), action: link ? TextLink({ label: t('dashboard.seePath'), href: '#/progress' }) : null },
      h('div', { class: 'rank-panel__head' },
        RankBadge(s.level, { size: badgeSize, state: 'current' }),
        h('div', { class: 'stack stack-2' },
          h('span', { class: 'eyebrow' }, t('rank.levelOf', { n: s.level, total: s.total })),
          h('span', { class: 'rank-panel__name' }, t(`ranks.${s.rank.id}.name`)),
          h('span', { class: 'rank-panel__quote' }, t(`ranks.${s.rank.id}.quote`)))),
      s.next
        ? h('div', { class: 'stack stack-3' },
            h('div', { class: 'row between' },
              h('span', { class: 'muted' }, t('rank.next'), ' ', h('strong', { class: 'ivory' }, t(`ranks.${s.next.id}.name`))),
              h('span', { class: 'figure rank-panel__pct' }, `${Math.round(s.progress * 100)} %`)),
            ProgressBar({ value: s.progress, label: t('rank.progress') }),
            h('span', { class: 'eyebrow', style: { marginTop: '8px' } }, t('rank.youNeed')),
            Requirements(s.requirements))
        : h('p', { class: 'muted' }, t('rank.top')));
  }

  DT.components.RankPanel = RankPanel;
})(window.DT);
