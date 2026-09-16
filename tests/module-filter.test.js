/*
  Module page — level filter (Beginner · Intermediate · Advanced · Expert · Show all).
  Run:  node tests/module-filter.test.js

  The real module view is rendered with a tiny DOM stand-in (plain objects), so the tabs, the skill cards,
  their links and the tab clicks are the ones the app uses. The filter is presentation only: no statistic changes.
*/
const memory = {};
global.localStorage = { getItem: (k) => memory[k] ?? null, setItem: (k, v) => { memory[k] = v; }, removeItem: (k) => { delete memory[k]; } };
global.navigator = { language: 'fr-FR' };
global.document = { documentElement: {}, querySelector: () => null };
global.requestAnimationFrame = (fn) => fn();
global.window = { DT: { translations: {}, core: {}, data: {}, components: {}, exercises: {}, views: {} } };

// A minimal element: { tag, props, children } — enough to read classes, links, roles and click handlers.
function h(tag, props, ...children) {
  return { tag, props: props || {}, children: children.flat(Infinity).filter((c) => c != null && c !== false), addEventListener() {} };
}
window.DT.core.dom = { h };

const load = (files) => files.forEach((f) => require(f));
load(['../js/i18n/en.js', '../js/i18n/fr.js', '../js/core/i18n.js', '../js/core/format.js', '../js/core/storage.js',
  '../js/data/modules.js', '../js/data/holdem-skills.js', '../js/data/blackjack-skills.js', '../js/data/ranks.js', '../js/data/achievements.js', '../js/data/challenges.js']);

const KEY = window.DT.core.storage.KEY;
/** Profiles are loaded when state.js starts: fresh state for a given saved profile. */
function startWith(saved) {
  for (const k of Object.keys(memory)) delete memory[k];
  if (saved) memory[KEY] = JSON.stringify(saved);
  delete require.cache[require.resolve('../js/core/state.js')];
  delete require.cache[require.resolve('../js/core/progression.js')];
  delete require.cache[require.resolve('../js/views/module.js')];
  require('../js/core/state.js');
  require('../js/core/progression.js');
  // Display pieces used by the page: plain elements
  const C = window.DT.components;
  const el = (cls) => (props = {}, ...children) => h('div', { class: cls, ...props }, ...children);
  Object.assign(C, {
    Panel: ({ className, eyebrow, title, description }, ...children) => h('section', { class: `panel ${className || ''}` }, eyebrow, title, description, ...children),
    PageHeader: ({ title }) => h('header', { class: 'page-header' }, title),
    Button: ({ label, href }) => h('a', { class: 'btn', href }, label),
    TextLink: ({ label, href }) => h('a', { class: 'text-link', href }, label),
    StatTile: el('stat'), ModuleArt: () => h('div', { class: 'art' }), Icon: () => h('svg', {}), Kbd: (k) => h('kbd', {}, k),
    ProgressBar: () => h('div', { class: 'bar' }), Requirements: () => h('ul', { class: 'reqs' }),
  });
  require('../js/views/module.js');
  window.DT.i18n.setLanguage(window.DT.core.state.get().settings.language);
}

const render = () => window.DT.views.module.render({ params: { id: 'holdem' }, data: window.DT.core.state.get() });
function all(node, match, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (match(node)) out.push(node);
  (node.children || []).forEach((c) => all(c, match, out));
  return out;
}
const hasClass = (cls) => (n) => (n.props.class || '').split(' ').includes(cls);
const text = (n) => (typeof n === 'string' || typeof n === 'number' ? String(n) : (n.children || []).map(text).join(''));
const tabs = (page) => all(page, (n) => n.props.role === 'tab');
const activeTab = (page) => tabs(page).find((t) => t.props['aria-selected'] === 'true').props.dataset.filter;
const cards = (page) => all(page, hasClass('skill-card'));
const cardIds = (page) => cards(page).map((c) => new URLSearchParams(c.props.href.split('?')[1]).get('skill'));
const click = (page, filter) => tabs(page).find((t) => t.props.dataset.filter === filter).props.onClick();

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function equal(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const { SKILLS } = window.DT.data.holdemSkills;
const idsOf = (level) => SKILLS.filter((s) => level === 'all' || s.level === level).map((s) => s.id);

// ---------------------------------------------------------------------------

test('New profile: Beginner shown by default, with its 5 skills', () => {
  startWith(null);
  const page = render();
  equal(tabs(page).map((t) => t.props.dataset.filter), ['beginner', 'intermediate', 'advanced', 'expert', 'all'], 'tabs');
  equal(activeTab(page), 'beginner', 'active tab');
  equal(cardIds(page), ['hand_recognition', 'hand_comparison', 'table_setup', 'hand_flow', 'chips_bets'], 'beginner skills');
});

for (const level of ['beginner', 'intermediate', 'advanced', 'expert']) {
  test(`Selecting ${level}: only its skills are shown`, () => {
    startWith(null);
    click(render(), level);
    const page = render();
    equal(activeTab(page), level, 'active tab');
    equal(cardIds(page), idsOf(level), `${level} skills`);
    assert(tabs(page).filter((t) => t.props['aria-selected'] === 'true').length === 1, 'a single active tab');
  });
}

test('Show all: every skill of every level, level titles back', () => {
  startWith(null);
  click(render(), 'all');
  const page = render();
  equal(activeTab(page), 'all', 'active tab');
  equal(cardIds(page), idsOf('all'), 'all 16 skills, in the path order');
  equal(all(page, hasClass('skill-level__title')).map(text), ['Débutant', 'Intermédiaire', 'Avancé', 'Expert'], 'level titles');
});

test('No skill lost: the four levels together hold every skill exactly once', () => {
  startWith(null);
  const seen = [];
  for (const level of ['beginner', 'intermediate', 'advanced', 'expert']) {
    click(render(), level);
    seen.push(...cardIds(render()));
  }
  equal(seen.slice().sort(), SKILLS.map((s) => s.id).sort(), 'every skill once');
  const counts = tabs(render()).filter((t) => t.props.dataset.filter !== 'all').map((t) => Number(text(all(t, hasClass('level-tab__count'))[0])));
  equal(counts, [5, 5, 5, 1], 'counts shown on the tabs');
});

test('The choice is remembered in localStorage and comes back on the next visit', () => {
  startWith(null);
  click(render(), 'advanced');
  const saved = JSON.parse(memory[KEY]);
  equal(saved.settings.skillFilters, { holdem: 'advanced' }, 'saved with the profile');
  // Next visit: the app starts again from the saved data
  startWith(saved);
  equal(activeTab(render()), 'advanced', 'filter restored');
});

test('Old profile without a filter preference: safe default, nothing reset', () => {
  // A profile saved before the filter existed, with progress on the beginner path
  const skills = {};
  for (const id of idsOf('beginner')) skills[id] = { questions: 60, correct: 60, mistakes: 0, bestMs: 900, recent: Array.from({ length: 30 }, () => ({ c: 1, ms: 900, t: 5000 })), masteredAt: 1 };
  const old = { version: 2, settings: { language: 'fr', holdemPlayers: 'auto' }, stats: { xp: 4321, questions: 300, skills: { holdem: { questions: 300, correct: 300, tier: 1, recent: [], skills } }, mistakes: [{ module: 'holdem', skill: 'kicker' }] }, history: [{ module: 'holdem' }] };
  startWith(old);
  const page = render();
  equal(activeTab(page), 'intermediate', 'default: the level of the next skill to work on');
  const data = window.DT.core.state.get();
  equal([data.stats.xp, data.stats.questions, data.stats.skills.holdem.skills.hand_recognition.questions, data.stats.mistakes.length, data.history.length], [4321, 300, 60, 1, 1], 'statistics untouched');
  equal(data.settings.skillFilters, {}, 'no preference stored until the user chooses');
  // An unknown saved value falls back to the default
  startWith({ ...old, settings: { ...old.settings, skillFilters: { holdem: 'legendary' } } });
  equal(activeTab(render()), 'intermediate', 'invalid value ignored');
});

test('Filtering changes nothing but the display: statistics identical before and after', () => {
  startWith(null);
  const before = JSON.stringify(window.DT.core.state.get().stats);
  for (const level of ['intermediate', 'expert', 'all', 'beginner']) click(render(), level);
  equal(JSON.stringify(window.DT.core.state.get().stats), before, 'stats unchanged');
});

test('A skill card opens a session of that skill; the four session types still work', () => {
  startWith(null);
  click(render(), 'advanced');
  const page = render();
  const P = window.DT.core.progression;
  const data = window.DT.core.state.get();
  cards(page).forEach((c) => {
    assert(c.props.href.startsWith('#/train/holdem?type=skill&skill='), `link ${c.props.href}`);
    const skill = new URLSearchParams(c.props.href.split('?')[1]).get('skill');
    equal(P.sessionPlan(data, 'holdem', { type: 'skill', skill }), Array(20).fill(skill), `session of ${skill}`);
  });
  const links = all(page, (n) => typeof n.props.href === 'string').map((n) => n.props.href);
  ['#/train/holdem', '#/train/holdem?mode=speed', '#/train/holdem?type=mistakes', '#/train/holdem?type=challenge'].forEach((href) => assert(links.includes(href), `link ${href}`));
  equal(P.sessionPlan(data, 'holdem', { type: 'path' }).length, 20, 'path');
  equal(P.sessionPlan(data, 'holdem', { type: 'challenge', count: 10 }).length, 10, 'challenge');
});

test('French and English: tab labels', () => {
  startWith({ settings: { language: 'fr' } });
  equal(tabs(render()).map((t) => text(all(t, hasClass('level-tab__name'))[0])), ['Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Tout afficher'], 'FR');
  startWith({ settings: { language: 'en' } });
  equal(tabs(render()).map((t) => text(all(t, hasClass('level-tab__name'))[0])), ['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Show all'], 'EN');
});

test('Blackjack page unchanged: no tabs, every level listed', () => {
  startWith(null);
  const page = window.DT.views.module.render({ params: { id: 'blackjack' }, data: window.DT.core.state.get() });
  equal(tabs(page).length, 0, 'no tabs');
  equal(all(page, hasClass('skill-level')).length, 4, 'four levels');
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
