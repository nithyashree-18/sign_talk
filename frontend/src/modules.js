// The three levels of the course, in the order they unlock.
export const LEVELS = [
  {
    id: "Numbers",
    title: "Numbers",
    step: "Level 1",
    blurb: "Zero to nine, one hand each.",
    kind: "numbers",
  },
  {
    id: "Alphabets",
    title: "Alphabets",
    step: "Level 2",
    blurb: "Fingerspell A to Z.",
    kind: "letters",
  },
  {
    id: "Daily Words",
    title: "Daily Words",
    step: "Level 3",
    blurb: "Everyday words as short videos.",
    kind: null, // learn-only: no live recognition
  },
];

// A level opens when this share of the previous level's lessons is finished.
export const UNLOCK_AT = 0.8;

export const levelOf = (id) => LEVELS.find((l) => l.id === id);

// local calendar date, e.g. "2026-10-13"
export const todayKey = (d = new Date()) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

export function streakOf(days) {
  const d = new Date();
  if (!days[todayKey(d)]?.length) d.setDate(d.getDate() - 1); // today may still be empty
  let n = 0;
  while (days[todayKey(d)]?.length) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// a different sign every day, the same for everyone
export function signOfTheDay(signs) {
  if (!signs.length) return null;
  const sorted = [...signs].sort((a, b) => a.id - b.id);
  const dayNumber = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
  return sorted[dayNumber % sorted.length];
}

export const isYouTube = (s) => !!s?.video_url && s.video_url.includes("youtube");
export const isMp4 = (s) => !!s?.video_url && s.video_url.endsWith(".mp4");
export const hasVideo = (s) => isYouTube(s) || isMp4(s);

export const shortLabel = (sign) => {
  if (sign.category === "Alphabets") return sign.name.slice(-1).toUpperCase();
  const m = sign.name.match(/\((\d+)\)/);
  return m ? m[1] : sign.name;
};
