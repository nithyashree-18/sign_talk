import { useEffect, useMemo, useState } from "react";
import { API } from "../api";
import "./Examiner.css";

export default function ExamManage({ user }) {
  const [signs, setSigns] = useState([]);
  const [exams, setExams] = useState([]);
  const [title, setTitle] = useState("");
  const [seconds, setSeconds] = useState(15);
  const [picked, setPicked] = useState(new Set());
  const [tab, setTab] = useState("All");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user.token}`,
  };

  const load = () =>
    fetch(`${API}/api/exam-mgmt`, { headers })
      .then((r) => r.json())
      .then((d) => setExams(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message));

  useEffect(() => {
    fetch(`${API}/api/signs`).then((r) => r.json()).then(setSigns).catch((e) => setError(e.message));
    load();
  }, []);

  const groups = useMemo(() => {
    const set = new Set(signs.map((s) => s.category).filter(Boolean));
    return ["All", ...set];
  }, [signs]);

  const visible = signs.filter((s) => tab === "All" || s.category === tab);
  const nameOf = (label) => signs.find((s) => s.label === label)?.name || label;

  const toggle = (label) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const selectVisible = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      visible.forEach((s) => next.add(s.label));
      return next;
    });

  const clearAll = () => setPicked(new Set());

  const create = async () => {
    setError("");
    setOk("");
    if (!title.trim()) return setError("Please enter an exam title.");
    if (picked.size === 0) return setError("Pick at least one sign.");
    const secs = Number(seconds);
    if (!(secs >= 5 && secs <= 120)) return setError("Seconds per question must be between 5 and 120.");
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/exam-mgmt`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title, seconds_per_question: secs, labels: [...picked] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not create exam");
      setTitle("");
      setPicked(new Set());
      setOk("Exam created.");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await fetch(`${API}/api/exam-mgmt/${id}`, { method: "DELETE", headers });
    load();
  };

  const totalSeconds = picked.size * Number(seconds || 0);

  return (
    <>
      <div className="ex-card">
        <h3>Create an exam</h3>
        <p className="hint">Name the exam, set the time per question and pick the signs to include.</p>

        {error && <div className="ex-error">{error}</div>}
        {ok && <div className="ex-ok">{ok}</div>}

        <div className="ex-row">
          <div className="ex-field">
            <label>Exam title</label>
            <input className="ex-input" placeholder="e.g. Numbers Test 1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="ex-field">
            <label>Seconds per question</label>
            <input className="ex-input narrow" type="number" min="5" max="120" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
          </div>
        </div>

        <div className="ex-tabs">
          {groups.map((g) => (
            <button key={g} className={`ex-tab ${tab === g ? "on" : ""}`} onClick={() => setTab(g)}>{g}</button>
          ))}
          <div className="ex-links">
            <button className="ex-link" onClick={selectVisible}>Select all</button>
            <button className="ex-link" onClick={clearAll}>Clear</button>
          </div>
        </div>

        <div className="ex-chips">
          {visible.map((s) => (
            <button key={s.id} className={`ex-chip ${picked.has(s.label) ? "on" : ""}`} onClick={() => toggle(s.label)}>
              {s.name}
            </button>
          ))}
        </div>

        <div className="ex-foot">
          <button className="ex-btn" onClick={create} disabled={busy}>{busy ? "Creating..." : "Create exam"}</button>
          <span className="ex-meta">
            {picked.size} sign{picked.size === 1 ? "" : "s"} selected
            {picked.size > 0 && ` · about ${Math.ceil(totalSeconds / 60)} min`}
          </span>
        </div>
      </div>

      <div className="ex-card">
        <h3>Existing exams</h3>
        <p className="hint">{exams.length} exam{exams.length === 1 ? "" : "s"} created</p>
        {exams.length === 0 ? (
          <div className="ex-empty">No exams yet. Create your first one above.</div>
        ) : (
          <div className="ex-exams">
            {exams.map((e) => (
              <div className="ex-exam" key={e.id}>
                <h4>{e.title}</h4>
                <span className="ex-meta">
                  {e.labels.length} questions · {e.seconds_per_question}s each · {new Date(e.created_at).toLocaleDateString()}
                </span>
                <div className="tags">
                  {e.labels.slice(0, 8).map((l) => (<span className="ex-tag" key={l}>{nameOf(l)}</span>))}
                  {e.labels.length > 8 && <span className="ex-tag">+{e.labels.length - 8} more</span>}
                </div>
                <button className="ex-btn danger small" onClick={() => remove(e.id, e.title)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}