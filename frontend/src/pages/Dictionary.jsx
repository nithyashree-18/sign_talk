import { useMemo, useState } from "react";
import SignImage from "../components/SignImage";
import SignModal from "../components/SignModal";
import { LEVELS, hasVideo } from "../modules";
import { useProgress } from "../progress";

export default function Dictionary({ signs, initialFilter = "All" }) {
  const progress = useProgress();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initialFilter || "All");
  const [open, setOpen] = useState(null);

  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      LEVELS.filter((l) => filter === "All" || filter === l.id)
        .map((l) => {
          let list = signs.filter((s) => s.category === l.id);
          if (q) {
            list = list.filter((s) =>
              [s.name, s.meaning, s.label].some((t) => (t || "").toLowerCase().includes(q))
            );
          }
          if (l.id === "Daily Words") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
          return { level: l, list };
        })
        .filter((g) => g.list.length > 0),
    [signs, q, filter]
  );
  const total = groups.reduce((n, g) => n + g.list.length, 0);

  return (
    <div className="practice">
      <section className="practice-head">
        <p className="eyebrow dark">Dictionary</p>
        <h1>Every sign in one place</h1>
        <p className="muted">Search by word, letter or meaning. Open any sign to watch it.</p>
      </section>

      <div className="st-dict-bar">
        <input
          className="st-search"
          placeholder="Search signs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="tabs">
          {["All", ...LEVELS.map((l) => l.id)].map((c) => (
            <button key={c} className={`tab ${c === filter ? "on" : ""}`} onClick={() => setFilter(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {signs.length === 0 && <p className="muted">Loading signs…</p>}
      {signs.length > 0 && total === 0 && <p className="empty">No signs match “{query}”.</p>}

      {groups.map(({ level, list }) => (
        <section key={level.id} className="st-dict-group">
          <h2 className="section-title">
            {level.title} <span className="st-count">{list.length}</span>
          </h2>
          <div className="st-dict-grid">
            {list.map((s) => (
              <button key={s.id} className="st-dict-card" onClick={() => setOpen(s)}>
                <div className="st-dict-thumb">
                  {hasVideo(s) ? <span className="play">▶</span> : <SignImage sign={s} />}
                </div>
                <strong>{s.name}</strong>
                {progress.learnedSet.has(s.id) && <span className="done">Learned</span>}
              </button>
            ))}
          </div>
        </section>
      ))}

      {open && (
        <SignModal
          sign={open}
          learned={progress.learnedSet.has(open.id)}
          onToggle={progress.toggleLearned}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
