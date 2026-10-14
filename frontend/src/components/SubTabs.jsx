// Segmented control used on the pages that group several views (Learn, Practice, Exams).
export default function SubTabs({ tabs, value, onChange }) {
  return (
    <div className="sub-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === value}
          className={`sub-tab ${t.id === value ? "on" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.hint && <span>{t.hint}</span>}
        </button>
      ))}
    </div>
  );
}
