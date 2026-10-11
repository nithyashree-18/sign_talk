const NAV = [
  { id: "home", label: "Home", ready: true },
  { id: "learn", label: "Learn", ready: true },
  { id: "practice", label: "Practice", ready: true },
  { id: "exams", label: "Exams", ready: true },
  { id: "results", label: "Results", ready: false },
  { id: "examiner", label: "Examiner", ready: true, examinerOnly: true },
];

export default function Sidebar({ page, onNavigate, user }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">ST</span>
        <span className="brand-name">Sign Talk</span>
      </div>
      <nav>
        {NAV.filter((item) => !item.examinerOnly || user?.role === "examiner").map((item) => (
          <button
            key={item.id}
            className={`nav-item ${!item.ready ? "disabled" : item.id === page ? "active" : ""}`}
            disabled={!item.ready}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-dot" />
            {item.label}
            {!item.ready && <span className="soon">Soon</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">Indian Sign Language, learn it, practise it, prove it.</div>
    </aside>
  );
}
