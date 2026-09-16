/*
  Application start: routes, shell, language, redraw when data changes.
*/
(function (DT) {
  'use strict';

  const { dom, state, progression } = DT.core;
  const views = DT.views;

  const ROUTES = [
    { path: '/dashboard', view: views.dashboard },
    { path: '/training', view: views.training },
    { path: '/training/:id', view: views.module },
    { path: '/train/:id', view: views.session },
    { path: '/challenges', view: views.challenges },
    { path: '/progress', view: views.progress },
    { path: '/settings', view: views.settings },
  ];

  let shell = null;
  let current = null;     // current route match
  let screenEl = null;    // current screen element
  let language = null;

  function applySettings(data) {
    document.documentElement.dataset.motion = data.settings.motion;
    if (data.settings.language !== language) {
      language = data.settings.language;
      DT.i18n.setLanguage(language);
      shell = DT.components.createShell(document.getElementById('app'));
      return true; // shell rebuilt
    }
    return false;
  }

  function render({ route, params, path }, { focus }) {
    const view = route.view;

    const previous = screenEl;
    screenEl = null;
    if (previous && previous.cleanup) previous.cleanup();
    screenEl = view.render({ params, data: state.get() });
    if (focus) screenEl.classList.add('view-enter');
    dom.clear(shell.main).appendChild(screenEl);

    const title = typeof view.title === 'function' ? view.title({ params }) : DT.i18n.t(view.title);
    shell.setActive(path);
    shell.renderRank(progression.rankStatus(state.get()));
    document.title = `${title} · ${DT.i18n.t('app.name')}`;

    if (focus) {
      window.scrollTo(0, 0);
      shell.main.focus({ preventScroll: true });
      dom.announce(title);
    }
  }

  const router = DT.core.router.createRouter({
    routes: ROUTES,
    fallback: { path: '*', view: views.notFound },
    onRoute(match) {
      current = match;
      render(match, { focus: true });
    },
  });

  // Data changed: redraw the current screen, unless it manages itself (live: false).
  state.subscribe((data) => {
    const rebuilt = applySettings(data);
    if (!current) return;
    if (rebuilt || current.route.view.live !== false) {
      const y = window.scrollY;
      render(current, { focus: false });
      window.scrollTo(0, y);
    } else {
      shell.renderRank(progression.rankStatus(data));
    }
  });

  applySettings(state.get());
  router.start();

  DT.app = {
    /** Redraw the current screen from scratch (e.g. "train again"). */
    refresh() {
      if (current) render(current, { focus: false });
    },
  };
})(window.DT);
