import { CATEGORIES } from "../categories";

export default function CategoryTabs({ category, onChange }) {
  return (
    <div className="tabs">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          className={`tab ${c.id === category ? "on" : ""}`}
          onClick={() => onChange(c.id)}
        >
          {c.title}
        </button>
      ))}
    </div>
  );
}