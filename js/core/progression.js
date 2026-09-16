/*
  Progression: XP, ranks, module tiers, skills & mastery, mistakes, achievements.

  The whole system in one sentence:
    every answer is recorded → XP is added → mistakes are logged →
    conditions for skill mastery, the module tier, the next rank and each achievement are checked.

  Nothing here ever removes XP, a rank, a tier or a mastered skill.
*/
(function (DT) {
  'use strict';

  const RANKS = DT.data.ranks;
  const ACHIEVEMENTS = DT.data.achievements;
  const { SKILLS: MODULES_WITH_STATS, TIERS, byId } = DT.data.modules;
  const { DAILY } = DT.data.challenges;

  /** Modules organised as a learning path of skills. */
  const PATHS = { holdem: DT.data.holdemSkills, blackjack: DT.data.blackjackSkills };

  const RECENT = 50;          // module accuracy and speed: last 50 answers
  const HISTORY_LIMIT = 200;
  const MISTAKES_LIMIT = 300;
  const SESSION_LENGTH = 20;

  /** XP rules — kept small on purpose. */
  const XP = {
    correct: 10,   // correct answer
    fast: 5,       // correct and under the target time
    hard: 15,      // correct on an intermediate, advanced or expert question
    streak: 10,    // every 10 correct answers in a row
    daily: 50,     // daily challenge completed
  };

  // ---------------------------------------------------------------------------
  // Measures
  // ---------------------------------------------------------------------------

  /** Accuracy, fast rate and average time over a list of recent answers. */
  function measure(recent) {
    if (!recent.length) return { count: 0, accuracy: null, fast: null, avgMs: null };
    let correct = 0, fast = 0, ms = 0;
    for (const a of recent) { correct += a.c; fast += a.f; ms += a.ms; }
    return { count: recent.length, accuracy: correct / recent.length, fast: fast / recent.length, avgMs: ms / recent.length };
  }

  function pushRecent(list, entry, limit = RECENT) {
    list.push(entry);
    if (list.length > limit) list.splice(0, list.length - limit);
  }

  const average = (list) => (list.length ? list.reduce((s, x) => s + x, 0) / list.length : null);

  /**
   * A condition line, e.g. { key: 'accuracy', current: 0.84, target: 0.85, met: false, fraction: 0.99 }
   * `fraction` (0–1) feeds the progress bar.
   */
  function requirement(key, current, target) {
    const safe = current || 0;
    return { key, current: safe, target, met: safe >= target, fraction: target ? Math.min(1, safe / target) : 1 };
  }

  /** Speed condition: lower is better. */
  function speedRequirement(avgMs, targetMs) {
    if (avgMs == null) return { key: 'speed', current: null, target: targetMs, met: false, fraction: 0 };
    return { key: 'speed', current: avgMs, target: targetMs, met: avgMs <= targetMs, fraction: Math.min(1, targetMs / avgMs) };
  }

  const progressOf = (requirements) =>
    requirements.length ? requirements.reduce((sum, r) => sum + r.fraction, 0) / requirements.length : 1;

  // ---------------------------------------------------------------------------
  // Skills (learning path)
  // ---------------------------------------------------------------------------

  function skillRecord(data, moduleId, skillId) {
    const all = data.stats.skills[moduleId].skills;
    if (!all[skillId]) all[skillId] = { questions: 0, correct: 0, mistakes: 0, bestMs: null, recent: [], masteredAt: null };
    return all[skillId];
  }

  /**
   * Everything about one skill: counts, recent accuracy and speed, mastery conditions.
   *   state: 'new' | 'learning' | 'progressing' | 'almost' | 'mastered'
   */
  function skillStatus(data, moduleId, skillId) {
    const path = PATHS[moduleId];
    const skill = path.byId[skillId];
    const rec = data.stats.skills[moduleId].skills[skillId] || { questions: 0, correct: 0, mistakes: 0, bestMs: null, recent: [], masteredAt: null };
    const window = rec.recent.slice(-path.MASTERY.window);
    const accuracy = window.length ? window.filter((a) => a.c).length / window.length : null;
    const correctOnes = window.filter((a) => a.c);
    const avgMs = average(correctOnes.map((a) => a.ms)); // speed of correct answers
    // Each answer keeps its own target (a 6-player table allows more time than 2 players).
    const targetMs = correctOnes.length ? average(correctOnes.map((a) => a.t || skill.targetMs)) : skill.targetMs;

    const requirements = [
      requirement('exercises', rec.questions, path.MASTERY.exercises),
      requirement('accuracy', accuracy, path.MASTERY.accuracy),
      speedRequirement(avgMs, targetMs),
    ];
    const mastered = !!rec.masteredAt;
    const progress = mastered ? 1 : progressOf(requirements);
    const state = mastered ? 'mastered' : rec.questions === 0 ? 'new' : progress >= 0.9 ? 'almost' : progress >= 0.5 ? 'progressing' : 'learning';

    const available = skill.available !== false; // skills of a later build phase are listed but not playable yet
    return { skill, available, questions: rec.questions, correct: rec.correct, mistakes: rec.mistakes, bestMs: rec.bestMs, accuracy, avgMs, requirements, progress, mastered, masteredAt: rec.masteredAt, state };
  }

  function skillList(data, moduleId) {
    return PATHS[moduleId].SKILLS.map((s) => skillStatus(data, moduleId, s.id));
  }

  /** First playable skill of the path that is not mastered yet (the last playable one if all are). */
  function nextSkill(data, moduleId) {
    const list = skillList(data, moduleId).filter((s) => s.available);
    return list.find((s) => !s.mastered) || list[list.length - 1];
  }

  /** Mistakes per skill, most frequent first: [{ skill, count }] */
  function mistakesBySkill(data, moduleId) {
    return skillList(data, moduleId)
      .filter((s) => s.mistakes > 0)
      .map((s) => ({ skill: s.skill, count: s.mistakes }))
      .sort((a, b) => b.count - a.count);
  }

  // ---------------------------------------------------------------------------
  // Session plans: which skill for each of the session's questions
  // ---------------------------------------------------------------------------

  /**
   * The four session types. Each can be played in Practice or Speed.
   *   path      — PARCOURS: the next skill to master, then a short review of earlier skills at the end
   *   skill     — COMPÉTENCE: 100 % the chosen skill
   *   mistakes  — MES ERREURS: skills weighted by recent mistakes (the path when there are none)
   *   challenge — DÉFI: every playable skill already reached, evenly mixed
   * @returns {string[]} one skill id per question
   */
  function sessionPlan(data, moduleId, { type = 'path', skill = null, count = SESSION_LENGTH, random = Math.random } = {}) {
    const list = skillList(data, moduleId).filter((s) => s.available);
    const ids = list.map((s) => s.skill.id);
    const next = nextSkill(data, moduleId).skill.id;

    if (type === 'skill' && ids.includes(skill)) return Array(count).fill(skill);

    if (type === 'mistakes') {
      const recent = data.stats.mistakes.filter((m) => m.module === moduleId && ids.includes(m.skill)).slice(-50);
      if (recent.length) {
        // Recent mistakes weigh more: the latest counts 2, the oldest of the 50 counts 1.
        const weights = {};
        recent.forEach((m, i) => { weights[m.skill] = (weights[m.skill] || 0) + 1 + i / recent.length; });
        const entries = Object.entries(weights);
        const total = entries.reduce((sum, [, w]) => sum + w, 0);
        return Array.from({ length: count }, () => {
          let r = random() * total;
          for (const [id, w] of entries) { r -= w; if (r <= 0) return id; }
          return entries[0][0];
        });
      }
    }

    if (type === 'challenge') {
      const reached = Math.max(ids.indexOf(next), ...list.map((s, i) => (s.questions ? i : 0)));
      const pool = ids.slice(0, reached + 1);
      return Array.from({ length: count }, () => pool[Math.floor(random() * pool.length)]);
    }

    // Path: main block first, review at the end.
    const review = ids.slice(0, ids.indexOf(next));
    const reviewCount = review.length ? Math.round(count * 0.25) : 0;
    const reviewPart = Array.from({ length: reviewCount }, () => review[Math.floor(random() * review.length)]);
    return Array(count - reviewCount).fill(next).concat(reviewPart);
  }

  // ---------------------------------------------------------------------------
  // End of session: skills practised and one clear recommendation
  // ---------------------------------------------------------------------------

  /**
   * @param {{ skill, correct, ms, targetMs }[]} answers answers of the session
   * @returns {{ accuracy, avgMs, bestMs, practiced: [{skill, count, correct, avgMs, targetMs}], advice: { key, skill } }}
   *   advice.key: 'accuracy' (a skill is not accurate yet) · 'maintain' (mastered, but slipped today) · 'speed' (accurate but slow)
   *               · 'next' (move on) · 'mastered' (all done) · 'none'
   */
  function sessionReport(data, moduleId, answers) {
    const correct = answers.filter((a) => a.correct);
    const bySkill = {};
    for (const a of answers) {
      const s = (bySkill[a.skill] = bySkill[a.skill] || { skill: a.skill, count: 0, correct: 0, times: [], targetMs: a.targetMs });
      s.count += 1;
      if (a.correct) { s.correct += 1; s.times.push(a.ms); }
    }
    const practiced = Object.values(bySkill)
      .map((s) => ({ skill: s.skill, count: s.count, correct: s.correct, accuracy: s.correct / s.count, avgMs: average(s.times), targetMs: s.targetMs }))
      .sort((a, b) => b.count - a.count);

    let advice = { key: 'none', skill: null };
    if (answers.length) {
      const enough = practiced.filter((s) => s.count >= 2);
      const accuracyGoal = PATHS[moduleId] ? PATHS[moduleId].MASTERY.accuracy : 0.9;
      const inaccurate = enough.filter((s) => s.accuracy < accuracyGoal).sort((a, b) => a.accuracy - b.accuracy)[0];
      const slow = enough.filter((s) => s.avgMs != null && s.avgMs > s.targetMs).sort((a, b) => b.avgMs / b.targetMs - a.avgMs / a.targetMs)[0];
      const next = PATHS[moduleId] ? nextSkill(data, moduleId) : null;

      const isMastered = (id) => !!(PATHS[moduleId] && skillStatus(data, moduleId, id).mastered);
      // A mastered skill that slipped today gets a "keep it sharp" message, not "not accurate yet".
      if (inaccurate) advice = { key: isMastered(inaccurate.skill) ? 'maintain' : 'accuracy', skill: inaccurate.skill };
      else if (slow) advice = { key: 'speed', skill: slow.skill };
      else if (next && !next.mastered) advice = { key: 'next', skill: next.skill.id };
      else if (next) advice = { key: 'mastered', skill: next.skill.id };
    }

    return {
      accuracy: answers.length ? correct.length / answers.length : null,
      avgMs: average(answers.map((a) => a.ms)),
      bestMs: correct.length ? Math.min(...correct.map((a) => a.ms)) : null,
      practiced,
      advice,
    };
  }

  // ---------------------------------------------------------------------------
  // Ranks
  // ---------------------------------------------------------------------------

  function rankRequirements(data, rank) {
    const s = data.stats;
    const recent = measure(s.recent);
    const list = [];
    if (rank.xp) list.push(requirement('xp', s.xp, rank.xp));
    if (rank.accuracy) list.push(requirement('accuracy', recent.accuracy, rank.accuracy / 100));
    if (rank.fast) list.push(requirement('fast', recent.fast, rank.fast / 100));
    if (rank.streak) list.push(requirement('streak', s.longestStreak, rank.streak));
    if (rank.skills) {
      const needed = TIERS.findIndex((t) => t.id === rank.skills.tier);
      const count = MODULES_WITH_STATS.filter((m) => s.skills[m.id].tier >= needed).length;
      list.push({ ...requirement('skills', count, rank.skills.count), tier: rank.skills.tier });
    }
    return list;
  }

  /** Where the user stands: current rank, next rank, conditions, overall % to next. */
  function rankStatus(data) {
    const index = data.stats.rank;
    const next = RANKS[index + 1] || null;
    const requirements = next ? rankRequirements(data, next) : [];
    return { index, level: index + 1, rank: RANKS[index], next, requirements, progress: progressOf(requirements), total: RANKS.length };
  }

  // ---------------------------------------------------------------------------
  // Module tiers (Beginner → Expert)
  // ---------------------------------------------------------------------------

  /**
   * Modules with a learning path: the tier follows the path —
   *   Intermediate once every Beginner skill is mastered, and so on.
   * Other modules: correct answers, accuracy and speed on the last 50 answers.
   */
  function tierStatus(data, moduleId) {
    const skill = data.stats.skills[moduleId];
    const recent = measure(skill.recent);
    const next = TIERS[skill.tier + 1] || null;
    let requirements = [];

    if (next && PATHS[moduleId]) {
      const levelId = TIERS[skill.tier].id;
      const inLevel = skillList(data, moduleId).filter((s) => s.skill.level === levelId);
      requirements = [{ ...requirement('levelSkills', inLevel.filter((s) => s.mastered).length, inLevel.length), level: levelId }];
    } else if (next) {
      requirements = [
        requirement('correct', skill.correct, next.correct),
        requirement('accuracy', recent.accuracy, next.accuracy / 100),
        ...(next.fast ? [requirement('fast', recent.fast, next.fast / 100)] : []),
      ];
    }
    return { module: byId[moduleId], index: skill.tier, tier: TIERS[skill.tier], next, requirements, progress: progressOf(requirements), recent, skill };
  }

  // ---------------------------------------------------------------------------
  // Unlocks (skills, tiers, ranks, achievements)
  // ---------------------------------------------------------------------------

  function checkUnlocks(data, session = null) {
    const unlocked = { skills: [], ranks: [], tiers: [], achievements: [] };
    const s = data.stats;

    for (const moduleId of Object.keys(PATHS)) {
      for (const status of skillList(data, moduleId)) {
        if (!status.mastered && status.requirements.every((r) => r.met)) {
          skillRecord(data, moduleId, status.skill.id).masteredAt = Date.now();
          unlocked.skills.push({ module: moduleId, skill: status.skill.id });
        }
      }
    }

    for (const m of MODULES_WITH_STATS) {
      let status = tierStatus(data, m.id);
      while (status.next && status.requirements.every((r) => r.met)) {
        s.skills[m.id].tier += 1;
        unlocked.tiers.push({ module: m.id, tier: TIERS[s.skills[m.id].tier].id });
        status = tierStatus(data, m.id);
      }
    }

    let status = rankStatus(data);
    while (status.next && status.requirements.every((r) => r.met)) {
      s.rank += 1;
      s.rankDates[s.rank] = Date.now();
      unlocked.ranks.push(RANKS[s.rank].id);
      status = rankStatus(data);
    }

    for (const a of ACHIEVEMENTS) {
      if (!data.achievements[a.id] && a.check(data, session)) {
        data.achievements[a.id] = Date.now();
        unlocked.achievements.push(a.id);
      }
    }
    return unlocked;
  }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  /**
   * Record one answer. Call inside DT.core.state.update().
   * @param {{ module, correct, ms, skill?, level?, difficulty?, targetMs?, mode?, hard? }} answer
   * @returns {{ xp, parts, fast, streak, unlocked }}
   */
  function recordAnswer(data, answer) {
    const s = data.stats;
    const moduleStats = s.skills[answer.module];
    const ms = Math.max(0, Math.round(answer.ms));
    const targetMs = answer.targetMs || byId[answer.module].targetMs;
    const fast = answer.correct && ms <= targetMs;
    const parts = [];

    s.questions += 1;
    s.totalMs += ms;
    moduleStats.questions += 1;
    moduleStats.totalMs += ms;

    if (answer.correct) {
      s.correct += 1;
      moduleStats.correct += 1;
      s.currentStreak += 1;
      s.longestStreak = Math.max(s.longestStreak, s.currentStreak);
      if (s.bestMs == null || ms < s.bestMs) s.bestMs = ms;
      if (moduleStats.bestMs == null || ms < moduleStats.bestMs) moduleStats.bestMs = ms;
      if (ms < 2000) s.under2s += 1;

      parts.push({ key: 'correct', xp: XP.correct });
      if (fast) parts.push({ key: 'fast', xp: XP.fast });
      if (answer.hard) parts.push({ key: 'hard', xp: XP.hard });
      if (s.currentStreak % 10 === 0) parts.push({ key: 'streak', xp: XP.streak });
    } else {
      s.currentStreak = 0;
    }

    const xp = parts.reduce((sum, p) => sum + p.xp, 0);
    s.xp += xp;

    const entry = { c: answer.correct ? 1 : 0, f: fast ? 1 : 0, ms };
    pushRecent(s.recent, entry);
    pushRecent(moduleStats.recent, entry);
    data.lastModule = answer.module;

    if (answer.skill && PATHS[answer.module]) {
      const rec = skillRecord(data, answer.module, answer.skill);
      rec.questions += 1;
      if (answer.correct) {
        rec.correct += 1;
        if (rec.bestMs == null || ms < rec.bestMs) rec.bestMs = ms;
      } else {
        rec.mistakes += 1;
      }
      pushRecent(rec.recent, { c: entry.c, ms, t: targetMs }, PATHS[answer.module].MASTERY.window);
    }

    // A mistake is information, not a penalty: it is logged to guide practice.
    if (!answer.correct) {
      s.mistakes.push({
        module: answer.module,
        skill: answer.skill || null,
        level: answer.level || null,
        difficulty: answer.difficulty || null,
        mode: answer.mode || null,
        responseTime: Math.round(ms / 10) / 100, // seconds
        at: Date.now(),
      });
      if (s.mistakes.length > MISTAKES_LIMIT) s.mistakes.splice(0, s.mistakes.length - MISTAKES_LIMIT);
    }

    return { xp, parts, fast, streak: s.currentStreak, unlocked: checkUnlocks(data) };
  }

  /**
   * Record a finished (or stopped) session. Call inside DT.core.state.update().
   * @param {{ module, type, mode, startedAt, durationMs, questions, correct, totalMs, xp, completed? }} session
   */
  function recordSession(data, session) {
    let bonusXp = 0;
    const today = DT.core.format.dayKey();

    // The first completed 60-second challenge of the day earns the daily bonus.
    if (session.type === 'challenge' && session.completed && !(data.daily.date === today && data.daily.done)) {
      data.daily = { date: today, done: true };
      data.stats.dailyDone += 1;
      data.stats.xp += XP.daily;
      bonusXp = XP.daily;
    }

    data.stats.trainingMs += Math.max(0, Math.round(session.durationMs));
    if (session.questions > 0) {
      data.history.unshift({
        at: Date.now(),
        module: session.module,
        type: session.type,
        mode: session.mode,
        durationMs: Math.round(session.durationMs),
        questions: session.questions,
        correct: session.correct,
        avgMs: Math.round(session.totalMs / session.questions),
        xp: session.xp + bonusXp,
      });
      if (data.history.length > HISTORY_LIMIT) data.history.length = HISTORY_LIMIT;
    }
    return { bonusXp, unlocked: checkUnlocks(data, session) };
  }

  function dailyDoneToday(data) {
    return data.daily.date === DT.core.format.dayKey() && data.daily.done;
  }

  // ---------------------------------------------------------------------------
  // Dashboard helpers
  // ---------------------------------------------------------------------------

  function overview(data) {
    const s = data.stats;
    const recent = measure(s.recent);
    return {
      xp: s.xp,
      questions: s.questions,
      correct: s.correct,
      accuracy: recent.accuracy,
      avgMs: recent.avgMs,
      fast: recent.fast,
      bestMs: s.bestMs,
      currentStreak: s.currentStreak,
      longestStreak: s.longestStreak,
      trainingMs: s.trainingMs,
    };
  }

  /** Weakest playable modules first. Untrained modules come after measured weaknesses. */
  function focusAreas(data, limit = 3) {
    const measured = [];
    const untrained = [];
    for (const m of MODULES_WITH_STATS.filter((x) => x.available)) {
      const r = measure(data.stats.skills[m.id].recent);
      if (!r.count) { untrained.push({ module: m, reason: 'untrained' }); continue; }
      const accuracyGap = Math.max(0, 0.9 - r.accuracy);
      const speedGap = Math.max(0, 0.6 - r.fast);
      if (accuracyGap === 0 && speedGap === 0) continue;
      measured.push({
        module: m,
        reason: accuracyGap * 2 >= speedGap ? 'accuracy' : 'speed',
        accuracy: r.accuracy,
        fast: r.fast,
        weight: accuracyGap * 2 + speedGap,
      });
    }
    measured.sort((a, b) => b.weight - a.weight);
    return measured.concat(untrained).slice(0, limit);
  }

  DT.core.progression = {
    XP,
    RECENT,
    SESSION_LENGTH,
    DAILY,
    PATHS,
    measure,
    rankStatus,
    rankRequirements,
    tierStatus,
    skillStatus,
    skillList,
    nextSkill,
    mistakesBySkill,
    sessionPlan,
    sessionReport,
    recordAnswer,
    recordSession,
    dailyDoneToday,
    overview,
    focusAreas,
  };
})(window.DT);
