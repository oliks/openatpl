/* ────────────────────────────────────────────────────────────────────────────────────── */
/*  TestRunner – interactive quiz with a global flag list (one array for the whole app)   */
/* ────────────────────────────────────────────────────────────────────────────────────── */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const CoffeeBanner = dynamic(() => import("@/components/CoffeeBanner"), { ssr: false });

const STORAGE_PREFIX = "openatpl-progress-v1";
const FLAGS_KEY = `${STORAGE_PREFIX}:flags`;
const TILES_PER_PAGE = 25;

/* ── helpers ───────────────────────────────────────────────────────────────────────────── */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normalizeOption(v) {
  if (typeof v !== "string") return null;
  const n = v.trim().toLowerCase();
  return ["a", "b", "c", "d", "e", "f"].includes(n) ? n : null;
}

function compareQuestionIds(expected, saved) {
  if (!Array.isArray(saved) || expected.length !== saved.length) return false;
  for (let i = 0; i < expected.length; i++)
    if (String(expected[i]) !== String(saved[i])) return false;
  return true;
}

function sanitizeSavedAnswers(saved, qs) {
  if (!saved || typeof saved !== "object") return {};
  const out = {};
  for (const q of qs) {
    const key = String(q.id);
    const opt = normalizeOption((saved || {})[key]);
    if (opt) out[key] = opt;
  }
  return out;
}

function evaluateQuestion(q, ans) {
  const sel = normalizeOption(ans[String(q.id)]);
  const cor = normalizeOption(q.correctOption);
  if (!sel) return { selected: null, correct: cor, status: "unanswered" };
  if (cor && sel === cor) return { selected: sel, correct: cor, status: "correct" };
  if (cor && sel !== cor) return { selected: sel, correct: cor, status: "wrong" };
  return { selected: sel, correct: null, status: "answered" };
}

function buildAnswerPools(qs, ans) {
  const wrong = [], correct = [];
  for (const q of qs) {
    const st = evaluateQuestion(q, ans).status;
    if (st === "wrong") wrong.push(String(q.id));
    else if (st === "correct") correct.push(String(q.id));
  }
  return { wrongQuestionIds: wrong, correctQuestionIds: correct };
}

function questionOptionLetters(q) {
  const opts = q?.options;
  if (!opts || typeof opts !== "object") return ["a", "b", "c", "d"];
  const avail = Object.keys(opts)
    .map(k => normalizeOption(k))
    .filter(Boolean)
    .sort();
  return avail.length ? avail : ["a", "b", "c", "d"];
}

function isTypingTarget(t) {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return Boolean(t.closest("[contenteditable='true']"));
}

function optionFromKeyboardEvent(e) {
  const byKey = normalizeOption(e?.key);
  if (byKey && ["a", "b", "c", "d"].includes(byKey)) return byKey;
  const code = typeof e?.code === "string" ? e.code : "";
  const map = { KeyA: "a", KeyB: "b", KeyC: "c", KeyD: "d" };
  return map[code] ?? null;
}

function parseElapsedSeconds(v) {
  const p = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(p) && p >= 0 ? p : 0;
}

function formatElapsedSeconds(tot) {
  const safe = Math.max(0, Math.floor(tot || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map(x => String(x).padStart(2, "0")).join(":");
}

function noteStorageKey(questionId) {
  return `${STORAGE_PREFIX}:note:${questionId}`;
}

function buildQuestionDerivePools(questions, answers, flaggedIds, notesById) {
  const answerPools = buildAnswerPools(questions, answers);
  const flaggedLookup = new Set((flaggedIds || []).map(String));
  return {
    wrongQuestionIds: answerPools.wrongQuestionIds,
    correctQuestionIds: answerPools.correctQuestionIds,
    flaggedQuestionIds: questions
      .filter((question) => flaggedLookup.has(String(question.id)))
      .map((question) => String(question.id)),
    withNotesQuestionIds: questions
      .filter((question) => {
        const note = notesById[String(question.id)];
        return typeof note === "string" && note.trim().length > 0;
      })
      .map((question) => String(question.id)),
    withAttachmentQuestionIds: questions
      .filter((question) => Array.isArray(question.attachments) && question.attachments.length > 0)
      .map((question) => String(question.id)),
    withoutAttachmentQuestionIds: questions
      .filter((question) => !Array.isArray(question.attachments) || question.attachments.length === 0)
      .map((question) => String(question.id)),
  };
}

function buildProgressPayload({
  sessionKey,
  questionIds,
  currentIndex,
  answers,
  startedAt,
  elapsedSeconds,
  derivePools,
  savedAt,
  finishedAt,
}) {
  return {
    version: 1,
    sessionKey,
    questionIds,
    currentIndex,
    answers,
    startedAt,
    elapsedSeconds,
    wrongQuestionIds: derivePools.wrongQuestionIds,
    correctQuestionIds: derivePools.correctQuestionIds,
    flaggedQuestionIds: derivePools.flaggedQuestionIds,
    withNotesQuestionIds: derivePools.withNotesQuestionIds,
    withAttachmentQuestionIds: derivePools.withAttachmentQuestionIds,
    withoutAttachmentQuestionIds: derivePools.withoutAttachmentQuestionIds,
    savedAt,
    finishedAt: finishedAt || null,
  };
}

/* ───────────────────── Main component ───────────────────── */

export default function TestRunner({
  testMeta,
  questionEntries,
  sessionKey,
}) {
  const router = useRouter();

  /* ---------- question entries as lightweight question stubs ---------- */
  const questions = useMemo(
    () => questionEntries.map((e) => ({ id: e.id, correctOption: e.correctOption, file: e.file })),
    [questionEntries]
  );

  /* ---------- on-demand question loading ---------- */
  const questionCache = useRef({});
  const [loadedQuestion, setLoadedQuestion] = useState(null);

  /* ---------- local state ---------- */
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tilePage, setTilePage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [personalNotes, setPersonalNotes] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [finishedAt, setFinishedAt] = useState(null);
  const [showFinishScreen, setShowFinishScreen] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [globalFlaggedIds, setGlobalFlaggedIds] = useState([]); // <-- global flags
  const [questionNotesById, setQuestionNotesById] = useState({});

  const storageKey = `${STORAGE_PREFIX}:${sessionKey}`;
  const questionIdFingerprint = questions.map(q => String(q.id)).join("|");
  const questionIds = useMemo(
    () => (questionIdFingerprint ? questionIdFingerprint.split("|") : []),
    [questionIdFingerprint]
  );

  /* ---------- load global flags once ---------- */
  useEffect(() => {
    const raw = window.localStorage.getItem(FLAGS_KEY);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setGlobalFlaggedIds(arr.map(String));
      } catch {
        // ignore malformed flag data
      }
    }
  }, []);

  /* ---------- restore session payload (no flags) ---------- */
  useEffect(() => {
    if (!questions || questions.length === 0) return; // wait for real data

    /* reset everything for a fresh start */
    setHydrated(false);
    setAnswers({});
    setCurrentIndex(0);
    setPersonalNotes("");
    setFinishedAt(null);
    setElapsedSeconds(0);
    setStartedAt(null);
    setQuestionNotesById({});

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setStartedAt(new Date().toISOString());
      setElapsedSeconds(0);
      setHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!compareQuestionIds(questionIds, parsed.questionIds)) {
        setStartedAt(new Date().toISOString());
        setElapsedSeconds(0);
        setHydrated(true);
        return;
      }

      // ---- restore only the global flags (kept in FLAGS_KEY) ----
      // nothing to do here – global flags were already loaded
      // ---------------------------------------------------------

      const restoredAnswers = sanitizeSavedAnswers(parsed.answers, questions);
      const restoredIndex = clamp(
        Number.parseInt(String(parsed.currentIndex ?? 0), 10) || 0,
        0,
        questions.length - 1
      );

      setAnswers(restoredAnswers);
      setCurrentIndex(restoredIndex);
      setElapsedSeconds(parseElapsedSeconds(parsed.elapsedSeconds));
      setStartedAt(
        typeof parsed.startedAt === "string" && parsed.startedAt.trim()
          ? parsed.startedAt
          : new Date().toISOString()
      );
      setSavedAt(typeof parsed.savedAt === "string" ? parsed.savedAt : null);
      setFinishedAt(typeof parsed.finishedAt === "string" ? parsed.finishedAt : null);
    } catch {
      setStartedAt(new Date().toISOString());
      setElapsedSeconds(0);
    } finally {
      setHydrated(true);
    }
  }, [questionIds, questions, storageKey]);

  const derivePools = useMemo(
    () =>
      buildQuestionDerivePools(questions, answers, globalFlaggedIds, questionNotesById),
    [questions, answers, globalFlaggedIds, questionNotesById]
  );

  /* ---------- persist session ---------- */
  useEffect(() => {
    if (!hydrated || !questions || questions.length === 0) return;
    // Don't keep re-saving a finished test
    if (finishedAt) {
      const existing = window.localStorage.getItem(storageKey);
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          if (parsed.finishedAt) return;
        } catch { /* proceed to save */ }
      }
    }

    const payload = buildProgressPayload({
      sessionKey,
      questionIds,
      currentIndex,
      answers,
      startedAt,
      elapsedSeconds,
      derivePools,
      savedAt: new Date().toISOString(),
      finishedAt,
    });
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    setSavedAt(payload.savedAt);
  }, [
    hydrated,
    questionIds,
    derivePools,
    finishedAt,
    currentIndex,
    answers,
    elapsedSeconds,
    questions,
    sessionKey,
    startedAt,
    storageKey,
  ]);

  /* ---------- safety‑net (every 5 s) ---------- */
  useEffect(() => {
    if (!hydrated || !questions || questions.length === 0) return;
    if (!elapsedSeconds || elapsedSeconds % 5 !== 0) return;

    const payload = buildProgressPayload({
      sessionKey,
      questionIds,
      currentIndex,
      answers,
      startedAt,
      elapsedSeconds,
      derivePools,
      savedAt,
      finishedAt,
    });
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    answers,
    currentIndex,
    derivePools,
    finishedAt,
    hydrated,
    elapsedSeconds,
    questionIds,
    questions,
    savedAt,
    sessionKey,
    startedAt,
    storageKey,
  ]);

  /* ---------- timer ---------- */
  useEffect(() => {
    if (!hydrated || finishedAt) return;
    const id = setInterval(() => setElapsedSeconds(p => p + 1), 1000);
    return () => clearInterval(id);
  }, [hydrated, finishedAt]);

  /* ---------- fetch current question on demand ---------- */
  const currentEntry = questions[currentIndex];
  useEffect(() => {
    if (!currentEntry?.file) return;
    const cached = questionCache.current[currentEntry.id];
    if (cached) { setLoadedQuestion(cached); return; }

    let cancelled = false;
    const subject = testMeta.id;
    fetch(`/api/question?subject=${subject}&file=${encodeURIComponent(currentEntry.file)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const q = { ...currentEntry, ...data, id: currentEntry.id };
        questionCache.current[currentEntry.id] = q;
        setLoadedQuestion(q);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentEntry, testMeta.id]);

  /* ---------- compute derived data ---------- */
  const isQuestionLoaded = loadedQuestion?.id === currentEntry?.id && loadedQuestion?.stemHtml;
  const currentQuestion = isQuestionLoaded ? loadedQuestion : currentEntry;
  const evalq = currentEntry ? evaluateQuestion(currentEntry, answers) : null;
  const selected = evalq?.selected ?? null;
  const correct = evalq?.correct ?? null;
  const attachments = Array.isArray(currentQuestion?.attachments)
    ? currentQuestion.attachments
    : [];
  const preview = attachments
    .map((att, i) => {
      const url = typeof att?.publicUrl === "string" ? att.publicUrl.trim() : "";
      return url ? { key: `${att?.uniqueKey || "a"}-${i}`, url } : null;
    })
    .filter(Boolean);
  const missingAtt = Math.max(0, attachments.length - preview.length);
  const answeredCount = questions.reduce(
    (t, q) => t + (normalizeOption(answers[String(q.id)]) ? 1 : 0),
    0
  );
  const correctCountAll = questions.reduce((t, q) => {
    const sel = normalizeOption(answers[String(q.id)]);
    const cor = normalizeOption(q.correctOption);
    return sel && cor && sel === cor ? t + 1 : t;
  }, 0);
  const { wrongQuestionIds } = derivePools;
  const incorrectCount = wrongQuestionIds.length;
  const scoredCount = correctCountAll + incorrectCount;
  const correctRate = scoredCount ? (correctCountAll / scoredCount) * 100 : 0;
  const incorrectRate = scoredCount ? (incorrectCount / scoredCount) * 100 : 0;
  const roundedCorrectRate = Math.round(correctRate);
  const isCurrentFlagged = currentQuestion
    ? globalFlaggedIds.includes(String(currentQuestion.id))
    : false;
  const completion = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;
  const totalPages = Math.max(1, Math.ceil(questions.length / TILES_PER_PAGE));
  const startIdx = tilePage * TILES_PER_PAGE;
  const endIdx = Math.min(startIdx + TILES_PER_PAGE, questions.length);
  const visibleTiles = questions.slice(startIdx, endIdx);

  /* ---------- sync tile page ---------- */
  useEffect(() => setTilePage(p => clamp(p, 0, totalPages - 1)), [totalPages]);
  useEffect(() => {
    const exp = Math.floor(currentIndex / TILES_PER_PAGE);
    setTilePage(p => (p === exp ? p : exp));
  }, [currentIndex]);

  useEffect(() => {
    if (!questions || questions.length === 0) {
      return;
    }
    const nextNotesById = {};
    for (const q of questions) {
      const raw = localStorage.getItem(noteStorageKey(q.id));
      if (typeof raw === "string" && raw.trim().length > 0) {
        nextNotesById[String(q.id)] = raw;
      }
    }
    setQuestionNotesById(nextNotesById);
  }, [questionIdFingerprint, questions]);

  useEffect(() => {
    if (!currentQuestion) {
      setPersonalNotes("");
      return;
    }
    const next = questionNotesById[String(currentQuestion.id)] || "";
    setPersonalNotes(next);
  }, [currentQuestion, questionNotesById]);

  /* ---------- helpers (must be before effects that use them) ---------- */
  const updateAnswer = useCallback((opt) => {
    if (!currentQuestion) return;
    const key = String(currentQuestion.id);
    let isNew = false;
    setAnswers(prev => {
      if (normalizeOption(prev[key])) return prev;
      isNew = true;
      return { ...prev, [key]: opt };
    });
    // Auto-advance on correct answer after a short delay
    const cor = normalizeOption(currentQuestion.correctOption);
    if (isNew && cor && opt === cor) {
      setTimeout(() => {
        startTransition(() => setCurrentIndex(i => Math.min(i + 1, questions.length - 1)));
      }, 600);
    }
  }, [currentQuestion, questions.length]);

  const goToIndex = useCallback((idx) => {
    startTransition(() => setCurrentIndex(clamp(idx, 0, questions.length - 1)));
  }, [questions.length]);

  /* ---------- key handling ---------- */
  useEffect(() => {
    const fn = e => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (finishedAt) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToIndex(currentIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToIndex(currentIndex + 1);
      } else if (e.key === "f" || e.key === "F" || e.code === "KeyF") {
        if (!currentQuestion) return;
        e.preventDefault();
        toggleFlag(currentQuestion.id);
      } else {
        const opt = optionFromKeyboardEvent(e);
        if (!opt || !currentQuestion) return;
        if (!questionOptionLetters(currentQuestion).includes(opt)) return;
        e.preventDefault();
        updateAnswer(opt);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [currentIndex, currentQuestion, finishedAt, goToIndex, updateAnswer]);

  /* ---------- escape → close finish screen ---------- */
  useEffect(() => {
    if (!showFinishScreen) return;
    const fn = e => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowFinishScreen(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [showFinishScreen]);

  /* ---------- helpers ---------- */
  function toggleFlag(id) {
    const key = String(id);
    setGlobalFlaggedIds(prev => {
      const updated = prev.includes(key)
        ? prev.filter(i => i !== key)
        : [...prev, key];
      localStorage.setItem(FLAGS_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function setQuestionNote(txt) {
    if (!currentQuestion) return;
    const key = String(currentQuestion.id);
    const normalized = typeof txt === "string" ? txt : "";
    const hasContent = normalized.trim().length > 0;

    setPersonalNotes(normalized);
    setQuestionNotesById(prev => {
      if (hasContent) {
        return { ...prev, [key]: normalized };
      }
      if (!Object.prototype.hasOwnProperty.call(prev, key)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (hasContent) {
      localStorage.setItem(noteStorageKey(currentQuestion.id), normalized);
    } else {
      localStorage.removeItem(noteStorageKey(currentQuestion.id));
    }
  }

  function optionClass(opt) {
    if (!selected) return "option-button";
    if (correct && opt === correct) return "option-button option-correct";
    if (opt === selected && correct && selected !== correct)
      return "option-button option-wrong";
    return "option-button option-locked";
  }

  function moveTilePage(step) {
    setTilePage(p => clamp(p + step, 0, totalPages - 1));
  }

  /* ---------- render ---------- */
  return (
    <>
      <div className="runner-layout">
        <section className="runner-card">
          <div className="runner-top-row">
            <span className="chip">
              Question {currentIndex + 1} / {questions.length}
            </span>
            {currentQuestion ? (
              <button
                type="button"
                className="flag-button"
                aria-pressed={isCurrentFlagged}
                aria-label={
                  isCurrentFlagged
                    ? "Unflag question"
                    : "Flag question"
                }
                onClick={() => toggleFlag(currentQuestion.id)}
                title={isCurrentFlagged ? "Unflag question (F)" : "Flag question (F)"}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="flag-icon"
                  aria-hidden="true"
                >
                  <path
                    d="M5 21V4c5 0 5-2 10-2v8c-5 0-5 2-10 2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>

          <div style={{ marginTop: "0.85rem" }} className="progress-track">
            <div className="progress-fill" style={{ width: `${completion}%` }} />
          </div>

          <article className="question-panel">
            {!isQuestionLoaded ? (
              <div className="stem stem-loading">
                <div className="skeleton-line" style={{ width: "90%" }} />
                <div className="skeleton-line" style={{ width: "70%" }} />
                <div className="skeleton-line" style={{ width: "80%" }} />
              </div>
            ) : (
              <div
                className="stem"
                dangerouslySetInnerHTML={{
                  __html: currentQuestion?.stemHtml ?? "<p>Question text unavailable.</p>",
                }}
              />
            )}
            {preview.length > 0 && (
              <section className="attachment-section">
                <div className="attachment-grid">
                  {preview.map(att => (
                    <a
                      key={att.key}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="attachment-link"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={att.url}
                        alt="Question attachment preview"
                        className="attachment-image"
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}
            {missingAtt > 0 && (
              <p className="tiny" style={{ marginTop: "0.45rem" }}>
                {missingAtt} attachment{missingAtt === 1 ? "" : "s"} not available locally yet.
              </p>
            )}
          </article>

          <CoffeeBanner
            answeredCount={answeredCount}
            onShow={() => setShowSupport(true)}
            onDismiss={() => setShowSupport(false)}
          />

          {!showSupport && isQuestionLoaded && (
            <div className="option-list">
              {questionOptionLetters(currentQuestion)
                .map(opt => ({
                  option: opt,
                  html: currentQuestion?.options?.[opt] ?? "",
                }))
                .filter(it => it.html)
                .map(it => (
                  <button
                    type="button"
                    key={it.option}
                    className={optionClass(it.option)}
                    disabled={Boolean(selected)}
                    onClick={() => updateAnswer(it.option)}
                  >
                    <span className="option-letter">{it.option}</span>
                    <span
                      className="option-content"
                      dangerouslySetInnerHTML={{ __html: it.html }}
                    />
                  </button>
                ))}
            </div>
          )}

          <div className="runner-nav">
            <button
              type="button"
              className="button button-secondary nav-arrow"
              disabled={currentIndex <= 0 || isPending}
              onClick={() => goToIndex(currentIndex - 1)}
              aria-label="Previous question"
            >
              &larr;
            </button>
            <p className="shortcut-hints">
              <kbd>&larr;</kbd><kbd>&rarr;</kbd> navigate
              &nbsp;&middot;&nbsp;
              <kbd>A</kbd>-<kbd>D</kbd> answer
              &nbsp;&middot;&nbsp;
              <kbd>F</kbd> flag
            </p>
            <button
              type="button"
              className="button button-secondary nav-arrow"
              disabled={currentIndex >= questions.length - 1 || isPending}
              onClick={() => goToIndex(currentIndex + 1)}
              aria-label="Next question"
            >
              &rarr;
            </button>
          </div>
        </section>

        <aside className="runner-sidebar">
          <div className="session-summary">
            <h2 className="test-title session-title">
              Session
            </h2>
            <p className="muted session-name">
              {testMeta.name}
            </p>
            {testMeta?.subject ? (
              <p className="tiny session-subject">
                {testMeta.subject}
              </p>
            ) : null}
            <p className="tiny session-line">
              Time spent: {formatElapsedSeconds(elapsedSeconds)}
            </p>
            <p className="tiny session-line">
              {finishedAt
                ? `Completed at: ${new Date(finishedAt).toLocaleString()}`
                : `Last saved: ${hydrated && savedAt ? new Date(savedAt).toLocaleString() : "Loading..."}`}
            </p>
            <div className="session-stats">
              <p className="tiny session-stat-row">
                <span>Answered</span>
                <strong>{answeredCount} / {questions.length}</strong>
              </p>
              <p className="tiny session-rate-label">{roundedCorrectRate}% correct</p>
              <div className="session-results-bar" aria-label="Correct and incorrect answers ratio">
                <span className="session-results-correct" style={{ width: `${correctRate}%` }} />
                <span className="session-results-incorrect" style={{ width: `${incorrectRate}%` }} />
              </div>
              <p className="tiny session-results-counts">
                <span className="session-correct-text">{correctCountAll} correct</span>
                <span className="session-incorrect-text">{incorrectCount} incorrect</span>
              </p>
            </div>
            <button
              type="button"
              className="button button-primary button-full"
              disabled={answeredCount < questions.length}
              onClick={() => {
                setFinishedAt(new Date().toISOString());
                setShowFinishScreen(true);
              }}
              style={{ marginTop: "0.6rem" }}
            >
              Finish Test
            </button>
          </div>

          <div className="session-note-tile">
            <textarea
              className="session-note-input"
              value={personalNotes}
              onChange={e => setQuestionNote(e.target.value)}
              placeholder="Personal notes"
              aria-label="Personal notes"
              maxLength={500}
            />
            {personalNotes.length > 0 && (
              <p className="note-char-count">{personalNotes.length}/500</p>
            )}
          </div>

          <div className="tile-panel">
            <div className="tile-pagination">
              <button
                type="button"
                className="button button-secondary tile-page-button"
                disabled={tilePage <= 0}
                onClick={() => moveTilePage(-1)}
                aria-label="Previous tile page"
              >
                &larr;
              </button>
              <span className="tiny">
                Tiles {startIdx + 1}-{endIdx} / {questions.length}
              </span>
              <button
                type="button"
                className="button button-secondary tile-page-button"
                disabled={tilePage >= totalPages - 1}
                onClick={() => moveTilePage(1)}
                aria-label="Next tile page"
              >
                &rarr;
              </button>
            </div>

            <div className="tile-grid">
              {visibleTiles.map((q, i) => {
                const idx = startIdx + i;
                const stat = evaluateQuestion(q, answers).status;
                const flagged = globalFlaggedIds.includes(String(q.id));
                return (
                  <button
                    type="button"
                    key={q.id}
                    className={`question-tile ${stat} ${idx === currentIndex ? "active" : ""} ${
                      flagged ? "flagged" : ""
                    }`}
                    aria-label={`Question ${idx + 1}: ${stat}${flagged ? ", flagged" : ""}`}
                    aria-current={idx === currentIndex ? "true" : undefined}
                    onClick={() => goToIndex(idx)}
                  >
                    {idx + 1}
                    {flagged ? (
                      <span className="tile-flag" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="tile-flag-icon">
                          <path
                            d="M5 21V4c5 0 5-2 10-2v8c-5 0-5 2-10 2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {showFinishScreen && (
        <div className="modal-backdrop">
          <section className="finish-screen" role="dialog" aria-modal="true">
            <button
              type="button"
              className="icon-button finish-close"
              onClick={() => setShowFinishScreen(false)}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
            <h2
              className="finish-heading"
              style={{ color: roundedCorrectRate >= 75 ? "var(--ok)" : "var(--warn)" }}
            >
              {roundedCorrectRate >= 75 ? "Pass" : "Fail"}
            </h2>
            <p className="finish-rate">{roundedCorrectRate}%</p>
            <div className="session-results-bar finish-bar">
              <span className="session-results-correct" style={{ width: `${correctRate}%` }} />
              <span className="session-results-incorrect" style={{ width: `${incorrectRate}%` }} />
            </div>
            <p className="finish-detail">
              <span className="session-correct-text">{correctCountAll} correct</span>
              {" "}&middot;{" "}
              <span className="session-incorrect-text">{incorrectCount} wrong</span>
              {" "}&middot;{" "}
              {questions.length} questions
            </p>
            <p className="finish-message">
              If OpenATPL helps your studies, consider supporting the project.
            </p>
            <button
              type="button"
              className="button button-primary button-full finish-bmc-btn"
              onClick={() => window.open("https://buy.stripe.com/28E4gz6nY2XtgRIdAgfEk0Q", "_blank")}
            >
              Support this project
            </button>
            <button
              type="button"
              className="button button-secondary button-full"
              onClick={() => router.push("/")}
            >
              Back to My Tests
            </button>
          </section>
        </div>
      )}

    </>
  );
}
