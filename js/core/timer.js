(function (DT) {
  'use strict';

  /**
   * Stopwatch for response times. Paused time is not counted.
   *   const w = createStopwatch(); w.start(); … w.pause(); w.elapsed() → ms
   */
  function createStopwatch() {
    let startedAt = null;
    let accumulated = 0;

    return {
      start() {
        if (startedAt == null) startedAt = performance.now();
      },
      pause() {
        if (startedAt != null) {
          accumulated += performance.now() - startedAt;
          startedAt = null;
        }
      },
      reset() {
        startedAt = null;
        accumulated = 0;
      },
      elapsed() {
        return accumulated + (startedAt != null ? performance.now() - startedAt : 0);
      },
    };
  }

  DT.core.timer = { createStopwatch };
})(window.DT);
