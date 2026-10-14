import { useEffect, useState } from "react";
import { API } from "../api";
import { CATEGORIES } from "../categories";
import SignImage from "../components/SignImage";
import SignModal from "../components/SignModal";
import { BADGES, useProgress } from "../progress";
import { hasVideo, signOfTheDay } from "../modules";

const loadClasses = (kind) =>
  fetch(`${API}/api/model-info?kind=${kind}`)
    .then((res) => (res.ok ? res.json() : { classes: [] }))
    .then((d) => d.classes || [])
    .catch(() => []);

export default function Home({ signs, user, onOpenCategory, onNavigate }) {
  const progress = useProgress();
  const { stats, data } = progress;
  const [live, setLive] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    Promise.all([loadClasses("numbers"), loadClasses("letters")]).then(([a, b]) => setLive([...a, ...b]));
  }, []);

  const sotd = signOfTheDay(signs);
  const goalPct = Math.min(100, Math.round((stats.today / data.goal) * 100));
  const earned = BADGES.filter((b) => data.badges[b.id]);
  const first = (user?.name || "").split(" ")[0];

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">{first ? `Welcome back, ${first}` : "Welcome"}</p>
          <h1>Learn Indian Sign Language</h1>
          <p className="hero-sub">
            Follow the course from numbers to everyday words, practise with your camera, then take a practical exam.
          </p>
          <button className="primary st-hero-btn" onClick={() => onNavigate("course")}>
            {stats.lessonsDone ? "Continue the course" : "Start the course"}
          </button>
        </div>
        <div className="progress-box">
          <div className="progress-top">
            <span>Daily goal</span>
            <strong>
              {stats.today}/{data.goal} signs
            </strong>
          </div>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${goalPct}%` }} />
          </div>
          <span className="progress-pct">
            {stats.today >= data.goal ? "Goal reached today" : `${goalPct}% of today's goal`}
          </span>
          <div className="st-streak">
            <strong>{stats.streak}</strong> day streak
          </div>
        </div>
      </section>

      <div className="st-home-row">
        {sotd && (
          <section className="st-sotd">
            <p className="eyebrow dark">Sign of the day</p>
            <div className="st-sotd-body">
              <div className="st-sotd-pic">
                {hasVideo(sotd) ? <span className="play">▶</span> : <SignImage sign={sotd} />}
              </div>
              <div>
                <h3>{sotd.name}</h3>
                <p className="muted">{sotd.meaning}</p>
                <button className="secondary" onClick={() => setOpen(true)}>
                  {hasVideo(sotd) ? "Watch it" : "Look closer"}
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="st-sotd">
          <p className="eyebrow dark">Badges</p>
          {earned.length === 0 ? (
            <p className="muted">Finish a lesson to earn your first badge.</p>
          ) : (
            <div className="st-mini-badges">
              {earned.slice(-6).map((b) => (
                <span key={b.id} title={b.desc}>
                  ★ {b.title}
                </span>
              ))}
            </div>
          )}
          <button className="secondary" onClick={() => onNavigate("progress")}>
            See my progress
          </button>
        </section>
      </div>

      <h2 className="section-title">Sections</h2>
      <div className="cat-grid">
        {CATEGORIES.map((c) => {
          const inCat = signs.filter((s) => s.category === c.id);
          const liveCount = inCat.filter((s) => live.includes(s.label)).length;
          return (
            <button key={c.id} className="cat-card" onClick={() => onOpenCategory(c.id)}>
              <div className="cat-glyph">{c.glyph}</div>
              <h3>{c.title}</h3>
              <p>{c.blurb}</p>
              <div className="cat-meta">
                <span>{inCat.length} signs</span>
                <span className={`badge ${liveCount ? "live" : "learn"}`}>
                  {liveCount ? `Live recognition: ${liveCount}` : "Learn only"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="quick">
        <button className="secondary" onClick={() => onNavigate("practice")}>
          Open Practice
        </button>
        <button className="secondary" onClick={() => onNavigate("dictionary")}>
          Open the dictionary
        </button>
        <button className="primary" onClick={() => onNavigate("exams")}>
          Take the practical exam
        </button>
      </div>

      {open && sotd && (
        <SignModal
          sign={sotd}
          learned={progress.learnedSet.has(sotd.id)}
          onToggle={progress.toggleLearned}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
