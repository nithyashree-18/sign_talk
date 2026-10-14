import { useEffect } from "react";
import VideoPlayer from "./VideoPlayer";

export default function SignModal({ sign, learned, onToggle, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="st-overlay" onClick={onClose}>
      <div className="st-modal" onClick={(e) => e.stopPropagation()}>
        <button className="st-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <VideoPlayer key={sign.id} sign={sign} />
        <div className="st-modal-body">
          <span className="chip">{sign.category}</span>
          <h2>{sign.name}</h2>
          <p className="muted">{sign.meaning}</p>
          {onToggle && (
            <button className={`primary ${learned ? "on" : ""}`} onClick={() => onToggle(sign)}>
              {learned ? "Learned, tap to undo" : "Mark as learned"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
