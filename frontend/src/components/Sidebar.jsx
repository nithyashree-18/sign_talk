import { useProgress } from "../progress";

const ICONS = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  learn: "M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 19.7 4 20.5zM20 5.5C20 4.7 19.3 4 18.5 4H13v15h5.5c.8 0 1.5.7 1.5 1.5z",
  practice: "M4 8.5h3l1.5-2h7L17 8.5h3V18H4zM12 15.5a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z",
  exams: "M8 4h8v3H8zM6 6h12v14H6zM9 12h6M9 15.5h4",
  progress: "M5 19V11M12 19V5M19 19v-6",
  examiner: "M4 6h16M4 12h16M4 18h10",
  classresults: "M4 19V9M10 19V5M16 19v-8M21 19H3",
};

const STUDENT = [
  { id: "home", label: "Home" },
  { id: "learn", label: "Learn", hint: "Course and dictionary" },
  { id: "practice", label: "Practice", hint: "Camera and quiz" },
  { id: "exams", label: "Exams", hint: "Take one, see results" },
  { id: "progress", label: "Progress" },
];
const EXAMINER = [
  { id: "examiner", label: "Exams" },
  { id: "classresults", label: "Class results" },
];

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function GoalCard() {
  const { stats, data } = useProgress();
  const pct = Math.min(100, Math.round((stats.today / data.goal) * 100));
  return (
    <div className="sb-goal">
      <div>
        <strong>{stats.today}/{data.goal}</strong> signs today
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span>{stats.streak > 0 ? `${stats.streak} day streak` : "Study today to start a streak"}</span>
    </div>
  );
}

export default function Sidebar({ page, onNavigate, user, onLogout }) {
  const isExaminer = user?.role === "examiner";
  const items = isExaminer ? EXAMINER : STUDENT;
  return (
    <aside className="sidebar sb">
      <div className="sb-brand">Sign Talk</div>
      <nav className="sb-nav" aria-label="Main">
        {items.map((item) => (
          <button
            key={item.id}
            className={`sb-item ${item.id === page ? "on" : ""}`}
            aria-current={item.id === page ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.id} />
            <span>
              {item.label}
              {item.hint && <small>{item.hint}</small>}
            </span>
          </button>
        ))}
      </nav>
      {!isExaminer && <GoalCard />}
      <div className="sb-user">
        <span className="sb-avatar">{user.name[0].toUpperCase()}</span>
        <div>
          <strong>{user.name}</strong>
          <span>{isExaminer ? "Examiner" : "Student"}</span>
        </div>
        <button className="sb-logout" onClick={onLogout} title="Log out">
          Log out
        </button>
      </div>
    </aside>
  );
}
