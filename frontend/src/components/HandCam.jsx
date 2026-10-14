import { useEffect, useRef, useState } from "react";
import { API } from "../api";

// Below this confidence we say "Not sure". Letters pick from 26 classes, so they score lower.
export const THRESHOLDS = { numbers: 0.75, letters: 0.6 };
const WINDOW = 3;        // majority vote over the last 3 results
const INTERVAL_MS = 200; // about 5 frames per second
const HOLD = 4;          // this many correct results in a row count as one "hold"
const ATTEMPT_GAP = 1500; // log at most one attempt every 1.5 s, so accuracy is not inflated

const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11],
  [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const COLOURS = { ok: "#2fbf71", bad: "#f0a23c", idle: "#ffffff" };

function drawHands(canvas, hands, tone) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;
  const colour = COLOURS[tone] || COLOURS.idle;
  hands.forEach((pts) => {
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineCap = "round";
    EDGES.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(pts[a][0] * w, pts[a][1] * h);
      ctx.lineTo(pts[b][0] * w, pts[b][1] * h);
      ctx.stroke();
    });
    ctx.lineWidth = 3;
    ctx.strokeStyle = colour;
    EDGES.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(pts[a][0] * w, pts[a][1] * h);
      ctx.lineTo(pts[b][0] * w, pts[b][1] * h);
      ctx.stroke();
    });
    pts.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x * w, y * h, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.stroke();
    });
  });
}

/**
 * Webcam + hand skeleton + recognition loop.
 *  kind        "numbers" | "letters"
 *  target      the sign label we want to see (optional)
 *  onResult    called after every smoothed result: { running, hand, hands, label, confidence, tone, holds }
 *  onAttempt   (ok, shownLabel) at most every 1.5 s while a hand is visible and the model is sure
 *  onHold      called when the target is held correctly (HOLD results in a row)
 *  autoStart   open the camera as soon as the component appears
 */
export default function HandCam({ kind, target, onResult, onAttempt, onHold, autoStart = false }) {
  const videoRef = useRef(null);
  const captureRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const historyRef = useRef([]);
  const streakRef = useRef(0);
  const lastAttemptRef = useRef(0);
  const lockUntilRef = useRef(0);

  // always call the latest props from inside the loop
  const live = useRef({});
  live.current = { kind, target, onResult, onAttempt, onHold };

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const clearOverlay = () => {
    const c = overlayRef.current;
    if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height);
  };

  async function sendFrame() {
    const { kind: k, target: tgt } = live.current;
    const video = videoRef.current;
    const canvas = captureRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");

    // mirror the frame, exactly like our recordings
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
        body: JSON.stringify({ image, kind: k }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Server returned ${res.status}`);
      if (!runningRef.current) return; // camera was switched off while we waited
      setError("");

      const hands = data.landmarks || [];
      if (!data.hand_detected) {
        historyRef.current = [];
        streakRef.current = 0;
        drawHands(overlayRef.current, hands, "idle");
        live.current.onResult?.({ running: true, hand: false, hands: 0, label: "-", confidence: 0, tone: "idle", holds: 0 });
        return;
      }

      const label = data.confidence >= THRESHOLDS[k] ? data.label : "uncertain";
      historyRef.current = [...historyRef.current, label].slice(-WINDOW);
      const counts = {};
      historyRef.current.forEach((l) => (counts[l] = (counts[l] || 0) + 1));
      const shown = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];

      let tone = "idle";
      if (tgt && shown !== "uncertain" && shown !== "none") tone = shown === tgt ? "ok" : "bad";
      if (tgt && shown === "none") tone = "bad";

      let holds = 0;
      if (tgt && shown === tgt) {
        streakRef.current += 1;
        if (streakRef.current >= HOLD && Date.now() > lockUntilRef.current) {
          lockUntilRef.current = Date.now() + 1500;
          streakRef.current = 0;
          live.current.onHold?.();
          holds = HOLD;
        }
      } else {
        streakRef.current = 0;
      }

      if (tgt && shown !== "uncertain" && Date.now() - lastAttemptRef.current > ATTEMPT_GAP) {
        lastAttemptRef.current = Date.now();
        live.current.onAttempt?.(shown === tgt, shown);
      }

      drawHands(overlayRef.current, hands, tone);
      live.current.onResult?.({
        running: true,
        hand: true,
        hands: data.hands,
        label: shown,
        confidence: data.confidence,
        tone,
        holds: holds || streakRef.current,
      });
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
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
    streakRef.current = 0;
    clearOverlay();
    setRunning(false);
    live.current.onResult?.({ running: false, hand: false, hands: 0, label: "-", confidence: 0, tone: "idle", holds: 0 });
  }

  useEffect(() => {
    if (autoStart) start();
    return () => {
      runningRef.current = false;
      clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="st-cam">
      <div className="st-cam-frame">
        <video ref={videoRef} playsInline muted className="st-cam-video" />
        <canvas ref={overlayRef} width={640} height={480} className="st-cam-overlay" />
        {!running && <div className="st-cam-off">Camera is off</div>}
      </div>
      <button className="primary" onClick={running ? stop : start}>
        {running ? "Stop camera" : "Start camera"}
      </button>
      {error && <p className="error">{error}</p>}
      <canvas ref={captureRef} width={640} height={480} hidden />
    </div>
  );
}

export function ConfidenceMeter({ value, kind }) {
  const t = THRESHOLDS[kind] ?? 0.7;
  const pct = Math.round(value * 100);
  const state = value >= t ? "sure" : value > 0 ? "low" : "none";
  return (
    <div className="st-meter-wrap">
      <div className="st-meter-top">
        <span>Confidence</span>
        <strong>{pct}%</strong>
      </div>
      <div className={`st-meter st-meter-${state}`}>
        <div className="st-meter-fill" style={{ width: `${pct}%` }} />
        <div className="st-meter-mark" style={{ left: `${t * 100}%` }} title="Needed to count as a match" />
      </div>
      <span className="st-meter-hint">The line marks how sure the model must be.</span>
    </div>
  );
}
