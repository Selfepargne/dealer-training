/*
  Achievements. Names and descriptions are in js/i18n/*.js under "achievements.<id>".

  check(data, session) returns true when the achievement is earned.
  `session` is only given at the end of a session (otherwise null).
*/
(function (DT) {
  'use strict';

  const skill = (data, id) => data.stats.skills[id];

  const ACHIEVEMENTS = [
    { id: 'first_deal', check: (d) => d.stats.questions >= 1 },
    { id: 'quick_hands', check: (d) => d.stats.under2s >= 10 },
    { id: 'no_mistakes', check: (d) => d.stats.longestStreak >= 25 },
    { id: 'perfect_table', check: (d, s) => !!s && s.questions >= 20 && s.correct === s.questions },
    { id: 'early_shift', check: (d, s) => !!s && s.questions >= 10 && new Date(s.startedAt).getHours() < 9 },
    { id: 'daily_routine', check: (d) => d.stats.dailyDone >= 1 },
    { id: 'poker_instinct', check: (d) => skill(d, 'holdem').correct >= 50 },
    { id: 'blackjack_eye', check: (d) => skill(d, 'blackjack').correct >= 50 },
    { id: 'chip_master', check: (d) => skill(d, 'chips').questions >= 100 },
  ];

  DT.data.achievements = ACHIEVEMENTS;
})(window.DT);
