import Practice from "./Practice";
import Quiz from "./Quiz";
import SubTabs from "../components/SubTabs";

const TABS = [
  { id: "camera", label: "Camera practice", hint: "Sign to your webcam" },
  { id: "quiz", label: "Picture quiz", hint: "Name the sign" },
];

export default function PracticeHub({ tab, onTab, signs, category, onCategoryChange }) {
  return (
    <>
      <SubTabs tabs={TABS} value={tab} onChange={onTab} />
      {tab === "camera" ? (
        <Practice signs={signs} category={category} onCategoryChange={onCategoryChange} />
      ) : (
        <Quiz signs={signs} />
      )}
    </>
  );
}
