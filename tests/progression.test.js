/*
  Progression tests: XP, mistakes, skill mastery, tiers, session plans, end-of-session advice.
  Run:  node tests/progression.test.js
*/
global.window = { DT: { translations: {}, core: {}, data: {}, components: {}, exercises: {}, views: {} } };
global.navigator = { language: 'fr-FR' };
const memory = {};
global.localStorage = { getItem: (k) => memory[k] ?? null, setItem: (k, v) => { memory[k] = v; }, removeItem: (k) => { delete memory[k]; } };

for (const f of [
  '../js/core/i18n.js', '../js/core/format.js', '../js/core/storage.js',
  '../js/data/modules.js', '../js/data/holdem-skills.js', '../js/data/blackjack-skills.js', '../js/data/ranks.js', '../js/data/achievements.js', '../js/data/challenges.js',
  '../js/core/state.js', '../js/core/progression.js',
]) require(f);

const { state, progression: P } = window.DT.core;
const { SKILLS, MASTERY } = window.DT.data.holdemSkills;

const results = [];
function test(name, fn) {
  state.resetProgress(); // every test starts from empty data
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function equal(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const skill = (id) => SKILLS.find((s) => s.id === id);
function answer(skillId, correct, ms, extra = {}) {
  const s = skill(skillId);
  return state.update((d) => P.recordAnswer(d, {
    module: 'holdem', skill: s.id, level: s.level, difficulty: s.difficulty, targetMs: s.targetMs,
    hard: s.difficulty >= 6, mode: 'practice', correct, ms, ...extra,
  }));
}
const data = () => state.get();

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

test('XP: correct + fast on a beginner skill = 15', () => {
  const r = answer('pair_vs_pair', true, 1000);
  equal(r.parts.map((p) => p.key), ['correct', 'fast'], 'parts');
  equal(r.xp, 15, 'xp');
  equal(data().stats.xp, 15, 'total');
});

test('XP: correct but slow on an intermediate skill = correct + hard', () => {
  const r = answer('kicker', true, 9000);
  equal(r.parts.map((p) => p.key), ['correct', 'hard'], 'parts');
  equal(r.xp, 25, 'xp');
});

test('XP: the target time is the skill target, not the module default', () => {
  // hand_recognition target 3.0 s: 3.5 s is not fast even though the module default is 5 s
  equal(answer('hand_recognition', true, 3500).fast, false, 'fast');
  equal(answer('hand_recognition', true, 2900).fast, true, 'fast');
});

test('XP: +10 on every 10th correct answer in a row', () => {
  let last;
  for (let i = 0; i < 10; i++) last = answer('pair_vs_pair', true, 5000);
  assert(last.parts.some((p) => p.key === 'streak'), 'streak bonus');
});

// ---------------------------------------------------------------------------
// Mistakes
// ---------------------------------------------------------------------------

test('A mistake is logged with module, skill, level, difficulty, mode and time', () => {
  answer('kicker', true, 2000);
  const xpBefore = data().stats.xp;
  const r = answer('kicker', false, 4210);
  equal(r.xp, 0, 'no XP');
  equal(data().stats.xp, xpBefore, 'XP never removed');
  equal(data().stats.currentStreak, 0, 'streak reset');
  const m = data().stats.mistakes[0];
  equal([m.module, m.skill, m.level, m.difficulty, m.mode, m.responseTime], ['holdem', 'kicker', 'intermediate', 6, 'practice', 4.21], 'mistake');
});

test('Mistakes are counted per skill, most frequent first', () => {
  for (let i = 0; i < 4; i++) answer('kicker', false, 3000);
  for (let i = 0; i < 2; i++) answer('straight_on_board', false, 3000);
  answer('two_pair', false, 3000);
  equal(P.mistakesBySkill(data(), 'holdem').map((m) => [m.skill.id, m.count]), [['kicker', 4], ['straight_on_board', 2], ['two_pair', 1]], 'counts');
});

// ---------------------------------------------------------------------------
// Mastery
// ---------------------------------------------------------------------------

test(`Mastery needs ${MASTERY.exercises} exercises — 49 perfect answers are not enough`, () => {
  for (let i = 0; i < 49; i++) answer('trips', true, 1000);
  const s = P.skillStatus(data(), 'holdem', 'trips');
  assert(!s.mastered, 'not mastered');
  equal(s.requirements.map((r) => [r.key, r.met]), [['exercises', false], ['accuracy', true], ['speed', true]], 'requirements');
  const r = answer('trips', true, 1000);
  assert(P.skillStatus(data(), 'holdem', 'trips').mastered, 'mastered at 50');
  equal(r.unlocked.skills, [{ module: 'holdem', skill: 'trips' }], 'unlock reported once');
});

test('Mastery needs accuracy — 85 % is not enough', () => {
  for (let i = 0; i < 60; i++) answer('flush', i % 7 !== 0, 1000); // ~86 %
  const s = P.skillStatus(data(), 'holdem', 'flush');
  assert(!s.mastered, 'not mastered');
  assert(s.requirements.find((r) => r.key === 'accuracy').met === false, 'accuracy not met');
});

test('Mastery needs speed — accurate but slow is "not mastered yet"', () => {
  for (let i = 0; i < 60; i++) answer('kicker', true, 4500); // target 4.0 s
  const s = P.skillStatus(data(), 'holdem', 'kicker');
  assert(!s.mastered, 'not mastered');
  equal(s.requirements.map((r) => r.met), [true, true, false], 'only speed missing');
  assert(Math.abs(s.progress - (1 + 1 + 4000 / 4500) / 3) < 1e-9, `progress ${s.progress}`);
  equal(s.state, 'almost', 'state');
});

test('Mastery is never lost, and nothing goes down after mistakes', () => {
  for (let i = 0; i < 50; i++) answer('trips', true, 1000);
  const before = { xp: data().stats.xp, rank: data().stats.rank };
  for (let i = 0; i < 40; i++) answer('trips', false, 9000);
  const s = P.skillStatus(data(), 'holdem', 'trips');
  assert(s.mastered && s.state === 'mastered' && s.progress === 1, 'still mastered');
  assert(s.accuracy === 0, 'recent accuracy still shown honestly');
  equal([data().stats.xp, data().stats.rank], [before.xp, before.rank], 'xp and rank kept');
});

test('Speed mastery uses each question target: a 6-player table allows more time', () => {
  // kicker target 4.0 s at 2 players, +0.7 s per extra player → 6.8 s at 6 players
  for (let i = 0; i < 50; i++) answer('kicker', true, 6000, { targetMs: 4000 + 4 * 700 });
  const s = P.skillStatus(data(), 'holdem', 'kicker');
  assert(s.mastered, '6.0 s average at 6 players is under the 6.8 s target');
});

test('Skill states: new → learning → progressing', () => {
  equal(P.skillStatus(data(), 'holdem', 'flush').state, 'new', 'new');
  answer('flush', true, 1000);
  equal(P.skillStatus(data(), 'holdem', 'flush').state, 'progressing', 'one fast correct answer: 2 of 3 conditions met');
  answer('straight', false, 9000);
  equal(P.skillStatus(data(), 'holdem', 'straight').state, 'learning', 'learning');
});

test('Module tier follows the path: Intermediate once all Beginner skills are mastered', () => {
  const beginner = SKILLS.filter((s) => s.level === 'beginner');
  beginner.slice(0, -1).forEach((s) => { for (let i = 0; i < 50; i++) answer(s.id, true, 1000); });
  equal(data().stats.skills.holdem.tier, 0, 'still beginner');
  const status = P.tierStatus(data(), 'holdem');
  equal([status.requirements[0].key, status.requirements[0].current, status.requirements[0].target], ['levelSkills', 4, 5], 'condition');
  const tierUps = [];
  for (let i = 0; i < 50; i++) tierUps.push(...answer(beginner[4].id, true, 1000).unlocked.tiers);
  equal(data().stats.skills.holdem.tier, 1, 'intermediate');
  equal(tierUps, [{ module: 'holdem', tier: 'intermediate' }], 'tier-up reported once');
  equal(P.nextSkill(data(), 'holdem').skill.id, 'kicker', 'next skill');
});

// ---------------------------------------------------------------------------
// Session plans
// ---------------------------------------------------------------------------

test('Path plan on a new profile: 20 questions of the first skill', () => {
  const plan = P.sessionPlan(data(), 'holdem', { type: 'path' });
  equal(plan.length, 20, 'length');
  assert(plan.every((id) => id === 'hand_recognition'), 'first skill only (nothing to review yet)');
});

test('Path plan later on: 15 on the next skill first, then 5 review of earlier skills', () => {
  for (const id of ['hand_recognition', 'simple_winner']) for (let i = 0; i < 50; i++) answer(id, true, 1000);
  const plan = P.sessionPlan(data(), 'holdem', { type: 'path' });
  assert(plan.slice(0, 15).every((id) => id === 'pair_vs_pair'), 'main block first');
  assert(plan.slice(15).every((id) => ['hand_recognition', 'simple_winner'].includes(id)), 'review at the end');
  equal(plan.length, 20, 'length');
});

test('Skill session: 100 % the chosen skill — even when mastered', () => {
  equal(P.sessionPlan(data(), 'holdem', { type: 'skill', skill: 'kicker' }), Array(20).fill('kicker'), 'kicker only');
  for (let i = 0; i < 50; i++) answer('trips', true, 1000);
  assert(P.skillStatus(data(), 'holdem', 'trips').mastered, 'mastered');
  equal(P.sessionPlan(data(), 'holdem', { type: 'skill', skill: 'trips' }), Array(20).fill('trips'), 'mastered skills can still be practised');
});

test('Train my mistakes: the session follows recent mistakes', () => {
  for (let i = 0; i < 8; i++) answer('kicker', false, 3000);
  answer('two_pair', false, 3000);
  const plan = P.sessionPlan(data(), 'holdem', { type: 'mistakes' });
  const kickers = plan.filter((id) => id === 'kicker').length;
  assert(plan.length === 20 && kickers >= 12, `kicker questions: ${kickers}`);
  assert(plan.every((id) => ['kicker', 'two_pair'].includes(id)), 'only skills with mistakes');
});

test('Train my mistakes without mistakes falls back to the path', () => {
  equal(P.sessionPlan(data(), 'holdem', { type: 'mistakes' }).length, 20, 'length');
});

test('Challenge plan only uses skills already reached', () => {
  answer('simple_winner', true, 1000);
  const plan = P.sessionPlan(data(), 'holdem', { type: 'challenge', count: 200 });
  assert(plan.every((id) => ['hand_recognition', 'simple_winner'].includes(id)), [...new Set(plan)].join(','));
});

test('Blackjack path: only playable skills (phase A) are proposed', () => {
  const bj = window.DT.data.blackjackSkills.SKILLS;
  const record = (id, correct) => state.update((d) => P.recordAnswer(d, { module: 'blackjack', skill: id, level: 'beginner', targetMs: 3000, correct, ms: 1000 }));
  bj.filter((s) => s.available).forEach((s) => { for (let i = 0; i < 50; i++) record(s.id, true); });
  const next = P.nextSkill(data(), 'blackjack');
  equal([next.skill.id, next.available], ['outcome', true], 'last playable skill when all are mastered');
  const plan = P.sessionPlan(data(), 'blackjack', { type: 'challenge', count: 100 });
  assert(plan.every((id) => window.DT.data.blackjackSkills.byId[id].available), 'challenge only uses playable skills');
  assert(P.sessionPlan(data(), 'blackjack', { type: 'skill', skill: 'split' }).every((id) => id !== 'split'), 'an unavailable skill cannot be chosen');
  equal(data().stats.skills.blackjack.tier, 1, 'Blackjack Intermediate: every Beginner skill mastered');
});

// ---------------------------------------------------------------------------
// End-of-session report
// ---------------------------------------------------------------------------

const a = (skillId, correct, ms) => ({ skill: skillId, correct, ms, targetMs: skill(skillId).targetMs });

test('Report: figures and skills practised', () => {
  const r = P.sessionReport(data(), 'holdem', [a('kicker', true, 2000), a('kicker', false, 5000), a('flush', true, 1420)]);
  assert(Math.abs(r.accuracy - 2 / 3) < 1e-9, 'accuracy');
  equal(r.bestMs, 1420, 'best time (correct answers only)');
  equal(r.practiced.map((p) => [p.skill, p.count]), [['kicker', 2], ['flush', 1]], 'practised');
});

test('Report advice: inaccurate skill first', () => {
  const r = P.sessionReport(data(), 'holdem', [a('kicker', false, 2000), a('kicker', false, 2000), a('flush', true, 9000), a('flush', true, 9000)]);
  equal(r.advice, { key: 'accuracy', skill: 'kicker' }, 'advice');
});

test('Report advice: 80 % is not a clean session (goal is the mastery accuracy, 90 %)', () => {
  const list = [];
  for (let i = 0; i < 10; i++) list.push(a('hand_recognition', i < 8, 1000));
  equal(P.sessionReport(data(), 'holdem', list).advice, { key: 'accuracy', skill: 'hand_recognition' }, 'advice');
});

test('Report advice: a mastered skill that slips gets "maintain", not "not accurate yet"', () => {
  for (let i = 0; i < 50; i++) answer('trips', true, 1000);
  const list = [];
  for (let i = 0; i < 10; i++) list.push(a('trips', i < 8, 1000));
  equal(P.sessionReport(data(), 'holdem', list).advice, { key: 'maintain', skill: 'trips' }, 'advice');
});

test('Report advice: accurate but slow → speed on that skill', () => {
  const r = P.sessionReport(data(), 'holdem', [a('kicker', true, 6000), a('kicker', true, 6000), a('flush', true, 1000), a('flush', true, 1000)]);
  equal(r.advice, { key: 'speed', skill: 'kicker' }, 'advice');
});

test('Report advice: clean session → next skill of the path', () => {
  const r = P.sessionReport(data(), 'holdem', [a('hand_recognition', true, 1000), a('hand_recognition', true, 1000)]);
  equal(r.advice, { key: 'next', skill: 'hand_recognition' }, 'advice');
});

// ---------------------------------------------------------------------------
// Session recording
// ---------------------------------------------------------------------------

test('Session: history, training time and daily bonus once per day (first completed challenge)', () => {
  const session = { module: 'holdem', type: 'challenge', mode: 'speed', startedAt: Date.now(), durationMs: 45000, questions: 10, correct: 9, totalMs: 20000, xp: 150, completed: true };
  const first = state.update((d) => P.recordSession(d, session));
  const second = state.update((d) => P.recordSession(d, session));
  equal([first.bonusXp, second.bonusXp], [50, 0], 'bonus once');
  equal(data().history.length, 2, 'history');
  equal(data().stats.trainingMs, 90000, 'training time');
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
