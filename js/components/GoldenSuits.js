/*
  GoldenSuits — the signature of the application: a few champagne card suits floating very slowly behind the screens.

  One layer, built once by the shell, placed behind every block (the content is opaque, so the suits only ever
  show in the empty space). It carries no data, reads no state and never takes a click or the keyboard focus.

    GoldenSuits()        the layer: a fixed number of suits, each with its own size, speed, drift and opacity
    levelFor(path)       how lively a screen is: the shell puts it on the root, the stylesheet does the rest
                         hero · lively · normal · calm · subtle · still · none (exercises: no decoration at all)

  The CSS (css/decor.css) decides how many suits each level shows and freezes them when the reader asked for
  less motion (system preference or the in-app Motion setting).
*/
(function (DT) {
  'use strict';

  const { h } = DT.core.dom;

  const SUITS = ['♠', '♥', '♦', '♣'];
  /** The most suits a screen can show; the stylesheet hides the rest per level and per screen size. */
  const COUNT = 14;
  /** The gold dust that goes with them: smaller, faster, and just as cheap to run. */
  const GRAINS = 30;

  /**
   * How lively each screen is. Exercises get nothing: during a hand the student reads the table, not the decoration.
   * Screens that do not exist yet (statistics, leaderboard, resources) already have their level here.
   */
  const LEVELS = {
    dashboard: 'hero',
    training: 'normal',
    train: 'none',       // exercises and sessions
    challenges: 'lively',
    progress: 'calm',
    stats: 'subtle',
    leaderboard: 'subtle',
    resources: 'calm',
    settings: 'still',
  };

  /** The level of a route path ('#/train/holdem' → 'none'). Unknown screens stay calm. */
  function levelFor(path) {
    const section = String(path || '').split('/')[1];
    return LEVELS[section] || 'calm';
  }

  /** A small deterministic generator: the same layout at every reload, nothing to compute while it animates. */
  function numbers(seed) {
    let n = seed;
    return () => {
      n = (n * 1103515245 + 12345) % 2147483648;
      return n / 2147483648;
    };
  }

  /**
   * One suit: an outline of gold, its place, its size, how long it takes to drift, how visible it is.
   * The small ones get a thinner, cooler stroke: that is what gives the depth.
   * Most rise from below; the few that sink start above the screen, otherwise they would never show.
   */
  function suit(random, i) {
    const size = 18 + Math.round(random() * 54);      // 18 … 72 px
    const far = size < 34;                            // small ones read as far away
    const down = i % 5 === 0;                         // a few sink, for variety
    return h('span', {
      class: `suits__item${far ? ' suits__item--far' : ''}${down ? ' suits__item--down' : ''}`,
      style: {
        '--x': `${Math.round(random() * 100)}%`,
        '--size': `${size}px`,
        '--duration': `${Math.round(54 + random() * 66)}s`,   // 54 … 120 s: almost imperceptible
        '--delay': `${-Math.round(random() * 60)}s`,          // already under way when the screen opens
        '--drift': `${Math.round((random() - 0.5) * 90)}px`,
        '--spin': `${Math.round((random() - 0.5) * 16)}deg`,
        '--dim': (0.45 + random() * 0.45).toFixed(3),         // 0.45 … 0.90 — un trait, pas une surface
        '--way': down ? '-1' : '1',
      },
    }, SUITS[i % SUITS.length]);
  }

  /** One grain of gold dust: a point of light that twinkles as it rises. */
  function grain(random) {
    return h('span', {
      class: 'suits__grain',
      style: {
        '--x': `${Math.round(random() * 100)}%`,
        '--size': `${(1.4 + random() * 2).toFixed(1)}px`,
        '--halo': `${(3 + random() * 5).toFixed(1)}px`,
        '--duration': `${Math.round(52 + random() * 46)}s`,
        '--delay': `${-Math.round(random() * 90)}s`,
        '--drift': `${Math.round((random() - 0.5) * 60)}px`,
        '--spin': '0deg',
        '--dim': (0.35 + random() * 0.5).toFixed(3),
        '--way': '1',
      },
    });
  }

  function GoldenSuits() {
    const random = numbers(20260918);
    return h('div', { class: 'suits', 'aria-hidden': 'true' },
      Array.from({ length: COUNT }, (_, i) => suit(random, i)),
      Array.from({ length: GRAINS }, () => grain(random)));
  }

  DT.components.GoldenSuits = GoldenSuits;
  DT.components.GoldenSuits.levelFor = levelFor;
  DT.components.GoldenSuits.LEVELS = LEVELS;
  DT.components.GoldenSuits.COUNT = COUNT;
  DT.components.GoldenSuits.GRAINS = GRAINS;
})(window.DT);
