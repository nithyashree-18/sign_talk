import { useCallback, useEffect, useState } from "react";
import { API } from "../api";

const getJson = (url) =>
  fetch(`${API}${url}`).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Server returned ${res.status}`);
    return res.json();
  });

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

export default function Results({ user, onNavigate }) {
  const [history, setHistory] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [titles, setTitles] = useState([]);
  const [title, setTitle] = useState("");
  const [board, setBoard] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  const name = encodeURIComponent(user.name);

  const load = useCallback(() => {
    Promise.all([getJson(`/api/me/history?student=${name}`), getJson(`/api/assignments/mine?student=${name}`), getJson("/api/exam-titles")])
      .then(([h, a, t]) => {
        setHistory(h);
        setAssigned(a);
        setTitles(t);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [name]);

  useEffect(load, [load]);

  useEffect(() => {
    getJson(`/api/leaderboard?exam_title=${encodeURIComponent(title)}`)
      .then(setBoard)
      .catch(() => setBoard([]));
  }, [title]);

  async function certificate(attempt) {
    setBusy(attempt.attempt_id);
    try {
      const res = await fetch(`${API}/api/certificates/${attempt.attempt_id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not create the certificate");
      window.open(`${API}/api/certificates/${attempt.attempt_id}/pdf`, "_blank");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const myFirst = user.name.trim().split(" ")[0].toLowerCase();
  const pending = assigned.filter((a) => !a.done);

  return (
    <div className="practice">
      <section className="practice-head">
        <p className="eyebrow dark">Results</p>
        <h1>Your exams</h1>
        <p className="muted">Exams are matched by the name you enter when you start one: {user.name}.</p>
      </section>

      {error && <p className="error">{error}</p>}

      {assigned.length > 0 && (
        <section className="st-panel">
          <h2 className="section-title">Assigned to you</h2>
          <ul className="st-weak">
            {assigned.map((a) => (
              <li key={a.id}>
                <span className={`st-weak-badge ${a.done ? "st-ok" : ""}`}>{a.done ? "✓" : "!"}</span>
                <div>
                  <strong>{a.exam_title}</strong>
                  <span className="muted">
                    {a.done ? "Completed" : a.due_date ? `Due ${fmt(a.due_date)}` : "No due date"}
                  </span>
                </div>
                {!a.done && (
                  <button className="primary" onClick={() => onNavigate("exams")}>
                    Take it
                  </button>
                )}
              </li>
            ))}
          </ul>
          {pending.length === 0 && <p className="hint">Everything assigned to you is done.</p>}
        </section>
      )}

      <section className="st-panel">
        <h2 className="section-title">Exam history</h2>
        {history.length === 0 ? (
          <p className="muted">No exams yet. Take one from the Exams page.</p>
        ) : (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.attempt_id}>
                    <td>{h.exam_title}</td>
                    <td>{fmt(h.submitted_at)}</td>
                    <td>
                      {h.score}/{h.total}
                    </td>
                    <td>
                      <span className={`st-pill ${h.passed ? "pass" : "fail"}`}>{h.passed ? "Passed" : "Not passed"}</span>
                    </td>
                    <td>
                      {h.passed && (
                        <button className="secondary" disabled={busy === h.attempt_id} onClick={() => certificate(h)}>
                          {busy === h.attempt_id ? "…" : "Certificate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="st-panel">
        <h2 className="section-title">Class leaderboard</h2>
        <div className="tabs">
          <button className={`tab ${title === "" ? "on" : ""}`} onClick={() => setTitle("")}>
            All exams
          </button>
          {titles.map((t) => (
            <button key={t.kind} className={`tab ${title === t.title ? "on" : ""}`} onClick={() => setTitle(t.title)}>
              {t.kind === "letters" ? "Alphabets" : "Numbers"}
            </button>
          ))}
        </div>
        {board.length === 0 ? (
          <p className="muted">Nobody has taken this exam yet.</p>
        ) : (
          <ol className="st-board">
            {board.map((b) => (
              <li key={b.rank} className={b.name.toLowerCase() === myFirst ? "me" : ""}>
                <span className="st-rank">{b.rank}</span>
                <strong>{b.name}</strong>
                <span className="muted">{b.exams_taken} attempt{b.exams_taken === 1 ? "" : "s"}</span>
                <span className="st-score">{b.best_percent}%</span>
              </li>
            ))}
          </ol>
        )}
        <p className="hint">Shows first names and each student's best score.</p>
      </section>
    </div>
  );
}
