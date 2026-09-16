(function (DT) {
  'use strict';

  const { h, toast } = DT.core.dom;
  const fmt = DT.core.format;
  const state = DT.core.state;
  const { PageHeader, Panel, Button, Segmented, Switch, Range, SettingRow } = DT.components;

  function set(key, value) {
    state.update((d) => { d.settings[key] = value; });
  }

  function general(data) {
    const t = DT.i18n.t;
    const input = h('input', { class: 'input', type: 'text', value: data.profile.name, maxlength: '32', autocomplete: 'given-name', 'aria-labelledby': 'set-name' });
    input.addEventListener('change', () => {
      state.update((d) => { d.profile.name = input.value.trim(); });
      toast(t('settings.saved'));
    });

    return Panel(
      { eyebrow: t('settings.generalEyebrow'), title: t('settings.generalTitle') },
      h('div', { class: 'settings-group' },
        SettingRow({
          label: t('settings.language'),
          control: Segmented({
            label: t('settings.language'),
            value: data.settings.language,
            options: [{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }],
            onChange: (v) => set('language', v), // app.js redraws everything in the new language
          }),
        }),
        SettingRow({ id: 'set-name', label: t('settings.name'), hint: t('settings.nameHint'), control: input })));
  }

  function rules(data) {
    const t = DT.i18n.t;
    return Panel(
      { eyebrow: t('settings.rulesEyebrow'), title: t('settings.rulesTitle'), description: t('settings.rulesDesc') },
      h('div', { class: 'settings-group' },
        SettingRow({
          label: t('settings.blackjackPays'),
          hint: t('settings.blackjackHint'),
          control: Segmented({
            label: t('settings.blackjackPays'),
            value: data.settings.blackjackPayout,
            options: ['3:2', '6:5', '1:1'].map((v) => ({ value: v, label: v })),
            onChange: (v) => set('blackjackPayout', v),
          }),
        })));
  }

  function interfacePanel(data) {
    const t = DT.i18n.t;
    return Panel(
      { eyebrow: t('settings.interfaceEyebrow'), title: t('settings.interfaceTitle') },
      h('div', { class: 'settings-group' },
        SettingRow({
          label: t('settings.flash'),
          hint: t('settings.flashHint'),
          control: Range({
            label: t('settings.flash'),
            min: 300, max: 3000, step: 100,
            value: data.settings.flashExposureMs,
            format: (ms) => `${fmt.seconds(ms, 1)} s`,
            onChange: (v) => set('flashExposureMs', v),
          }),
        }),
        SettingRow({
          label: t('settings.hints'),
          hint: t('settings.hintsHint'),
          control: Switch({ label: t('settings.hints'), checked: data.settings.keyboardHints, onChange: (v) => set('keyboardHints', v) }),
        }),
        SettingRow({
          label: t('settings.motion'),
          hint: t('settings.motionHint'),
          control: Segmented({
            label: t('settings.motion'),
            value: data.settings.motion,
            options: ['system', 'reduced', 'full'].map((v) => ({ value: v, label: t(`settings.motionOptions.${v}`) })),
            onChange: (v) => set('motion', v),
          }),
        })));
  }

  function dataPanel() {
    const t = DT.i18n.t;
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try {
        state.importJSON(await file.text());
        DT.app.refresh();
        toast(t('settings.imported'));
      } catch (err) {
        toast(t('settings.importError'));
      }
      fileInput.value = '';
    });

    function exportData() {
      const blob = new Blob([state.exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: `dealer-training-${fmt.dayKey()}.json` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Two clicks instead of a confirmation dialog.
    let armedTimer = null;
    const reset = Button({ label: t('settings.reset'), variant: 'danger', size: 'sm' });
    const resetLabel = reset.querySelector('span');
    function disarm() {
      reset.classList.remove('is-armed');
      resetLabel.textContent = t('settings.reset');
    }
    reset.addEventListener('click', () => {
      if (!reset.classList.contains('is-armed')) {
        reset.classList.add('is-armed');
        resetLabel.textContent = t('settings.resetConfirm');
        armedTimer = setTimeout(disarm, 4000);
        return;
      }
      clearTimeout(armedTimer);
      disarm();
      state.resetProgress();
      toast(t('settings.resetDone'));
    });

    return Panel(
      { eyebrow: t('settings.dataEyebrow'), title: t('settings.dataTitle'), description: t('settings.dataDesc') },
      h('div', { class: 'settings-group' },
        SettingRow({
          label: t('settings.backup'),
          hint: t('settings.backupHint'),
          control: h('div', { class: 'row row-2 wrap' },
            Button({ label: t('settings.export'), variant: 'secondary', size: 'sm', icon: 'download', onClick: exportData }),
            Button({ label: t('settings.import'), variant: 'secondary', size: 'sm', icon: 'upload', onClick: () => fileInput.click() }),
            fileInput),
        }),
        SettingRow({ label: t('settings.reset'), hint: t('settings.resetHint'), control: reset })));
  }

  function render({ data }) {
    const t = DT.i18n.t;
    return h('div', { class: 'view stack stack-4', style: { maxWidth: '880px', marginLeft: '0' } },
      PageHeader({ eyebrow: t('nav.settings'), title: t('settings.title'), lead: t('settings.lead') }),
      general(data),
      rules(data),
      interfacePanel(data),
      dataPanel());
  }

  // Controls keep their own state; redrawing on each change would lose focus.
  DT.views.settings = { title: 'nav.settings', render, live: false };
})(window.DT);
