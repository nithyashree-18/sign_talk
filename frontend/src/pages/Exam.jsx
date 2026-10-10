import { useEffect, useRef, useState } from "react";
import { API } from "../api";

const PASS_CONF = 0.6;      // minimum confidence for a frame to count as correct
const STREAK_NEEDED = 3;    // consecutive correct frames (about one second)
const INTERVAL_MS = 200;    // about 5 frames per second
const FLASH_MS = 1200;      // how long "Correct" / "Time's up" stays on screen

const detailOf = (data, res) =>
  typeof data.detail === "string" ? data.detail : `Server returned ${res.status}`;

export default function Exam({ onExit }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const flashTimerRef = useRef(null);
  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const lockedRef = useRef(true);
  const examRef = useRef(null);
  const indexRef = useRef(0);
  const answersRef = useRef([]);
  const streakRef = useRef(0);
  const startRef = useRef(0);
  const nameRef = useRef("");

  const [phase, setPhase] = useState("intro"); // intro | running | submitting | failed | done
  const [name, setName] = useState("");
  const [exam, setExam] = useState(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [flash, setFlash] = useState(null); // "passed" | "missed" | null
  const [live, setLive] = useState({ hand: false, progress: 0 });
  const [summary, setSummary] = useState(null);

  // switch the camera off when leaving this page
  useEffect(() => {
    return () => {
      runningRef.current = false;
      clearTimeout(timerRef.current);
      clearTimeout(flashTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function check(qIndex) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !video.videoWidth) return;
    const ctx = canvas.getContext("2d");

    // mirror the frame, exactly like our training recordings
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    const image = canvas.toDataURL("image/jpeg", 0.8);

    const res = await fetch(`${API}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(detailOf(data, res));

    // ignore an answer that arrives after the question has already ended
    if (!runningRef.current || lockedRef.current || indexRef.current !== qIndex) return;

    const target = examRef.current.questions[qIndex].label;
    const correct = data.hand_detected && data.label === target && data.confidence >= PASS_CONF;
    streakRef.current = correct ? streakRef.current + 1 : 0;
    setLive({ hand: data.hand_detected, progress: Math.min(1, streakRef.current / STREAK_NEEDED) });
    if (streakRef.current >= STREAK_NEEDED) finishQuestion(true);
  }

  function finishQuestion(passed) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    const limit = examRef.current.seconds_per_question;
    const q = examRef.current.questions[indexRef.current];
    const seconds = Math.min(limit, (Date.now() - startRef.current) / 1000);
    answersRef.current.push({ label: q.label, passed, seconds: Math.round(seconds * 10) / 10 });
    setFlash(passed ? "passed" : "missed");

    flashTimerRef.current = setTimeout(() => {
      if (!runningRef.current) return;
      setFlash(null);
      if (indexRef.current + 1 >= examRef.current.questions.length) {
        finishExam();
      } else {
        indexRef.current += 1;
        setIndex(indexRef.current);
        streakRef.current = 0;
        setLive({ hand: false, progress: 0 });
        startRef.current = Date.now();
        setTimeLeft(limit);
        lockedRef.current = false;
      }
    }, FLASH_MS);
  }

  async function loop() {
    if (!runningRef.current) return;
    if (!lockedRef.current) {
      const limit = examRef.current.seconds_per_question;
      const elapsed = (Date.now() - startRef.current) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(limit - elapsed)));
      if (elapsed >= limit) {
        finishQuestion(false);
      } else if (!busyRef.current) {
        busyRef.current = true;
        try {
          await check(indexRef.current);
          setError("");
        } catch (err) {
          setError(`Recognition failed: ${err.message}`);
        } finally {
          busyRef.current = false;
        }
      }
    }
    timerRef.current = setTimeout(loop, INTERVAL_MS);
  }

  async function start() {
    if (!name.trim()) {
      setError("Please enter your name to begin.");
      return;
    }
    setError("");

    let data;
    try {
      const res = await fetch(`${API}/api/exam`);
      data = await res.json();
      if (!res.ok) throw new Error(detailOf(data, res));
      if (!data.questions.length) throw new Error("This exam has no questions yet.");
    } catch (err) {
      setError(`Could not load the exam: ${err.message}`);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch {
      setError(
        "Could not open the webcam. Allow camera access in the browser, and close any other program that is using the camera."
      );
      return;
    }

    nameRef.current = name.trim();
    examRef.current = data;
    answersRef.current = [];
    indexRef.current = 0;
    streakRef.current = 0;
    startRef.current = Date.now();
    lockedRef.current = false;
    runningRef.current = true;
    setExam(data);
    setIndex(0);
    setTimeLeft(data.seconds_per_question);
    setLive({ hand: false, progress: 0 });
    setPhase("running");
    loop();
  }

  function finishExam() {
    runningRef.current = false;
    clearTimeout(timerRef.current);
    stopCamera();
    sendResult();
  }

  async function sendResult() {
    setPhase("submitting");
    setError("");
    try {
      const res = await fetch(`${API}/api/exam/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_name: nameRef.current, answers: answersRef.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(detailOf(data, res));
      setSummary(data);
      setPhase("done");
    } catch (err) {
      setError(`Could not submit your result: ${err.message}`);
      setPhase("failed");
    }
  }

  function retake() {
    setSummary(null);
    setExam(null);
    setError("");
    setFlash(null);
    setLive({ hand: false, progress: 0 });
    setPhase("intro");
  }

  // ---------- screens ----------
  if (phase === "submitting") {
    return (
      <div className="result-card">
        <h2>Submitting your answers…</h2>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="result-card">
        <h2>Your answers are safe, but not submitted yet</h2>
        <p className="error">{error}</p>
        <button className="primary" onClick={sendResult}>
          Try submitting again
        </button>
      </div>
    );
  }

  if (phase === "done" && summary) {
    const pct = Math.round((summary.score / summary.total) * 100);
    return (
      <div className="result-card">
        <p className="eyebrow dark">Exam complete</p>
        <h2>{exam.title}</h2>
        <div className="score-big">
          {summary.score} / {summary.total}
        </div>
        <p className="muted">
          {nameRef.current}, you scored {pct}%.
        </p>
        <ul className="result-list">
          {answersRef.current.map((a, i) => {
            const q = exam.questions.find((x) => x.label === a.label);
            return (
              <li key={i}>
                <span>{q ? q.name : a.label}</span>
                <span className={a.passed ? "ok-text" : "miss-text"}>
                  {a.passed ? `✓ ${a.seconds}s` : "✗ Not shown"}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="btn-row">
          <button className="secondary" onClick={retake}>
            Retake exam
          </button>
          <button className="primary" onClick={onExit}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const running = phase === "running" && exam;
  return (
    <div className="practice">
      <section className="practice-head">
        <p className="eyebrow dark">Practical exam</p>
        <h1>{running ? exam.title : "Show the signs you have learned"}</h1>
        <p className="muted">Your camera checks each sign automatically.</p>
      </section>

      <div className="practice-grid">
        <div className="cam-card">
          <div className="cam-frame">
            <video ref={videoRef} playsInline muted className="cam-video" />
            {!running && <div className="cam-off">Camera starts with the exam</div>}
            {flash && (
              <div className={`cam-flash ${flash === "passed" ? "ok" : "miss"}`}>
                {flash === "passed" ? "✓ Correct" : "Time's up"}
              </div>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          <canvas ref={canvasRef} width={640} height={480} hidden />
        </div>

        <div className="side-card">
          {!running ? (
            <>
              <h3>Before you begin</h3>
              <input
                className="name-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <ul className="rules">
                <li>You are asked to show one sign at a time.</li>
                <li>You have 15 seconds for each question.</li>
                <li>Hold the sign steady in front of the camera until the bar fills.</li>
                <li>The sign pictures are hidden during the exam.</li>
                <li>Use good light and keep your hand fully in view.</li>
              </ul>
              <button className="primary" onClick={start}>
                Start exam
              </button>
            </>
          ) : (
            <>
              <p className="q-count">
                Question {index + 1} of {exam.questions.length}
              </p>
              <h2 className="q-prompt">{exam.questions[index].prompt}</h2>
              <div className="timer-row">
                <span className="muted-sm">Time left</span>
                <span className={`timer ${timeLeft <= 5 ? "low" : ""}`}>{timeLeft}s</span>
              </div>
              <div className="readout">
                <div>
                  <span>Hand</span>
                  <strong>{live.hand ? "Detected" : "Not detected"}</strong>
                </div>
              </div>
              <p className="muted-sm">Hold the sign steady until the bar fills.</p>
              <div className="meter">
                <div className="meter-fill" style={{ width: `${live.progress * 100}%` }} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}