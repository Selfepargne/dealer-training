(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const progression = DT.core.progression;
  const { CHALLENGES, EXAM, DAILY } = DT.data.challenges;
  const { PageHeader, Panel, Button, Badge, ModuleArt } = DT.components;

  function daily(data) {
    const t = DT.i18n.t;
    const done = progression.dailyDoneToday(data);
    return Panel(
      { className: 'exam' },
      h('div', { class: 'stack stack-5' },
        h('div', { class: 'row row-3 wrap' },
          h('span', { class: 'eyebrow eyebrow--accent' }, t('daily.title')),
          done ? Badge(t('daily.done'), 'positive') : Badge(`+${DAILY.xp} XP`, 'accent')),
        h('h2', { class: 'display challenge__heading' }, t('daily.format', { n: DAILY.questions, s: DAILY.timeLimitMs / 1000 })),
        h('p', { class: 'muted' }, t('daily.rules', { n: DAILY.questions, s: DAILY.timeLimitMs / 1000, xp: DAILY.xp })),
        h('div', null, Button({ label: done ? t('daily.replay') : t('daily.start'), variant: done ? 'secondary' : 'accent', size: 'lg', arrow: true, href: '#/train/daily' }))),
      h('div', { class: 'daily__art daily__art--plain' }, ModuleArt('holdem')));
  }

  function card(c) {
    const t = DT.i18n.t;
    return Panel(
      { className: 'challenge', eyebrow: t(`challenges.${c.id}.name`), action: Badge(t('common.soon')) },
      h('div', { class: 'challenge__figure' },
        h('span', { class: 'figure' }, c.figure),
        c.unit && h('span', { class: 'muted' }, c.unit)),
      h('p', { class: 'muted' }, t(`challenges.${c.id}.summary`)));
  }

  function exam() {
    const t = DT.i18n.t;
    return Panel(
      { eyebrow: t('challenges.exam.eyebrow'), title: t('challenges.exam.name'), description: t('challenges.exam.summary'), action: Badge(t('common.soon')) },
      h('div', { class: 'exam__figures' },
        [[EXAM.questions, t('challenges.exam.questions')], [EXAM.minutes, t('challenges.exam.minutes')], [EXAM.disciplines, t('challenges.exam.disciplines')]].map(([v, l]) =>
          h('div', { class: 'stack stack-2' }, h('span', { class: 'figure' }, v), h('span', { class: 'eyebrow' }, l)))));
  }

  function render({ data }) {
    const t = DT.i18n.t;
    return h('div', { class: 'view stack stack-4' },
      PageHeader({ eyebrow: t('nav.challenges'), title: t('challenges.title'), lead: t('challenges.lead') }),
      daily(data),
      h('div', { class: 'grid stagger' }, CHALLENGES.map((c) => h('div', { class: 'span-3' }, card(c)))),
      exam());
  }

  DT.views.challenges = { title: 'nav.challenges', render };
})(window.DT);
