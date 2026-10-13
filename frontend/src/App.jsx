import { useEffect, useState } from "react";
import "./App.css";
import "./theme.css";
import { API } from "./api";
import Sidebar from "./components/Sidebar";
import Exam from "./pages/Exam";
import Examiner from "./pages/Examiner";
import Home from "./pages/Home";
import Learn from "./pages/Learn";
import Login from "./pages/Login";
import Practice from "./pages/Practice";
import Quiz from "./pages/Quiz";

const startPage = (u) => (u?.role === "examiner" ? "examiner" : "home");

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("signtalk_user"));
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState(() => {
    try {
      return startPage(JSON.parse(localStorage.getItem("signtalk_user")));
    } catch {
      return "home";
    }
  });
  const [category, setCategory] = useState("Numbers");
  const [signs, setSigns] = useState([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [learned, setLearned] = useState(new Set());

  useEffect(() => {
    fetch(`${API}/api/signs`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then(setSigns)
      .catch((err) => setError(err.message));
  }, []);

  const toggle = (id) =>
    setLearned((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const openCategory = (id) => {
    setCategory(id);
    setPage("learn");
  };

  const handleLogin = (u) => {
    setUser(u);
    setPage(startPage(u));       // examiners land on their dashboard
  };

  const logout = () => {
    localStorage.removeItem("signtalk_user");
    setUser(null);
    setPage("home");
  };

  if (!user) return <Login onLogin={handleLogin} />;

  // an examiner only ever sees the examiner page, a student never sees it
  const current =
    user.role === "examiner" ? "examiner" : page === "examiner" ? "home" : page;

  return (
    <div className="shell">
      <Sidebar page={current} onNavigate={setPage} user={user} onLogout={logout} />
      <main className="main">
        <header className="topbar">
          {current === "learn" ? (
            <input
              className="search"
              placeholder="Search signs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : (
            <div />
          )}
          <div
            className="avatar"
            title="Click to log out"
            onClick={logout}
            style={{ cursor: "pointer" }}
          >
            {user.name[0].toUpperCase()}
          </div>
        </header>

        {current === "home" && (
          <Home signs={signs} onOpenCategory={openCategory} onNavigate={setPage} />
        )}
        {current === "learn" && (
          <Learn
            signs={signs}
            category={category}
            onCategoryChange={setCategory}
            query={query}
            error={error}
            learned={learned}
            onToggle={toggle}
          />
        )}
        {current === "practice" && (
          <Practice signs={signs} category={category} onCategoryChange={setCategory} />
        )}
        {current === "quiz" && <Quiz signs={signs} />}
        {current === "exams" && <Exam onExit={() => setPage("home")} />}
        {current === "examiner" && <Examiner user={user} />}

        <footer className="credit">
          Sign content based on resources by the Indian Sign Language Research and Training
          Centre (ISLRTC), Government of India.
        </footer>
      </main>
    </div>
  );
}