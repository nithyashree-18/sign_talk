import Exam from "./Exam";
import Results from "./Results";
import SubTabs from "../components/SubTabs";

const TABS = [
  { id: "take", label: "Take an exam", hint: "Scored by your camera" },
  { id: "results", label: "My results", hint: "History and certificates" },
];

export default function ExamHub({ tab, onTab, user, onExit, onNavigate }) {
  return (
    <>
      <SubTabs tabs={TABS} value={tab} onChange={onTab} />
      {tab === "take" ? <Exam onExit={onExit} user={user} /> : <Results user={user} onNavigate={onNavigate} />}
    </>
  );
}
