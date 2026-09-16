(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const fmt = DT.core.format;
  const progression = DT.core.progression;
  const RANKS = DT.data.ranks;
  const ACHIEVEMENTS = DT.data.achievements;
  const { SKILLS, TIERS } = DT.data.modules;
  const { PageHeader, Panel, StatTile, EmptyState, RankBadge, RankPanel, AchievementSeal, HistoryList, Badge } = DT.components;

  /** "1 000 XP · 80 % accuracy · 25 % fast" — short summary of a rank's conditions. */
  function conditionsText(rank) {
    const t = DT.i18n.t;
    const parts = [];
    if (rank.xp) parts.push(`${fmt.integer(rank.xp)} XP`);
    if (rank.accuracy) parts.push(t('req.accuracy', { target: rank.accuracy }));
    if (rank.fast) parts.push(t('req.fast', { target: rank.fast }));
    if (rank.streak) parts.push(t('req.streak', { target: rank.streak }));
    if (rank.skills) parts.push(t('req.skills', { target: rank.skills.count, tier: t(`tiers.${rank.skills.tier}`) }));
    return parts.join(' · ');
  }

  function timeline(data) {
    const t = DT.i18n.t;
    const current = data.stats.rank;
    return Panel(
      { className: 'span-6', eyebrow: t('progress.pathEyebrow'), title: t('progress.pathTitle'), description: t('progress.pathDesc', { total: RANKS.length }) },
      h('ol', { class: 'timeline' },
        RANKS.map((rank, i) => {
          const state = i < current ? 'earned' : i === current ? 'current' : 'locked';
          const date = data.stats.rankDates[i];
          return h('li', { class: `timeline__item is-${state}`, 'aria-current': state === 'current' ? 'step' : null },
            RankBadge(i + 1, { size: 44, state }),
            h('div', { class: 'timeline__body' },
              h('div', { class: 'row row-3 wrap' },
                h('span', { class: 'timeline__name' }, t(`ranks.${rank.id}.name`)),
                state === 'current' && Badge(t('progress.currentBadge'), 'accent')),
              state === 'locked'
                ? h('p', { class: 'timeline__text' }, conditionsText(rank) || t('progress.start'))
                : h('p', { class: 'timeline__text' }, t(`ranks.${rank.id}.quote`)),
              state !== 'locked' && date && i > 0 && h('p', { class: 'timeline__date' }, t('progress.reachedOn', { date: fmt.shortDate(date) }))));
        })));
  }

  function moduleLevels(data) {
    const t = DT.i18n.t;
    return Panel(
      { flush: true, eyebrow: t('progress.modulesEyebrow'), title: t('progress.modulesTitle') },
      h('ul', { class: 'module-levels' },
        SKILLS.map((m) => {
          const tier = data.stats.skills[m.id].tier;
          return h('li', { class: `module-level${m.available ? '' : ' is-soon'}` },
            h('a', { class: 'module-level__name', href: `#/training/${m.id}` }, t(`modules.${m.id}.name`)),
            h('span', { class: 'module-level__pips', 'aria-hidden': 'true' },
              TIERS.map((x, i) => h('span', { class: i <= tier ? 'is-on' : '' }))),
            h('span', { class: 'module-level__tier' }, m.available ? t(`tiers.${TIERS[tier].id}`) : t('common.soon')));
        })));
  }

  function achievements(data) {
    const t = DT.i18n.t;
    const earned = ACHIEVEMENTS.filter((a) => data.achievements[a.id]).length;
    return Panel(
      { flush: true, eyebrow: t('progress.achievementsEyebrow'), title: t('progress.achievementsTitle'), description: t('progress.achievementsCount', { n: earned, total: ACHIEVEMENTS.length }) },
      h('ul', { class: 'achievements' },
        ACHIEVEMENTS.map((a) => {
          const date = data.achievements[a.id];
          return h('li', { class: `achievement${date ? ' is-earned' : ''}` },
            AchievementSeal({ earned: !!date }),
            h('div', null,
              h('p', { class: 'achievement__name' }, t(`achievements.${a.id}.name`)),
              h('p', { class: 'achievement__text' }, t(`achievements.${a.id}.text`)),
              date && h('p', { class: 'timeline__date' }, fmt.shortDate(date))));
        })));
  }

  function figures(data) {
    const t = DT.i18n.t;
    const o = progression.overview(data);
    const has = o.questions > 0;
    const time = fmt.duration(o.trainingMs);
    const tiles = [
      { label: 'XP', value: fmt.integer(o.xp) },
      { label: t('stats.exercises'), value: fmt.integer(o.questions), hint: t('stats.correctCount', { n: fmt.integer(o.correct) }) },
      { label: t('stats.accuracy'), value: has ? fmt.percent(o.accuracy) : null, unit: '%', hint: has ? t('stats.lastAnswers', { n: Math.min(o.questions, progression.RECENT) }) : '' },
      { label: t('stats.avgSpeed'), value: has ? fmt.seconds(o.avgMs, 1) : null, unit: 's' },
      { label: t('stats.best'), value: o.bestMs != null ? fmt.seconds(o.bestMs) : null, unit: 's' },
      { label: t('stats.longestStreak'), value: has ? fmt.integer(o.longestStreak) : null },
      { label: t('stats.trainingTime'), value: time.value, unit: time.unit },
      { label: t('stats.sessions'), value: fmt.integer(data.history.length) },
    ];
    return h('div', { class: 'grid stagger' }, tiles.map((x) => h('div', { class: 'span-3' }, StatTile(x))));
  }

  function history(data) {
    const t = DT.i18n.t;
    const items = data.history.slice(0, 30);
    return Panel(
      { flush: true, eyebrow: t('history.eyebrow'), title: t('history.title') },
      items.length ? HistoryList(items) : EmptyState({ title: t('history.emptyTitle'), text: t('history.emptyText') }));
  }

  function render({ data }) {
    const t = DT.i18n.t;
    return h('div', { class: 'view stack stack-4' },
      PageHeader({ eyebrow: t('nav.progress'), title: t('progress.title'), lead: t('progress.lead') }),
      RankPanel(data, { link: false, badgeSize: 80 }),
      h('div', { class: 'grid' },
        timeline(data),
        h('div', { class: 'span-6 stack stack-4' }, moduleLevels(data), achievements(data))),
      figures(data),
      history(data));
  }

  DT.views.progress = { title: 'nav.progress', render };
})(window.DT);
