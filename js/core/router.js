(function (DT) {
  'use strict';

  /**
   * Minimal hash router: '#/training/holdem' matches '/training/:id'.
   * Hash routing keeps deep links working when opened from file://.
   */
  function createRouter({ routes, fallback, onRoute }) {
    const compiled = routes.map((route) => {
      const keys = [];
      const pattern = route.path
        .split('/')
        .map((part) => {
          if (part.startsWith(':')) { keys.push(part.slice(1)); return '([^/]+)'; }
          return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/');
      return { ...route, keys, regex: new RegExp(`^${pattern}/?$`) };
    });

    function currentPath() {
      const hash = window.location.hash.replace(/^#/, '');
      return hash.startsWith('/') ? hash : '/';
    }

    function resolve() {
      // '#/train/holdem?mode=speed&skill=kicker' → path '/train/holdem', query { mode, skill }
      const [path, search = ''] = currentPath().split('?');
      const query = Object.fromEntries(new URLSearchParams(search));
      for (const route of compiled) {
        const match = path.match(route.regex);
        if (match) {
          const params = { query };
          route.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });
          return onRoute({ route, params, path });
        }
      }
      return onRoute({ route: fallback, params: { query }, path });
    }

    function navigate(path) {
      if (currentPath() === path) resolve();
      else window.location.hash = path;
    }

    return {
      start() {
        window.addEventListener('hashchange', resolve);
        if (!window.location.hash || window.location.hash === '#/') window.location.replace('#/dashboard');
        else resolve();
      },
      navigate,
      refresh: resolve,
      currentPath,
    };
  }

  DT.core.router = { createRouter };
})(window.DT);
