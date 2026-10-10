import { useEffect, useMemo, useState } from "react";
import CategoryTabs from "../components/CategoryTabs";
import SignPicture from "../components/SignPicture";
import { CATEGORIES } from "../categories";

const isVideo = (sign) => sign.video_url && sign.video_url.endsWith(".mp4");

function Hero({ info, learned, total }) {
  const pct = total ? Math.round((learned / total) * 100) : 0;
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">{info.course}</p>
        <h1>{info.heading}</h1>
        <p className="hero-sub">{info.sub}</p>
      </div>
      <div className="progress-box">
        <div className="progress-top">
          <span>Your progress</span>
          <strong>
            {learned}/{total}
          </strong>
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-pct">{pct}% complete</span>
      </div>
    </section>
  );
}

function SignCard({ sign, lesson, learned, onOpen }) {
  return (
    <button className="card" onClick={() => onOpen(sign)}>
      <div className="card-top">
        <span className="chip">Lesson {lesson}</span>
        {learned && <span className="done">Learned</span>}
      </div>
      <div className="numeral">
        {isVideo(sign) ? <span className="play">▶</span> : <SignPicture sign={sign} />}
      </div>
      <h3>{sign.name}</h3>
      <p>{sign.meaning}</p>
    </button>
  );
}

function SignModal({ sign, learned, onToggle, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal-media">
          {isVideo(sign) ? (
            <video className="modal-video" src={sign.video_url} controls loop muted playsInline autoPlay />
          ) : (
            <SignPicture sign={sign} big />
          )}
        </div>
        <div className="modal-body">
          <span className="chip">{sign.category}</span>
          <h2>{sign.name}</h2>
          <p className="modal-meaning">{sign.meaning}</p>
          <button className={`primary ${learned ? "on" : ""}`} onClick={() => onToggle(sign.id)}>
            {learned ? "Learned, tap to undo" : "Mark as learned"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Learn({ signs, category, onCategoryChange, query, error, learned, onToggle }) {
  const [open, setOpen] = useState(null);
  const info = CATEGORIES.find((c) => c.id === category);

  const inCategory = useMemo(() => signs.filter((s) => s.category === category), [signs, category]);
  const lessonOf = useMemo(() => new Map(inCategory.map((s, i) => [s.id, i + 1])), [inCategory]);
  const shown = useMemo(
    () => inCategory.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [inCategory, query]
  );
  const learnedHere = inCategory.filter((s) => learned.has(s.id)).length;

  return (
    <>
      <CategoryTabs category={category} onChange={onCategoryChange} />
      <Hero info={info} learned={learnedHere} total={inCategory.length} />

      {error && <p className="error">Could not load signs: {error}</p>}

      <h2 className="section-title">Lessons</h2>
      <div className="grid">
        {shown.map((s) => (
          <SignCard
            key={s.id}
            sign={s}
            lesson={lessonOf.get(s.id)}
            learned={learned.has(s.id)}
            onOpen={setOpen}
          />
        ))}
      </div>
      {!error && signs.length > 0 && inCategory.length === 0 && (
        <p className="empty">Signs for this section are coming soon.</p>
      )}
      {inCategory.length > 0 && shown.length === 0 && (
        <p className="empty">No signs match “{query}”.</p>
      )}

      {open && (
        <SignModal
          sign={open}
          learned={learned.has(open.id)}
          onToggle={onToggle}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}