/*
  Translations.
    DT.i18n.t('dashboard.continue')              → "Continuer l'entraînement"
    DT.i18n.t('session.streak', { n: 14 })       → "14 d'affilée"
  Texts live in js/i18n/fr.js and js/i18n/en.js (same keys in both files).
*/
(function (DT) {
  'use strict';

  const LANGUAGES = ['fr', 'en'];
  let current = 'en';

  function detect() {
    return (navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  }

  function setLanguage(lang) {
    current = LANGUAGES.includes(lang) ? lang : 'en';
    document.documentElement.lang = current;
  }

  function lookup(dictionary, key) {
    return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dictionary);
  }

  function t(key, vars) {
    let text = lookup(DT.translations[current], key);
    if (text === undefined) text = lookup(DT.translations.en, key);
    if (text === undefined) {
      console.warn('[i18n] missing text:', key);
      return key;
    }
    if (typeof text === 'string' && vars) {
      text = text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? vars[name] : match));
    }
    return text;
  }

  /** Locale used to format numbers and dates. */
  function locale() {
    return current === 'fr' ? 'fr-FR' : 'en-GB';
  }

  DT.i18n = {
    LANGUAGES,
    detect,
    setLanguage,
    t,
    locale,
    get language() { return current; },
  };
})(window.DT);
