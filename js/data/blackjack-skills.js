/*
  Blackjack learning path — dealer skills, not player strategy.
  Names and descriptions are in js/i18n/*.js under "blackjackSkills.<id>".

  What a dealer must do at the table: recognise, count, announce, compare, pay, run the table.

  Each skill:
    level      — beginner · intermediate · advanced · expert
    difficulty — position in the path (1 = easiest)
    targetMs   — target response time ("fast" answers, Speed mode, mastery)
    phase      — build phase: A (now), B (payouts), C (full table)
    exercise   — what the screen asks
    errors     — the typical mistakes this skill trains against

  Table rules used everywhere (defined once, in js/modules/blackjack/engine.js):
    dealer stands on all 17s · blackjack payout from Settings (3:2, 6:5 or 1:1) · insurance pays 2:1

  Mastery: same rule as every module — 50 exercises, 90 % accuracy, average under the target time,
  measured on the last 30 answers. Once mastered, always mastered.
*/
(function (DT) {
  'use strict';

  const SKILLS = [
    // ---- Beginner — read a hand ----------------------------------------------------
    {
      id: 'card_values', level: 'beginner', difficulty: 1, targetMs: 1500, phase: 'A',
      exercise: 'One card → its value (Ace: 1 or 11).',
      errors: ['face card not counted as 10', 'ace given a single value'],
    },
    {
      id: 'hard_totals', level: 'beginner', difficulty: 2, targetMs: 2500, phase: 'A',
      exercise: '2 to 4 cards without an ace → total.',
      errors: ['addition slip of 1 or 2', 'face card miscounted'],
    },
    {
      id: 'aces', level: 'beginner', difficulty: 3, targetMs: 3000, phase: 'A',
      exercise: 'A hand with one or two aces → best total.',
      errors: ['ace kept at 11 and the hand busts', 'ace counted as 1 when 11 fits', 'two aces both counted as 11'],
    },
    {
      id: 'soft_hard', level: 'beginner', difficulty: 4, targetMs: 3000, phase: 'A',
      exercise: 'A hand → soft or hard, and its total.',
      errors: ['hand called soft although the ace must count 1', 'hand without an ace called soft'],
    },
    {
      id: 'blackjack_bust', level: 'beginner', difficulty: 5, targetMs: 2500, phase: 'A',
      exercise: 'A hand → Blackjack, 21, Bust or under 21.',
      errors: ['three-card 21 called blackjack', 'soft hand called bust', 'bust missed'],
    },

    // ---- Intermediate — compare and pay one hand -----------------------------------------
    {
      id: 'outcome', level: 'intermediate', difficulty: 6, targetMs: 3000, phase: 'A',
      exercise: 'Player hand against the dealer’s final hand → Win, Lose or Push.',
      errors: ['player bust paid because the dealer busts too', 'blackjack against a three-card 21 called push', 'push missed'],
    },
    {
      id: 'dealer_hand', level: 'intermediate', difficulty: 7, targetMs: 3500, phase: 'B',
      exercise: 'Dealer draws to 17 → final total or bust.',
      errors: ['dealer hits a soft 17', 'dealer stops before 17'],
    },
    {
      id: 'simple_payout', level: 'intermediate', difficulty: 8, targetMs: 3000, phase: 'B',
      exercise: 'Bet and result → amount paid.',
      errors: ['push paid', 'bet returned counted as winnings'],
    },
    {
      id: 'double', level: 'intermediate', difficulty: 9, targetMs: 3500, phase: 'B',
      exercise: 'Doubled bet → amount paid.',
      errors: ['original bet paid instead of the doubled bet'],
    },
    {
      id: 'blackjack_payout', level: 'intermediate', difficulty: 10, targetMs: 3500, phase: 'B',
      exercise: 'Blackjack on a bet → payout at the table ratio.',
      errors: ['paid 1:1', 'wrong ratio (3:2 vs 6:5)', 'half-euro rounding'],
    },

    // ---- Advanced — special bets -----------------------------------------------------------
    {
      id: 'split', level: 'advanced', difficulty: 11, targetMs: 4500, phase: 'B',
      exercise: 'Split hands with separate results → total paid.',
      errors: ['one hand forgotten', 'split 21 paid as blackjack'],
    },
    {
      id: 'insurance', level: 'advanced', difficulty: 12, targetMs: 4000, phase: 'B',
      exercise: 'Insurance bet and dealer result → amount paid or taken.',
      errors: ['insurance paid 1:1', 'insurance paid when the dealer has no blackjack'],
    },
    {
      id: 'multiple_hands', level: 'advanced', difficulty: 13, targetMs: 5000, phase: 'C',
      exercise: 'Several hands of one player → net result.',
      errors: ['wins and losses not offset'],
    },
    {
      id: 'multiple_players', level: 'advanced', difficulty: 14, targetMs: 6000, phase: 'C',
      exercise: 'Several players → who wins, loses, pushes.',
      errors: ['seat skipped', 'push treated as a loss'],
    },
    {
      id: 'table_payout', level: 'advanced', difficulty: 15, targetMs: 7000, phase: 'C',
      exercise: 'Whole table → total the dealer pays.',
      errors: ['losing bets added to the payout', 'blackjack paid 1:1'],
    },

    // ---- Expert — full table under time ---------------------------------------------------
    {
      id: 'complex_totals', level: 'expert', difficulty: 16, targetMs: 5000, phase: 'C',
      exercise: 'Mixed payouts, doubles and blackjacks → exact amounts.',
      errors: ['cents and half-euros'],
    },
    {
      id: 'full_table', level: 'expert', difficulty: 17, targetMs: 8000, phase: 'C',
      exercise: 'Seven seats, every kind of result → table payout.',
      errors: ['any of the above, under load'],
    },
    {
      id: 'speed_dealer', level: 'expert', difficulty: 18, targetMs: 4000, phase: 'C',
      exercise: 'Everything above, short target time.',
      errors: ['speed over accuracy'],
    },
  ];

  /** Build phases currently playable. Add 'B', then 'C', as they are built. */
  const AVAILABLE_PHASES = ['A'];
  SKILLS.forEach((s) => { s.available = AVAILABLE_PHASES.includes(s.phase); });

  const MASTERY = { exercises: 50, accuracy: 0.9, window: 30 };
  const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

  DT.data.blackjackSkills = { SKILLS, MASTERY, LEVELS, AVAILABLE_PHASES, byId: Object.fromEntries(SKILLS.map((s) => [s.id, s])) };
})(window.DT);
