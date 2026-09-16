(function (DT) {
  'use strict';

  const DASH = '—';
  const locale = () => DT.i18n.locale();

  function number(n, digits = 0) {
    if (n == null || !isFinite(n)) return DASH;
    return Number(n).toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  /** 0.8732 → "87" */
  function percent(ratio, digits = 0) {
    if (ratio == null || !isFinite(ratio)) return DASH;
    return number(ratio * 100, digits);
  }

  /** 1823 → "1.82" (en) / "1,82" (fr) */
  function seconds(ms, digits = 2) {
    if (ms == null || !isFinite(ms)) return DASH;
    return number(ms / 1000, digits);
  }

  /** Stopwatch display: 1823 → "01.82" */
  function stopwatch(ms) {
    const s = Math.min(99.99, ms / 1000);
    const [whole, cents] = s.toFixed(2).split('.');
    return `${whole.padStart(2, '0')}${locale() === 'fr-FR' ? ',' : '.'}${cents}`;
  }

  /** Training time → { value, unit } */
  function duration(ms) {
    const totalMin = Math.floor(Math.max(0, ms || 0) / 60000);
    if (totalMin < 60) return { value: String(totalMin), unit: 'min' };
    const hours = Math.floor(totalMin / 60);
    return { value: `${hours}h${String(totalMin % 60).padStart(2, '0')}`, unit: '' };
  }

  function integer(n) {
    return number(n, 0);
  }

  function longDate(date = new Date()) {
    return date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function shortDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function relativeDay(timestamp) {
    const d = new Date(timestamp);
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
    const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
    if (diff === 0) return `${DT.i18n.t('time.today')} · ${time}`;
    if (diff === 1) return `${DT.i18n.t('time.yesterday')} · ${time}`;
    return `${d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} · ${time}`;
  }

  /** Local calendar day, e.g. "2026-09-16". */
  function dayKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function greeting(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return DT.i18n.t('greeting.morning');
    if (hour >= 12 && hour < 18) return DT.i18n.t('greeting.afternoon');
    return DT.i18n.t('greeting.evening');
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  DT.core.format = { DASH, number, percent, seconds, stopwatch, duration, integer, longDate, shortDate, relativeDay, dayKey, greeting, pad2 };
})(window.DT);
