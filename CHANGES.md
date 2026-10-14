# What this update adds (student side)

| Feature | Where |
|---|---|
| 1. Levels (Numbers, then Alphabets, then Daily Words) with watch, practise, quiz per lesson | `pages/Course.jsx`, `pages/Lesson.jsx`, `modules.js` |
| 2. Progress dashboard: completion bars, accuracy over time, signs to revise, badges, daily goal | `pages/Progress.jsx` |
| 3. Practice screen: live hand skeleton, confidence meter with threshold line, Correct / Try again | `pages/Practice.jsx`, `components/HandCam.jsx`, `backend/recognizer.py` |
| 4. Video controls: slow motion, replay, mirror view | `components/VideoPlayer.jsx`, `components/SignModal.jsx` |
| 5. Streaks, daily goal, badges, sign of the day | `progress.jsx`, `pages/Home.jsx`, top bar chip in `App.jsx` |
| 6. Dictionary | `pages/Dictionary.jsx` |

## Honest notes
- Progress is stored in the browser (localStorage), per account. It survives refresh and logout, but not a different browser or computer. Server-side storage is part of the AWS plan (RDS).
- A level opens when 80% of the previous level's lessons are finished (`UNLOCK_AT` in `modules.js`).
- "Skip practice" is allowed so a weak model never blocks a student. Skipped practice is shown with a dash, not a tick.
- Accuracy counts at most one camera attempt every 1.5 seconds, so holding a sign still does not inflate it.
- Slow motion needs the YouTube player script from youtube.com. If it is blocked, the video still plays and only the speed buttons are disabled.
- Existing Quiz, Exam, Login and Examiner pages are untouched. The old Quiz page does not feed the progress dashboard; lesson quizzes do.
