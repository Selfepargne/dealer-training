(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const fmt = DT.core.format;
  const progression = DT.core.progression;
  const { SKILLS, byId } = DT.data.modules;
  const { DAILY } = DT.data.challenges;
  const { Button, TextLink, Badge, Panel, StatTile, ProgressBar, EmptyState, ModuleArt, Icon, RankBadge } = DT.components;

  /** Where "Continue training" goes: last playable module, otherwise Hold'em. */
  function continueTarget(data) {
    const last = data.lastModule && byId[data.lastModule];
    return last && last.available ? last.id : 'holdem';
  }

  /**
    * The greeting band: one photograph of a dealer table, and over it the real text.
    * The photograph carries no words of its own, so the veil (css/decor.css) is only there to
    * carry the title: it goes from black on the far left to nothing at 42 %.
    * Decorative image: alt is empty on purpose — the greeting is right beside it, in HTML.
    */
  function heroPhoto() {
    return [
      h('img', {
        class: 'hero__photo',
        src: 'assets/hero-table-1600.webp',
        srcset: 'assets/hero-table-1100.webp 1100w, assets/hero-table-1600.webp 1600w',
        sizes: '(max-width: 767px) 100vw, (max-width: 1179px) calc(100vw - 120px), calc(100vw - 360px)',
        width: 1600,
        height: 641,
        alt: '',
        decoding: 'async',
        fetchpriority: 'high',
      }),
      h('span', { class: 'hero__veil', 'aria-hidden': 'true' }),
    ];
  }

  function hero(data) {
    const t = DT.i18n.t;
    const name = (data.profile.name || '').trim();
    const target = continueTarget(data);
    const greeting = name
      ? [`${fmt.greeting()}, `, h('em', null, name)]
      : [fmt.greeting()];
    return h('section', { class: 'hero hero--photo', 'aria-labelledby': 'dash-title' },
      heroPhoto(),
      h('div', { class: 'hero__body' },
        h('p', { class: 'eyebrow eyebrow--accent' }, fmt.longDate()),
        h('h1', { class: 'display hero__title', id: 'dash-title' }, greeting),
        h('p', { class: 'hero__lead' }, t('dashboard.lead')),
        h('div', { class: 'hero__actions' },
          Button({ label: t('dashboard.continue'), size: 'lg', icon: 'play', arrow: true, href: `#/train/${target}` }),
          h('p', { class: 'hero__resume' }, t(`modules.${target}.name`), ' · ', t('dashboard.sessionLength', { n: 20 })))),
      h('p', { class: 'hero__quote' }, t('app.motto')));
  }

  /**
   * The grade tile: the wide first tile of the row — level, rank, progress to the next one
   * and the XP counter. Same data as the rank panel of the progress screen, in a tile.
   */
  function gradeTile(data, o) {
    const t = DT.i18n.t;
    const s = progression.rankStatus(data);
    return h('article', { class: 'stat stat--grade' },
      h('div', { class: 'stat__label' }, h('span', { class: 'eyebrow' }, t('dashboard.currentRank'))),
      h('div', { class: 'grade' },
        RankBadge(s.level, { size: 54, state: 'current' }),
        h('span', { class: 'grade__name' }, t(`ranks.${s.rank.id}.name`)),
        s.next ? h('span', { class: 'figure grade__pct' }, `${Math.round(s.progress * 100)} %`) : null),
      ProgressBar({ value: s.next ? s.progress : 1, label: t('rank.progress') }),
      s.next
        ? h('a', { class: 'grade__next', href: '#/progress' },
            h('span', null, t('rank.next'), ' ', h('strong', null, t(`ranks.${s.next.id}.name`))),
            s.next.xp ? h('span', { class: 'grade__xp' }, `${fmt.integer(o.xp)} / ${fmt.integer(s.next.xp)} XP`) : null,
            Icon('arrow'))
        : h('p', { class: 'grade__next' }, t('rank.top')));
  }

  function statTiles(data) {
    const t = DT.i18n.t;
    const o = progression.overview(data);
    const has = o.questions > 0;
    return h('div', { class: 'kpis stagger' },
      gradeTile(data, o),
      StatTile({
        label: t('stats.streak'), icon: 'flame',
        value: has ? fmt.integer(o.currentStreak) : null,
        hint: has ? t('stats.record', { n: fmt.integer(o.longestStreak) }) : t('stats.streakHint'),
      }),
      StatTile({
        label: t('stats.accuracy'), icon: 'target',
        value: has ? fmt.percent(o.accuracy) : null, unit: '%',
        hint: has ? t('stats.lastAnswers', { n: Math.min(o.questions, progression.RECENT) }) : t('stats.noAnswers'),
      }),
      StatTile({
        label: t('stats.avgSpeed'), icon: 'clock',
        value: has ? fmt.seconds(o.avgMs, 1) : null, unit: 's',
        hint: has ? t('stats.fastShare', { pct: fmt.percent(o.fast) }) : t('stats.speedHint'),
      }));
  }

  function skills(data) {
    const t = DT.i18n.t;
    const rows = SKILLS.map((m) => {
      if (!m.available) {
        return h('a', { class: 'skill is-soon', href: `#/training/${m.id}` },
          h('div', null,
            h('div', { class: 'skill__top' }, h('span', { class: 'skill__name' }, t(`modules.${m.id}.name`)), h('span', { class: 'skill__meta' }, t('common.soon'))),
            ProgressBar({ value: 0, label: t(`modules.${m.id}.name`) })),
          h('span', { class: 'figure skill__score skill__score--empty' }, fmt.DASH));
      }
      const s = progression.tierStatus(data, m.id);
      const acc = s.recent.accuracy;
      return h('a', { class: 'skill', href: `#/training/${m.id}` },
        h('div', null,
          h('div', { class: 'skill__top' },
            h('span', { class: 'skill__name' }, t(`modules.${m.id}.name`)),
            h('span', { class: 'skill__meta' }, t(`tiers.${s.tier.id}`))),
          ProgressBar({ value: acc || 0, label: t('stats.accuracy') })),
        h('span', { class: `figure skill__score${acc == null ? ' skill__score--empty' : ''}` }, acc == null ? fmt.DASH : `${fmt.percent(acc)}%`));
    });

    return Panel(
      { className: 'span-8', eyebrow: t('dashboard.skills'), title: t('dashboard.skillsTitle'), description: t('dashboard.skillsDesc') },
      h('div', { class: 'skills' }, rows));
  }

  function dailyCard(data) {
    const t = DT.i18n.t;
    const done = progression.dailyDoneToday(data);
    return Panel(
      { className: 'span-4 daily', eyebrow: t('daily.title'), action: done ? Badge(t('daily.done'), 'positive') : Badge(`+${DAILY.xp} XP`, 'accent') },
      h('div', { class: 'daily__art' }, ModuleArt(continueTarget(data))),
      h('h2', { class: 'daily__title' }, t('daily.format', { n: DAILY.questions, s: DAILY.timeLimitMs / 1000 })),
      h('dl', { class: 'daily__specs' },
        h('div', { class: 'daily__spec' }, h('dt', null, t('daily.module')), h('dd', null, t(`modules.${continueTarget(data)}.name`))),
        h('div', { class: 'daily__spec' }, h('dt', null, t('daily.reward')), h('dd', null, done ? t('daily.earnedToday') : `+${DAILY.xp} XP`))),
      Button({ label: done ? t('daily.replay') : t('daily.start'), variant: done ? 'secondary' : 'accent', arrow: true, block: true, href: `#/train/${continueTarget(data)}?type=challenge` }));
  }

  function focus(data) {
    const t = DT.i18n.t;
    const areas = progression.focusAreas(data, 3);
    const reason = (a) =>
      a.reason === 'untrained' ? t('focus.untrained')
        : a.reason === 'accuracy' ? t('focus.accuracy', { pct: fmt.percent(a.accuracy) })
        : t('focus.speed', { pct: fmt.percent(a.fast) });

    const body = areas.length
      ? h('div', { class: 'focus-list' },
          areas.map((a, i) =>
            h('a', { class: 'focus', href: `#/train/${a.module.id}` },
              h('span', { class: 'focus__index' }, fmt.pad2(i + 1)),
              h('span', { class: 'grow' },
                h('span', { class: 'focus__name' }, t(`modules.${a.module.id}.name`)),
                h('span', { class: 'focus__reason' }, reason(a))),
              Icon('arrow', 'focus__go'))))
      : EmptyState({ title: t('focus.noneTitle'), text: t('focus.noneText') });

    return Panel({ flush: true, className: 'span-6', eyebrow: t('focus.eyebrow'), title: t('focus.title'), description: t('focus.desc') }, body);
  }

  function recent(data) {
    const t = DT.i18n.t;
    const items = data.history.slice(0, 4);
    const body = items.length
      ? DT.components.HistoryList(items)
      : EmptyState({ title: t('history.emptyTitle'), text: t('history.emptyText') });
    return Panel(
      { flush: true, className: 'span-6', eyebrow: t('history.eyebrow'), title: t('history.title'), action: items.length ? TextLink({ label: t('common.all'), href: '#/progress' }) : null },
      body);
  }

  function render({ data }) {
    return h('div', { class: 'view stack stack-5' },
      hero(data),
      statTiles(data),
      h('div', { class: 'grid' }, skills(data), dailyCard(data)),
      h('div', { class: 'grid' }, focus(data), recent(data)));
  }

  DT.views.dashboard = { title: 'nav.dashboard', render };
})(window.DT);
