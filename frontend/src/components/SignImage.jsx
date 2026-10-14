import { useState } from "react";
import { shortLabel } from "../modules";

// Shows a sign's picture. If the file is missing it shows the number or letter instead.
// Set `hideAnswer` for quizzes so a missing picture never reveals the answer.
export default function SignImage({ sign, hideAnswer = false }) {
  const [failed, setFailed] = useState(false);
  if (failed || !sign.image_url) {
    return <span className="st-img-fallback">{hideAnswer ? "?" : shortLabel(sign)}</span>;
  }
  return (
    <img
      className="st-img"
      src={sign.image_url}
      alt={hideAnswer ? "Which sign is this?" : `ISL sign for ${sign.name}`}
      onError={() => setFailed(true)}
    />
  );
}
