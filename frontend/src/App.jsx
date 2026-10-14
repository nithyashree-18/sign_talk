import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import "./theme.css";
import "./features.css";
import "./extras.css";
import "./ux.css";
import { API } from "./api";
import AuthScreen from "./components/AuthScreen";
import ConfirmDialog from "./components/ConfirmDialog";
import Sidebar from "./components/Sidebar";
import { ProgressProvider, useProgress } from "./progress";
import ClassResults from "./pages/ClassResults";
import ExamHub from "./pages/ExamHub";
import Examiner from "./pages/Examiner";
import Home from "./pages/Home";
import LearnHub from "./pages/LearnHub";
import PracticeHub from "./pages/PracticeHub";
import Progress from "./pages/Progress";

// ---- routing: the address bar (#/learn/dictionary) is the single source of truth, so the browser's
// Back and Forward buttons move between pages inside the app instead of leaving it.
const STUDENT_PAGES = { home: [], learn: ["course", "dictionary"], practice: ["camera", "quiz"], exams: ["take", "results"], progress: [] };
const EXAMINER_PAGES = { examiner: [], classresults: [] };
const TITLES = { home: "Home", learn: "Learn", practice: "Practice", exams: "Exams", progress: "Progress", examiner: "Exams", classresults: "Class results" };

function parseHash() {
  const [page = "", tab = ""] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { page, tab };
}
function normalise({ page, tab }, isExaminer) {
  const pages = isExaminer ? EXAMINER_PAGES : STUDENT_PAGES;
  const fallback = isExaminer ? "examiner" : "home";
  const p = pages[page] ? page : fallback;
  const tabs = pages[p];
  return { page: p, tab: tabs.includes(tab) ? tab : tabs[0] || "" };
}
const hashOf = ({ page, tab }) => `#/${page}${tab ? `/${tab}` : ""}`;

// older page names used by buttons inside pages
const LEGACY = {
  course: { page: "learn", tab: "course" },
  dictionary: { page: "learn", tab: "dictionary" },
  quiz: { page: "practice", tab: "quiz" },
  results: { page: "exams", tab: "results" },
};

function Shell({ user, signs, error, onRetry, onLogout }) {
  const progress = useProgress();
  const isExaminer = user.role === "examiner";
  const [route, setRoute] = useState(() => normalise(parseHash(), isExaminer));
  const [category, setCategory] = useState("Numbers");
  const [dictFilter, setDictFilter] = useState("All");
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  // make sure the address bar matches the page we opened on
  useEffect(() => {
    window.history.replaceState(null, "", hashOf(route));
    const onPop = () => setRoute(normalise(parseHash(), isExaminer));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback(
    (id, tab) => {
      const target = normalise(LEGACY[id] && !tab ? LEGACY[id] : { page: id, tab }, isExaminer);
      if (hashOf(target) !== window.location.hash) window.history.pushState(null, "", hashOf(target));
      setRoute(target);
    },
    [isExaminer]
  );

  // a new page starts at the top, and the browser tab says where you are
  useEffect(() => {
    document.title = `${TITLES[route.page]} · Sign Talk`;
    window.scrollTo(0, 0);
    document.querySelector(".main")?.scrollTo?.(0, 0);
  }, [route.page, route.tab]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const [confirmOut, setConfirmOut] = useState(false);
  const askLogout = () => {
    setMenu(false);
    setConfirmOut(true);
  };

  const { page, tab } = route;

  return (
    <div className="shell">
      <Sidebar page={page} onNavigate={(id) => go(id)} user={user} onLogout={askLogout} />
      <main className="main">
        <header className="topbar">
          <h2 className="topbar-title">{TITLES[page]}</h2>
          <div className="st-top-right">
            {!isExaminer && (
              <button className="st-streak-chip" onClick={() => go("progress")} title="Your streak and daily goal">
                🔥 {progress.stats.streak} · {progress.stats.today}/{progress.data.goal} today
              </button>
            )}
            <div className="account" ref={menuRef}>
              <button className="avatar" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} title="Account">
                {user.name[0].toUpperCase()}
              </button>
              {menu && (
                <div className="account-menu" role="menu">
                  <div className="account-who">
                    <strong>{user.name}</strong>
                    <span>{isExaminer ? "Examiner" : "Student"}</span>
                  </div>
                  <button role="menuitem" onClick={askLogout}>
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {error && (
          <div className="banner" role="alert">
            <span>Can't reach the Sign Talk server. Start the backend, then try again.</span>
            <button className="secondary" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}

        {page === "home" && (
          <Home
            signs={signs}
            user={user}
            onOpenCategory={(id) => {
              setDictFilter(id);
              go("learn", "dictionary");
            }}
            onNavigate={go}
          />
        )}
        {page === "learn" && <LearnHub tab={tab} onTab={(t) => go("learn", t)} signs={signs} dictFilter={dictFilter} />}
        {page === "practice" && (
          <PracticeHub tab={tab} onTab={(t) => go("practice", t)} signs={signs} category={category} onCategoryChange={setCategory} />
        )}
        {page === "exams" && (
          <ExamHub tab={tab} onTab={(t) => go("exams", t)} user={user} onExit={() => go("home")} onNavigate={go} />
        )}
        {page === "progress" && (
          <Progress
            signs={signs}
            onPractice={(c) => {
              setCategory(c);
              go("practice", "camera");
            }}
          />
        )}
        {page === "examiner" && isExaminer && <Examiner user={user} />}
        {page === "classresults" && isExaminer && <ClassResults />}

        <footer className="credit">
          Sign content based on resources by the Indian Sign Language Research and Training Centre (ISLRTC),
          Government of India.
        </footer>
      </main>

      {confirmOut && (
        <ConfirmDialog
          title="Log out of Sign Talk?"
          text={isExaminer ? "You can log back in at any time." : "Your progress is saved on this computer."}
          confirm="Log out"
          onConfirm={onLogout}
          onCancel={() => setConfirmOut(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("signtalk_user"));
    } catch {
      return null;
    }
  });
  const [signs, setSigns] = useState([]);
  const [error, setError] = useState("");

  const loadSigns = useCallback(() => {
    fetch(`${API}/api/signs`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then((list) => {
        setSigns(list);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, []);
  useEffect(loadSigns, [loadSigns]);

  useEffect(() => {
    if (!user) document.title = "Log in · Sign Talk";
  }, [user]);

  const handleLogin = (u) => {
    window.history.replaceState(null, "", u?.role === "examiner" ? "#/examiner" : "#/home");
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem("signtalk_user");
    window.history.replaceState(null, "", window.location.pathname); // nothing of the app stays in the address bar
    setUser(null);
  };

  if (!user) return <AuthScreen signs={signs} onLogin={handleLogin} />;

  return (
    <ProgressProvider key={user.email || user.name} user={user} signs={signs}>
      <Shell user={user} signs={signs} error={error} onRetry={loadSigns} onLogout={logout} />
    </ProgressProvider>
  );
}
