import { useEffect, useState } from "react";
import { API } from "../api";
import ExamManage from "./ExamManage";
import "./Examiner.css";

const badgeOf = (p) => (p >= 80 ? "good" : p >= 50 ? "mid" : "low");

export default function Examiner({ user }) {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const get = async (path) => {
    const res = await fetch(`${API}/api/examiner/${path}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Request failed");
    return res.json();
  };

  const refresh = () => {
    setLoading(true);
    setError("");
    Promise.all([get("summary"), get("attempts")])
      .then(([s, a]) => {
        setSummary(s);
        setRows(a);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const shown = rows.filter((r) => r.student_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="ex-page">
      <div className="ex-head">
        <div>
          <h2>Examiner dashboard</h2>
          <p className="ex-sub">Welcome, {user.name}. Create exams and review student results.</p>
        </div>
        <button className="ex-btn ghost" onClick={refresh}>Refresh</button>
      </div>

      {error && <div className="ex-error">{error}</div>}

      <div className="ex-stats">
        <div className="ex-stat">
          <div className="label">Attempts</div>
          <div className="value">{summary ? summary.attempts : "-"}</div>
        </div>
        <div className="ex-stat green">
          <div className="label">Students</div>
          <div className="value">{summary ? summary.students : "-"}</div>
        </div>
        <div className="ex-stat amber">
          <div className="label">Average score</div>
          <div className="value">{summary ? `${summary.avg_percent}%` : "-"}</div>
        </div>
      </div>

      <ExamManage user={user} />

      <div className="ex-card">
        <div className="ex-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <h3>Student results</h3>
            <p className="hint" style={{ margin: 0 }}>{shown.length} attempt{shown.length === 1 ? "" : "s"}</p>
          </div>
          <input className="ex-input" placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="ex-empty">Loading...</div>
        ) : shown.length === 0 ? (
          <div className="ex-empty">No exam attempts yet. Results appear here once students submit an exam.</div>
        ) : (
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr><th>Student</th><th>Exam</th><th>Score</th><th>Submitted</th><th></th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.student_name}</b></td>
                    <td>{r.exam_title}</td>
                    <td>
                      <span className={`ex-badge ${badgeOf(r.percent)}`}>{r.score}/{r.total} · {r.percent}%</span>
                      <div className="ex-bar"><div style={{ width: `${r.percent}%` }} /></div>
                    </td>
                    <td>{r.submitted_at.replace("T", " ")}</td>
                    <td>
                      <button className="ex-btn ghost small" onClick={() => get(`attempts/${r.id}`).then(setDetail).catch((e) => setError(e.message))}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <div className="ex-modal-bg" onClick={() => setDetail(null)}>
          <div className="ex-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px" }}>{detail.student_name}</h3>
            <p className="ex-sub" style={{ marginBottom: 14 }}>
              {detail.exam_title} · {detail.score}/{detail.total}
            </p>
            {detail.details.map((d, i) => (
              <div className="ex-q" key={i}>
                <span>{i + 1}. {d.label}</span>
                <span>
                  <span className={`ex-badge ${d.passed ? "good" : "low"}`}>{d.passed ? "Correct" : "Wrong"}</span>
                  <span className="ex-meta"> {d.seconds}s</span>
                </span>
              </div>
            ))}
            <div style={{ marginTop: 18 }}>
              <button className="ex-btn" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}