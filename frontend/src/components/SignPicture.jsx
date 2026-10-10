import { useState } from "react";
import { digitOf } from "../utils";

export default function SignPicture({ sign, big = false }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return big ? (
      <>
        <span className="modal-numeral">{digitOf(sign)}</span>
        <span className="media-note">Sign demonstration coming soon</span>
      </>
    ) : (
      <span>{digitOf(sign)}</span>
    );
  }
  return (
    <img
      className="sign-img"
      src={sign.image_url}
      alt={`ISL sign for ${sign.name}`}
      onError={() => setFailed(true)}
    />
  );
}