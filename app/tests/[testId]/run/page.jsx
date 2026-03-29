import Link from "next/link";
import { notFound } from "next/navigation";
import TestRunner from "@/components/TestRunner";
import { getTestById, selectQuestions } from "@/lib/test-bank";

export const dynamic = "force-dynamic";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTestName(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 180) : fallback;
}

function parseQuestionIds(value) {
  if (typeof value !== "string") {
    return [];
  }

  const unique = new Set();
  for (const rawItem of value.split(",")) {
    const item = rawItem.trim();
    if (!item) continue;
    unique.add(item);
  }
  return [...unique];
}

export default async function RunTestPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const test = await getTestById(resolvedParams.testId);
  if (!test) {
    notFound();
  }

  const explicitQuestionIds = parseQuestionIds(resolvedSearchParams?.questionIds);
  const explicitQuestionIdSet = new Set(explicitQuestionIds);
  const scopedEntries = explicitQuestionIds.length
    ? test.entries.filter((entry) => explicitQuestionIdSet.has(String(entry.id)))
    : test.entries;

  if (!scopedEntries.length) {
    notFound();
  }

  const fallbackCount = explicitQuestionIds.length
    ? scopedEntries.length
    : Math.min(25, scopedEntries.length || 1);
  const requestedCount = parsePositiveInt(resolvedSearchParams?.count, fallbackCount);
  const savedTestId = typeof resolvedSearchParams?.savedTestId === "string" && resolvedSearchParams.savedTestId
    ? resolvedSearchParams.savedTestId
    : null;
  const testDisplayName = parseTestName(resolvedSearchParams?.name, test.name);
  const seed = typeof resolvedSearchParams?.seed === "string" && resolvedSearchParams.seed
    ? resolvedSearchParams.seed
    : `${Date.now()}-${test.id}-${requestedCount}`;
  const selectedEntries = selectQuestions(scopedEntries, {
    count: requestedCount,
    randomize: true,
    seed,
  });

  if (!selectedEntries.length) {
    notFound();
  }

  const sessionKey = savedTestId
    ? `saved|${savedTestId}`
    : `${test.id}|${selectedEntries.length}|rand|${seed}|scope-${scopedEntries.length}`;

  return (
    <main className="runner-shell">
      <div className="runner-header">
        <div className="inline-row">
          <Link className="button button-secondary" href="/">
            Back to My Tests
          </Link>
        </div>
        <h1>{testDisplayName}</h1>
      </div>

      <TestRunner
        sessionKey={sessionKey}
        testMeta={{
          id: test.id,
          name: testDisplayName,
          subject: test.subject,
          selectedCount: selectedEntries.length,
          totalCount: test.totalQuestions,
        }}
        questionEntries={selectedEntries}
      />
    </main>
  );
}
