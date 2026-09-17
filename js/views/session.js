/*
  Training session screen — shared by every exercise module.

  Four session types, each playable in Practice or Speed:
    #/train/holdem                               PARCOURS   next skill of the path, review at the end
    #/train/holdem?type=skill&skill=kicker       COMPÉTENCE 100 % one skill
    #/train/holdem?type=mistakes                 MES ERREURS skills of recent mistakes
    #/train/holdem?type=challenge                DÉFI       10 questions within 60 seconds
  Add &mode=speed to preselect Speed.

  Practice: no clock, the answer is explained, "Why?" shows the details on demand.
  Speed:    clock, minimal feedback; a correct answer moves on by itself, a mistake shows the right answer.

  Keys: intro 1 Practice · 2 Speed · Enter/Space start — question 1–4 — Enter continue — Esc pause
*/
(function (DT) {
  'use strict';

  const { h, clear } = DT.core.dom;
  const fmt = DT.core.format;
  const state = DT.core.state;
  const progression = DT.core.progression;
  const { createStopwatch } = DT.core.timer;
  const { DAILY } = DT.data.challenges;
  const { byId } = DT.data.modules;
  const { Button, Kbd, Icon, ProgressBar, RankBadge, Requirements, Segmented, Logo } = DT.components;

  const AUTO_NEXT_MS = 650;  // Speed: pause after a correct answer
  const TYPES = ['path', 'skill', 'mistakes', 'challenge'];

  function render({ params }) {
    const t = DT.i18n.t;
    const query = params.query || {};

    // #/train/daily (older links, dashboard) = today's challenge on the last module played.
    const legacyDaily = params.id === 'daily';
    const lastModule = state.get().lastModule;
    const moduleId = legacyDaily ? (lastModule && byId[lastModule] && byId[lastModule].available && DT.exercises[lastModule] ? lastModule : 'holdem') : params.id;
    const exercise = DT.exercises[moduleId];
    const path = progression.PATHS[moduleId];
    if (!exercise || !path || !byId[moduleId].available) return DT.views.notFound.render();

    let type = legacyDaily ? 'challenge' : TYPES.includes(query.type) ? query.type : 'path';
    if (type === 'skill' && !(path.byId[query.skill] && path.byId[query.skill].available !== false)) type = 'path';
    const challenge = type === 'challenge';
    const total = challenge ? DAILY.questions : progression.SESSION_LENGTH;
    let mode = query.mode === 'speed' || (challenge && query.mode !== 'practice') ? 'speed' : 'practice';

    const moduleName = t(`modules.${moduleId}.name`);
    const skillName = (id) => t(`${moduleId}Skills.${id}.name`);
    const focusSkill = type === 'skill' ? query.skill : type === 'path' ? progression.nextSkill(state.get(), moduleId).skill.id : null;

    // ---- Session variables -------------------------------------------------
    let phase = 'intro'; // intro | question | answered | paused | summary
    let phaseBeforePause = null;
    let plan = [];
    let question = null;
    let screen = null;
    let number = 0;
    let sessionStreak = 0;
    let frame = null;
    let autoNext = null;
    let finished = false;
    const answers = [];
    const answerWatch = createStopwatch();
    const sessionWatch = createStopwatch();
    const session = { module: moduleId, type, mode, startedAt: null, questions: 0, correct: 0, totalMs: 0, xp: 0, bestStreak: 0 };
    const unlocked = { skills: [], ranks: [], tiers: [], achievements: [] };

    // ---- Frame ---------------------------------------------------------------
    const title = challenge ? `${moduleName} · ${t('sessionTypes.challenge')}` : moduleName;
    const counterEl = h('span', { class: 'session__count num' });
    const progressFill = h('span', { class: 'session__progress-fill' });
    const progressEl = h('div', { class: 'session__progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, hidden: true }, progressFill);
    const streakEl = h('span', { class: 'session__streak', 'aria-live': 'polite' });
    const timerEl = h('span', { class: 'session__timer', role: 'timer' });
    const pauseBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('session.pause'), onClick: togglePause }, Icon('pause'));
    const body = h('div', { class: 'session__body' });
    const overlay = h('div', { class: 'session__overlay', hidden: true });
    const exitHref = `#/training/${moduleId}`;

    const root = h('div', { class: 'view session' },
      h('header', { class: 'session__bar' },
        h('a', { class: 'icon-btn', href: exitHref, 'aria-label': t('session.quit'), title: t('session.quit') }, Icon('close')),
        h('div', { class: 'session__meta' }, Logo({ size: 26, className: 'session__logo' }), h('span', { class: 'session__title' }, title), counterEl),
        h('div', { class: 'session__right' }, streakEl, timerEl, pauseBtn)),
      progressEl,
      body,
      overlay);

    const clockVisible = () => challenge || mode === 'speed';

    function updateBar() {
      const inGame = number > 0 && phase !== 'summary';
      counterEl.textContent = inGame ? t('session.counter', { n: fmt.pad2(number), total }) : '';
      progressEl.hidden = !inGame;
      progressEl.setAttribute('aria-valuenow', number);
      progressFill.style.width = `${(Math.max(0, number - (phase === 'question' ? 1 : 0)) / total) * 100}%`;
      const showStreak = sessionStreak >= 3 && phase !== 'summary' && phase !== 'intro';
      streakEl.replaceChildren(...(showStreak ? [Icon('flame'), h('span', null, t('session.streak', { n: sessionStreak }))] : []));
      const playing = phase === 'question' || phase === 'answered' || phase === 'paused';
      pauseBtn.hidden = !(phase === 'question' || phase === 'answered');
      timerEl.hidden = !(playing && clockVisible());
    }

    // ---- Intro -----------------------------------------------------------------
    function showIntro() {
      phase = 'intro';
      const data = state.get();
      let heading;
      let text;
      let details = null;

      if (challenge) {
        heading = t('sessionTypes.challenge');
        text = t('daily.rules', { n: total, s: DAILY.timeLimitMs / 1000, xp: DAILY.xp });
        if (progression.dailyDoneToday(data)) details = h('p', { class: 'faint' }, t('daily.alreadyDone'));
      } else if (type === 'mistakes') {
        heading = t('sessionTypes.mistakes');
        const top = progression.mistakesBySkill(data, moduleId).filter((m) => m.skill.available !== false).slice(0, 3);
        text = top.length ? t('session.mistakesText') : t('session.noMistakes');
        if (top.length) {
          details = h('ul', { class: 'mini-list intro-skill' },
            top.map((m) => h('li', null, h('span', null, skillName(m.skill.id)), h('span', { class: 'num faint' }, t('mistakes.count', { n: m.count })))));
        }
      } else {
        const status = progression.skillStatus(data, moduleId, focusSkill);
        heading = skillName(focusSkill);
        text = t(`${moduleId}Skills.${focusSkill}.desc`);
        details = h('div', { class: 'stack stack-3 intro-skill' },
          h('span', { class: 'eyebrow' }, status.mastered ? t('skills.mastered') : t('skills.toMaster')),
          Requirements(status.requirements));
      }

      const modeButton = (value) =>
        h('button', { type: 'button', class: `mode-btn${mode === value ? ' is-default' : ''}`, onClick: () => start(value) },
          h('span', { class: 'mode-btn__name' }, t(`session.modes.${value}`)),
          h('span', { class: 'mode-btn__hint' }, t(`session.modeHint.${value}`)));

      // Table size (Hold'em): Auto follows the level of the skill; the choice is remembered.
      const tableChoice = exercise.TABLE_SIZES && (!focusSkill || exercise.hasTableSize(focusSkill)) &&
        h('div', { class: 'table-choice' },
          h('span', { class: 'eyebrow' }, t('session.tableSize')),
          Segmented({
            label: t('session.tableSize'),
            value: String(data.settings.holdemPlayers || 'auto'),
            options: [{ value: 'auto', label: t('session.tableAuto') }, ...exercise.TABLE_SIZES.map((n) => ({ value: String(n), label: String(n) }))],
            onChange: (v) => state.update((d) => { d.settings.holdemPlayers = v; }),
          }));

      clear(body).append(
        h('section', { class: 'session__intro' },
          h('span', { class: 'eyebrow eyebrow--accent' }, t(`sessionTypes.${type}`)),
          h('h1', { class: 'display session__intro-title' }, heading),
          h('p', { class: 'session__intro-text' }, text),
          details,
          tableChoice,
          h('div', { class: 'mode-choice', role: 'group', 'aria-label': t('session.mode') },
            modeButton('practice'),
            modeButton('speed')),
          h('p', { class: 'faint small hide-touch' }, t('session.introKeys'))));
      updateBar();
    }

    function start(chosenMode = mode) {
      if (phase !== 'intro') return;
      mode = chosenMode;
      session.mode = mode;
      plan = progression.sessionPlan(state.get(), moduleId, { type, skill: query.skill, count: total });
      session.startedAt = Date.now();
      sessionWatch.start();
      nextQuestion();
      frame = requestAnimationFrame(tick);
    }

    // ---- Question ----------------------------------------------------------------
    /** Challenge only: true once the 60 seconds are used up. */
    function timeIsUp() {
      return challenge && sessionWatch.elapsed() >= DAILY.timeLimitMs;
    }

    function nextQuestion() {
      clearTimeout(autoNext);
      if (number >= total || timeIsUp()) return finish();
      const players = exercise.playersFor ? exercise.playersFor(plan[number], state.get().settings.holdemPlayers) : undefined;
      question = exercise.create(plan[number], { players });
      number += 1;
      screen = exercise.view(question);
      phase = 'question';

      screen.buttons = screen.options.map((opt, i) =>
        h('button', { type: 'button', class: 'answer', dataset: { id: opt.id }, onClick: () => answer(opt.id) },
          h('span', { class: 'answer__key', 'aria-hidden': 'true' }, i + 1),
          h('span', { class: 'answer__label' }, opt.label)));

      screen.bottom = h('div', { class: 'exercise__bottom' },
        h('p', { class: 'exercise__prompt' }, screen.prompt),
        h('div', { class: `answers answers--${screen.options.length}`, role: 'group', 'aria-label': screen.prompt }, screen.buttons));

      clear(body).append(h('div', { class: `exercise exercise--${moduleId}` }, screen.stage, screen.bottom));
      answerWatch.reset();
      answerWatch.start();
      updateBar();
    }

    function answer(id) {
      if (phase !== 'question') return;
      if (timeIsUp()) return finish(); // too late: the answer does not count
      answerWatch.pause();
      const ms = answerWatch.elapsed();
      const rightId = exercise.correct(question);
      const isCorrect = id === rightId;
      if (!challenge && mode === 'speed') timerEl.textContent = fmt.stopwatch(ms);

      const result = state.update((d) => progression.recordAnswer(d, {
        module: moduleId,
        skill: question.skill,
        level: question.level,
        difficulty: question.difficulty,
        targetMs: question.targetMs,
        mode,
        hard: exercise.isHard(question),
        correct: isCorrect,
        ms,
      }));
      answers.push({ skill: question.skill, correct: isCorrect, ms, targetMs: question.targetMs });
      session.questions += 1;
      session.totalMs += ms;
      session.xp += result.xp;
      if (isCorrect) session.correct += 1;
      sessionStreak = isCorrect ? sessionStreak + 1 : 0;
      session.bestStreak = Math.max(session.bestStreak, sessionStreak);
      addUnlocked(result.unlocked);

      phase = 'answered';
      exercise.reveal(question, screen.stage);
      for (const btn of screen.buttons) {
        btn.disabled = true;
        if (btn.dataset.id === rightId) btn.classList.add('is-right');
        else if (btn.dataset.id === id) btn.classList.add('is-wrong');
      }

      const last = number >= total;
      const nextBtn = Button({ label: last ? t('session.results') : t('session.next'), arrow: true, onClick: nextQuestion });
      const actions = h('div', { class: 'feedback__actions' }, nextBtn, h('span', { class: 'faint hide-touch' }, Kbd(t('keys.enter'))));
      const verdict = h('span', { class: 'feedback__verdict' }, isCorrect ? t('session.correct') : t('session.incorrect'), ' ', isCorrect ? '✓' : '✗');
      const xp = result.xp > 0 && h('span', { class: 'feedback__xp num' }, `+${result.xp} XP`);
      let feedback;

      if (mode === 'speed') {
        const rightLabel = screen.options.find((o) => o.id === rightId).label;
        feedback = h('section', { class: `feedback feedback--quick ${isCorrect ? 'is-correct' : 'is-wrong'}` },
          h('div', { class: 'feedback__head' },
            verdict,
            h('span', { class: 'feedback__stat num' }, `${fmt.seconds(ms)} s`),
            isCorrect && result.fast && h('span', { class: 'feedback__fast is-fast' }, `${t('session.fast')} ✓`),
            xp),
          !isCorrect && h('div', { class: 'feedback__right' },
            h('span', { class: 'eyebrow' }, t('session.rightAnswer')),
            h('strong', null, rightLabel)),
          unlockNotes(result.unlocked),
          (!isCorrect || last) && actions);
      } else {
        const ex = exercise.explain(question);
        const whyBox = h('div', { class: 'why', hidden: true }, (ex.why || []).map(whyItem));
        const whyBtn = ex.why && ex.why.length && h('button', {
          type: 'button',
          class: 'why-btn',
          'aria-expanded': 'false',
          onClick: () => {
            whyBox.hidden = !whyBox.hidden;
            whyBtn.setAttribute('aria-expanded', String(!whyBox.hidden));
          },
        }, t('session.why'));

        feedback = h('section', { class: `feedback ${isCorrect ? 'is-correct' : 'is-wrong'}` },
          h('div', { class: 'feedback__head' }, verdict, h('span', { class: 'feedback__stat num' }, `${fmt.seconds(ms)} s`), xp),
          h('p', { class: 'feedback__headline' }, h('span', { class: 'feedback__mark', 'aria-hidden': 'true' }, '✓'), ex.headline),
          ex.hand && h('p', { class: 'feedback__hand' }, ex.hand),
          h('p', { class: 'feedback__detail' }, ex.short),
          whyBtn,
          whyBox,
          !isCorrect && h('p', { class: 'feedback__note' }, t('session.mistakeNoted')),
          unlockNotes(result.unlocked),
          actions);
      }

      screen.bottom.replaceChildren(feedback);
      if (isCorrect && sessionStreak >= 3) {
        streakEl.classList.remove('bump');
        void streakEl.offsetWidth; // restart the small animation
        streakEl.classList.add('bump');
      }
      updateBar();
      nextBtn.focus({ preventScroll: true });
      nextBtn.scrollIntoView({ block: 'nearest' }); // keep the button reachable on phones

      // Speed: a correct answer moves on by itself. A mistake waits for Enter.
      if (mode === 'speed' && isCorrect && !last) autoNext = setTimeout(() => { if (phase === 'answered') nextQuestion(); }, AUTO_NEXT_MS);
    }

    /** One line of the "Why?" box: a hand ({ label, cards, hand }), the result ({ result }) or a sentence. */
    function whyItem(item) {
      if (typeof item === 'string') return h('p', { class: 'why__line' }, item);
      if (item.result) return h('p', { class: 'why__result' }, item.result);
      return h('div', { class: 'why__hand' },
        h('span', { class: 'why__label' }, item.label),
        h('span', { class: 'why__cards num' }, item.cards),
        item.hand && h('span', { class: 'why__name' }, item.hand));
    }

    function addUnlocked(u) {
      for (const key of Object.keys(unlocked)) unlocked[key].push(...u[key]);
    }

    /** Short lines under the feedback: skill mastered, new rank, module tier, achievement. */
    function unlockNotes(u) {
      const lines = [
        ...u.skills.map((x) => t('unlock.skill', { skill: t(`${x.module}Skills.${x.skill}.name`) })),
        ...u.ranks.map((id) => t('unlock.rank', { rank: t(`ranks.${id}.name`) })),
        ...u.tiers.map((x) => t('unlock.tier', { module: t(`modules.${x.module}.name`), tier: t(`tiers.${x.tier}`) })),
        ...u.achievements.map((id) => t('unlock.achievement', { name: t(`achievements.${id}.name`) })),
      ];
      return lines.length ? h('ul', { class: 'unlocks' }, lines.map((line) => h('li', null, line))) : null;
    }

    // ---- Clock -----------------------------------------------------------------
    function tick() {
      if (challenge) {
        const remaining = Math.max(0, DAILY.timeLimitMs - sessionWatch.elapsed());
        timerEl.textContent = fmt.stopwatch(remaining);
        timerEl.classList.toggle('is-low', remaining < 10000);
        if (remaining === 0 && (phase === 'question' || phase === 'answered')) return finish();
      } else if (phase === 'question' && mode === 'speed') {
        const ms = answerWatch.elapsed();
        timerEl.textContent = fmt.stopwatch(ms);
        timerEl.classList.toggle('is-low', ms > question.targetMs);
      }
      frame = requestAnimationFrame(tick);
    }

    // ---- Pause -------------------------------------------------------------------
    function togglePause() {
      if (phase === 'paused') return resume();
      if (phase !== 'question' && phase !== 'answered') return;
      clearTimeout(autoNext);
      phaseBeforePause = phase;
      phase = 'paused';
      answerWatch.pause();
      sessionWatch.pause();
      root.classList.add('is-paused');
      overlay.hidden = false;
      overlay.replaceChildren(
        h('div', { class: 'pause', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('session.paused') },
          h('p', { class: 'display pause__title' }, t('session.paused')),
          h('p', { class: 'muted' }, t('session.pausedHint')),
          h('div', { class: 'row row-3 wrap', style: { justifyContent: 'center' } },
            Button({ label: t('session.resume'), onClick: resume }),
            Button({ label: t('session.quit'), variant: 'secondary', href: exitHref }))));
      overlay.querySelector('button').focus();
      updateBar();
    }

    function resume() {
      if (phase !== 'paused') return;
      phase = phaseBeforePause;
      sessionWatch.start();
      if (phase === 'question') answerWatch.start();
      root.classList.remove('is-paused');
      overlay.hidden = true;
      updateBar();
      const next = body.querySelector('.feedback__actions .btn');
      if (next) next.focus({ preventScroll: true });
    }

    // ---- End ---------------------------------------------------------------------
    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(autoNext);
      cancelAnimationFrame(frame);
      answerWatch.pause();
      sessionWatch.pause();
      const completed = challenge && session.questions >= total;
      const res = state.update((d) => progression.recordSession(d, { ...session, durationMs: sessionWatch.elapsed(), completed }));
      session.xp += res.bonusXp;
      addUnlocked(res.unlocked);
      showSummary({ completed, bonusXp: res.bonusXp });
    }

    function showSummary({ completed, bonusXp }) {
      phase = 'summary';
      const data = state.get();
      const report = progression.sessionReport(data, moduleId, answers);
      const status = progression.rankStatus(data);
      const heading = challenge ? (completed ? t('daily.success') : t('daily.timeUp')) : t('session.done');
      const pct = (x) => (x == null ? fmt.DASH : `${fmt.percent(x)} %`);
      const sec = (x) => (x == null ? fmt.DASH : `${fmt.seconds(x)} s`);

      const figures = [
        [t('stats.accuracy'), pct(report.accuracy)],
        [t('summary.average'), sec(report.avgMs)],
        [t('summary.best'), sec(report.bestMs)],
        ['XP', `+${fmt.integer(session.xp)}`],
        [t('stats.bestStreak'), fmt.integer(session.bestStreak)],
      ];

      const advice = report.advice;
      const adviceLink = advice.skill && advice.key !== 'mastered'
        ? `#/train/${moduleId}?type=skill&skill=${advice.skill}${advice.key === 'speed' ? '&mode=speed' : ''}`
        : null;
      const adviceBtn = adviceLink && Button({ label: t(`advice.button.${advice.key}`, { skill: skillName(advice.skill) }), arrow: true, href: adviceLink });

      clear(body).append(
        h('section', { class: 'summary' },
          h('span', { class: 'eyebrow eyebrow--accent' }, `${t(`sessionTypes.${type}`)} · ${t(`session.modes.${mode}`)}`),
          h('h1', { class: 'display summary__title' }, heading),
          h('p', { class: 'muted' },
            t('session.summaryLine', { correct: session.correct, total: session.questions }),
            bonusXp ? ` · ${t('daily.bonus', { xp: bonusXp })}` : ''),
          h('dl', { class: 'summary__figures' },
            figures.map(([label, value]) => h('div', null, h('dt', { class: 'eyebrow' }, label), h('dd', { class: 'figure' }, value)))),
          unlockNotes(unlocked),
          h('div', { class: 'summary__columns' },
            advice.key !== 'none' && h('div', { class: 'summary__block advice' },
              h('span', { class: 'eyebrow eyebrow--accent' }, t('summary.focusNext')),
              advice.key !== 'mastered' && h('p', { class: 'advice__skill' }, skillName(advice.skill)),
              h('p', { class: 'advice__text' }, t(`advice.${advice.key}`, { skill: skillName(advice.skill) })),
              adviceBtn),
            report.practiced.length > 0 && h('div', { class: 'summary__block' },
              h('span', { class: 'eyebrow' }, t('summary.practiced')),
              h('ul', { class: 'mini-list' },
                report.practiced.map((p) =>
                  h('li', null,
                    h('span', null, skillName(p.skill)),
                    h('span', { class: 'num faint' }, `${t('summary.questions', { n: p.count })} · ${fmt.percent(p.accuracy)} %`)))))),
          h('div', { class: 'row row-3 wrap' },
            Button({ label: t('session.again'), variant: adviceBtn ? 'secondary' : 'primary', onClick: () => DT.app.refresh() }),
            Button({ label: t('module.back'), variant: 'secondary', href: exitHref })),
          h('a', { class: 'summary__rank', href: '#/progress' },
            RankBadge(status.level, { size: 44, state: 'current' }),
            h('div', { class: 'grow stack stack-2' },
              h('span', { class: 'summary__rank-name' }, t(`ranks.${status.rank.id}.name`)),
              ProgressBar({ value: status.progress, label: t('rank.progress') }),
              h('span', { class: 'faint small' }, status.next
                ? t('rank.nextShort', { rank: t(`ranks.${status.next.id}.name`), pct: Math.round(status.progress * 100) })
                : t('rank.top'))))));
      if (adviceBtn) adviceBtn.focus({ preventScroll: true });
      timerEl.hidden = true;
      updateBar();
    }

    // ---- Keyboard ------------------------------------------------------------------
    function onKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key;

      if (key === 'Escape') { event.preventDefault(); togglePause(); return; }

      // A focused button or link already reacts to Enter/Space on its own.
      if ((key === 'Enter' || key === ' ') && event.target.closest && event.target.closest('button, a, input')) return;

      if (phase === 'intro') {
        if (key === '1' || key === '2') { event.preventDefault(); start(key === '1' ? 'practice' : 'speed'); }
        else if (key === ' ' || key === 'Enter') { event.preventDefault(); start(); }
        return;
      }
      if (phase === 'question' && /^[1-9]$/.test(key)) {
        const option = screen.options[Number(key) - 1];
        if (option) { event.preventDefault(); answer(option.id); }
        return;
      }
      if (phase === 'answered' && (key === 'Enter' || key === ' ')) { event.preventDefault(); nextQuestion(); return; }
      if (phase === 'paused' && key === ' ') { event.preventDefault(); resume(); return; }
      if (phase === 'summary' && key === 'Enter') { event.preventDefault(); DT.app.refresh(); }
    }

    document.addEventListener('keydown', onKey);

    /** Called by app.js when leaving this screen. Stopped sessions still count. */
    root.cleanup = function () {
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(frame);
      clearTimeout(autoNext);
      if (session.startedAt && !finished && session.questions > 0) {
        finished = true;
        sessionWatch.pause();
        state.update((d) => progression.recordSession(d, { ...session, durationMs: sessionWatch.elapsed(), completed: false }));
      }
    };

    showIntro();
    return root;
  }

  DT.views.session = {
    title: ({ params }) => DT.i18n.t(`modules.${params.id === 'daily' ? 'holdem' : params.id}.name`),
    render,
    live: false,
  };
})(window.DT);
