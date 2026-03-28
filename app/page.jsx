import Link from "next/link";
import MyTestsList from "@/components/MyTestsList";
import { getAllTestsSummary } from "@/lib/test-bank";

export const dynamic = "force-dynamic";
const GITHUB_URL = "https://github.com/openatpl/openatpl";

export default async function HomePage() {
  const subjects = await getAllTestsSummary();

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="eyebrow">Open Source ATPL Bank</div>
        <h1>EASA 2020 ECQB Bank Practice</h1>
        <p>
          This is an open source ATPL question bank focused on EASA 2020 ECQB practice. Progress is saved locally
          in your browser memory only, with no accounts, no subscriptions, no fees, just questions.
        </p>
        <div className="inline-row hero-actions">
          <Link className="button button-primary" href="/create-test">
            Create Test
          </Link>
          <a className="button button-secondary github-button" href={GITHUB_URL} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="github-icon">
              <path
                fill="currentColor"
                d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.11.79-.25.79-.56l-.01-2.03c-3.2.7-3.88-1.35-3.88-1.35-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.02 1.74 2.67 1.24 3.32.95.1-.73.4-1.24.72-1.53-2.55-.29-5.23-1.27-5.23-5.67 0-1.25.45-2.28 1.17-3.08-.12-.29-.51-1.47.11-3.07 0 0 .96-.31 3.14 1.17.91-.25 1.89-.37 2.86-.37.97 0 1.95.13 2.86.37 2.18-1.48 3.14-1.17 3.14-1.17.62 1.6.23 2.78.11 3.07.73.8 1.17 1.83 1.17 3.08 0 4.41-2.68 5.37-5.24 5.66.41.36.77 1.06.77 2.14l-.01 3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
              />
            </svg>
            Get on GitHub
          </a>
        </div>
      </section>

      <MyTestsList availableSubjectCount={subjects.length} />
    </main>
  );
}
