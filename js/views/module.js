(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const fmt = DT.core.format;
  const progression = DT.core.progression;
  const { byId, TIERS, REFLEX } = DT.data.modules;
  const { PageHeader, Panel, Button, StatTile, ModuleArt, Icon, Kbd, ProgressBar, Requirements, TextLink } = DT.components;

  const trainLink = (moduleId, query = '') => `#/train/${moduleId}${query ? `?${query}` : ''}`;

  // ---------------------------------------------------------------------------
  // Modules with a learning path (Texas Hold'em, Blackjack)
  // ---------------------------------------------------------------------------

  /** One skill: name, status, progress bar, and three figures — nothing more. */
  function skillCard(moduleId, s) {
    const t = DT.i18n.t;
    const name = t(`${moduleId}Skills.${s.skill.id}.name`);

    if (!s.available) {
      return h('div', { class: 'skill-card is-soon' },
        h('div', { class: 'skill-card__top' },
          h('span', { class: 'skill-card__name' }, name),
          h('span', { class: 'skill-card__state' }, t('common.soon'))));
    }

    const figure = (label, value) => h('div', { class: 'skill-card__figure' }, h('span', { class: 'skill-card__label' }, label), h('span', { class: 'num' }, value));
    return h('a', { class: `skill-card is-${s.state}`, href: trainLink(moduleId, `type=skill&skill=${s.skill.id}`) },
      h('div', { class: 'skill-card__top' },
        h('span', { class: 'skill-card__name' }, name),
        h('span', { class: 'skill-card__state' }, s.mastered && Icon('check'), t(`skills.states.${s.state}`))),
      ProgressBar({ value: s.progress, thin: true, label: name }),
      h('div', { class: 'skill-card__figures' },
        figure(t('skills.figures.exercises'), fmt.integer(s.questions)),
        figure(t('skills.figures.accuracy'), s.accuracy != null ? `${fmt.percent(s.accuracy)} %` : fmt.DASH),
        figure(t('skills.figures.speed'), s.avgMs != null ? `${fmt.seconds(s.avgMs, 1)} s` : fmt.DASH)));
  }

  function skillsPanel(moduleId, data) {
    const t = DT.i18n.t;
    const path = progression.PATHS[moduleId];
    const list = progression.skillList(data, moduleId);

    return Panel(
      { eyebrow: t('skills.eyebrow'), title: t('skills.title'), description: t('skills.desc', { n: path.MASTERY.exercises }) },
      path.LEVELS.map((level) => {
        const inLevel = list.filter((s) => s.skill.level === level);
        const done = inLevel.filter((s) => s.mastered).length;
        return h('section', { class: 'skill-level' },
          h('div', { class: 'skill-level__head' },
            h('h3', { class: 'skill-level__title' }, t(`tiers.${level}`)),
            h('span', { class: 'faint small num' }, t('skills.masteredCount', { n: done, total: inLevel.length }))),
          h('div', { class: 'skill-grid' }, inLevel.map((s) => skillCard(moduleId, s))));
      }));
  }

  /** The four session types: path (with Practice / Speed), a chosen skill (the cards), my mistakes, challenge. */
  function nextPanel(moduleId, data) {
    const t = DT.i18n.t;
    const next = progression.nextSkill(data, moduleId);
    const id = next.skill.id;
    const hasMistakes = progression.mistakesBySkill(data, moduleId).some((m) => m.skill.available !== false);

    return Panel(
      { className: 'next-skill', eyebrow: `${t('sessionTypes.path')} · ${next.mastered ? t('skills.allMastered') : t('skills.next')}` },
      h('div', { class: 'stack stack-2' },
        h('h2', { class: 'next-skill__name' }, t(`${moduleId}Skills.${id}.name`)),
        h('p', { class: 'muted small' }, t(`${moduleId}Skills.${id}.desc`))),
      h('div', { class: 'stack stack-3' },
        ProgressBar({ value: next.progress, label: t('skills.next') }),
        Requirements(next.requirements)),
      h('div', { class: 'row row-3 wrap' },
        Button({ label: t('session.modes.practice'), arrow: true, href: trainLink(moduleId) }),
        Button({ label: t('session.modes.speed'), variant: 'secondary', href: trainLink(moduleId, 'mode=speed') })),
      h('ul', { class: 'session-links' },
        h('li', null, TextLink({ label: t('sessionTypes.mistakes'), href: trainLink(moduleId, 'type=mistakes') }),
          h('span', { class: 'faint small' }, hasMistakes ? t('sessionTypes.mistakesHint') : t('mistakes.none'))),
        h('li', null, TextLink({ label: t('sessionTypes.challenge'), href: trainLink(moduleId, 'type=challenge') }),
          h('span', { class: 'faint small' }, t('sessionTypes.challengeHint'))),
        h('li', null, h('span', { class: 'small muted' }, t('sessionTypes.skillHint')))),
      data.settings.keyboardHints &&
        h('ul', { class: 'shortcuts hide-touch' },
          h('li', null, h('span', null, t('session.keys.answer')), Kbd('1–4')),
          h('li', null, h('span', null, t('session.keys.next')), Kbd(t('keys.enter'))),
          h('li', null, h('span', null, t('session.keys.start')), Kbd(t('keys.space'))),
          h('li', null, h('span', null, t('session.keys.pause')), Kbd(t('keys.esc')))));
  }

  function mistakesPanel(moduleId, data) {
    const t = DT.i18n.t;
    const list = progression.mistakesBySkill(data, moduleId).slice(0, 5);
    return Panel(
      { eyebrow: t('mistakes.eyebrow'), title: t('mistakes.title'), description: t('mistakes.desc') },
      list.length
        ? h('ul', { class: 'mini-list' },
            list.map((m) => h('li', null,
              h('a', { href: trainLink(moduleId, `type=skill&skill=${m.skill.id}`) }, t(`${moduleId}Skills.${m.skill.id}.name`)),
              h('span', { class: 'num faint' }, t('mistakes.count', { n: m.count })))))
        : h('p', { class: 'faint small' }, t('mistakes.none')));
  }

  // ---------------------------------------------------------------------------
  // Shared panels
  // ---------------------------------------------------------------------------

  /** Beginner → Expert ladder with the conditions for the next tier. */
  function tiers(status) {
    const t = DT.i18n.t;
    const hasPath = !!progression.PATHS[status.module.id];
    return Panel(
      { eyebrow: t('module.levelEyebrow'), title: t(`tiers.${status.tier.id}`), description: hasPath ? t('module.levelDescPath') : t('module.levelDesc') },
      h('ol', { class: 'tier-steps' },
        TIERS.map((tier, i) =>
          h('li', { class: `tier-step${i < status.index ? ' is-done' : i === status.index ? ' is-current' : ''}` },
            h('span', { class: 'tier-step__bar' }),
            h('span', { class: 'tier-step__name' }, t(`tiers.${tier.id}`))))),
      status.next
        ? h('div', { class: 'stack stack-3' },
            h('div', { class: 'row between' },
              h('span', { class: 'muted' }, t('module.nextTier'), ' ', h('strong', { class: 'ivory' }, t(`tiers.${status.next.id}`))),
              h('span', { class: 'figure rank-panel__pct' }, `${Math.round(status.progress * 100)} %`)),
            ProgressBar({ value: status.progress, label: t('module.nextTier') }),
            Requirements(status.requirements))
        : h('p', { class: 'muted' }, t('module.topTier')));
  }

  function metrics(status) {
    const t = DT.i18n.t;
    const sk = status.skill;
    const has = sk.questions > 0;
    return h('div', { class: 'grid-2' },
      StatTile({ label: t('stats.accuracy'), value: has ? fmt.percent(status.recent.accuracy) : null, unit: '%', hint: has ? t('stats.lastAnswers', { n: status.recent.count }) : t('stats.noAnswers') }),
      StatTile({ label: t('stats.avgSpeed'), value: has ? fmt.seconds(status.recent.avgMs, 1) : null, unit: 's', hint: t('stats.speedHint') }),
      StatTile({ label: t('stats.exercises'), value: fmt.integer(sk.questions), hint: t('stats.correctCount', { n: fmt.integer(sk.correct) }) }),
      StatTile({ label: t('stats.best'), value: sk.bestMs != null ? fmt.seconds(sk.bestMs) : null, unit: 's', hint: t('stats.bestHint') }));
  }

  /** Modules not built yet. */
  function soon(m) {
    const t = DT.i18n.t;
    return Panel(
      { className: 'daily', eyebrow: t('module.session') },
      h('div', { class: 'daily__art' }, ModuleArt(m.id)),
      h('h2', { class: 'daily__title' }, t(`modules.${m.id}.tagline`)),
      h('div', { class: 'flow' },
        REFLEX.map((step, i) => [
          i > 0 && h('span', { class: 'flow__sep', 'aria-hidden': 'true' }),
          h('span', { class: `flow__step${m.reflex.includes(step) ? ' is-key' : ''}` }, t(`reflex.${step}`)),
        ])),
      h('p', { class: 'muted small' }, t('module.soonText')),
      Button({ label: t('common.soon'), disabled: true, block: true, size: 'lg' }));
  }

  function render({ params, data }) {
    const t = DT.i18n.t;
    const m = byId[params.id];
    if (!m) return DT.views.notFound.render();

    const header = PageHeader({
      back: { href: '#/training', label: t('module.back') },
      eyebrow: t('module.eyebrow', { n: m.index }),
      title: t(`modules.${m.id}.name`),
      lead: t(`modules.${m.id}.description`),
    });

    if (m.available && progression.PATHS[m.id]) {
      const status = progression.tierStatus(data, m.id);
      return h('div', { class: 'view' }, header,
        h('div', { class: 'grid' },
          h('div', { class: 'span-7' }, skillsPanel(m.id, data)),
          h('div', { class: 'span-5 stack stack-4 order-first-narrow' },
            nextPanel(m.id, data),
            mistakesPanel(m.id, data),
            tiers(status))));
    }

    const status = m.skill ? progression.tierStatus(data, m.id) : null;
    return h('div', { class: 'view' }, header,
      h('div', { class: 'grid' },
        h('div', { class: 'span-7 stack stack-4' }, status && metrics(status), status && tiers(status)),
        h('div', { class: 'span-5 order-first-narrow' }, soon(m))));
  }

  DT.views.module = {
    title: ({ params }) => (byId[params.id] ? DT.i18n.t(`modules.${params.id}.name`) : DT.i18n.t('notFound.eyebrow')),
    render,
  };
})(window.DT);
