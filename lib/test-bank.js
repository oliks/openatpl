import { readFile } from "node:fs/promises";
import path from "node:path";

const MANIFEST_PATH = path.join(process.cwd(), "data", "tests", "manifest.json");

let manifestCache = null;
const testCache = new Map();

function isRuntimeCacheEnabled() {
  return process.env.NODE_ENV === "production";
}

function normalizeId(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{3}-\d{4}$/.test(trimmed)) return trimmed;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeOption(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return ["a", "b", "c", "d", "e", "f"].includes(normalized) ? normalized : null;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function buildViewerUrlFromUniqueKey(uniqueKey) {
  const normalized = asString(uniqueKey).trim();
  if (!normalized) {
    return null;
  }
  return `https://atplquestions.com/image/download?image=${normalized}`;
}

function normalizeAttachmentEntry(entry) {
  const entryObject = asObject(entry);
  if (!entryObject) {
    return null;
  }

  const uniqueKey = asString(entryObject.uniqueKey).trim();
  if (!uniqueKey) {
    return null;
  }

  const sourceUrl = asString(entryObject.sourceUrl).trim() || buildViewerUrlFromUniqueKey(uniqueKey);
  const publicUrl = asString(entryObject.publicUrl).trim();

  return {
    id: normalizeId(entryObject.id),
    uniqueKey,
    annexWithGif: Boolean(entryObject.annexWithGif),
    imageType: normalizeId(entryObject.imageType),
    sourceUrl: sourceUrl || null,
    publicUrl: publicUrl || null,
    localPath: asString(entryObject.localPath).trim() || null,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle(items, seedString) {
  const shuffled = [...items];
  const random = mulberry32(hashString(seedString));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizeLegacyQuestionEntry(entry, testId) {
  const entryObject = asObject(entry);
  if (!entryObject) {
    return null;
  }

  const response = asObject(entryObject.response);
  const question = asObject(response?.question);
  const detail = asObject(question?.detail);
  if (!question || !detail) {
    return null;
  }

  const questionId = normalizeId(entryObject.questionId ?? question.id);
  if (questionId == null) {
    return null;
  }

  // Ignore malformed placeholders where the test ID appears as a question ID.
  if (questionId === testId && question.id == null) {
    return null;
  }

  const options = {
    a: asString(detail.optionA),
    b: asString(detail.optionB),
    c: asString(detail.optionC),
    d: asString(detail.optionD),
    e: asString(detail.optionE),
    f: asString(detail.optionF),
  };

  const hasRenderableOption = Object.values(options).some((value) => Boolean(value));
  const stemHtml = asString(detail.title);
  if (!stemHtml && !hasRenderableOption) {
    return null;
  }

  const trueOption = normalizeOption(
    entryObject.trueOption ??
      asObject(entryObject.answerProbe)?.trueOption ??
      asObject(response?.answerProbe)?.trueOption ??
      detail.trueOption
  );

  const imageList = Array.isArray(question.imageList) ? question.imageList : [];
  const attachments = imageList
    .map((image) => {
      const imageObject = asObject(image);
      if (!imageObject) {
        return null;
      }
      return normalizeAttachmentEntry({
        ...imageObject,
        sourceUrl: buildViewerUrlFromUniqueKey(imageObject.uniqueKey),
      });
    })
    .filter(Boolean);

  return {
    id: questionId,
    questionNumber: asString(question.questionNumber) || null,
    stemHtml,
    options,
    correctOption: trueOption,
    attachments,
    lessonId: normalizeId(question.lessonId),
    hasExplanation: Boolean(response?.hasExplanation),
  };
}

function normalizeStandardizedQuestionEntry(entry) {
  const entryObject = asObject(entry);
  if (!entryObject) {
    return null;
  }

  const questionId = normalizeId(
    entryObject.questionId ??
      entryObject.id ??
      asObject(entryObject.question)?.id
  );
  if (questionId == null) {
    return null;
  }

  const detail = asObject(entryObject.detail) ?? asObject(entryObject.question)?.detail;
  const optionsObject = asObject(entryObject.options);
  const options = {
    a: asString(optionsObject?.a ?? detail?.optionA),
    b: asString(optionsObject?.b ?? detail?.optionB),
    c: asString(optionsObject?.c ?? detail?.optionC),
    d: asString(optionsObject?.d ?? detail?.optionD),
    e: asString(optionsObject?.e ?? detail?.optionE),
    f: asString(optionsObject?.f ?? detail?.optionF),
  };

  const stemHtml = asString(entryObject.stemHtml ?? detail?.title);
  const hasRenderableOption = Object.values(options).some((value) => Boolean(value));
  if (!stemHtml && !hasRenderableOption) {
    return null;
  }

  const attachments = Array.isArray(entryObject.attachments)
    ? entryObject.attachments.map((attachment) => normalizeAttachmentEntry(attachment)).filter(Boolean)
    : [];

  return {
    id: questionId,
    questionNumber: asString(entryObject.questionNumber) || null,
    stemHtml,
    options,
    correctOption: normalizeOption(entryObject.correctOption ?? detail?.trueOption),
    attachments,
    lessonId: normalizeId(entryObject.lessonId),
    hasExplanation: Boolean(entryObject.hasExplanation),
  };
}

function isLegacyQuestionsPayload(payload) {
  const questions = Array.isArray(payload?.questions) ? payload.questions : null;
  const first = questions && questions.length ? asObject(questions[0]) : null;
  return Boolean(asObject(first?.response)?.question);
}

function isSubjectIndexPayload(payload) {
  const questions = Array.isArray(payload?.questions) ? payload.questions : null;
  const first = questions && questions.length ? asObject(questions[0]) : null;
  return Boolean(first && typeof first.file === "string");
}

function isStandardizedQuestionsPayload(payload) {
  const questions = Array.isArray(payload?.questions) ? payload.questions : null;
  const first = questions && questions.length ? asObject(questions[0]) : null;
  if (!first) {
    return false;
  }
  return Boolean(
    "stemHtml" in first ||
      "options" in first ||
      "correctOption" in first
  );
}

async function loadQuestionsFromSubjectIndexPayload(payload, sourcePath) {
  const indexEntries = Array.isArray(payload?.questions) ? payload.questions : [];
  const baseDir = path.dirname(sourcePath);

  const loaded = await Promise.all(
    indexEntries.map(async (indexEntry) => {
      const item = asObject(indexEntry);
      if (!item) {
        return null;
      }

      const relativeFile = asString(item.file);
      if (!relativeFile) {
        return normalizeStandardizedQuestionEntry(item);
      }

      const questionPath = path.resolve(baseDir, relativeFile);
      const raw = await readFile(questionPath, "utf-8");
      const questionPayload = JSON.parse(raw);
      return normalizeStandardizedQuestionEntry(questionPayload);
    })
  );

  return loaded.filter(Boolean);
}

async function normalizeQuestionsFromPayload(payload, { sourcePath, testId }) {
  if (isLegacyQuestionsPayload(payload)) {
    const questionsRaw = Array.isArray(payload?.questions) ? payload.questions : [];
    return questionsRaw
      .map((entry) => normalizeLegacyQuestionEntry(entry, testId))
      .filter(Boolean);
  }

  if (isSubjectIndexPayload(payload)) {
    return loadQuestionsFromSubjectIndexPayload(payload, sourcePath);
  }

  if (isStandardizedQuestionsPayload(payload)) {
    const questionsRaw = Array.isArray(payload?.questions) ? payload.questions : [];
    return questionsRaw
      .map((entry) => normalizeStandardizedQuestionEntry(entry))
      .filter(Boolean);
  }

  if (Array.isArray(payload)) {
    return payload
      .map((entry) => normalizeStandardizedQuestionEntry(entry))
      .filter(Boolean);
  }

  return [];
}

async function loadManifest() {
  if (isRuntimeCacheEnabled() && manifestCache) {
    return manifestCache;
  }
  const raw = await readFile(MANIFEST_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("data/tests/manifest.json must contain a JSON array.");
  }
  if (isRuntimeCacheEnabled()) {
    manifestCache = parsed;
    return manifestCache;
  }
  return parsed;
}

async function loadTestFromConfig(config) {
  const id = String(config.id);
  if (isRuntimeCacheEnabled() && testCache.has(id)) {
    return testCache.get(id);
  }

  const sourceFile = asString(config.sourceFile);
  if (!sourceFile) {
    throw new Error(`Test ${id} is missing sourceFile in manifest.`);
  }
  const sourcePath = path.isAbsolute(sourceFile)
    ? sourceFile
    : path.join(process.cwd(), sourceFile);

  const raw = await readFile(sourcePath, "utf-8");
  const payload = JSON.parse(raw);
  const testId = normalizeId(config.id) ?? 0;
  const normalizedQuestions = await normalizeQuestionsFromPayload(payload, {
    sourcePath,
    testId,
  });

  const withAnswers = normalizedQuestions.filter((question) => Boolean(question.correctOption)).length;
  const test = {
    id,
    name: asString(config.name) || `Test ${id}`,
    subject: asString(config.subject) || "General",
    description: asString(config.description),
    sourceFile,
    totalQuestions: normalizedQuestions.length,
    answerCoverage: withAnswers,
    questions: normalizedQuestions,
  };

  if (isRuntimeCacheEnabled()) {
    testCache.set(id, test);
  }
  return test;
}

export async function getAllTestsSummary() {
  const manifest = await loadManifest();
  const tests = await Promise.all(manifest.map((config) => loadTestFromConfig(config)));
  return tests
    .map((test) => ({
      id: test.id,
      name: test.name,
      subject: test.subject,
      description: test.description,
      totalQuestions: test.totalQuestions,
      answerCoverage: test.answerCoverage,
    }))
    .sort((left, right) => Number(left.id) - Number(right.id));
}

export async function getTestById(testId) {
  const id = String(testId);
  const manifest = await loadManifest();
  const config = manifest.find((item) => String(item.id) === id);
  if (!config) {
    return null;
  }
  return loadTestFromConfig(config);
}

export function selectQuestions(questions, options = {}) {
  if (!Array.isArray(questions) || !questions.length) {
    return [];
  }

  const defaultCount = questions.length;
  const requested = Number.parseInt(String(options.count ?? defaultCount), 10);
  const count = Number.isFinite(requested) ? clamp(requested, 1, questions.length) : defaultCount;
  const randomize = Boolean(options.randomize);
  if (!randomize) {
    return questions.slice(0, count);
  }

  const seed = String(options.seed ?? `stable-${count}-${questions.length}`);
  return deterministicShuffle(questions, seed).slice(0, count);
}
