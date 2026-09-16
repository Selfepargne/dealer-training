/*
  Overall ranks, from New Dealer (level 1) to Master of the Table (level 18).
  Names and quotes are in js/i18n/*.js under "ranks.<id>".

  To reach a rank, ALL its conditions must be met:
    xp       — total experience points
    accuracy — % correct over your last 50 answers
    fast     — % of your last 50 answers that were correct AND under the module's target time
    streak   — best run of correct answers in a row
    skills   — number of modules at a given tier ('advanced' or 'expert')

  A rank, once reached, is never lost.
*/
(function (DT) {
  'use strict';

  const RANKS = [
    { id: 'new_dealer' },
    { id: 'trainee', xp: 100 },
    { id: 'junior_trainee', xp: 300, accuracy: 70 },
    { id: 'dealer_trainee', xp: 600, accuracy: 75 },
    { id: 'probationary', xp: 1000, accuracy: 80, fast: 25 },
    { id: 'junior_dealer', xp: 1600, accuracy: 82, fast: 35 },
    { id: 'dealer', xp: 2500, accuracy: 85, fast: 45, streak: 10 },
    { id: 'confirmed', xp: 3600, accuracy: 86, fast: 50, streak: 15 },
    { id: 'experienced', xp: 5000, accuracy: 88, fast: 55, streak: 20 },
    { id: 'senior', xp: 7000, accuracy: 90, fast: 60, streak: 25 },
    { id: 'lead', xp: 9500, accuracy: 90, fast: 65, streak: 30, skills: { tier: 'advanced', count: 1 } },
    { id: 'specialist', xp: 12500, accuracy: 92, fast: 68, streak: 35, skills: { tier: 'advanced', count: 2 } },
    { id: 'expert', xp: 16000, accuracy: 93, fast: 72, streak: 40, skills: { tier: 'advanced', count: 3 } },
    { id: 'master', xp: 20500, accuracy: 94, fast: 75, streak: 50, skills: { tier: 'advanced', count: 5 } },
    { id: 'elite', xp: 26000, accuracy: 95, fast: 78, streak: 60, skills: { tier: 'expert', count: 2 } },
    { id: 'distinguished', xp: 32500, accuracy: 95, fast: 80, streak: 75, skills: { tier: 'expert', count: 3 } },
    { id: 'grand_master', xp: 40000, accuracy: 96, fast: 83, streak: 90, skills: { tier: 'expert', count: 4 } },
    { id: 'master_of_table', xp: 50000, accuracy: 97, fast: 85, streak: 100, skills: { tier: 'expert', count: 5 } },
  ];

  DT.data.ranks = RANKS;
})(window.DT);
