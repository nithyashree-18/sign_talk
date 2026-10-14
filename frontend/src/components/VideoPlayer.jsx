import { useEffect, useRef, useState } from "react";
import { isMp4, isYouTube } from "../modules";
import SignImage from "./SignImage";

const RATES = [0.25, 0.5, 0.75, 1];

let ytPromise = null;
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previous) previous();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
      ytPromise = null;
      reject(new Error("YouTube API blocked"));
    };
    document.head.appendChild(tag);
  });
  return ytPromise;
}

const videoIdOf = (url) => {
  const m = url.match(/\/embed\/([A-Za-z0-9_-]{11})/) || url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

// One player for every kind of sign media, with slow motion, replay and mirror view.
export default function VideoPlayer({ sign }) {
  const holder = useRef(null);
  const playerRef = useRef(null);
  const mp4Ref = useRef(null);
  const [rate, setRate] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [apiOk, setApiOk] = useState(true);
  const [ready, setReady] = useState(false);

  const youtube = isYouTube(sign);
  const mp4 = isMp4(sign);
  const id = youtube ? videoIdOf(sign.video_url) : null;

  useEffect(() => {
    setRate(1);
    setReady(false);
    if (!youtube || !id) return undefined;
    let cancelled = false;
    const wrapper = holder.current;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !wrapper) return;
        wrapper.innerHTML = "";
        const slot = document.createElement("div");
        wrapper.appendChild(slot);
        playerRef.current = new YT.Player(slot, {
          videoId: id,
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
          events: { onReady: () => !cancelled && setReady(true) },
        });
      })
      .catch(() => !cancelled && setApiOk(false));
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* already gone */
      }
      playerRef.current = null;
      if (wrapper) wrapper.innerHTML = "";
    };
  }, [youtube, id]);

  useEffect(() => {
    if (mp4Ref.current) mp4Ref.current.playbackRate = rate;
  }, [rate, mp4]);

  function pickRate(r) {
    setRate(r);
    try {
      playerRef.current?.setPlaybackRate(r);
    } catch {
      /* player not ready yet */
    }
  }

  function replay() {
    try {
      if (playerRef.current) {
        playerRef.current.seekTo(0, true);
        playerRef.current.playVideo();
      }
      if (mp4Ref.current) {
        mp4Ref.current.currentTime = 0;
        mp4Ref.current.play();
      }
    } catch {
      /* ignore */
    }
  }

  const timed = (youtube && apiOk) || mp4; // speed and replay only make sense for video

  return (
    <div className="st-player">
      <div className={`st-player-media ${mirror ? "st-mirror" : ""}`}>
        {youtube && apiOk && id && <div ref={holder} className="st-player-yt" />}
        {youtube && !apiOk && (
          <iframe
            className="st-player-yt"
            src={sign.video_url}
            title={sign.name}
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
        {mp4 && (
          <video ref={mp4Ref} className="st-player-yt" src={sign.video_url} controls loop muted playsInline autoPlay />
        )}
        {!youtube && !mp4 && (
          <div className="st-player-pic">
            <SignImage sign={sign} />
          </div>
        )}
      </div>

      <div className="st-controls">
        {timed && (
          <div className="st-ctl-group" role="group" aria-label="Playback speed">
            <span className="st-ctl-label">Speed</span>
            {RATES.map((r) => (
              <button
                key={r}
                className={`st-ctl ${rate === r ? "on" : ""}`}
                onClick={() => pickRate(r)}
                disabled={youtube && apiOk && !ready}
              >
                {r === 1 ? "Normal" : `${r}×`}
              </button>
            ))}
          </div>
        )}
        {timed && (
          <button className="st-ctl" onClick={replay} disabled={youtube && apiOk && !ready}>
            ↺ Replay
          </button>
        )}
        <button className={`st-ctl ${mirror ? "on" : ""}`} onClick={() => setMirror((m) => !m)}>
          ⇋ Mirror view
        </button>
      </div>
      {youtube && !apiOk && (
        <p className="st-note">Speed controls need the YouTube player to load. Mirror view still works.</p>
      )}
      {mirror && (
        <p className="st-note">Mirrored: the signer's right hand now appears on your right, like a reflection.</p>
      )}
    </div>
  );
}
