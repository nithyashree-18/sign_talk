import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LEVELS, UNLOCK_AT, streakOf, todayKey } from "./modules";

const Ctx = createContext(null);
export const useProgress = () => useContext(Ctx);

const EMPTY = {
  learned: [],   // sign ids marked as learned
  lessons: {},   // sign label -> { watched, practice: "passed"|"skipped"|null, done }
  attempts: [],  // { t, label, ok, src: "cam"|"quiz" }
  days: {},      // "2026-10-13" -> [sign labels studied that day]
  goal: 5,       // signs per day
  badges: {},    // badge id -> date earned
  flags: { holds: 0, perfectQuiz: false, goalHit: false },
};

export const BADGES = [
  { id: "first", title: "First step", desc: "Finish a lesson or mark a sign as learned.", test: (s) => s.studied >= 1 },
  { id: "five", title: "Getting going", desc: "Study 5 different signs.", test: (s) => s.studied >= 5 },
  { id: "numbers", title: "Number cruncher", desc: "Finish the Numbers level.", test: (s) => s.levels.Numbers.total > 0 && s.levels.Numbers.done >= s.levels.Numbers.total },
  { id: "alphabets", title: "Spelling bee", desc: "Finish the Alphabets level.", test: (s) => s.levels.Alphabets.total > 0 && s.levels.Alphabets.done >= s.levels.Alphabets.total },
  { id: "words", title: "Chatterbox", desc: "Finish the Daily Words level.", test: (s) => s.levels["Daily Words"].total > 0 && s.levels["Daily Words"].done >= s.levels["Daily Words"].total },
  { id: "steady", title: "Steady hands", desc: "Hold the correct sign 10 times in Practice.", test: (s, d) => d.flags.holds >= 10 },
  { id: "perfect", title: "Full marks", desc: "Score 3 out of 3 in a lesson quiz.", test: (s, d) => d.flags.perfectQuiz },
  { id: "goal", title: "Goal getter", desc: "Reach your daily goal.", test: (s, d) => d.flags.goalHit },
  { id: "streak3", title: "Three in a row", desc: "Study 3 days in a row.", test: (s) => s.streak >= 3 },
  { id: "streak7", title: "One full week", desc: "Study 7 days in a row.", test: (s) => s.streak >= 7 },
];

function load(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved === "object") {
      return { ...EMPTY, ...saved, flags: { ...EMPTY.flags, ...(saved.flags || {}) } };
    }
  } catch {
    /* storage can be unavailable; start fresh */
  }
  return EMPTY;
}

export function ProgressProvider({ user, signs, children }) {
  const storageKey = `signtalk_progress_${user?.email || user?.name || "guest"}`;
  const [data, setData] = useState(() => load(storageKey));
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data, storageKey]);

  // ---- derived numbers -------------------------------------------------
  const stats = useMemo(() => {
    const levels = {};
    LEVELS.forEach((l) => {
      const inLevel = signs.filter((s) => s.category === l.id);
      const done = inLevel.filter((s) => data.lessons[s.label]?.done).length;
      levels[l.id] = { total: inLevel.length, done, frac: inLevel.length ? done / inLevel.length : 0 };
    });
    // a level opens when the one before it is mostly finished
    LEVELS.forEach((l, i) => {
      levels[l.id].unlocked = i === 0 || levels[LEVELS[i - 1].id].frac >= UNLOCK_AT;
    });
    const todayList = data.days[todayKey()] || [];
    const allLabels = new Set(Object.values(data.days).flat());
    const ok = data.attempts.filter((a) => a.ok).length;
    return {
      levels,
      streak: streakOf(data.days),
      today: todayList.length,
      studied: allLabels.size,
      lessonsDone: Object.values(data.lessons).filter((l) => l.done).length,
      attemptsTotal: data.attempts.length,
      accuracy: data.attempts.length ? ok / data.attempts.length : null,
    };
  }, [data, signs]);

  // ---- badges ----------------------------------------------------------
  useEffect(() => {
    if (!signs.length) return;
    const goalNow = stats.today >= data.goal && stats.today > 0;
    if (goalNow && !data.flags.goalHit) {
      setData((p) => ({ ...p, flags: { ...p.flags, goalHit: true } }));
      return;
    }
    const earned = BADGES.filter((b) => !data.badges[b.id] && b.test(stats, data));
    if (!earned.length) return;
    setData((p) => {
      const badges = { ...p.badges };
      earned.forEach((b) => {
        if (!badges[b.id]) badges[b.id] = todayKey();
      });
      return { ...p, badges };
    });
    setToast(earned[0]);
  }, [stats, data, signs.length]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- actions ---------------------------------------------------------
  const withDay = (prev, label) => {
    const k = todayKey();
    const list = prev.days[k] || [];
    return list.includes(label) ? prev.days : { ...prev.days, [k]: [...list, label] };
  };
  const patchLesson = (prev, label, patch) => ({
    ...prev.lessons,
    [label]: { watched: false, practice: null, done: false, ...prev.lessons[label], ...patch },
  });

  const actions = {
    toggleLearned: useCallback((sign) => {
      setData((p) => {
        const has = p.learned.includes(sign.id);
        return {
          ...p,
          learned: has ? p.learned.filter((i) => i !== sign.id) : [...p.learned, sign.id],
          days: has ? p.days : withDay(p, sign.label),
        };
      });
    }, []),
    markWatched: useCallback((label) => {
      setData((p) => ({ ...p, lessons: patchLesson(p, label, { watched: true }) }));
    }, []),
    setPractice: useCallback((label, status) => {
      setData((p) => ({
        ...p,
        lessons: patchLesson(p, label, { practice: status }),
        days: status === "passed" ? withDay(p, label) : p.days,
      }));
    }, []),
    completeLesson: useCallback((label, perfect) => {
      setData((p) => ({
        ...p,
        lessons: patchLesson(p, label, { watched: true, done: true }),
        days: withDay(p, label),
        flags: { ...p.flags, perfectQuiz: p.flags.perfectQuiz || !!perfect },
      }));
    }, []),
    recordAttempt: useCallback((label, ok, src) => {
      setData((p) => ({
        ...p,
        attempts: [...p.attempts, { t: Date.now(), label, ok: !!ok, src }].slice(-1000),
      }));
    }, []),
    recordHold: useCallback((label) => {
      setData((p) => ({
        ...p,
        days: withDay(p, label),
        flags: { ...p.flags, holds: p.flags.holds + 1 },
      }));
    }, []),
    setGoal: useCallback((n) => setData((p) => ({ ...p, goal: n })), []),
    reset: useCallback(() => setData(EMPTY), []),
  };

  const value = { data, stats, toast, learnedSet: new Set(data.learned), ...actions };
  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <div className="st-toast" role="status">
          <span className="st-toast-mark">★</span>
          <div>
            <strong>Badge earned: {toast.title}</strong>
            <span>{toast.desc}</span>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
