import { useEffect, useMemo, useRef, useState } from "react";
import { API } from "../api";
import HandCam, { ConfidenceMeter } from "../components/HandCam";
import SignImage from "../components/SignImage";
import VideoPlayer from "../components/VideoPlayer";
import { levelOf } from "../modules";
import { useProgress } from "../progress";

const HOLDS_NEEDED = 3;
const QUIZ_LENGTH = 3;
const PASS_MARK = 2;
const STEPS = ["Watch", "Practise", "Quiz"];

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const imageLoads = (sign) =>
  new Promise((resolve) => {
    if (!sign.image_url) return resolve(false);
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = sign.image_url;
  });

// Builds QUIZ_LENGTH questions. Picture questions only use pictures that really load,
// so a broken image can never give the answer away.
async function buildQuiz(sign, pool) {
  const words = sign.category === "Daily Words";
  const usable = words ? pool : (await Promise.all(pool.map(async (s) => ((await imageLoads(s)) ? s : null)))).filter(Boolean);
  if (!usable.some((s) => s.id === sign.id) || usable.length < 4) return [];
  const others = usable.filter((s) => s.id !== sign.id);
  const subjects = shuffle([sign, ...shuffle(others).slice(0, QUIZ_LENGTH - 1)]);
  return subjects.map((subject) => ({
    subject,
    words,
    options: shuffle([subject, ...shuffle(usable.filter((s) => s.id !== subject.id)).slice(0, 3)]),
  }));
}

function Stepper({ step }) {
  return (
    <ol className="st-steps">
      {STEPS.map((s, i) => (
        <li key={s} className={i === step ? "on" : i < step ? "done" : ""}>
          <span>{i < step ? "✓" : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function WatchStep({ sign, onNext }) {
  return (
    <div className="st-lesson-card">
      <VideoPlayer key={sign.id} sign={sign} />
      <div className="st-lesson-side">
        <span className="chip">{sign.category}</span>
        <h2>{sign.name}</h2>
        <p className="muted">{sign.meaning}</p>
        <p className="hint">Use slow motion and mirror view until you can copy the movement.</p>
        <button className="primary" onClick={onNext}>
          I have watched it, continue
        </button>
      </div>
    </div>
  );
}

function PracticeStep({ sign, kind, supported, onDone, onSkip }) {
  const progress = useProgress();
  const [holds, setHolds] = useState(0);
  const [result, setResult] = useState({ confidence: 0, tone: "idle", hand: false, running: false });
  const passed = holds >= HOLDS_NEEDED;

  if (!kind || !supported) {
    return (
      <div className="st-lesson-card st-single">
        <h2>Practise {sign.name}</h2>
        <p className="muted">
          Live camera checking is not available for this sign yet. Copy the video in front of a mirror, then go
          on to the quiz.
        </p>
        <button className="primary" onClick={onSkip}>
          Continue to the quiz
        </button>
      </div>
    );
  }

  let tip = "Start the camera and copy the sign.";
  if (result.running && !result.hand) tip = "Show your hand to the camera.";
  else if (result.running && result.tone === "ok") tip = "✓ Correct, hold it.";
  else if (result.running && result.tone === "bad") tip = "Try again. Compare your fingers with the picture.";
  else if (result.running) tip = "Hold steady…";

  return (
    <div className="st-lesson-card">
      <div className="st-lesson-cam">
        <HandCam
          kind={kind}
          target={sign.label}
          autoStart
          onResult={setResult}
          onAttempt={(ok) => progress.recordAttempt(sign.label, ok, "cam")}
          onHold={() => {
            progress.recordHold(sign.label);
            setHolds((h) => h + 1);
          }}
        />
      </div>
      <div className="st-lesson-side">
        <h2>Now you sign {sign.name}</h2>
        <div className="st-target-img st-big">
          <SignImage sign={sign} />
        </div>
        <div className={`st-feedback st-fb-${passed ? "ok" : result.tone}`}>
          <strong>{passed ? "Well done" : tip}</strong>
          <span>
            Correct holds: {Math.min(holds, HOLDS_NEEDED)} / {HOLDS_NEEDED}
          </span>
        </div>
        <ConfidenceMeter value={result.confidence} kind={kind} />
        {passed ? (
          <button className="primary" onClick={onDone}>
            Continue to the quiz
          </button>
        ) : (
          <button className="secondary" onClick={onSkip}>
            Skip practice
          </button>
        )}
      </div>
    </div>
  );
}

function QuizStep({ sign, pool, onFinish, onRetryPractice }) {
  const progress = useProgress();
  const [questions, setQuestions] = useState(null);
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const poolRef = useRef(pool); // the pool is a new array on every render, so keep it out of the deps
  poolRef.current = pool;

  useEffect(() => {
    let cancelled = false;
    setQuestions(null);
    buildQuiz(sign, poolRef.current).then((q) => {
      if (cancelled) return;
      setQuestions(q);
      setIndex(0);
      setPicked(null);
      setScore(0);
    });
    return () => {
      cancelled = true;
    };
  }, [sign.id, round]);

  if (questions === null) return <p className="muted">Preparing your quiz…</p>;

  if (questions.length === 0) {
    return (
      <div className="st-lesson-card st-single">
        <h2>Quiz not available</h2>
        <p className="muted">There are not enough pictures in this level for a quiz yet. This lesson counts as finished.</p>
        <button className="primary" onClick={() => onFinish(true, 0, 0)}>
          Finish lesson
        </button>
      </div>
    );
  }

  const total = questions.length;
  const finished = index >= total;
  const need = Math.min(PASS_MARK, total);

  if (finished) {
    const pass = score >= need;
    return (
      <div className="st-lesson-card st-single">
        <p className="eyebrow dark">{pass ? "Lesson passed" : "Not quite yet"}</p>
        <div className="score-big">
          {score} / {total}
        </div>
        <p className="muted">
          {pass
            ? score === total
              ? "A perfect score."
              : "You can move on."
            : `You need ${need} correct to pass. Watch the sign again or try the quiz once more.`}
        </p>
        {pass ? (
          <button className="primary" onClick={() => onFinish(true, score, total)}>
            Finish lesson
          </button>
        ) : (
          <div className="st-row">
            <button className="primary" onClick={() => setRound((r) => r + 1)}>
              Try the quiz again
            </button>
            <button className="secondary" onClick={onRetryPractice}>
              Back to the video
            </button>
          </div>
        )}
      </div>
    );
  }

  const q = questions[index];
  function choose(option) {
    if (picked !== null) return;
    setPicked(option.id);
    const ok = option.id === q.subject.id;
    if (ok) setScore((s) => s + 1);
    progress.recordAttempt(q.subject.label, ok, "quiz");
  }

  return (
    <div className="st-lesson-card st-single">
      <div className="quiz-meta">
        <span>
          Question {index + 1} of {total}
        </span>
        <span>Score {score}</span>
      </div>
      {q.words ? (
        <h2 className="st-quiz-prompt">Which word means “{q.subject.meaning}”?</h2>
      ) : (
        <>
          <h2 className="st-quiz-prompt">Which sign is this?</h2>
          <div className="st-target-img st-big">
            <SignImage sign={q.subject} hideAnswer />
          </div>
        </>
      )}
      <div className="quiz-opts">
        {q.options.map((opt) => {
          const right = picked !== null && opt.id === q.subject.id;
          const wrong = picked === opt.id && opt.id !== q.subject.id;
          return (
            <button
              key={opt.id}
              className={`quiz-opt${right ? " right" : ""}${wrong ? " wrong" : ""}`}
              disabled={picked !== null}
              onClick={() => choose(opt)}
            >
              {opt.name}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <button
          className="primary"
          onClick={() => {
            setPicked(null);
            setIndex((i) => i + 1);
          }}
        >
          {index + 1 >= total ? "See my score" : "Next"}
        </button>
      )}
    </div>
  );
}

export default function Lesson({ sign, levelSigns, onExit, onOpenLesson }) {
  const progress = useProgress();
  const level = levelOf(sign.category);
  const kind = level?.kind || null;
  const [step, setStep] = useState(0);
  const [supported, setSupported] = useState(null); // null = still loading
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setStep(0);
    setFinished(false);
  }, [sign.id]);

  useEffect(() => {
    if (!kind) return setSupported([]);
    setSupported(null);
    fetch(`${API}/api/model-info?kind=${kind}`)
      .then((res) => (res.ok ? res.json() : { classes: [] }))
      .then((d) => setSupported(d.classes || []))
      .catch(() => setSupported([]));
    return undefined;
  }, [kind]);

  const next = useMemo(() => {
    const i = levelSigns.findIndex((s) => s.id === sign.id);
    return i >= 0 ? levelSigns[i + 1] || null : null;
  }, [levelSigns, sign.id]);

  return (
    <div className="practice">
      <button className="st-back" onClick={onExit}>
        ← Back to the course
      </button>
      <Stepper step={finished ? 3 : step} />

      {finished ? (
        <div className="st-lesson-card st-single">
          <p className="eyebrow dark">Lesson complete</p>
          <h2>{sign.name}</h2>
          <p className="muted">Saved to your progress.</p>
          <div className="st-row">
            {next && (
              <button className="primary" onClick={() => onOpenLesson(next)}>
                Next: {next.name}
              </button>
            )}
            <button className="secondary" onClick={onExit}>
              Back to the course
            </button>
          </div>
        </div>
      ) : step === 0 ? (
        <WatchStep
          sign={sign}
          onNext={() => {
            progress.markWatched(sign.label);
            setStep(1);
          }}
        />
      ) : step === 1 ? (
        supported === null ? (
          <p className="muted">Checking the camera model…</p>
        ) : (
          <PracticeStep
            key={sign.id}
            sign={sign}
            kind={kind}
            supported={supported.includes(sign.label)}
            onDone={() => {
              progress.setPractice(sign.label, "passed");
              setStep(2);
            }}
            onSkip={() => {
              progress.setPractice(sign.label, "skipped");
              setStep(2);
            }}
          />
        )
      ) : (
        <QuizStep
          sign={sign}
          pool={levelSigns}
          onRetryPractice={() => setStep(0)}
          onFinish={(pass, score, total) => {
            progress.completeLesson(sign.label, total > 0 && score === total);
            setFinished(true);
          }}
        />
      )}
    </div>
  );
}
