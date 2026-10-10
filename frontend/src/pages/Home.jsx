import { useEffect, useState } from "react";
import { API } from "../api";
import { CATEGORIES } from "../categories";

export default function Home({ signs, onOpenCategory, onNavigate }) {
  const [live, setLive] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/model-info`)
      .then((res) => (res.ok ? res.json() : { classes: [] }))
      .then((d) => setLive(d.classes || []))
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Welcome</p>
          <h1>Learn Indian Sign Language</h1>
          <p className="hero-sub">
            Study the signs, practise with your camera, then take a practical exam. Choose a
            section to begin.
          </p>
        </div>
      </section>

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
        <button className="primary" onClick={() => onNavigate("exams")}>
          Take the practical exam
        </button>
      </div>
    </>
  );
}