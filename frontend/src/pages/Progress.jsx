import { useMemo } from "react";
import { BADGES, useProgress } from "../progress";
import { LEVELS, shortLabel, todayKey } from "../modules";

const MIN_TRIES = 3;      // a sign needs this many attempts before it can be called weak
const WEAK_BELOW = 0.7;   // accuracy under this means "revise"

function dayLabel(key) {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

function AccuracyChart({ points }) {
  if (points.length === 0) {
    return <p className="muted">Practise with the camera or take a quiz and your accuracy will appear here.</p>;
  }
  const W = 560;
  const H = 180;
  const pad = { l: 36, r: 12, t: 12, b: 28 };
  const x = (i) => (points.length === 1 ? W / 2 : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.acc)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="st-chart" role="img" aria-label="Accuracy over time">
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} className="st-grid" />
          <text x={pad.l - 6} y={y(g) + 4} textAnchor="end" className="st-axis">
            {g * 100}%
          </text>
        </g>
      ))}
      <path d={path} className="st-line" fill="none" />
      {points.map((p, i) => (
        <g key={p.day}>
          <circle cx={x(i)} cy={y(p.acc)} r="4" className="st-dot">
            <title>{`${dayLabel(p.day)}: ${Math.round(p.acc * 100)}% of ${p.n} attempts`}</title>
          </circle>
          {(points.length <= 7 || i % 2 === 0) && (
            <text x={x(i)} y={H - 8} textAnchor="middle" className="st-axis">
              {dayLabel(p.day)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function Progress({ signs, onPractice }) {
  const { data, stats, setGoal, reset } = useProgress();

  const byLabel = useMemo(() => new Map(signs.map((s) => [s.label, s])), [signs]);

  // accuracy for each day that has attempts (last 14 such days)
  const chart = useMemo(() => {
    const days = {};
    data.attempts.forEach((a) => {
      const k = todayKey(new Date(a.t));
      days[k] = days[k] || { n: 0, ok: 0 };
      days[k].n += 1;
      days[k].ok += a.ok ? 1 : 0;
    });
    return Object.keys(days)
      .sort()
      .slice(-14)
      .map((day) => ({ day, n: days[day].n, acc: days[day].ok / days[day].n }));
  }, [data.attempts]);

  // signs to revise: lowest accuracy first, only with enough attempts to be fair
  const weak = useMemo(() => {
    const per = {};
    data.attempts.forEach((a) => {
      per[a.label] = per[a.label] || { n: 0, ok: 0 };
      per[a.label].n += 1;
      per[a.label].ok += a.ok ? 1 : 0;
    });
    return Object.entries(per)
      .map(([label, v]) => ({ label, n: v.n, acc: v.ok / v.n, sign: byLabel.get(label) }))
      .filter((w) => w.sign && w.n >= MIN_TRIES && w.acc < WEAK_BELOW)
      .sort((a, b) => a.acc - b.acc)
      .slice(0, 8);
  }, [data.attempts, byLabel]);

  const accuracyText = stats.accuracy === null ? "–" : `${Math.round(stats.accuracy * 100)}%`;

  return (
    <div className="practice">
      <section className="practice-head">
        <p className="eyebrow dark">Progress</p>
        <h1>How you are doing</h1>
        <p className="muted">Saved in this browser for your account.</p>
      </section>

      <div className="st-stats">
        <div>
          <strong>{stats.streak}</strong>
          <span>day streak</span>
        </div>
        <div>
          <strong>
            {stats.today}/{data.goal}
          </strong>
          <span>signs today</span>
        </div>
        <div>
          <strong>{stats.lessonsDone}</strong>
          <span>lessons finished</span>
        </div>
        <div>
          <strong>{accuracyText}</strong>
          <span>overall accuracy</span>
        </div>
      </div>

      <div className="st-panels">
        <section className="st-panel">
          <h2 className="section-title">Completion by level</h2>
          {LEVELS.map((l) => {
            const s = stats.levels[l.id];
            const pct = Math.round(s.frac * 100);
            return (
              <div key={l.id} className="st-bar-row">
                <div className="progress-top">
                  <span>{l.title}</span>
                  <strong>
                    {s.done}/{s.total} · {pct}%
                  </strong>
                </div>
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </section>

        <section className="st-panel">
          <h2 className="section-title">Accuracy over time</h2>
          <AccuracyChart points={chart} />
        </section>
      </div>

      <section className="st-panel">
        <h2 className="section-title">Signs to revise</h2>
        {weak.length === 0 ? (
          <p className="muted">
            Nothing to revise yet. A sign appears here after {MIN_TRIES}+ attempts with under{" "}
            {Math.round(WEAK_BELOW * 100)}% correct.
          </p>
        ) : (
          <ul className="st-weak">
            {weak.map((w) => (
              <li key={w.label}>
                <span className="st-weak-badge">{shortLabel(w.sign)}</span>
                <div>
                  <strong>{w.sign.name}</strong>
                  <span className="muted">
                    {Math.round(w.acc * 100)}% correct over {w.n} attempts
                  </span>
                </div>
                {w.sign.category !== "Daily Words" && (
                  <button className="secondary" onClick={() => onPractice(w.sign.category)}>
                    Practise
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="st-panel">
        <h2 className="section-title">Daily goal</h2>
        <div className="st-row">
          {[3, 5, 10].map((n) => (
            <button key={n} className={`pill ${data.goal === n ? "on" : ""}`} onClick={() => setGoal(n)}>
              {n} signs
            </button>
          ))}
        </div>
        <p className="hint">A sign counts once per day when you learn it, hold it in Practice or finish its lesson.</p>
      </section>

      <section className="st-panel">
        <h2 className="section-title">Badges</h2>
        <div className="st-badges">
          {BADGES.map((b) => {
            const when = data.badges[b.id];
            return (
              <div key={b.id} className={`st-badge ${when ? "earned" : ""}`}>
                <span className="st-badge-mark">{when ? "★" : "☆"}</span>
                <strong>{b.title}</strong>
                <span>{b.desc}</span>
                {when && <em>{when}</em>}
              </div>
            );
          })}
        </div>
      </section>

      <button
        className="st-reset"
        onClick={() => window.confirm("Clear all saved progress for this account?") && reset()}
      >
        Reset my progress
      </button>
    </div>
  );
}
