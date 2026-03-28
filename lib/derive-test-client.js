"use client";

const DERIVE_SOURCE_DEFINITIONS = [
  {
    value: "wrong",
    poolKey: "wrongQuestionIds",
    selectLabel: "Incorrect",
    displayLabel: "Incorrect",
    emptyMessage: "No incorrectly answered questions available yet.",
  },
  {
    value: "correct",
    poolKey: "correctQuestionIds",
    selectLabel: "Correct",
    displayLabel: "Correct",
    emptyMessage: "No correctly answered questions available yet.",
  },
  {
    value: "flagged",
    poolKey: "flaggedQuestionIds",
    selectLabel: "Flagged Questions",
    displayLabel: "Flagged",
    emptyMessage: "No flagged questions available yet.",
  },
  {
    value: "withNotes",
    poolKey: "withNotesQuestionIds",
    selectLabel: "Questions with Notes",
    displayLabel: "With Notes",
    emptyMessage: "No questions with notes available yet.",
  },
  {
    value: "withAttachment",
    poolKey: "withAttachmentQuestionIds",
    selectLabel: "Questions with Attachment",
    displayLabel: "With Attachment",
    emptyMessage: "No questions with attachments available.",
  },
  {
    value: "withoutAttachment",
    poolKey: "withoutAttachmentQuestionIds",
    selectLabel: "Questions without Attachment",
    displayLabel: "Without Attachment",
    emptyMessage: "No questions without attachments available.",
  },
];

const SOURCE_TO_DEFINITION = DERIVE_SOURCE_DEFINITIONS.reduce((acc, definition) => {
  acc[definition.value] = definition;
  return acc;
}, {});

const EMPTY_DERIVE_POOLS = Object.freeze({
  wrongQuestionIds: [],
  correctQuestionIds: [],
  flaggedQuestionIds: [],
  withNotesQuestionIds: [],
  withAttachmentQuestionIds: [],
  withoutAttachmentQuestionIds: [],
});

export const DERIVE_SOURCE_PRIORITY = DERIVE_SOURCE_DEFINITIONS.map(
  (definition) => definition.value
);

export function createEmptyDerivePools() {
  return {
    wrongQuestionIds: [],
    correctQuestionIds: [],
    flaggedQuestionIds: [],
    withNotesQuestionIds: [],
    withAttachmentQuestionIds: [],
    withoutAttachmentQuestionIds: [],
  };
}

export function getDerivePoolQuestionIds(derivePools, deriveSource) {
  const definition = SOURCE_TO_DEFINITION[deriveSource] || SOURCE_TO_DEFINITION.wrong;
  const pool = derivePools?.[definition.poolKey];
  return Array.isArray(pool) ? pool : EMPTY_DERIVE_POOLS[definition.poolKey];
}

export function getDeriveSourceDisplayLabel(deriveSource) {
  return (SOURCE_TO_DEFINITION[deriveSource] || SOURCE_TO_DEFINITION.wrong).displayLabel;
}

export function getDeriveSourceSelectLabel(deriveSource) {
  return (SOURCE_TO_DEFINITION[deriveSource] || SOURCE_TO_DEFINITION.wrong).selectLabel;
}

export function getDeriveSourceEmptyMessage(deriveSource) {
  return (SOURCE_TO_DEFINITION[deriveSource] || SOURCE_TO_DEFINITION.wrong).emptyMessage;
}

export function hasAnyDerivePool(derivePools) {
  return DERIVE_SOURCE_DEFINITIONS.some(
    (definition) => getDerivePoolQuestionIds(derivePools, definition.value).length > 0
  );
}

export function firstAvailableDeriveSource(derivePools) {
  return (
    DERIVE_SOURCE_PRIORITY.find(
      (source) => getDerivePoolQuestionIds(derivePools, source).length > 0
    ) || "wrong"
  );
}
