import { useEffect, useState } from "react";
import "./App.css";
import { API } from "./api";
import Sidebar from "./components/Sidebar";
import Exam from "./pages/Exam";
import Home from "./pages/Home";
import Learn from "./pages/Learn";
import Practice from "./pages/Practice";

export default function App() {
  const [page, setPage] = useState("home");
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

  return (
    <div className="shell">
      <Sidebar page={page} onNavigate={setPage} />
      <main className="main">
        <header className="topbar">
          {page === "learn" ? (
            <input
              className="search"
              placeholder="Search signs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : (
            <div />
          )}
          <div className="avatar">S</div>
        </header>

        {page === "home" && (
          <Home signs={signs} onOpenCategory={openCategory} onNavigate={setPage} />
        )}
        {page === "learn" && (
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
        {page === "practice" && (
          <Practice signs={signs} category={category} onCategoryChange={setCategory} />
        )}
        {page === "exams" && <Exam onExit={() => setPage("home")} />}

        <footer className="credit">
          Sign content based on resources by the Indian Sign Language Research and Training
          Centre (ISLRTC), Government of India.
        </footer>
      </main>
    </div>
  );
}