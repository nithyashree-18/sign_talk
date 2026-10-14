import { useMemo } from "react";
import Login from "../pages/Login";

// New look for the login page. It wraps the existing Login form, so sign-in and registration
// keep working exactly as before. Only the page around the form (and its styling) is new.
export default function AuthScreen({ signs, onLogin }) {
  const tiles = useMemo(() => {
    const letters = signs.filter((s) => s.category === "Alphabets" && s.image_url);
    const pool = letters.length >= 6 ? letters : signs.filter((s) => s.image_url);
    return pool.slice(0, 6);
  }, [signs]);

  return (
    <div className="auth-stage">
      <aside className="auth-brand">
        <div className="auth-wordmark">Sign Talk</div>
        <div>
          <h1>Sign it. Your webcam checks it.</h1>
          <p>
            Learn Indian Sign Language step by step, practise with live feedback on your own hands, and take a
            practical exam that scores itself.
          </p>
        </div>
        <div className="auth-tiles" aria-hidden="true">
          {tiles.length > 0
            ? tiles.map((s) => (
                <figure key={s.id}>
                  <img src={s.image_url} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                  <figcaption>{s.name.replace("Letter ", "")}</figcaption>
                </figure>
              ))
            : ["A", "B", "C", "D", "E", "F"].map((c) => (
                <figure key={c} className="blank">
                  <figcaption>{c}</figcaption>
                </figure>
              ))}
        </div>
        <small>Signs from the Indian Sign Language Research and Training Centre (ISLRTC).</small>
      </aside>

      <main className="auth-form">
        <div className="auth-slot">
          <Login onLogin={onLogin} />
        </div>
      </main>
    </div>
  );
}
