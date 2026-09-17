/*
  Design explorations — the small toolkit shared by the simulations.

    SUITS            the four suits as SVG paths (24 × 24), drawn for this brand: sober, a little narrow
    glyph(name, o)   one suit as an <svg> string, so each variant can paint it its own way
    rng(seed)        the same composition at every reload, as in the application
    stages(paint)    builds the two screens (desktop + phone) with a ghost of the real interface
                     and calls paint(layer, kind) to fill the decoration layer of each one
    pause()          wires the Pause button of the page header

  Nothing here is loaded by the application.
*/
window.DX = (function () {
  'use strict';

  // ?bare=1 : only the mock, no heading and no notes — that is what a comparison page embeds
  if (location.search.indexOf('bare') > -1) document.documentElement.classList.add('bare');

  const SUITS = {
    spade: 'M12 2.4C12 2.4 4.9 7.7 4.9 12.2c0 2.5 1.9 4.2 4.1 4.2 1.2 0 2.2-.4 2.8-1.2-.2 2.6-1.2 4.5-2.7 5.5h5.8c-1.5-1-2.5-2.9-2.7-5.5.6.8 1.6 1.2 2.8 1.2 2.2 0 4.1-1.7 4.1-4.2C19.1 7.7 12 2.4 12 2.4z',
    heart: 'M12 20.9S3.4 15.6 3.4 9.9C3.4 7.1 5.5 5.1 8 5.1c1.8 0 3.2 1 4 2.4.8-1.4 2.2-2.4 4-2.4 2.5 0 4.6 2 4.6 4.8 0 5.7-8.6 11-8.6 11z',
    diamond: 'M12 2.1l7.2 9.9L12 21.9 4.8 12z',
    club: 'M12 2.5c-2.1 0-3.8 1.7-3.8 3.8 0 .7.2 1.4.5 2-.5-.3-1.2-.5-1.9-.5-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c1.2 0 2.2-.5 2.9-1.4-.1 2.4-1.1 4.2-2.5 5.2h9.6c-1.4-1-2.4-2.8-2.5-5.2.7.9 1.7 1.4 2.9 1.4 2.1 0 3.8-1.7 3.8-3.8s-1.7-3.8-3.8-3.8c-.7 0-1.4.2-1.9.5.3-.6.5-1.3.5-2 0-2.1-1.7-3.8-3.8-3.8z',
  };
  const NAMES = ['spade', 'heart', 'diamond', 'club'];

  /** One suit as SVG. `o.cls` goes on the svg, `o.fill` / `o.stroke` on the path. */
  function glyph(name, o) {
    const p = o || {};
    const attrs = [`viewBox="0 0 24 24"`, `aria-hidden="true"`, p.cls ? `class="${p.cls}"` : ''].filter(Boolean).join(' ');
    const path = [`d="${SUITS[name]}"`, p.fill ? `fill="${p.fill}"` : '', p.stroke ? `stroke="${p.stroke}"` : '',
      p.width ? `stroke-width="${p.width}"` : '', p.extra || ''].filter(Boolean).join(' ');
    return `<svg ${attrs}><path ${path}/></svg>`;
  }

  /** The deterministic generator of the application: the same layout at every reload. */
  function rng(seed) {
    let n = seed;
    return () => { n = (n * 1103515245 + 12345) % 2147483648; return n / 2147483648; };
  }

  const pick = (random, list) => list[Math.floor(random() * list.length) % list.length];
  const between = (random, a, b) => a + random() * (b - a);

  /** The ghost of the dashboard: enough of the real interface to judge the decoration in place. */
  function ghost(kind) {
    const side = kind === 'phone' ? '' : `
      <div class="ui__side">
        <div class="ui__brand"><span class="ui__mark">DT</span><span class="ui__name">Dealer Training<small>Académie</small></span></div>
        <div class="ui__nav"><span>Tableau de bord</span><span>Entraînement</span><span>Défis</span><span>Progression</span><span>Réglages</span></div>
      </div>`;
    return `<div class="ui">${side}
      <div class="ui__body">
        <p class="ui__date">Jeudi 17 septembre</p>
        <h2 class="ui__h1">Bonsoir, Farid</h2>
        <p class="ui__sub">Prêt pour votre prochaine session ?</p>
        <span class="ui__cta">Continuer l’entraînement →</span>
        <div class="ui__tiles">
          <div class="ui__tile"><span>XP</span><b>0</b></div>
          <div class="ui__tile"><span>Série</span><b>—</b></div>
          <div class="ui__tile"><span>Précision</span><b>—</b></div>
        </div>
      </div></div>`;
  }

  /** The two screens, each with its own decoration layer. */
  function stages(paint, host) {
    const mount = host || document.getElementById('stages');
    mount.className = 'screens';
    mount.innerHTML = ['desktop', 'phone'].map((kind) =>
      `<div class="screen screen--${kind}"><div class="layer" data-kind="${kind}"></div>${ghost(kind)}</div>`).join('');
    mount.querySelectorAll('.layer').forEach((layer) => paint(layer, layer.dataset.kind));
  }

  /** Pause: the same switch for every animation of the page, to look at a still frame. */
  function pause(button) {
    const b = button || document.querySelector('[data-pause]');
    if (!b) return;
    b.addEventListener('click', () => {
      const on = document.body.dataset.paused === 'true';
      document.body.dataset.paused = on ? 'false' : 'true';
      b.setAttribute('aria-pressed', on ? 'false' : 'true');
      b.textContent = on ? 'Pause' : 'Reprendre';
    });
  }

  /** The intensity switch: what would ship · the chosen level · a demonstration of the material. */
  function gain(button) {
    const b = button || document.querySelector('[data-gain]');
    if (!b) return;
    const steps = [['normal', 'Intensité · juste'], ['demo', 'Intensité · démonstration'], ['sober', 'Intensité · sobre']];
    let i = 0;
    b.textContent = steps[0][1];
    b.addEventListener('click', () => {
      i = (i + 1) % steps.length;
      document.body.dataset.gain = steps[i][0];
      b.textContent = steps[i][1];
      b.setAttribute('aria-pressed', String(i !== 0));
    });
  }

  /** A place in the empty part of a screen: the greeting and the button keep their own room. */
  function spot(random, kind) {
    const safe = kind === 'phone' ? { x: 68, y: 46 } : { x: 32, y: 50 };
    for (let i = 0; i < 24; i++) {
      const x = Math.round(random() * 92);
      const y = Math.round(random() * 86);
      if (x > safe.x || y > safe.y) return { x, y };
    }
    return { x: 80, y: 70 };
  }

  /** Draws a mock at its true width (1440) and scales it down to the page: the proportions stay honest. */
  function fit(host, width) {
    const child = host.firstElementChild;
    if (!child) return;
    const apply = () => {
      const room = host.parentElement.clientWidth;
      const s = Math.min(1, room / width);
      child.style.width = width + 'px';
      child.style.transform = 'scale(' + s + ')';
      host.style.height = Math.ceil(child.offsetHeight * s) + 'px';
    };
    apply();
    window.addEventListener('resize', apply);
    setTimeout(apply, 400);   // once the display font has loaded
  }

  return { SUITS, NAMES, glyph, rng, pick, between, stages, pause, gain, spot, ghost, fit };
})();
