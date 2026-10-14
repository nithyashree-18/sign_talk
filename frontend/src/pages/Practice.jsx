import { useEffect, useState } from "react";
import { API } from "../api";
import CategoryTabs from "../components/CategoryTabs";
import HandCam, { ConfidenceMeter } from "../components/HandCam";
import SignImage from "../components/SignImage";
import { shortLabel } from "../modules";
import { useProgress } from "../progress";

const IDLE = { running: false, hand: false, hands: 0, label: "-", confidence: 0, tone: "idle", holds: 0 };

export default function Practice({ signs, category, onCategoryChange }) {
  const kind = category === "Alphabets" ? "letters" : "numbers";
  const progress = useProgress();

  const [error, setError] = useState("");
  const [supported, setSupported] = useState([]);
  const [target, setTarget] = useState(null);
  const [result, setResult] = useState(IDLE);
  const [session, setSession] = useState({ tries: 0, right: 0, holds: 0 });

  // which signs does the trained model for this section know?
  useEffect(() => {
    setSupported([]);
    setResult(IDLE);
    fetch(`${API}/api/model-info?kind=${kind}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Server returned ${res.status}`);
        setError("");
        setSupported(data.classes.filter((c) => c !== "none"));
      })
      .catch((err) => setError(`Could not load the model: ${err.message}`));
  }, [kind]);

  const inCategory = signs.filter((s) => s.category === category);
  const practiceSigns = inCategory.filter((s) => supported.includes(s.label));
  const missing = inCategory.filter((s) => !supported.includes(s.label));
  const activeLabel = practiceSigns.some((s) => s.label === target) ? target : practiceSigns[0]?.label;
  const targetSign = practiceSigns.find((s) => s.label === activeLabel);

  const nameOf = (label) => {
    if (label === "-") return "-";
    if (label === "none") return "No sign";
    if (label === "uncertain") return "Not sure";
    return signs.find((s) => s.label === label)?.name ?? label;
  };

  // one clear message: correct, try again, or what to do next
  let feedback;
  if (!result.running)
    feedback = { tone: "idle", title: "Start the camera", text: "Then copy the picture with your hand." };
  else if (!result.hand)
    feedback = { tone: "idle", title: "Show your hand", text: "Keep it fully in view." };
  else if (result.label === "uncertain")
    feedback = { tone: "idle", title: "Hold steady", text: "The model is not sure yet. Keep the shape still." };
  else if (result.tone === "ok")
    feedback = { tone: "ok", title: "✓ Correct", text: `That is ${targetSign?.name}. Hold it for a moment.` };
  else
    feedback = {
      tone: "bad",
      title: "Try again",
      text:
        result.label === "none"
          ? "No sign was recognised. Check the picture and copy the finger shape."
          : `I see ${nameOf(result.label)}. Compare your fingers with the picture.`,
    };

  function handleAttempt(ok) {
    if (!activeLabel) return;
    progress.recordAttempt(activeLabel, ok, "cam");
    setSession((s) => ({ ...s, tries: s.tries + 1, right: s.right + (ok ? 1 : 0) }));
  }
  function handleHold() {
    if (!activeLabel) return;
    progress.recordHold(activeLabel);
    setSession((s) => ({ ...s, holds: s.holds + 1 }));
  }

  const head = (
    <section className="practice-head">
      <p className="eyebrow dark">Practice</p>
      <h1>Show the sign to your camera</h1>
      <p className="muted">Pick a sign, copy the picture, and watch the skeleton the recogniser sees.</p>
    </section>
  );

  // this section has no trained signs yet
  if (supported.length > 0 && practiceSigns.length === 0) {
    return (
      <div className="practice">
        {head}
        <CategoryTabs category={category} onChange={onCategoryChange} />
        <div className="notice">
          Live recognition is not available for this section yet. You can still study these signs on the Learn page.
        </div>
      </div>
    );
  }

  return (
    <div className="practice">
      {head}
      <CategoryTabs category={category} onChange={onCategoryChange} />

      <div className="practice-grid">
        <div className="cam-card">
          {/* key={kind}: switching section switches the camera off */}
          <HandCam
            key={kind}
            kind={kind}
            target={activeLabel}
            onResult={setResult}
            onAttempt={handleAttempt}
            onHold={handleHold}
          />
          {kind === "letters" && (
            <p className="hint">
              Most letters use both hands. Sit about an arm's length from the camera and keep both hands fully in view.
            </p>
          )}
          {error && <p className="error">{error}</p>}
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
                {shortLabel(s)}
              </button>
            ))}
          </div>

          {targetSign && (
            <div className="st-target">
              <div className="st-target-img">
                <SignImage sign={targetSign} />
              </div>
              <div>
                <strong>{targetSign.name}</strong>
                <span className="muted">{targetSign.meaning}</span>
              </div>
            </div>
          )}

          <div className={`st-feedback st-fb-${feedback.tone}`}>
            <strong>{feedback.title}</strong>
            <span>{feedback.text}</span>
          </div>

          <div className="readout">
            <div>
              <span>Hands</span>
              <strong>{result.hand ? `${result.hands} detected` : "Not detected"}</strong>
            </div>
            <div>
              <span>Predicted sign</span>
              <strong>{nameOf(result.label)}</strong>
            </div>
          </div>
          <ConfidenceMeter value={result.confidence} kind={kind} />

          <div className="st-session">
            <div>
              <strong>{session.holds}</strong>
              <span>holds</span>
            </div>
            <div>
              <strong>{session.tries ? Math.round((session.right / session.tries) * 100) : 0}%</strong>
              <span>accuracy this session</span>
            </div>
            <div>
              <strong>
                {progress.stats.today}/{progress.data.goal}
              </strong>
              <span>signs today</span>
            </div>
          </div>

          {supported.length > 0 && missing.length > 0 && (
            <p className="hint">
              Not trained yet: {missing.map(shortLabel).join(", ")}. They will appear here once recorded.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
