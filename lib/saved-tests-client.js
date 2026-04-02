"use client";

const STORAGE_KEY = "openatpl-saved-tests-v1";
const LEGACY_SUBJECT_ID_MAP = {
  "42901979": "032",
};

function randomChunk() {
  return Math.floor(Math.random() * 1_000_000).toString(36);
}

function normalizeSubjectId(value) {
  const normalized = String(value || "");
  return LEGACY_SUBJECT_ID_MAP[normalized] || normalized;
}

function normalizeQuestionIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set();
  for (const item of value) {
    const normalized = String(item || "").trim();
    if (!normalized) {
      continue;
    }
    unique.add(normalized);
  }
  return [...unique];
}

function defaultDisplayName({ subjectName, questionCount }) {
  return `${subjectName} (${questionCount}Q)`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildSavedTestHref(savedTest) {
  const questionIds = normalizeQuestionIds(savedTest.questionIds);
  const requestedCount = Number.parseInt(String(savedTest.questionCount ?? 0), 10) || 0;
  const questionCount = questionIds.length
    ? clamp(requestedCount || questionIds.length, 1, questionIds.length)
    : Math.max(1, requestedCount);
  const displayName = String(savedTest.displayName || "").trim();
  const search = new URLSearchParams();
  search.set("count", String(questionCount));
  search.set("seed", savedTest.seed);
  search.set("savedTestId", savedTest.id);
  if (displayName) {
    search.set("name", displayName);
  }
  if (questionIds.length) {
    search.set("questionIds", questionIds.join(","));
  }
  if (savedTest.filter) {
    search.set("filter", savedTest.filter);
  }
  return `/tests/${normalizeSubjectId(savedTest.subjectId)}/run?${search.toString()}`;
}

export function loadSavedTests() {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        id: String(entry.id || ""),
        subjectId: normalizeSubjectId(entry.subjectId),
        subjectName: String(entry.subjectName || ""),
        displayName:
          typeof entry.displayName === "string" && entry.displayName.trim()
            ? entry.displayName.trim()
            : "",
        questionCount: Number.parseInt(String(entry.questionCount || 0), 10) || 0,
        seed: String(entry.seed || ""),
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : null,
        questionIds: normalizeQuestionIds(entry.questionIds),
        sourceTestId:
          typeof entry.sourceTestId === "string" && entry.sourceTestId.trim()
            ? entry.sourceTestId.trim()
            : null,
        sourceSessionKey:
          typeof entry.sourceSessionKey === "string" && entry.sourceSessionKey.trim()
            ? entry.sourceSessionKey.trim()
            : null,
        origin:
          typeof entry.origin === "string" && entry.origin.trim()
            ? entry.origin.trim()
            : null,
      }))
      .filter(
        (entry) =>
          Boolean(entry.id) &&
          Boolean(entry.subjectId) &&
          Boolean(entry.seed) &&
          Number.isFinite(entry.questionCount) &&
          entry.questionCount > 0
      )
      .map((entry) => ({
        ...entry,
        displayName: entry.displayName || defaultDisplayName(entry),
      }))
      .sort((left, right) => {
        const leftTs = left.createdAt ? Date.parse(left.createdAt) : 0;
        const rightTs = right.createdAt ? Date.parse(right.createdAt) : 0;
        return rightTs - leftTs;
      });
  } catch {
    return [];
  }
}

export function saveSavedTests(entries) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function createSavedTest({
  subjectId,
  subjectName,
  questionCount,
  questionIds = [],
  displayName: requestedDisplayName = "",
  sourceTestId = null,
  sourceSessionKey = null,
  origin = null,
  filter = null,
}) {
  const normalizedQuestionIds = normalizeQuestionIds(questionIds);
  const parsedQuestionCount = Number.parseInt(String(questionCount || 0), 10);
  const fallbackQuestionCount = normalizedQuestionIds.length || 0;
  const safeQuestionCount = Number.isFinite(parsedQuestionCount) && parsedQuestionCount > 0
    ? parsedQuestionCount
    : fallbackQuestionCount;
  const normalizedQuestionCount = normalizedQuestionIds.length
    ? clamp(safeQuestionCount, 1, normalizedQuestionIds.length)
    : safeQuestionCount;
  const id = `${Date.now()}-${randomChunk()}`;
  const seed = `${Date.now()}-${randomChunk()}`;
  const customDisplayName = String(requestedDisplayName || "").trim();
  const resolvedDisplayName =
    customDisplayName ||
    defaultDisplayName({
      subjectName: String(subjectName),
      questionCount: normalizedQuestionCount,
    });
  return {
    id,
    subjectId: normalizeSubjectId(subjectId),
    subjectName: String(subjectName),
    displayName: resolvedDisplayName,
    questionCount: normalizedQuestionCount,
    seed,
    createdAt: new Date().toISOString(),
    questionIds: normalizedQuestionIds,
    sourceTestId: typeof sourceTestId === "string" && sourceTestId.trim() ? sourceTestId.trim() : null,
    sourceSessionKey:
      typeof sourceSessionKey === "string" && sourceSessionKey.trim() ? sourceSessionKey.trim() : null,
    origin: typeof origin === "string" && origin.trim() ? origin.trim() : null,
    filter: typeof filter === "string" && filter.trim() ? filter.trim() : null,
  };
}

export function appendSavedTest(savedTest) {
  const existing = loadSavedTests();
  const updated = [savedTest, ...existing.filter((entry) => entry.id !== savedTest.id)];
  const limited = updated.slice(0, 200);
  saveSavedTests(limited);
  return limited;
}

export function renameSavedTest(testId, nextName) {
  const normalizedName = String(nextName || "").trim();
  if (!normalizedName) {
    return loadSavedTests();
  }

  const existing = loadSavedTests();
  const updated = existing.map((entry) =>
    entry.id === testId
      ? {
          ...entry,
          displayName: normalizedName,
        }
      : entry
  );
  saveSavedTests(updated);
  return updated;
}

export function deleteSavedTest(testId) {
  const existing = loadSavedTests();
  const updated = existing.filter((entry) => entry.id !== testId);
  saveSavedTests(updated);
  return updated;
}
