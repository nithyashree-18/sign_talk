import { useEffect } from "react";

export default function ConfirmDialog({ title, text, confirm, cancel = "Stay", onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="st-overlay" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="muted">{text}</p>
        <div className="st-row">
          <button className="primary" onClick={onConfirm}>
            {confirm}
          </button>
          <button className="secondary" autoFocus onClick={onCancel}>
            {cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
