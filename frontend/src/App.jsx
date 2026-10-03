import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

const NAV = [
  { id: "learn", label: "Learn", ready: true },
  { id: "practice", label: "Practice", ready: false },
  { id: "exams", label: "Exams", ready: false },
  { id: "results", label: "Results", ready: false },
];

// "Three (3)" -> "3"
const digitOf = (sign) => {
  const m = sign.name.match(/\((\d+)\)/);
  return m ? m[1] : sign.name[0];
};

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">ST</span>
        <span className="brand-name">Sign Talk</span>
      </div>
      <nav>
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${item.ready ? "active" : "disabled"}`}
            disabled={!item.ready}
          >
            <span className="nav-dot" />
            {item.label}
            {!item.ready && <span className="soon">Soon</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">Indian Sign Language, learn it, practise it, prove it.</div>
    </aside>
  );
}

function Hero({ learned, total }) {
  const pct = total ? Math.round((learned / total) * 100) : 0;
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Course 1</p>
        <h1>Numbers in Indian Sign Language</h1>
        <p className="hero-sub">
          Ten one-handed signs, from zero to nine. Study each one, then mark it as learned.
        </p>
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
function SignPicture({ sign, big = false }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return big ? (
      <>
        <span className="modal-numeral">{digitOf(sign)}</span>
        <span className="media-note">Sign demonstration coming soon</span>
      </>
    ) : (
      <span>{digitOf(sign)}</span>
    );
  }
  return (
    <img
      className="sign-img"
      src={sign.image_url}
      alt={`ISL sign for ${sign.name}`}
      onError={() => setFailed(true)}
    />
  );
}
function SignCard({ sign, learned, onOpen }) {
  return (
    <button className="card" onClick={() => onOpen(sign)}>
      <div className="card-top">
        <span className="chip">Lesson {sign.id}</span>
        {learned && <span className="done">Learned</span>}
      </div>
      <div className="numeral">
        <SignPicture sign={sign} />
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
          <SignPicture sign={sign} big />
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

export default function App() {
  const [signs, setSigns] = useState([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [learned, setLearned] = useState(new Set());
  const [open, setOpen] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/signs`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then(setSigns)
      .catch((err) => setError(err.message));
  }, []);

  const shown = useMemo(
    () => signs.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [signs, query]
  );

  const toggle = (id) =>
    setLearned((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <input
            className="search"
            placeholder="Search signs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="avatar">S</div>
        </header>

        <Hero learned={learned.size} total={signs.length} />

        {error && <p className="error">Could not load signs: {error}</p>}

        <h2 className="section-title">Lessons</h2>
        <div className="grid">
          {shown.map((s) => (
            <SignCard key={s.id} sign={s} learned={learned.has(s.id)} onOpen={setOpen} />
          ))}
        </div>
        {!error && signs.length > 0 && shown.length === 0 && (
          <p className="empty">No signs match “{query}”.</p>
        )}

        <footer className="credit">
          Sign content based on resources by the Indian Sign Language Research and Training
          Centre (ISLRTC), Government of India.
        </footer>
      </main>

      {open && (
        <SignModal
          sign={open}
          learned={learned.has(open.id)}
          onToggle={toggle}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}