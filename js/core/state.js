/*
  All saved data lives in one object, stored in localStorage.

    DT.core.state.get()                 → read the data
    DT.core.state.update(d => { … })    → change it (saved automatically)
    DT.core.state.subscribe(fn)         → be told when it changes
*/
(function (DT) {
  'use strict';

  const { storage } = DT.core;
  const { MODULES, SKILLS } = DT.data.modules;

  function emptySkill() {
    return {
      questions: 0,
      correct: 0,
      totalMs: 0,
      bestMs: null,
      tier: 0,       // 0 beginner · 1 intermediate · 2 advanced · 3 expert
      recent: [],    // last 50 answers: { c: correct 0/1, f: fast 0/1, ms }
      skills: {},    // learning path, per skill id (see js/core/progression.js)
    };
  }

  function defaults() {
    return {
      version: 2,
      profile: { name: 'Farid' },
      settings: {
        language: DT.i18n.detect(),
        blackjackPayout: '3:2',
        flashExposureMs: 1000,
        holdemPlayers: 'auto', // Hold'em table size: 'auto' or 2 to 6
        skillFilters: {}, // module page: level shown per module ('beginner' … 'expert' or 'all')
        keyboardHints: true,
        motion: 'system', // 'system' | 'reduced' | 'full'
      },
      stats: {
        xp: 0,
        questions: 0,
        correct: 0,
        totalMs: 0,
        bestMs: null,
        under2s: 0,        // correct answers under 2 seconds
        currentStreak: 0,
        longestStreak: 0,
        trainingMs: 0,
        dailyDone: 0,
        recent: [],        // last 50 answers, all modules: { c, f, ms }
        mistakes: [],      // wrong answers: { module, skill, level, difficulty, mode, responseTime, at }
        rank: 0,           // index in DT.data.ranks — never goes down
        rankDates: { 0: Date.now() },
        skills: Object.fromEntries(SKILLS.map((m) => [m.id, emptySkill()])),
      },
      achievements: {},    // id → date earned
      daily: { date: null, done: false },
      history: [],         // finished sessions, most recent first
      lastModule: null,
    };
  }

  function isObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
  }

  /** Saved values win; keys added in a newer version get their default. */
  function merge(base, saved) {
    if (saved === undefined) return base;
    if (isObject(base)) {
      if (!isObject(saved)) return base;
      const out = { ...base };
      for (const key of Object.keys(saved)) out[key] = merge(base[key], saved[key]);
      return out;
    }
    if (Array.isArray(base) && !Array.isArray(saved)) return base;
    return saved;
  }

  function hydrate(saved) {
    if (!isObject(saved)) return defaults();
    const data = merge(defaults(), saved);
    data.version = 2;
    if (!MODULES.some((m) => m.id === data.lastModule)) data.lastModule = null;
    return data;
  }

  let data = hydrate(storage.load());
  const listeners = new Set();

  function save() {
    storage.save(data);
    listeners.forEach((fn) => fn(data));
  }

  DT.core.state = {
    get: () => data,

    update(change) {
      const result = change(data);
      save();
      return result;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Clears statistics, ranks and history. Keeps name and settings. */
    resetProgress() {
      data = { ...defaults(), profile: data.profile, settings: data.settings };
      save();
    },

    exportJSON: () => JSON.stringify(data, null, 2),

    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!isObject(parsed) || !isObject(parsed.stats)) throw new Error('invalid');
      data = hydrate(parsed);
      save();
    },
  };
})(window.DT);
