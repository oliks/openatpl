import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get("subject");
  const file = searchParams.get("file");

  if (!subject || !file) {
    return NextResponse.json({ error: "Missing subject or file" }, { status: 400 });
  }

  // Sanitize to prevent path traversal
  if (/\.\./.test(subject) || /\.\./.test(file)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!/^\d{3}$/.test(subject)) {
    return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
  }

  const questionPath = path.join(process.cwd(), "data", "tests", subject, file);

  try {
    const raw = await readFile(questionPath, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
}
