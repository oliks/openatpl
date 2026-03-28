import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div className="eyebrow">OpenATPL</div>
        <h1>Test not found</h1>
        <p>Check the test ID or update <code>data/tests/manifest.json</code>.</p>
      </section>
      <Link className="button button-primary" href="/">
        Back to test list
      </Link>
    </main>
  );
}
