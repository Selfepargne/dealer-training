(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const fmt = DT.core.format;

  /** List of finished sessions (dashboard and progress page). */
  function HistoryList(items) {
    const t = DT.i18n.t;
    return h('ul', { class: 'history' },
      items.map((s) =>
        h('li', { class: 'history__item' },
          h('div', null,
            h('p', { class: 'history__title' },
              t(`modules.${s.module}.name`),
              s.type ? ` · ${t(`sessionTypes.${s.type}`)}` : ''),
            h('p', { class: 'history__when' },
              `${fmt.relativeDay(s.at)} · ${t('history.questions', { n: s.questions })}${s.xp ? ` · +${fmt.integer(s.xp)} XP` : ''}`)),
          h('span', { class: 'history__time faint num' }, s.avgMs != null ? `${fmt.seconds(s.avgMs)} s` : ''),
          h('span', { class: 'history__acc' }, s.questions ? `${fmt.percent(s.correct / s.questions)}%` : fmt.DASH))));
  }

  DT.components.HistoryList = HistoryList;
})(window.DT);
