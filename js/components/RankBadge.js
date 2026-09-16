(function (DT) {
  'use strict';

  /*
    Rank insignia: the level number inside a frame that grows richer by stage.
      levels 1–4   single ring
      levels 5–9   double ring
      levels 10–13 ring + diamond
      levels 14–18 double ring + diamond
    state: 'earned' | 'current' | 'locked'
  */
  function RankBadge(level, { size = 48, state = 'earned' } = {}) {
    const stage = level <= 4 ? 1 : level <= 9 ? 2 : level <= 13 ? 3 : 4;
    const parts = ['<circle cx="24" cy="24" r="22.5" />'];
    if (stage === 2 || stage === 4) parts.push('<circle cx="24" cy="24" r="19" />');
    if (stage >= 3) parts.push('<path d="M24 6.5 41.5 24 24 41.5 6.5 24Z" />');

    const tpl = document.createElement('template');
    tpl.innerHTML =
      `<svg class="rank-badge rank-badge--${state}" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">` +
      `<g fill="none" stroke="currentColor" stroke-width="1">${parts.join('')}</g>` +
      `<text x="24" y="24" text-anchor="middle" dominant-baseline="central">${Number(level)}</text>` +
      '</svg>';
    return tpl.content.firstChild;
  }

  /** Small seal used for achievements. */
  function AchievementSeal({ earned }) {
    const tpl = document.createElement('template');
    tpl.innerHTML =
      `<svg class="seal${earned ? ' is-earned' : ''}" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">` +
      '<circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" stroke-width="1"/>' +
      '<path d="M20 10 26 20 20 30 14 20Z" fill="' + (earned ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1"/>' +
      '</svg>';
    return tpl.content.firstChild;
  }

  DT.components.RankBadge = RankBadge;
  DT.components.AchievementSeal = AchievementSeal;
})(window.DT);
