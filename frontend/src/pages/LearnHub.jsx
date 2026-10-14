import Course from "./Course";
import Dictionary from "./Dictionary";
import SubTabs from "../components/SubTabs";

const TABS = [
  { id: "course", label: "Course", hint: "Guided lessons" },
  { id: "dictionary", label: "Dictionary", hint: "Look up any sign" },
];

export default function LearnHub({ tab, onTab, signs, dictFilter }) {
  return (
    <>
      <SubTabs tabs={TABS} value={tab} onChange={onTab} />
      {tab === "course" ? <Course signs={signs} /> : <Dictionary key={dictFilter} signs={signs} initialFilter={dictFilter} />}
    </>
  );
}
