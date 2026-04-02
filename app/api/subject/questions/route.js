import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const subject = body?.id;
  const requestedIds = Array.isArray(body?.ids) ? new Set(body.ids.map(String)) : null;

  if (!subject || !/^\d{3}$/.test(subject)) {
    return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
  }

  const indexPath = path.join(process.cwd(), "data", "tests", subject, "index.json");

  try {
    const raw = await readFile(indexPath, "utf-8");
    const data = JSON.parse(raw);
    let entries = data.questions || [];
    const baseDir = path.join(process.cwd(), "data", "tests", subject);

    if (requestedIds) {
      entries = entries.filter((e) => requestedIds.has(String(e.questionId)));
    }

    const questions = [];
    for (const entry of entries) {
      if (!entry.file) continue;
      try {
        const qRaw = await readFile(path.join(baseDir, entry.file), "utf-8");
        const q = JSON.parse(qRaw);
        q._file = entry.file;
        questions.push(q);
      } catch {
        // Skip missing questions
      }
    }

    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }
}
