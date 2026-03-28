import Link from "next/link";
import { notFound } from "next/navigation";
import CreateTestForm from "@/components/CreateTestForm";
import { getAllTestsSummary } from "@/lib/test-bank";

export const dynamic = "force-dynamic";

export default async function CreateTestPage() {
  const subjects = await getAllTestsSummary();
  if (!subjects.length) {
    notFound();
  }

  return (
    <main className="app-shell">
      <div className="runner-header">
        <div className="inline-row">
          <Link className="button button-secondary" href="/">
            Back to My Tests
          </Link>
          <span className="chip">{subjects.length} subjects available</span>
        </div>
        <h1>Create Test</h1>
        <p className="muted">Choose subject and question count, then save the test.</p>
      </div>

      <section className="setup-card">
        <CreateTestForm subjects={subjects} />
      </section>
    </main>
  );
}
