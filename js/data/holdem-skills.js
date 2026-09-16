/*
  Texas Hold'em learning path — 2 players.
  Names and descriptions are in js/i18n/*.js under "holdemSkills.<id>".

  level      — beginner · intermediate · advanced · expert
  difficulty — position in the path (1 = easiest)
  targetMs   — target response time; used for "fast" answers, Speed mode and mastery

  A skill is MASTERED when all three conditions are met (see MASTERY below).
  Once mastered, it stays mastered.
*/
(function (DT) {
  'use strict';

  const SKILLS = [
    // Beginner — obvious situations
    { id: 'hand_recognition', level: 'beginner', difficulty: 1, targetMs: 3000 },
    { id: 'simple_winner', level: 'beginner', difficulty: 2, targetMs: 3000 },
    { id: 'pair_vs_pair', level: 'beginner', difficulty: 3, targetMs: 3500 },
    { id: 'two_pair', level: 'beginner', difficulty: 4, targetMs: 4000 },
    { id: 'trips', level: 'beginner', difficulty: 5, targetMs: 4000 },

    // Intermediate — close comparisons
    { id: 'kicker', level: 'intermediate', difficulty: 6, targetMs: 4000 },
    { id: 'straight', level: 'intermediate', difficulty: 7, targetMs: 4000 },
    { id: 'flush', level: 'intermediate', difficulty: 8, targetMs: 4000 },
    { id: 'full_house', level: 'intermediate', difficulty: 9, targetMs: 4000 },
    { id: 'board_pair', level: 'intermediate', difficulty: 10, targetMs: 4500 },

    // Advanced — the board matters
    { id: 'board_plays', level: 'advanced', difficulty: 11, targetMs: 4500 },
    { id: 'straight_on_board', level: 'advanced', difficulty: 12, targetMs: 4500 },
    { id: 'flush_on_board', level: 'advanced', difficulty: 13, targetMs: 4500 },
    { id: 'full_house_on_board', level: 'advanced', difficulty: 14, targetMs: 4500 },
    { id: 'complex_kicker', level: 'advanced', difficulty: 15, targetMs: 5000 },

    // Expert — close calls and splits, under a short target time
    { id: 'close_calls', level: 'expert', difficulty: 16, targetMs: 3500 },
  ];

  /** Mastery: enough practice, accurate, and fast — measured on the last 30 answers of the skill. */
  const MASTERY = { exercises: 50, accuracy: 0.9, window: 30 };

  const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

  DT.data.holdemSkills = { SKILLS, MASTERY, LEVELS, byId: Object.fromEntries(SKILLS.map((s) => [s.id, s])) };
})(window.DT);
