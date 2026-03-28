"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { appendSavedTest, buildSavedTestHref, createSavedTest } from "@/lib/saved-tests-client";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function CreateTestForm({ subjects }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredSubject = searchParams.get("subject");
  const initialSubjectId = useMemo(() => {
    if (!subjects.length) {
      return "";
    }
    if (preferredSubject && subjects.some((subject) => subject.id === preferredSubject)) {
      return preferredSubject;
    }
    return subjects[0].id;
  }, [subjects, preferredSubject]);

  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubjectId);
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) || subjects[0] || null;
  const maxQuestions = selectedSubject ? selectedSubject.totalQuestions : 1;
  const [count, setCount] = useState(selectedSubject ? Math.min(25, selectedSubject.totalQuestions) : 1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function onSubjectChange(nextId) {
    setSelectedSubjectId(nextId);
    const nextSubject = subjects.find((subject) => subject.id === nextId);
    if (!nextSubject) {
      return;
    }
    setCount((previous) => clamp(previous, 1, nextSubject.totalQuestions));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedSubject) {
      return;
    }

    const savedTest = createSavedTest({
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.name,
      questionCount: clamp(Number(count) || 1, 1, selectedSubject.totalQuestions),
    });
    appendSavedTest(savedTest);

    setIsSubmitting(true);
    router.push(buildSavedTestHref(savedTest));
  }

  return (
    <form className="create-test-form" onSubmit={handleSubmit}>
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

      <label htmlFor="question-count-slider" className="slider-label">
        Number of questions: <strong>{count}</strong>
      </label>
      <input
        id="question-count-slider"
        className="question-slider"
        type="range"
        min={1}
        max={maxQuestions}
        value={count}
        onChange={(event) => setCount(clamp(Number(event.target.value), 1, maxQuestions))}
      />
      <div className="slider-scale">
        <span>1</span>
        <span>{maxQuestions}</span>
      </div>

      <button className="button button-primary" type="submit" disabled={isSubmitting || !selectedSubject}>
        {isSubmitting ? "Creating..." : "Create Test"}
      </button>
    </form>
  );
}
