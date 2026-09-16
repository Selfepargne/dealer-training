/*
  Challenge formats. Texts are in js/i18n/*.js under "challenges.<id>".
  These formats are built in phase 8; only the daily challenge is playable now.
*/
(function (DT) {
  'use strict';

  const CHALLENGES = [
    { id: 'sixty', figure: '60', unit: 'sec' },
    { id: 'endless', figure: '∞', unit: '' },
    { id: 'speed', figure: '20', unit: 'q' },
    { id: 'reflex', figure: '1.0', unit: 'sec' },
  ];

  const EXAM = { id: 'exam', questions: 50, minutes: 15, disciplines: 5 };

  /** Daily challenge: 10 exercises within 60 seconds, once per day. */
  const DAILY = { questions: 10, timeLimitMs: 60000, xp: 50 };

  DT.data.challenges = { CHALLENGES, EXAM, DAILY };
})(window.DT);
