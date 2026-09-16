(function (DT) {
  'use strict';

  const { h } = DT.core.dom;

  /**
   * Accessible progress bar. The fill animates from 0 on mount.
   * @param {{ value: number, label: string, thin?: boolean, tone?: 'ivory' }} props value in 0..1
   */
  function ProgressBar({ value, label, thin = false, tone }) {
    const pct = Math.round(Math.min(1, Math.max(0, value || 0)) * 100);
    const fill = h('span', { class: 'bar__fill' });
    const bar = h(
      'div',
      {
        class: ['bar', thin && 'bar--thin', tone && `bar--${tone}`].filter(Boolean).join(' '),
        role: 'progressbar',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': pct,
      },
      fill
    );
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${pct}%`; }));
    return bar;
  }

  DT.components.ProgressBar = ProgressBar;
})(window.DT);
