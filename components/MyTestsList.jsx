"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  appendSavedTest,
  buildSavedTestHref,
  createSavedTest,
  deleteSavedTest,
  loadSavedTests,
  renameSavedTest,
} from "@/lib/saved-tests-client";
import {
  createEmptyDerivePools,
  DERIVE_SOURCE_PRIORITY,
  firstAvailableDeriveSource,
  getDerivePoolQuestionIds,
  getDeriveSourceDisplayLabel,
  getDeriveSourceEmptyMessage,
  getDeriveSourceSelectLabel,
  hasAnyDerivePool,
} from "@/lib/derive-test-client";

const PROGRESS_STORAGE_PREFIX = "openatpl-progress-v1";

function loadTestProgress(savedTestId) {
  if (typeof window === "undefined") return null;
  const key = `${PROGRESS_STORAGE_PREFIX}:saved|${savedTestId}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const answers = parsed?.answers;
    if (!answers || typeof answers !== "object") return null;
    const answered = Object.keys(answers).length;
    const total = Array.isArray(parsed?.questionIds) ? parsed.questionIds.length : 0;
    const correct = parsed?.correctQuestionIds?.length ?? 0;
    const wrong = parsed?.wrongQuestionIds?.length ?? 0;
    const finishedAt = typeof parsed?.finishedAt === "string" ? parsed.finishedAt : null;
    return { answered, total, correct, wrong, finishedAt };
  } catch {
    return null;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeQuestionIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set();
  for (const item of value) {
    const normalized = String(item || "").trim();
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique];
}

function loadDerivePools(savedTestId) {
  if (typeof window === "undefined") {
    return createEmptyDerivePools();
  }

  const key = `${PROGRESS_STORAGE_PREFIX}:saved|${savedTestId}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return createEmptyDerivePools();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      wrongQuestionIds: normalizeQuestionIds(parsed?.wrongQuestionIds),
      correctQuestionIds: normalizeQuestionIds(parsed?.correctQuestionIds),
      flaggedQuestionIds: normalizeQuestionIds(parsed?.flaggedQuestionIds),
      withNotesQuestionIds: normalizeQuestionIds(parsed?.withNotesQuestionIds),
      withAttachmentQuestionIds: normalizeQuestionIds(parsed?.withAttachmentQuestionIds),
      withoutAttachmentQuestionIds: normalizeQuestionIds(parsed?.withoutAttachmentQuestionIds),
    };
  } catch {
    return createEmptyDerivePools();
  }
}

export default function MyTestsList({ availableSubjectCount }) {
  const router = useRouter();
  const [tests, setTests] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [deriveTarget, setDeriveTarget] = useState(null);
  const [derivePools, setDerivePools] = useState(createEmptyDerivePools);
  const [deriveSource, setDeriveSource] = useState("wrong");
  const [deriveCount, setDeriveCount] = useState(1);
  const [deriveError, setDeriveError] = useState("");
  const [progressMap, setProgressMap] = useState({});

  useEffect(() => {
    const saved = loadSavedTests();
    setTests(saved);
    const pm = {};
    for (const t of saved) {
      const p = loadTestProgress(t.id);
      if (p) pm[t.id] = p;
    }
    setProgressMap(pm);
    setHydrated(true);
  }, []);

  const derivePoolQuestionIds = getDerivePoolQuestionIds(derivePools, deriveSource);
  const deriveMaxCount = derivePoolQuestionIds.length;

  useEffect(() => {
    if (!deriveTarget) {
      return;
    }
    if (!deriveMaxCount) {
      setDeriveCount(0);
      return;
    }
    setDeriveCount((previous) => clamp(previous || deriveMaxCount, 1, deriveMaxCount));
  }, [deriveTarget, deriveMaxCount]);

  useEffect(() => {
    if (!deriveTarget) {
      return;
    }

    function onKeyDown(event) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setDeriveTarget(null);
      setDerivePools(createEmptyDerivePools());
      setDeriveSource("wrong");
      setDeriveCount(1);
      setDeriveError("");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deriveTarget]);

  function startRenaming(savedTest) {
    setRenamingId(savedTest.id);
    setRenameValue(savedTest.displayName || savedTest.subjectName);
  }

  function cancelRenaming() {
    setRenamingId("");
    setRenameValue("");
  }

  function submitRename(event, testId) {
    event.preventDefault();
    const updated = renameSavedTest(testId, renameValue);
    setTests(updated);
    cancelRenaming();
  }

  function handleDelete(savedTest) {
    const confirmed = window.confirm(`Delete saved test "${savedTest.displayName}"?`);
    if (!confirmed) {
      return;
    }
    const updated = deleteSavedTest(savedTest.id);
    setTests(updated);
    if (renamingId === savedTest.id) {
      cancelRenaming();
    }
  }

  function closeDeriveModal() {
    setDeriveTarget(null);
    setDerivePools(createEmptyDerivePools());
    setDeriveSource("wrong");
    setDeriveCount(1);
    setDeriveError("");
  }

  function openDeriveModal(savedTest) {
    const pools = loadDerivePools(savedTest.id);
    const preferredSource = firstAvailableDeriveSource(pools);
    const preferredCount = getDerivePoolQuestionIds(pools, preferredSource).length;

    setDeriveTarget(savedTest);
    setDerivePools(pools);
    setDeriveSource(preferredSource);
    setDeriveCount(preferredCount || 0);
    setDeriveError("");
  }

  function createDerivedTest() {
    if (!deriveTarget) {
      return;
    }

    if (!derivePoolQuestionIds.length) {
      setDeriveError(getDeriveSourceEmptyMessage(deriveSource));
      return;
    }

    const requestedCount = clamp(Number(deriveCount) || 1, 1, derivePoolQuestionIds.length);
    const sourceLabel = getDeriveSourceDisplayLabel(deriveSource);
    const baseName = String(deriveTarget.displayName || deriveTarget.subjectName || "Test").trim() || "Test";
    const derivedTest = createSavedTest({
      subjectId: deriveTarget.subjectId,
      subjectName: deriveTarget.subjectName,
      questionCount: requestedCount,
      questionIds: derivePoolQuestionIds,
      displayName: `${baseName} - ${sourceLabel} (${requestedCount}Q)`,
      sourceTestId: deriveTarget.sourceTestId || deriveTarget.subjectId,
      sourceSessionKey: `saved|${deriveTarget.id}`,
      origin: deriveSource,
    });

    const updated = appendSavedTest(derivedTest);
    setTests(updated);
    closeDeriveModal();
    router.push(buildSavedTestHref(derivedTest));
  }

  if (!hydrated) {
    return (
      <section className="my-tests-grid">
        {[1, 2, 3].map(i => (
          <div className="my-test-card skeleton-card" key={i}>
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-subtitle" />
            <div className="skeleton-line skeleton-chips" />
            <div className="skeleton-line skeleton-btn" />
          </div>
        ))}
      </section>
    );
  }

  if (!tests.length) {
    return (
      <section className="empty-state">
        <h2 className="test-title">No saved tests yet</h2>
        <p className="muted">
          Create your first test from {availableSubjectCount} available subject
          {availableSubjectCount === 1 ? "" : "s"}.
        </p>
        <Link className="button button-primary" href="/create-test">
          Create Test
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="my-tests-grid">
        {tests.map((savedTest) => (
          <article className="my-test-card" key={savedTest.id} onClick={() => {
            if (renamingId !== savedTest.id) router.push(buildSavedTestHref(savedTest));
          }} style={{ cursor: renamingId === savedTest.id ? "default" : "pointer" }}>
            <div className="my-test-header">
              <div className="my-test-title-row">
                {renamingId === savedTest.id ? (
                  <form className="rename-inline-form" onSubmit={(event) => submitRename(event, savedTest.id)}>
                    <input
                      className="rename-inline-input"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      maxLength={120}
                      aria-label="Rename saved test"
                      autoFocus
                    />
                    <button className="icon-button" type="submit" aria-label="Save test name" title="Save">
                      ✓
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={cancelRenaming}
                      aria-label="Cancel rename"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <>
                    <h2 className="test-title">{savedTest.displayName}</h2>
                    <div className="title-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => openDeriveModal(savedTest)}
                        aria-label="Create derived test"
                        title="Create derived test"
                      >
                        +
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => startRenaming(savedTest)}
                        aria-label="Rename saved test"
                        title="Rename"
                      >
                        🖊️
                      </button>
                      <button
                        className="icon-button icon-button-danger"
                        type="button"
                        onClick={() => handleDelete(savedTest)}
                        aria-label="Delete saved test"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </>
                )}
              </div>
              <p className="test-subheader">
                {progressMap[savedTest.id]?.finishedAt
                  ? `Completed ${new Date(progressMap[savedTest.id].finishedAt).toLocaleString()}`
                  : `Saved ${savedTest.createdAt ? new Date(savedTest.createdAt).toLocaleString() : "unknown time"}`}
              </p>
              <div className="test-meta">
                <span className="chip">{savedTest.subjectName}</span>
                <span className="chip">{savedTest.questionCount} questions</span>
              </div>
            </div>
            {(() => {
              const p = progressMap[savedTest.id];
              if (!p) return null;
              const isComplete = !!p.finishedAt;
              const scored = p.correct + p.wrong;
              const pct = scored > 0 ? Math.round((p.correct / scored) * 100) : 0;
              if (isComplete) {
                return (
                  <div className="my-test-progress">
                    <div className="session-results-bar">
                      <span className="session-results-correct" style={{ width: `${pct}%` }} />
                      <span className="session-results-incorrect" style={{ width: `${100 - pct}%` }} />
                    </div>
                    <p className="tiny my-test-progress-label">
                      Completed &middot; <span className="session-correct-text">{p.correct} correct</span> &middot; <span className="session-incorrect-text">{p.wrong} wrong</span>
                    </p>
                  </div>
                );
              }
              return (
                <div className="my-test-progress">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${p.total ? Math.round((p.answered / p.total) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="tiny my-test-progress-label">
                    {p.answered}/{p.total} answered
                    {scored > 0 && <> &middot; {pct}% correct</>}
                  </p>
                </div>
              );
            })()}
          </article>
        ))}
      </section>

      {deriveTarget ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeDeriveModal();
            }
          }}
        >
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="derive-test-title">
            <div className="modal-header">
              <h2 id="derive-test-title" className="test-title">
                Create Derived Test
              </h2>
              <button
                type="button"
                className="icon-button"
                onClick={closeDeriveModal}
                aria-label="Close dialog"
                title="Close"
              >
                ✕
              </button>
            </div>

            <p className="tiny" style={{ margin: 0 }}>
              Source: {deriveTarget.displayName}
            </p>

            <label className="field">
              <span>Question source</span>
              <select
                value={deriveSource}
                onChange={(event) => {
                  setDeriveSource(event.target.value);
                  setDeriveError("");
                }}
              >
                {DERIVE_SOURCE_PRIORITY.map((source) => {
                  const sourceIds = getDerivePoolQuestionIds(derivePools, source);
                  return (
                    <option key={source} value={source} disabled={!sourceIds.length}>
                      {getDeriveSourceSelectLabel(source)} ({sourceIds.length})
                    </option>
                  );
                })}
              </select>
            </label>

            <label htmlFor="derive-count-slider" className="slider-label">
              Number of questions: <strong>{deriveMaxCount ? deriveCount : 0}</strong>
            </label>
            <input
              id="derive-count-slider"
              className="question-slider"
              type="range"
              min={1}
              max={Math.max(1, deriveMaxCount)}
              value={deriveMaxCount ? deriveCount : 1}
              onChange={(event) => {
                setDeriveCount(clamp(Number(event.target.value) || 1, 1, Math.max(1, deriveMaxCount)));
                setDeriveError("");
              }}
              disabled={!deriveMaxCount}
            />
            <div className="slider-scale">
              <span>{deriveMaxCount ? 1 : 0}</span>
              <span>{deriveMaxCount}</span>
            </div>

            {deriveError ? <p className="tiny derive-error">{deriveError}</p> : null}
            {!hasAnyDerivePool(derivePools) ? (
              <p className="tiny" style={{ margin: 0 }}>
                No cached filters found yet. Open this test once to refresh local session stats.
              </p>
            ) : null}

            <div className="inline-row modal-actions">
              <button type="button" className="button button-secondary" onClick={closeDeriveModal}>
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={createDerivedTest}
                disabled={!deriveMaxCount}
              >
                Create Test
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
