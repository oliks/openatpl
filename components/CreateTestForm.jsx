"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { appendSavedTest, buildSavedTestHref, createSavedTest } from "@/lib/saved-tests-client";

const PROGRESS_PREFIX = "openatpl-progress-v1";

function getAnswerHistory() {
  if (typeof window === "undefined") return { seen: new Set(), correct: new Set(), wrong: new Set() };
  const seen = new Set();
  const correct = new Set();
  const wrong = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PROGRESS_PREFIX + ":")) continue;
    if (key.includes(":note:") || key === PROGRESS_PREFIX + ":flags") continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (!data?.answers || typeof data.answers !== "object") continue;
      for (const qid of Object.keys(data.answers)) {
        if (data.answers[qid]) seen.add(qid);
      }
      if (Array.isArray(data.correctQuestionIds)) {
        for (const qid of data.correctQuestionIds) correct.add(qid);
      }
      if (Array.isArray(data.wrongQuestionIds)) {
        for (const qid of data.wrongQuestionIds) wrong.add(qid);
      }
    } catch { /* ignore */ }
  }
  return { seen, correct, wrong };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function allSubjectIds(subjectCode, total) {
  const ids = [];
  for (let i = 1; i <= total; i++) {
    ids.push(`${subjectCode}-${String(i).padStart(4, "0")}`);
  }
  return ids;
}

const FILTERS = [
  { key: "withAttachment", label: "With attachments", group: "attachment" },
  { key: "withoutAttachment", label: "Without attachments", group: "attachment" },
  { key: "notSeen", label: "Not seen before", group: "history", needsHistory: true },
  { key: "seen", label: "Seen before", group: "history", needsHistory: true },
  { key: "correct", label: "Previously correct", group: "history", needsHistory: true },
  { key: "wrong", label: "Previously incorrect", group: "history", needsHistory: true },
];

export default function CreateTestForm({ subjects }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredSubject = searchParams.get("subject");
  const initialSubjectId = useMemo(() => {
    if (!subjects.length) return "";
    if (preferredSubject && subjects.some((s) => s.id === preferredSubject)) return preferredSubject;
    return subjects[0].id;
  }, [subjects, preferredSubject]);

  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubjectId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState(null);
  const [subjectEntries, setSubjectEntries] = useState(null); // [{id, hasAttachment}]
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [filterMode, setFilterMode] = useState("and"); // "and" | "or"

  useEffect(() => {
    setHistory(getAnswerHistory());
  }, []);

  // Fetch subject entries when subject changes
  useEffect(() => {
    if (!selectedSubjectId) return;
    let cancelled = false;
    setSubjectEntries(null);
    fetch(`/api/subject?id=${selectedSubjectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.entries) setSubjectEntries(data.entries);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedSubjectId]);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null;
  const hasHistory = history && history.seen.size > 0;

  // Compute filtered question IDs using full entry data
  const { filteredIds, filteredCount } = useMemo(() => {
    if (!selectedSubject) return { filteredIds: null, filteredCount: 0 };
    const total = selectedSubject.totalQuestions;
    if (activeFilters.size === 0) return { filteredIds: null, filteredCount: total };

    // Need entries loaded for attachment filters
    const entries = subjectEntries || [];
    const allIds = entries.length > 0
      ? entries.map((e) => String(e.id))
      : allSubjectIds(selectedSubject.id, total);
    const prefix = selectedSubject.id + "-";

    // Build per-filter ID sets
    const filterSets = [];
    for (const f of activeFilters) {
      const ids = new Set();
      if (f === "withAttachment") {
        if (entries.length > 0) {
          for (const e of entries) { if (e.hasAttachment) ids.add(String(e.id)); }
        }
      } else if (f === "withoutAttachment") {
        if (entries.length > 0) {
          for (const e of entries) { if (!e.hasAttachment) ids.add(String(e.id)); }
        }
      } else if (f === "notSeen" && history) {
        for (const id of allIds) { if (!history.seen.has(id)) ids.add(id); }
      } else if (f === "seen" && history) {
        for (const id of allIds) { if (history.seen.has(id)) ids.add(id); }
      } else if (f === "correct" && history) {
        for (const id of history.correct) { if (String(id).startsWith(prefix)) ids.add(String(id)); }
      } else if (f === "wrong" && history) {
        for (const id of history.wrong) { if (String(id).startsWith(prefix)) ids.add(String(id)); }
      }
      filterSets.push(ids);
    }

    if (filterSets.length === 0) return { filteredIds: null, filteredCount: total };

    let result;
    if (filterMode === "and") {
      result = new Set(filterSets[0]);
      for (let i = 1; i < filterSets.length; i++) {
        result = new Set([...result].filter((id) => filterSets[i].has(id)));
      }
    } else {
      result = new Set();
      for (const s of filterSets) {
        for (const id of s) result.add(id);
      }
    }

    return { filteredIds: result, filteredCount: result.size };
  }, [selectedSubject, subjectEntries, activeFilters, filterMode, history]);

  const maxQuestions = Math.max(0, filteredCount);
  const [count, setCount] = useState(selectedSubject ? Math.min(25, selectedSubject.totalQuestions) : 1);

  useEffect(() => {
    const safeMax = Math.max(1, maxQuestions);
    setCount((prev) => Math.min(prev, safeMax));
  }, [maxQuestions]);

  function toggleFilter(key) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Mutually exclusive within groups
        const filter = FILTERS.find((f) => f.key === key);
        if (filter) {
          for (const f of FILTERS) {
            if (f.group === filter.group && f.key !== key) next.delete(f.key);
          }
        }
        next.add(key);
      }
      return next;
    });
  }

  function onSubjectChange(nextId) {
    setSelectedSubjectId(nextId);
    const nextSubject = subjects.find((s) => s.id === nextId);
    if (nextSubject) {
      setCount((prev) => clamp(prev, 1, nextSubject.totalQuestions));
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedSubject || maxQuestions <= 0) return;

    const savedTest = createSavedTest({
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.name,
      questionCount: clamp(Number(count) || 1, 1, Math.max(1, maxQuestions)),
      questionIds: filteredIds ? [...filteredIds] : [],
    });
    appendSavedTest(savedTest);

    setIsSubmitting(true);
    router.push(buildSavedTestHref(savedTest));
  }

  // Per-subject counts for display
  const subjectHistory = useMemo(() => {
    if (!history || !selectedSubject) return { seen: 0, correct: 0, wrong: 0 };
    const prefix = selectedSubject.id + "-";
    let seen = 0, correct = 0, wrong = 0;
    for (const id of history.seen) { if (String(id).startsWith(prefix)) seen++; }
    for (const id of history.correct) { if (String(id).startsWith(prefix)) correct++; }
    for (const id of history.wrong) { if (String(id).startsWith(prefix)) wrong++; }
    return { seen, correct, wrong };
  }, [history, selectedSubject]);

  const hasMultipleFilters = activeFilters.size > 1;

  return (
    <form className="create-test-form" onSubmit={handleSubmit}>
      <section className="setup-card">
        <label className="field">
          <span>Subject</span>
          <select
            value={selectedSubjectId}
            onChange={(event) => onSubjectChange(event.target.value)}
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>

        <div className="slider-label">
          <span>Number of questions:</span>
          <input
            type="number"
            className="count-input"
            min={1}
            max={Math.max(1, maxQuestions)}
            value={count}
            onChange={(event) => {
              const val = Number(event.target.value);
              if (val >= 1) setCount(Math.min(val, Math.max(1, maxQuestions)));
              else if (event.target.value === "") setCount(1);
            }}
            onBlur={() => setCount(clamp(count || 1, 1, Math.max(1, maxQuestions)))}
          />
        </div>
        <input
          className="question-slider"
          type="range"
          min={1}
          max={Math.max(1, maxQuestions)}
          value={Math.min(count, Math.max(1, maxQuestions))}
          onChange={(event) => setCount(clamp(Number(event.target.value), 1, Math.max(1, maxQuestions)))}
        />
        <div className="slider-scale">
          <span>1</span>
          <span>{maxQuestions}</span>
        </div>
      </section>

      <section className="setup-card">
        <div className="filter-header">
          <span className="field-heading">Filters</span>
          {hasMultipleFilters && (
            <button
              type="button"
              className="filter-mode-toggle"
              onClick={() => setFilterMode((m) => m === "and" ? "or" : "and")}
              title={filterMode === "and" ? "Matching all filters" : "Matching any filter"}
            >
              {filterMode === "and" ? "AND" : "OR"}
            </button>
          )}
        </div>

        <div className="filter-group">
          <span className="filter-group-label">Attachments</span>
          {FILTERS.filter((f) => f.group === "attachment").map((f) => (
            <label key={f.key} className="filter-option">
              <input
                type="checkbox"
                checked={activeFilters.has(f.key)}
                onChange={() => toggleFilter(f.key)}
              />
              {f.label} ({f.key === "withAttachment" ? selectedSubject?.withAttachment ?? 0 : selectedSubject?.withoutAttachment ?? 0})
            </label>
          ))}
        </div>

        <div className="filter-group">
          <span className="filter-group-label">History</span>
          {FILTERS.filter((f) => f.group === "history").map((f) => {
            const disabled = f.needsHistory && !hasHistory;
            const histCount = f.key === "notSeen" ? (selectedSubject ? selectedSubject.totalQuestions - subjectHistory.seen : 0)
              : f.key === "seen" ? subjectHistory.seen
              : f.key === "correct" ? subjectHistory.correct
              : f.key === "wrong" ? subjectHistory.wrong
              : 0;
            return (
              <label key={f.key} className="filter-option">
                <input
                  type="checkbox"
                  checked={activeFilters.has(f.key)}
                  onChange={() => toggleFilter(f.key)}
                  disabled={disabled}
                />
                {f.label} {disabled ? "(no history)" : `(${histCount})`}
              </label>
            );
          })}
        </div>
      </section>

      <button className="button button-primary button-full" type="submit" disabled={isSubmitting || !selectedSubject || maxQuestions <= 0}>
        {isSubmitting ? "Creating..." : "Create Test"}
      </button>
    </form>
  );
}
