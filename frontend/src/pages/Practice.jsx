import { useEffect, useRef, useState } from "react";
import { API } from "../api";
import { digitOf } from "../utils";
import CategoryTabs from "../components/CategoryTabs";

const THRESHOLD = 0.75;   // below this confidence we show "Not sure"
const WINDOW = 3;         // majority vote over the last 3 results (less flicker)
const INTERVAL_MS = 200;  // about 5 frames per second

export default function Practice({ signs, category, onCategoryChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const historyRef = useRef([]);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState([]);
  const [target, setTarget] = useState(null);
  const [result, setResult] = useState({ hand: false, label: "-", confidence: 0 });

  // which signs does the trained model know?
  useEffect(() => {
    fetch(`${API}/api/model-info`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Server returned ${res.status}`);
        setSupported(data.classes.filter((c) => c !== "none"));
      })
      .catch((err) => setError(`Could not load the model: ${err.message}`));
  }, []);

  // switch the camera off when leaving this page
  useEffect(() => {
    return () => {
      runningRef.current = false;
      clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function sendFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // mirror the frame, exactly like our training recordings
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    const image = canvas.toDataURL("image/jpeg", 0.8);

    try {
      const res = await fetch(`${API}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Server returned ${res.status}`);
      setError("");

      if (!data.hand_detected) {
        historyRef.current = [];
        setResult({ hand: false, label: "-", confidence: 0 });
        return;
      }

      const label = data.confidence >= THRESHOLD ? data.label : "uncertain";
      historyRef.current = [...historyRef.current, label].slice(-WINDOW);
      const counts = {};
      historyRef.current.forEach((l) => (counts[l] = (counts[l] || 0) + 1));
      const shown = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      setResult({ hand: true, label: shown, confidence: data.confidence });
    } catch (err) {
      setError(`Prediction failed: ${err.message}`);
    }
  }

  async function loop() {
    if (!runningRef.current) return;
    if (!busyRef.current && videoRef.current && videoRef.current.videoWidth) {
      busyRef.current = true;
      try {
        await sendFrame();
      } finally {
        busyRef.current = false;
      }
    }
    timerRef.current = setTimeout(loop, INTERVAL_MS);
  }

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      runningRef.current = true;
      setRunning(true);
      loop();
    } catch {
      setError(
        "Could not open the webcam. Allow camera access in the browser, and close any other program that is using the camera."
      );
    }
  }

  function stop() {
    runningRef.current = false;
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    historyRef.current = [];
    setRunning(false);
    setResult({ hand: false, label: "-", confidence: 0 });
  }

  // only the signs of the selected section
  const inCategory = signs.filter((s) => s.category === category);
  const practiceSigns = inCategory.filter((s) => supported.includes(s.label));
  const missing = inCategory.filter((s) => !supported.includes(s.label));
  const activeLabel = practiceSigns.some((s) => s.label === target)
    ? target
    : practiceSigns[0]?.label;
  const targetSign = practiceSigns.find((s) => s.label === activeLabel);
  const matched = running && result.hand && result.label === activeLabel;

  const nameOf = (label) => {
    if (label === "-") return "-";
    if (label === "none") return "No sign";
    if (label === "uncertain") return "Not sure";
    return signs.find((s) => s.label === label)?.name ?? label;
  };

  const tabs = (
    <CategoryTabs
      category={category}
      onChange={(id) => {
        if (running) stop();   // switch the camera off when changing section
        onCategoryChange(id);
      }}
    />
  );

  // this section has no trained signs yet
  if (supported.length > 0 && practiceSigns.length === 0) {
    return (
      <div className="practice">
        <section className="practice-head">
          <p className="eyebrow dark">Practice</p>
          <h1>Show the sign to your camera</h1>
        </section>
        {tabs}
        <div className="notice">
          Live recognition is not available for this section yet. You can still study these
          signs on the Learn page.
        </div>
      </div>
    );
  }

  return (
    <div className="practice">
      <section className="practice-head">
        <p className="eyebrow dark">Practice</p>
        <h1>Show the sign to your camera</h1>
        <p className="muted">
          Pick a sign, copy the picture, and see what the recogniser sees.
        </p>
      </section>

      {tabs}

      <div className="practice-grid">
        <div className="cam-card">
          <div className="cam-frame">
            <video ref={videoRef} playsInline muted className="cam-video" />
            {!running && <div className="cam-off">Camera is off</div>}
            {matched && <div className="cam-match">✓ Correct</div>}
          </div>
          <button className="primary" onClick={running ? stop : start}>
            {running ? "Stop camera" : "Start camera"}
          </button>
          {error && <p className="error">{error}</p>}
          <canvas ref={canvasRef} width={640} height={480} hidden />
        </div>

        <div className="side-card">
          <h3>Practise this sign</h3>
          <div className="pills">
            {practiceSigns.map((s) => (
              <button
                key={s.label}
                className={`pill ${s.label === activeLabel ? "on" : ""}`}
                onClick={() => setTarget(s.label)}
              >
                {digitOf(s)}
              </button>
            ))}
          </div>

          {targetSign && (
            <div className="target-img">
              <img className="sign-img" src={targetSign.image_url} alt={targetSign.name} />
            </div>
          )}

          <div className="readout">
            <div>
              <span>Hand</span>
              <strong>{result.hand ? "Detected" : "Not detected"}</strong>
            </div>
            <div>
              <span>Predicted sign</span>
              <strong>{nameOf(result.label)}</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{Math.round(result.confidence * 100)}%</strong>
            </div>
          </div>
          <div className="meter">
            <div className="meter-fill" style={{ width: `${result.confidence * 100}%` }} />
          </div>

          {supported.length > 0 && missing.length > 0 && (
            <p className="hint">
              Not trained yet: {missing.map(digitOf).join(", ")}. They will appear here once
              recorded.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}