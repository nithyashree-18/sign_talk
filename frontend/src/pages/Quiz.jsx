import { useEffect, useState } from "react";
import "./Quiz.css";

const SECTIONS = ["Numbers", "Alphabets"];
const ROUND = 10;

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function Quiz({ signs }) {
  const [category, setCategory] = useState("Numbers");
  const [okIds, setOkIds] = useState(null);
  const [round, setRound] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState([]);

  // keep only signs whose picture really loads, so a missing file can never reveal the answer
  useEffect(() => {
    let cancelled = false;
    setOkIds(null);
    const pool = signs.filter((s) => s.category === category && s.image_url);
    Promise.all(
      pool.map(
        (s) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(s.id);
            img.onerror = () => resolve(null);
            img.src = s.image_url;
          })
      )
    ).then((ids) => {
      if (!cancelled) setOkIds(new Set(ids.filter((id) => id !== null)));
    });
    return () => {
      cancelled = true;
    };
  }, [signs, category]);

  // build a fresh round
  useEffect(() => {
    if (!okIds) return;
    const pool = signs.filter((s) => s.category === category && okIds.has(s.id));
    if (pool.length < 4) {
      setQuestions([]);
      return;
    }
    const chosen = shuffle(pool).slice(0, Math.min(ROUND, pool.length));
    setQuestions(
      chosen.map((sign) => ({
        sign,
        options: shuffle([sign, ...shuffle(pool.filter((s) => s.id !== sign.id)).slice(0, 3)]),
      }))
    );
    setIndex(0);
    setPicked(null);
    setScore(0);
    setMissed([]);
  }, [okIds, round, signs, category]);

  const total = questions.length;
  const finished = total > 0 && index >= total;
  const q = finished ? null : questions[index];

  function choose(option) {
    if (picked !== null) return;
    setPicked(option.id);
    if (option.id === q.sign.id) setScore((s) => s + 1);
    else setMissed((m) => [...m, q.sign]);
  }

  function next() {
    setPicked(null);
    setIndex((i) => i + 1);
  }

  return (
    <div className="practice">
      <section className="practice-head">
        <p className="eyebrow dark">Quiz</p>
        <h1>Name the sign</h1>
        <p className="muted">No camera needed. Look at the picture and pick the right name.</p>
      </section>

      <div className="tabs">
        {SECTIONS.map((c) => (
          <button
            key={c}
            className={`tab ${c === category ? "on" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {signs.length === 0 || okIds === null ? (
        <p className="muted">Loading pictures…</p>
      ) : total === 0 ? (
        <div className="notice">Not enough sign pictures in this section yet.</div>
      ) : finished ? (
        <div className="quiz-card quiz-done">
          <p className="eyebrow dark">Round complete</p>
          <div className="score-big">
            {score} / {total}
          </div>
          {missed.length > 0 ? (
            <>
              <p className="muted">Worth another look:</p>
              <ul className="quiz-missed">
                {missed.map((s) => (
                  <li key={s.id}>
                    <img className="sign-img" src={s.image_url} alt="" />
                    <span>{s.name}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">A perfect round.</p>
          )}
          <button className="primary" onClick={() => setRound((r) => r + 1)}>
            Play again
          </button>
        </div>
      ) : (
        <div className="quiz-card">
          <div className="quiz-meta">
            <span>
              Question {index + 1} of {total}
            </span>
            <span>Score {score}</span>
          </div>
          <div className="quiz-img">
            <img className="sign-img" src={q.sign.image_url} alt="Which sign is this?" />
          </div>
          <div className="quiz-opts">
            {q.options.map((opt) => {
              const isRight = picked !== null && opt.id === q.sign.id;
              const isWrong = picked === opt.id && opt.id !== q.sign.id;
              return (
                <button
                  key={opt.id}
                  className={`quiz-opt${isRight ? " right" : ""}${isWrong ? " wrong" : ""}`}
                  disabled={picked !== null}
                  onClick={() => choose(opt)}
                >
                  {opt.name}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <button className="primary" onClick={next}>
              {index + 1 >= total ? "See my score" : "Next"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}