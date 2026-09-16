(function (DT) {
  'use strict';

  const { h } = DT.core.dom;

  /** Single-choice segmented control (radiogroup with roving arrow-key focus). */
  function Segmented({ label, options, value, onChange }) {
    const buttons = options.map((opt) =>
      h('button', {
        type: 'button',
        role: 'radio',
        class: 'segmented__opt',
        'aria-checked': String(opt.value === value),
        tabindex: opt.value === value ? '0' : '-1',
        onClick: () => select(opt.value, true),
      }, opt.label));

    function select(next, focus) {
      options.forEach((opt, i) => {
        const on = opt.value === next;
        buttons[i].setAttribute('aria-checked', String(on));
        buttons[i].tabIndex = on ? 0 : -1;
        if (on && focus) buttons[i].focus();
      });
      if (next !== value) { value = next; onChange(next); }
    }

    const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label }, buttons);
    group.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const i = options.findIndex((o) => o.value === value);
      select(options[(i + step + options.length) % options.length].value, true);
    });
    return group;
  }

  function Switch({ label, checked, onChange }) {
    const el = h('button', { type: 'button', role: 'switch', class: 'switch', 'aria-label': label, 'aria-checked': String(checked) });
    el.addEventListener('click', () => {
      checked = !checked;
      el.setAttribute('aria-checked', String(checked));
      onChange(checked);
    });
    return el;
  }

  function Range({ label, min, max, step, value, format, onChange }) {
    const output = h('output', null, format(value));
    const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
    input.addEventListener('input', () => { output.textContent = format(Number(input.value)); });
    input.addEventListener('change', () => onChange(Number(input.value)));
    return h('div', { class: 'range' }, input, output);
  }

  /** One labelled row of the settings list. */
  function SettingRow({ label, hint, control, id }) {
    return h('div', { class: 'setting' },
      h('div', null,
        h('p', { class: 'setting__label', id }, label),
        hint && h('p', { class: 'setting__hint' }, hint)),
      h('div', { class: 'setting__control' }, control));
  }

  DT.components.Segmented = Segmented;
  DT.components.Switch = Switch;
  DT.components.Range = Range;
  DT.components.SettingRow = SettingRow;
})(window.DT);
