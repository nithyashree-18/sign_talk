import { useCallback, useEffect, useState } from "react";
import { API } from "../api";

const getJson = (url) =>
  fetch(`${API}${url}`).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Server returned ${res.status}`);
    return res.json();
  });

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "–");

export default function ClassResults() {
  const [data, setData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [titles, setTitles] = useState([]);
  const [error, setError] = useState("");
  const [pick, setPick] = useState("");
  const [form, setForm] = useState({ exam_kind: "numbers", student_name: "*", due_date: "" });

  const load = useCallback(() => {
    Promise.all([getJson("/api/class/overview"), getJson("/api/assignments"), getJson("/api/exam-titles")])
      .then(([d, a, t]) => {
        setData(d);
        setAssignments(a);
        setTitles(t);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function assign(e) {
    e.preventDefault();
    const res = await fetch(`${API}/api/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, due_date: form.due_date || null }),
    });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).detail || "Could not assign");
    load();
  }
  async function unassign(id) {
    await fetch(`${API}/api/assignments/${id}`, { method: "DELETE" });
    load();
  }

  if (error && !data) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const { stats } = data;
  const student = data.students.find((s) => s.student === pick);
  const weak = student ? student.weak : data.class_weak;

  return (
    <div className="practice">
      <section className="practice-head">
        <p className="eyebrow dark">Class results</p>
        <h1>How the class is doing</h1>
        <p className="muted">Pass mark: {data.pass_mark_percent}% of the questions.</p>
      </section>
      {error && <p className="error">{error}</p>}

      <div className="st-stats">
        <div><strong>{stats.students}</strong><span>students</span></div>
        <div><strong>{stats.attempts}</strong><span>exam attempts</span></div>
        <div><strong>{stats.average_percent ?? "–"}{stats.average_percent != null && "%"}</strong><span>average score</span></div>
        <div><strong>{stats.pass_rate ?? "–"}{stats.pass_rate != null && "%"}</strong><span>pass rate</span></div>
      </div>

      <div className="st-panels">
        <section className="st-panel">
          <h2 className="section-title">Weak signs</h2>
          <div className="st-row">
            <select className="st-select" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Whole class</option>
              {data.students.map((s) => (
                <option key={s.student} value={s.student}>{s.student}</option>
              ))}
            </select>
          </div>
          {weak.length === 0 ? (
            <p className="muted">No missed signs yet.</p>
          ) : (
            <ul className="st-weak">
              {weak.map((w) => (
                <li key={w.label}>
                  <div>
                    <strong>{w.name}</strong>
                    <span className="muted">{w.correct} of {w.attempts} correct</span>
                  </div>
                  <span className="st-score">{Math.round(w.accuracy * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="st-panel">
          <h2 className="section-title">Assign an exam</h2>
          <form className="st-form" onSubmit={assign}>
            <label>
              Exam
              <select className="st-select" value={form.exam_kind} onChange={(e) => setForm({ ...form, exam_kind: e.target.value })}>
                {titles.map((t) => <option key={t.kind} value={t.kind}>{t.title}</option>)}
              </select>
            </label>
            <label>
              Student
              <select className="st-select" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })}>
                <option value="*">Whole class</option>
                {data.students.map((s) => <option key={s.student} value={s.student}>{s.student}</option>)}
              </select>
            </label>
            <label>
              Due date (optional)
              <input className="st-select" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </label>
            <button className="primary" type="submit">Assign</button>
          </form>
          {assignments.length > 0 && (
            <ul className="st-weak st-assigned">
              {assignments.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.exam_title}</strong>
                    <span className="muted">{a.student} · {a.due_date ? `due ${fmt(a.due_date)}` : "no due date"} · {a.done}/{a.of} done</span>
                  </div>
                  <button className="secondary" onClick={() => unassign(a.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="st-panel">
        <h2 className="section-title">Students</h2>
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr><th>Student</th><th>Attempts</th><th>Best</th><th>Last exam</th><th>Weakest signs</th></tr></thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.student}>
                  <td>{s.student}</td>
                  <td>{s.attempts}</td>
                  <td>{s.best_percent != null ? `${s.best_percent}%` : "–"}</td>
                  <td>{fmt(s.last)}</td>
                  <td>{s.weak.length ? s.weak.map((w) => w.name).join(", ") : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="st-panel">
        <h2 className="section-title">All attempts</h2>
        <div className="st-table-wrap">
          <table className="st-table">
            <thead><tr><th>Student</th><th>Exam</th><th>Date</th><th>Score</th><th>Result</th></tr></thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.attempt_id}>
                  <td>{r.student}</td>
                  <td>{r.exam_title}</td>
                  <td>{fmt(r.submitted_at)}</td>
                  <td>{r.score}/{r.total} ({r.percent}%)</td>
                  <td><span className={`st-pill ${r.passed ? "pass" : "fail"}`}>{r.passed ? "Passed" : "Not passed"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
