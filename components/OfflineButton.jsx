"use client";

import { useEffect, useState } from "react";
import {
  isOfflineSupported,
  isTestOffline,
  getTestQuestionIds,
  downloadTestForOffline,
  removeTestOffline,
} from "@/lib/offline-client";

export default function OfflineButton({ savedTestId, subjectId, testHref }) {
  const [supported, setSupported] = useState(false);
  const [offline, setOffline] = useState(false);
  const [questionIds, setQuestionIds] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const isPwa = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    setSupported(isPwa && isOfflineSupported());
    setOffline(isTestOffline(savedTestId));
    setQuestionIds(getTestQuestionIds(savedTestId));
  }, [savedTestId]);

  // Don't show if not PWA, or if test hasn't been opened yet (no progress = no questionIds)
  if (!supported || (!offline && !questionIds)) return null;

  async function handleDownload() {
    if (!questionIds) return;
    setDownloading(true);
    setStatus("Starting...");
    try {
      await downloadTestForOffline(savedTestId, subjectId, questionIds, testHref, (done, total, msg) => {
        setProgress({ done, total });
        if (msg) setStatus(msg);
      });
      setOffline(true);
    } catch (err) {
      console.error("Offline download failed:", err);
      setStatus("Failed");
    } finally {
      setDownloading(false);
    }
  }

  async function handleRemove(e) {
    e.stopPropagation();
    await removeTestOffline(savedTestId, subjectId);
    setOffline(false);
  }

  if (downloading) {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="offline-status" onClick={(e) => e.stopPropagation()}>
        <div className="offline-progress-bar">
          <div className="offline-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="tiny">{status} {progress.done}/{progress.total}</p>
      </div>
    );
  }

  if (offline) {
    return (
      <div className="offline-status offline-status-done" onClick={(e) => e.stopPropagation()}>
        <span className="offline-badge">
          <span className="offline-badge-icon">&#x2713;</span>
          Available offline
        </span>
        <button type="button" className="icon-button icon-button-danger offline-trash" onClick={handleRemove} aria-label="Remove offline data" title="Remove offline data">
          🗑
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="button button-secondary button-full offline-download-btn"
      onClick={(e) => { e.stopPropagation(); handleDownload(); }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download for offline ({questionIds.length} questions)
    </button>
  );
}
