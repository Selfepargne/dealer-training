(function (DT) {
  'use strict';

  /** Line icons on a 24px grid, 1.5 stroke, drawn for this app. */
  const PATHS = {
    dashboard:
      '<rect x="3.5" y="3.5" width="7" height="9" rx="1"/><rect x="13.5" y="3.5" width="7" height="5" rx="1"/><rect x="13.5" y="11.5" width="7" height="9" rx="1"/><rect x="3.5" y="15.5" width="7" height="5" rx="1"/>',
    training:
      '<rect x="4" y="5" width="10" height="14" rx="1.5" transform="rotate(-8 9 12)"/><path d="M13.5 5.2l4.9.9a1.5 1.5 0 0 1 1.2 1.7l-1.9 10.4a1.5 1.5 0 0 1-1.7 1.2l-2.2-.4"/><path d="M8.6 10.2l1.2 1.8-1.8 1.2-1.2-1.8z"/>',
    challenges:
      '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10"/><path d="M10 3h4"/><path d="M12 3v3.5"/><path d="M18.5 7l1.2-1.2"/>',
    progress:
      '<path d="M4 19.5h16"/><path d="M4 15l4.5-4.5 3.5 3 7-7.5"/><path d="M15 6h4v4"/>',
    settings:
      '<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
    streak: '<path d="M4 17l4-5 3.5 3L20 6"/><path d="M4 20.5h16"/>',
    hourglass: '<path d="M7 3.5h10"/><path d="M7 20.5h10"/><path d="M8 3.5c0 4.5 8 5 8 8.5s-8 4-8 8.5"/><path d="M16 3.5c0 4.5-8 5-8 8.5s8 4 8 8.5"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
    upload: '<path d="M12 15V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M5 19.5h14"/>',
    pause: '<path d="M9 6v12"/><path d="M15 6v12"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    flame: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 3-5.2 3.4-8.9 2.4 1.5 3.4 3.6 3.2 5.4 1-.6 1.6-1.6 1.8-2.8 1.6 1.6 3.6 3.6 3.6 6.3 0 3.2-2.4 5.6-6 5.6z"/>',
  };

  function Icon(name, className = '') {
    const tpl = document.createElement('template');
    tpl.innerHTML =
      `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ` +
      `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name] || ''}</svg>`;
    return tpl.content.firstChild;
  }

  /** Official academy logo (assets/logo-*.png): a small square image, never recoloured or cropped. */
  function Logo({ size = 36, className = '' } = {}) {
    const img = document.createElement('img');
    img.src = size > 48 ? 'assets/logo-256.png' : 'assets/logo-96.png';
    img.width = size;
    img.height = size;
    img.alt = '';
    img.decoding = 'async';
    img.className = `logo ${className}`.trim();
    return img;
  }

  DT.components.Icon = Icon;
  DT.components.Logo = Logo;
})(window.DT);
