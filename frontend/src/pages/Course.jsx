import { useMemo, useState } from "react";
import { LEVELS, UNLOCK_AT } from "../modules";
import { useProgress } from "../progress";
import Lesson from "./Lesson";

function Check({ ok, label, soft }) {
  return <span className={`st-tick ${ok ? "ok" : soft ? "soft" : ""}`}>{ok ? "✓" : soft ? "–" : "○"} {label}</span>;
}

export default function Course({ signs }) {
  const progress = useProgress();
  const { stats, data } = progress;
  const [levelId, setLevelId] = useState(null);
  const [lesson, setLesson] = useState(null);

  // default to the first level that is open and not finished
  const firstOpen = LEVELS.find((l) => stats.levels[l.id].unlocked && stats.levels[l.id].frac < 1) || LEVELS[0];
  const activeId = levelId || firstOpen.id;
  const level = LEVELS.find((l) => l.id === activeId);
  const levelSigns = useMemo(() => signs.filter((s) => s.category === activeId), [signs, activeId]);

  const nextLesson = useMemo(() => {
    for (const l of LEVELS) {
      if (!stats.levels[l.id].unlocked) continue;
      const found = signs.filter((s) => s.category === l.id).find((s) => !data.lessons[s.label]?.done);
      if (found) return found;
    }
    return null;
  }, [signs, stats, data.lessons]);

  if (lesson) {
    const pool = signs.filter((s) => s.category === lesson.category);
    return (
      <Lesson
        sign={lesson}
        levelSigns={pool}
        onExit={() => setLesson(null)}
        onOpenLesson={(s) => setLesson(s)}
      />
    );
  }

  const info = stats.levels[activeId];

  return (
    <div className="practice">
      <section className="practice-head">
        <p className="eyebrow dark">Course</p>
        <h1>Your learning path</h1>
        <p className="muted">
          Each lesson has three steps: watch, practise with your camera, then a short quiz. Finish{" "}
          {Math.round(UNLOCK_AT * 100)}% of a level to open the next one.
        </p>
        {nextLesson && (
          <button className="primary" onClick={() => setLesson(nextLesson)}>
            Continue: {nextLesson.name}
          </button>
        )}
      </section>

      <div className="st-levels">
        {LEVELS.map((l, i) => {
          const s = stats.levels[l.id];
          const pct = Math.round(s.frac * 100);
          return (
            <button
              key={l.id}
              className={`st-level ${l.id === activeId ? "on" : ""} ${s.unlocked ? "" : "locked"}`}
              disabled={!s.unlocked}
              onClick={() => setLevelId(l.id)}
            >
              <span className="eyebrow dark">{l.step}</span>
              <h3>{l.title}</h3>
              <p>{s.unlocked ? l.blurb : `Locked. Finish ${Math.round(UNLOCK_AT * 100)}% of ${LEVELS[i - 1].title} first.`}</p>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="progress-pct">
                {s.done}/{s.total} lessons · {pct}%
              </span>
            </button>
          );
        })}
      </div>

      <h2 className="section-title">{level.title} lessons</h2>
      {levelSigns.length === 0 && <p className="empty">Lessons for this level are coming soon.</p>}
      <ol className="st-path">
        {levelSigns.map((s, i) => {
          const l = data.lessons[s.label] || {};
          return (
            <li key={s.id} className={l.done ? "done" : ""}>
              <span className="st-node">{l.done ? "✓" : i + 1}</span>
              <div className="st-path-main">
                <strong>{s.name}</strong>
                <div className="st-ticks">
                  <Check ok={l.watched || l.done} label="Watch" />
                  <Check ok={l.practice === "passed"} soft={l.practice === "skipped"} label="Practise" />
                  <Check ok={l.done} label="Quiz" />
                </div>
              </div>
              <button className={l.done ? "secondary" : "primary"} onClick={() => setLesson(s)}>
                {l.done ? "Review" : l.watched ? "Resume" : "Start"}
              </button>
            </li>
          );
        })}
      </ol>
      {info.total > 0 && info.done === info.total && <p className="st-note">Level complete. Well done!</p>}
    </div>
  );
}
