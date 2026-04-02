import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("id");

  if (!subject || !/^\d{3}$/.test(subject)) {
    return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
  }

  const indexPath = path.join(process.cwd(), "data", "tests", subject, "index.json");

  try {
    const raw = await readFile(indexPath, "utf-8");
    const data = JSON.parse(raw);
    const entries = (data.questions || []).map((q) => ({
      id: q.questionId,
      hasAttachment: Boolean(q.hasAttachment),
    }));
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }
}
