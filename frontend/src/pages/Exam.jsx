import { useEffect, useRef, useState } from "react";
import { API } from "../api";

const INTERVAL_MS = 200;    // about 5 frames per second
const FLASH_MS = 1200;      // how long "Correct" / "Time's up" stays on screen

const detailOf = (data, res) =>
  typeof data.detail === "string" ? data.detail : `Server returned ${res.status}`;

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* no JSON body */
  }
  if (!res.ok) {
    const err = new Error(detailOf(data, res));
    err.status = res.status;
    throw err;
  }
  return data;
}

export default function Exam({ onExit }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const flashTimerRef = useRef(null);
  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const lockedRef = useRef(true);
  const deadlineRef = useRef(0);
  const sessionRef = useRef(null);

  const [phase, setPhase] = useState("intro"); // intro | running | done
  const [name, setName] = useState("");
  const [meta, setMeta] = useState(null);
  const [question, setQuestion] = useState(null);
  const [error, setError] = useState("");
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

  function stopAll() {
    runningRef.current = false;
    clearTimeout(timerRef.current);
    clearTimeout(flashTimerRef.current);
    stopCamera();
  }

  function failSession(message) {
    stopAll();
    setFlash(null);
    setQuestion(null);
    setError(message);
    setPhase("intro");
  }

  function handleError(err) {
    if (err.status === 404) {
      failSession("Your exam session expired or the server restarted. Please start again.");
    } else {
      setError(`Recognition failed: ${err.message}`);
    }
  }

  function showQuestion(q) {
    setQuestion(q);
    deadlineRef.current = Date.now() + q.seconds_left * 1000;
    setTimeLeft(Math.ceil(q.seconds_left));
    setLive({ hand: false, progress: 0 });
    lockedRef.current = false;
  }

  function finishExam(result) {
    stopAll();
    setSummary(result);
    setPhase("done");
  }

  async function advance() {
    if (!runningRef.current) return;
    try {
      const data = await post(`/api/exam/${sessionRef.current}/next`);
      if (!runningRef.current) return;
      setFlash(null);
      setError("");
      if (data.finished) finishExam(data.result);
      else showQuestion(data.question);
    } catch (err) {
      if (err.status === 404) {
        handleError(err);
      } else {
        setError(`Connection problem: ${err.message}. Trying again…`);
        flashTimerRef.current = setTimeout(advance, 1500);
      }
    }
  }

  function resolveQuestion(status) {
    lockedRef.current = true;
    setFlash(status === "passed" ? "passed" : "missed");
    flashTimerRef.current = setTimeout(advance, FLASH_MS);
  }

  async function check() {
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

    const sid = sessionRef.current;
    const data = await post(`/api/exam/${sid}/frame`, { image });

    // ignore an answer that arrives after the question has already ended
    if (!runningRef.current || lockedRef.current || sessionRef.current !== sid) return;

    setLive({ hand: data.hand_detected, progress: data.progress });
    if (data.status === "passed" || data.status === "missed") resolveQuestion(data.status);
  }

  async function loop() {
    if (!runningRef.current) return;
    if (!lockedRef.current) {
      setTimeLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      if (!busyRef.current) {
        busyRef.current = true;
        try {
          await check();
          setError("");
        } catch (err) {
          handleError(err);
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

    // open the camera first, so the first question's timer does not run while it starts
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch {
      stopCamera();
      setError(
        "Could not open the webcam. Allow camera access in the browser, and close any other program that is using the camera."
      );
      return;
    }

    let data;
    try {
      data = await post("/api/exam/start", { student_name: name.trim() });
    } catch (err) {
      stopCamera();
      setError(`Could not start the exam: ${err.message}`);
      return;
    }

    sessionRef.current = data.session_id;
    setMeta({ title: data.title, seconds: data.seconds_per_question });
    runningRef.current = true;
    setPhase("running");
    showQuestion(data.question);
    loop();
  }

  function retake() {
    setSummary(null);
    setQuestion(null);
    setError("");
    setFlash(null);
    setLive({ hand: false, progress: 0 });
    setPhase("intro");
  }

  // ---------- screens ----------
  if (phase === "done" && summary) {
    const pct = Math.round((summary.score / summary.total) * 100);
    return (
      <div className="result-card">
        <p className="eyebrow dark">Exam complete</p>
        <h2>{summary.title}</h2>
        <div className="score-big">
          {summary.score} / {summary.total}
        </div>
        <p className="muted">
          {summary.student_name}, you scored {pct}%.
        </p>
        <ul className="result-list">
          {summary.answers.map((a, i) => (
            <li key={i}>
              <span>{a.name}</span>
              <span className={a.passed ? "ok-text" : "miss-text"}>
                {a.passed ? `✓ ${a.seconds}s` : "✗ Not shown"}
              </span>
            </li>
          ))}
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

  const running = phase === "running" && question;
  return (
    <div className="practice">
      <section className="practice-head">
        <p className="eyebrow dark">Practical exam</p>
        <h1>{running ? meta.title : "Show the signs you have learned"}</h1>
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
                Question {question.index + 1} of {question.total}
              </p>
              <h2 className="q-prompt">{question.prompt}</h2>
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