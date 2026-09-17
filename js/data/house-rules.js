/*
  House rules — choices that differ from one casino to another. They are NOT universal poker rules:
  set them to the rules of your card room. Every question, answer and explanation follows them,
  and the explanations always present them as "the rule of this table".

  showdownOrder — who shows their cards first at the showdown (Hold'em › Déroulement de la main, stage 3)
    'lastAggressor'  the last player who bet or raised on the river shows first; if nobody bet on the river,
                     the first active player left of the button. Common card-room practice (e.g. the TDA rules),
                     used by default because no casino rule is defined for this project.
    'leftOfButton'   always the first active player left of the button, whatever the betting.
  Not covered by the questions: all-in players (hands are then tabled), side pots, a player mucking or showing out of turn.
*/
(function (DT) {
  'use strict';

  DT.data.houseRules = {
    showdownOrder: 'lastAggressor',
  };
})(window.DT);
