"use client";

const OFFLINE_KEY = "openatpl-offline-tests";
const PROGRESS_PREFIX = "openatpl-progress-v1";

export function isOfflineSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function getOfflineTests() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function isTestOffline(savedTestId) {
  return Boolean(getOfflineTests()[savedTestId]);
}

function saveOfflineStatus(savedTestId, status) {
  const current = getOfflineTests();
  if (status) {
    current[savedTestId] = { downloadedAt: new Date().toISOString(), ...status };
  } else {
    delete current[savedTestId];
  }
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(current));
}

export function getTestQuestionIds(savedTestId) {
  if (typeof window === "undefined") return null;
  const key = `${PROGRESS_PREFIX}:saved|${savedTestId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.questionIds) ? parsed.questionIds : null;
  } catch {
    return null;
  }
}

export async function downloadTestForOffline(savedTestId, subjectId, questionIds, onProgress) {
  if (!isOfflineSupported()) throw new Error("Offline not supported");

  await navigator.serviceWorker.ready;
  const cache = await caches.open("openatpl-offline-v1");

  // 1. One bulk request for all questions
  onProgress?.(0, questionIds.length, "Downloading questions...");
  const res = await fetch("/api/subject/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: subjectId, ids: questionIds }),
  });
  if (!res.ok) throw new Error("Failed to fetch questions");
  const data = await res.json();
  const questions = data.questions || [];

  // 2. Cache each question under its individual API URL (so TestRunner finds them offline)
  const attachmentUrls = [];
  for (const q of questions) {
    const file = q._file || `questions/${String(q.number).padStart(4, "0")}.json`;
    const url = `/api/question?subject=${subjectId}&file=${encodeURIComponent(file)}`;
    const cached = new Response(JSON.stringify(q), {
      headers: { "Content-Type": "application/json" },
    });
    await cache.put(new Request(url, { method: "GET" }), cached);

    if (Array.isArray(q.attachments)) {
      for (const att of q.attachments) {
        if (att.publicUrl) attachmentUrls.push(att.publicUrl);
      }
    }
  }

  onProgress?.(questions.length, questions.length + attachmentUrls.length, "Downloading images...");

  // 3. Cache subject entries API
  try {
    const entriesRes = await fetch(`/api/subject?id=${subjectId}`);
    if (entriesRes.ok) {
      await cache.put(new Request(`/api/subject?id=${subjectId}`, { method: "GET" }), entriesRes);
    }
  } catch { /* skip */ }

  // 4. Download attachments
  const uniqueAttUrls = [...new Set(attachmentUrls)];
  let attDone = 0;

  for (const attUrl of uniqueAttUrls) {
    try {
      const attRes = await fetch(attUrl);
      if (attRes.ok) {
        await cache.put(new Request(attUrl, { method: "GET" }), attRes);
      }
    } catch { /* skip */ }

    attDone++;
    if (attDone % 10 === 0 || attDone === uniqueAttUrls.length) {
      onProgress?.(questions.length + attDone, questions.length + uniqueAttUrls.length, "Downloading images...");
    }
  }

  saveOfflineStatus(savedTestId, {
    subjectId,
    questions: questions.length,
    attachments: uniqueAttUrls.length,
  });
}

export async function removeTestOffline(savedTestId, subjectId) {
  if (!isOfflineSupported()) return;

  try {
    const cache = await caches.open("openatpl-offline-v1");
    const keys = await cache.keys();
    for (const req of keys) {
      if (req.url.includes(`subject=${subjectId}`) || req.url.includes(`id=${subjectId}`) || req.url.includes(`/attachments/${subjectId}/`)) {
        await cache.delete(req);
      }
    }
  } catch { /* ignore */ }

  saveOfflineStatus(savedTestId, null);
}
