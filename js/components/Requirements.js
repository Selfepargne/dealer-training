(function (DT) {
  'use strict';

  const { h } = DT.core.dom;
  const fmt = DT.core.format;
  const { Icon } = DT.components;

  /**
   * Checklist of conditions (next rank, module tier, skill mastery):
   *   ✓ 50 exercises           52
   *   ✓ 90 % accuracy          91 %
   *   ○ Under 3.0 s on average 3.1 s
   */
  function Requirements(list) {
    const t = DT.i18n.t;

    function texts(r) {
      switch (r.key) {
        case 'accuracy':
        case 'fast':
          return [t(`req.${r.key}`, { target: fmt.percent(r.target) }), `${fmt.percent(r.current)} %`];
        case 'speed':
          return [t('req.speed', { target: fmt.seconds(r.target, 1) }), r.current == null ? fmt.DASH : `${fmt.seconds(r.current, 1)} s`];
        case 'skills':
          return [t('req.skills', { target: fmt.integer(r.target), tier: t(`tiers.${r.tier}`) }), fmt.integer(r.current)];
        case 'levelSkills':
          return [t('req.levelSkills', { target: fmt.integer(r.target), level: t(`tiers.${r.level}`) }), `${fmt.integer(r.current)} / ${fmt.integer(r.target)}`];
        default:
          return [t(`req.${r.key}`, { target: fmt.integer(r.target) }), fmt.integer(r.current)];
      }
    }

    return h('ul', { class: 'reqs' },
      list.map((r) => {
        const [label, current] = texts(r);
        return h('li', { class: `req${r.met ? ' is-met' : ''}` },
          h('span', { class: 'req__mark' }, r.met ? Icon('check') : null),
          h('span', { class: 'req__label' }, label),
          h('span', { class: 'req__current num' }, current),
          h('span', { class: 'sr-only' }, r.met ? t('req.met') : t('req.notMet')));
      }));
  }

  DT.components.Requirements = Requirements;
})(window.DT);
