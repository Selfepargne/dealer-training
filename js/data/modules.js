/*
  Training modules. Texts (names, descriptions) are in js/i18n/*.js under "modules.<id>".

  available — true when the exercise can be played
  targetMs  — reference response time; an answer at or under it counts as "fast"
  reflex    — which of the five reflexes the module trains most
*/
(function (DT) {
  'use strict';

  const REFLEX = ['see', 'recognize', 'calculate', 'decide', 'respond'];

  const MODULES = [
    { id: 'holdem', index: '01', skill: true, available: true, targetMs: 5000, reflex: ['see', 'recognize', 'decide'] },
    { id: 'blackjack', index: '02', skill: true, available: true, targetMs: 2500, reflex: ['see', 'calculate', 'respond'] },
    { id: 'chips', index: '03', skill: true, available: false, targetMs: 4000, reflex: ['see', 'recognize', 'calculate'] },
    { id: 'math', index: '04', skill: true, available: false, targetMs: 3000, reflex: ['calculate', 'respond'] },
    { id: 'table', index: '05', skill: true, available: false, targetMs: 5000, reflex: ['see', 'recognize', 'decide'] },
    { id: 'mixed', index: '06', skill: false, available: false, targetMs: null, reflex: REFLEX },
  ];

  /*
    Module tiers: Beginner → Intermediate → Advanced → Expert.
    Measured on the module's last 50 answers. A tier, once reached, is kept.
      correct  — total correct answers in the module
      accuracy — % correct over the last 50 answers
      fast     — % of the last 50 answers that were correct AND under the target time
  */
  const TIERS = [
    { id: 'beginner' },
    { id: 'intermediate', correct: 50, accuracy: 80, fast: 0 },
    { id: 'advanced', correct: 200, accuracy: 88, fast: 50 },
    { id: 'expert', correct: 500, accuracy: 94, fast: 75 },
  ];

  const byId = Object.fromEntries(MODULES.map((m) => [m.id, m]));
  const SKILLS = MODULES.filter((m) => m.skill);

  DT.data.modules = { REFLEX, MODULES, SKILLS, TIERS, byId };
})(window.DT);
