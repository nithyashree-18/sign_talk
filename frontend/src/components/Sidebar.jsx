const NAV = [
  { id: "home", label: "Home", ready: true, studentOnly: true },
  { id: "learn", label: "Learn", ready: true, studentOnly: true },
  { id: "practice", label: "Practice", ready: true, studentOnly: true },
  { id: "exams", label: "Exams", ready: true, studentOnly: true },
  { id: "results", label: "Results", ready: false, studentOnly: true },
  { id: "examiner", label: "Examiner", ready: true, examinerOnly: true },
];

// an examiner sees only examiner items, everyone else sees only student items
const visibleFor = (item, user) =>
  user?.role === "examiner" ? !item.studentOnly : !item.examinerOnly;

export default function Sidebar({ page, onNavigate, user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">ST</span>
        <span className="brand-name">Sign Talk</span>
      </div>
      <nav>
        {NAV.filter((item) => visibleFor(item, user)).map((item) => (
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
        <button className="nav-item" onClick={onLogout}>
          <span className="nav-dot" />
          Log out
        </button>
      </nav>
      <div className="sidebar-foot">Indian Sign Language, learn it, practise it, prove it.</div>
    </aside>
  );
}