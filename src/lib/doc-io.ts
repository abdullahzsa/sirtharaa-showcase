/**
 * Browser-only document parsing and export.
 * Every heavy dependency is imported dynamically inside the function that
 * needs it, so nothing is pulled into the SSR bundle or the initial chunk.
 */
import { canonicalSection } from "./section-aliases";
import { SECTIONS_AR, SECTIONS_EN } from "./ats-sample";
import { TEMPLATE_STYLES, type TemplateId } from "./templates";

export type ParseErrorCode =
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "PASSWORD_PROTECTED"
  | "DOCX_NO_TEXT"
  | "PDF_HAS_NO_TEXT_LAYER"
  | "ARABIC_PDF_UNSUPPORTED"
  | "UNKNOWN_PARSE_ERROR";

export class ResumeParseError extends Error {
  code: ParseErrorCode;
  constructor(code: ParseErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ResumeParseError";
    this.code = code;
  }
}

export class ArabicPdfUnsupported extends ResumeParseError {
  constructor() {
    super("ARABIC_PDF_UNSUPPORTED");
    this.name = "ArabicPdfUnsupported";
  }
}

const ARABIC = /[\u0600-\u06FF]/;

export const hasArabic = (text: string) => ARABIC.test(text);

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/* ------------------------------------------------------------------ parse */

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ResumeParseError("FILE_TOO_LARGE", `FILE_TOO_LARGE:${Math.round(file.size / 1024 / 1024)}MB`);
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return extractDocx(file);
  if (name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".txt") || name.endsWith(".md")) return file.text();
  throw new ResumeParseError("UNSUPPORTED_FILE_TYPE");
}

type MammothApi = {
  extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
};

async function extractDocx(file: File): Promise<string> {
  let api: MammothApi["extractRawText"];
  try {
    // Try the browser build first; fall back to the main entry if the bundler
    // resolves it differently.
    const mod = (await import(/* @vite-ignore */ "mammoth/mammoth.browser.js")) as unknown as {
      extractRawText?: MammothApi["extractRawText"];
      default?: MammothApi;
    };
    api = mod.extractRawText ?? mod.default?.extractRawText ?? (mod as MammothApi).extractRawText;
  } catch {
    const mod = (await import("mammoth")) as MammothApi;
    api = mod.extractRawText;
  }

  const arrayBuffer = await file.arrayBuffer();
  let result: { value: string };
  try {
    result = await api({ arrayBuffer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/password|encrypted/i.test(msg)) {
      throw new ResumeParseError("PASSWORD_PROTECTED");
    }
    throw new ResumeParseError("UNKNOWN_PARSE_ERROR", msg);
  }
  const text = result.value.replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new ResumeParseError("DOCX_NO_TEXT");
  return text;
}

/**
 * The PDF reader uses very new built-ins (Uint8Array#toHex, Promise.withResolvers,
 * Map#getOrInsertComputed) that many browsers lack. Install them before it loads.
 */
export function installPdfPolyfills() {
  const U8 = Uint8Array.prototype as unknown as Record<string, unknown>;
  if (typeof U8["toHex"] !== "function")
    U8["toHex"] = function (this: Uint8Array) {
      let out = "";
      for (let i = 0; i < this.length; i++) out += this[i]!.toString(16).padStart(2, "0");
      return out;
    };
  const P = Promise as unknown as Record<string, unknown>;
  if (typeof P["withResolvers"] !== "function")
    P["withResolvers"] = function () {
      let resolve!: (v: unknown) => void;
      let reject!: (e: unknown) => void;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  for (const C of [Map, WeakMap] as unknown as { prototype: Record<string, unknown> }[]) {
    if (!C.prototype["getOrInsertComputed"])
      C.prototype["getOrInsertComputed"] = function (
        this: Map<unknown, unknown>,
        k: unknown,
        fn: (k: unknown) => unknown,
      ) {
        if (!this.has(k)) this.set(k, fn(k));
        return this.get(k);
      };
    if (!C.prototype["getOrInsert"])
      C.prototype["getOrInsert"] = function (this: Map<unknown, unknown>, k: unknown, v: unknown) {
        if (!this.has(k)) this.set(k, v);
        return this.get(k);
      };
  }
}

async function extractPdf(file: File): Promise<string> {
  installPdfPolyfills();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const workerUrl = (
      (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")) as unknown as {
        default: string;
      }
    ).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    // If the worker URL import fails, pdfjs-dist may still work in some
    // bundler configurations; let getDocument fail cleanly instead.
  }

  const data = new Uint8Array(await file.arrayBuffer());
  let doc: { numPages: number; getPage: (n: number) => Promise<unknown> };
  try {
    doc = (await pdfjs.getDocument({ data }).promise) as typeof doc;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/password|encrypted/i.test(msg)) {
      throw new ResumeParseError("PASSWORD_PROTECTED");
    }
    throw new ResumeParseError("UNKNOWN_PARSE_ERROR", msg);
  }

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = (await doc.getPage(i)) as {
      getTextContent: () => Promise<{ items: unknown[] }>;
    };
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      const it = item as { str?: string; hasEOL?: boolean };
      if (typeof it.str !== "string") continue;
      line += it.str;
      if (it.hasEOL) {
        lines.push(line.trimEnd());
        line = "";
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
    pages.push(lines.join("\n"));
  }
  const text = pages
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) throw new ResumeParseError("PDF_HAS_NO_TEXT_LAYER");
  return text;
}

/* ----------------------------------------------------------- resume blocks */

/** Any recognised section heading, template or synonym ("Key Skills", "اللغات"). */
const HEADINGS = { has: (n: string) => canonicalSection(n) !== null };
/** Normalised template heading a line stands for (synonyms folded in). */
const sectionOf = (line: string) => normalizeHeading(canonicalSection(line) ?? line);

/** Professional Experience — the only section with employer / role lines. */
const EXPERIENCE_HEADINGS = new Set([SECTIONS_EN[2], SECTIONS_AR[2]].map((h) => normalizeHeading(h)));

/** Sections the template writes as plain paragraphs, never bullets. */
const PLAIN_HEADINGS = new Set(
  [SECTIONS_EN[3], SECTIONS_EN[4], SECTIONS_EN[5], SECTIONS_AR[3], SECTIONS_AR[4], SECTIONS_AR[5]].map((h) =>
    normalizeHeading(h),
  ),
);

function normalizeHeading(s: string): string {
  return s
    .replace(/[#*_:•\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type Segment = { text: string; bold: boolean };

export type DocLine =
  | { kind: "name"; text: string }
  | { kind: "contact"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "employer"; text: string; org: string; dates: string }
  | { kind: "role"; text: string; role: string; dates: string }
  | { kind: "strong"; text: string; segments: Segment[] }
  | { kind: "bullet"; text: string; tight: boolean }
  | { kind: "text"; text: string };

/**
 * Headings the writer uses for the trailing list of items it could not verify.
 * These belong to the conversation, never to the resume the candidate sends.
 */
const UNVERIFIED_HEADING =
  /^(left\s+unverified|still\s+unverified|unverified(\s+items?)?|open\s+items|pending\s+verification|بنود\s+معلّقة|بنود\s+معلقة|بنود\s+بحاجة\s+إلى\s+تحقق|بنود\s+غير\s+متحققة|لم\s+يتم\s+التحقق|متروك\s+دون\s+تحقق)(?=$|[\s:،.\-–—])/iu;

/** Inline markers the writer attaches to a claim it has not confirmed. */
const VERIFY_TAG = /\s*(\[\s*(?:verify|للتحقق|تحقق)\s*\]|\(\s*(?:verify|للتحقق)\s*\))/gi;

/**
 * A markdown horizontal rule. The writer often puts one above its trailing
 * notes; once those notes are cut the rule is left dangling, and the exporter
 * would otherwise print it as a literal line of text at the foot of the resume.
 */
export const DIVIDER_LINE = /^\s*(?:-{3,}|\*{3,}|_{3,}|[–—]{3,})\s*$/;

/**
 * Removes everything the writer flagged as unverified: the trailing
 * "Left unverified" list and any inline [VERIFY] markers. Exports and the
 * clipboard must carry only content the candidate stands behind, so this runs
 * on every resume before it leaves the app — including versions saved earlier.
 */
export function stripUnverified(resume: string): string {
  const out: string[] = [];
  for (const raw of resume.split(/\r?\n/)) {
    const bare = raw
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/\*\*/g, "")
      .replace(/^\s*[-•*·]\s+/, "")
      .trim();
    if (UNVERIFIED_HEADING.test(bare)) break;
    // Markdown rules are layout syntax, never resume content.
    if (DIVIDER_LINE.test(raw)) continue;
    const line = raw.replace(VERIFY_TAG, "");
    // A line that existed only to carry the marker is dropped entirely.
    if (raw.trim() && !line.replace(/^\s*[-•*·]\s*/, "").trim()) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Strips markdown decoration so the exported file stays ATS-plain. */
function clean(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(?!\s)(.+?)\*/g, "$1$2")
    .replace(/`+/g, "")
    .trimEnd();
}


/** Splits a partially bold line (company / role + dates) into runs. */
function toSegments(raw: string): Segment[] {
  const t = raw.replace(/^\s*#{1,6}\s*/, "").trim();
  const out: Segment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (m.index > last) out.push({ text: t.slice(last, m.index), bold: false });
    out.push({ text: m[1] ?? "", bold: true });
    last = m.index + m[0].length;
  }
  if (last < t.length) out.push({ text: t.slice(last), bold: false });
  return out.filter((s) => s.text !== "");
}

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?|[\\u0600-\\u06FF]{3,10}";
const YEAR = "\\d{4}|[\\u0660-\\u0669]{4}";
const ENDPOINT = `(?:(?:${MONTH})\\s+)?(?:${YEAR})`;
const OPEN_END = "present|now|current|to date|حتى الآن|الآن";
const DATE_RANGE = new RegExp(`((?:${ENDPOINT})\\s*[–—-]\\s*(?:${OPEN_END}|(?:${ENDPOINT})))\\s*$`, "i");

/** Pulls a trailing date range off an employer / role line. */
function splitDates(text: string): { head: string; dates: string } {
  const m = DATE_RANGE.exec(text.trim());
  if (!m) return { head: text.trim(), dates: "" };
  const dates = (m[1] ?? "").trim();
  const head = text
    .trim()
    .slice(0, m.index)
    .replace(/[\s|,;·—–-]+$/u, "")
    .trim();
  return head ? { head, dates } : { head: text.trim(), dates: "" };
}

const letters = (s: string) => s.replace(/[^A-Za-z]/g, "");

const ORG_SUFFIX =
  /\b(inc|llc|ltd|limited|corp|corporation|co|company|group|partners|consulting|consultants|services|solutions|technologies|tech|bank|hospital|university|college|institute|authority|commission|ministry|aramco|sabic|stc|mobily|zain|neom|pif|riyad bank|al rajhi|saudi airlines|aramex|nesma)\b/i;

/** An employer line: bolded, all-caps, or a clear organization name. */
function looksLikeEmployer(raw: string, head: string): boolean {
  if (/^\s*\*\*/.test(raw.trim())) return true;
  const l = letters(head);
  if (l.length >= 3 && l === l.toUpperCase()) return true;
  // "PRICEWATERHOUSECOOPERS (PwC)" — the parenthetical trade name breaks the
  // all-caps test, so judge the part outside the brackets on its own.
  const outside = letters(head.replace(/\([^)]*\)/g, " "));
  if (outside.length >= 4 && outside === outside.toUpperCase()) return true;
  return ORG_SUFFIX.test(head) && head.split(/\s+/).length <= 6;
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Achievement bullets converted from a native Word list (numbering, not a
 * typed "-"/"•") lose their marker on plain-text extraction. A short one with
 * no terminal punctuation ("Managed a team of 12 engineers") would otherwise
 * fall through every other prose test and get read as a role title. Most
 * resume achievement lines open with a past-tense action verb — job titles
 * essentially never do — so use that as one more shape signal.
 */
const ACTION_VERB_START =
  /^(led|managed|built|delivered|owned|developed|achieved|reduced|increased|implemented|coordinated|directed|oversaw|drove|spearheaded|established|launched|created|designed|executed|negotiated|resolved|conducted|audited|supported|maintained|tracked|reported|trained|mentored|reviewed|analy[sz]ed|improved|streamlined|automated|planned|initiated|partnered|collaborated|ensured|monitored|generated|produced|prepared|presented|handled|processed|updated|configured|deployed|migrated|integrated|optimi[sz]ed|drafted|authored|facilitated|piloted|championed|scaled)\b/i;

/**
 * Achievement lines inside Professional Experience often arrive without a
 * bullet marker (pasted or converted from Word). Shape — not a leading dot —
 * decides: a job title is short, carries no terminal punctuation, and usually
 * ends in a date range; a sentence is long and/or punctuated and/or opens
 * with a past-tense action verb.
 */
function looksLikeProse(head: string, dates: string): boolean {
  const text = head.trim();
  if (dates) return false;
  if (/[.;:،؛]$/.test(text)) return true;
  if (/[,;]\s/.test(text) && wordCount(text) > 6) return true;
  if (wordCount(text) > 8) return true;
  return ACTION_VERB_START.test(text) && wordCount(text) >= 4;
}

/**
 * "Management Consultant - PRICEWATERHOUSECOOPERS (PwC) | February 2017 – May
 * 2017" means exactly the same as the company block with the title underneath:
 * one company, one role. Split it so both layouts record identically. The date
 * range must already be removed before this runs.
 */
export function splitCombinedEntry(head: string): { org: string; role: string } | null {
  const text = head.trim();
  if (!text) return null;
  const re = /\s+[-–—|]\s+|,\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const left = text.slice(0, m.index).trim();
    const right = text.slice(m.index + m[0].length).trim();
    if (!left || !right) continue;
    if (looksLikeEmployer(left, left)) continue; // company came first
    if (!looksLikeEmployer(right, right)) continue;
    if (wordCount(left) > 8 || /[.;:،؛]$/.test(left)) continue;
    return { org: right, role: left };
  }
  return null;
}

/** Loose company-name comparison, so one company is never opened twice. */
const orgKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, "");

export function toDocLines(resume: string): DocLine[] {
  const rawLines = stripUnverified(resume).split(/\r?\n/);

  const lines: DocLine[] = [];
  let seenHeading = false;
  let namedHeader = false;
  let inExperience = false;
  let inPlain = false;
  let currentEmployer = -1;
  let currentEmployerOrg = "";
  let currentEmployerDates = "";
  let expectingEmployer = false;

  rawLines.forEach((raw, i) => {
    const line = clean(raw);
    const trimmed = line.trim();
    if (trimmed === "" && clean(rawLines[i - 1] ?? "").trim() === "") return;

    if (HEADINGS.has(normalizeHeading(trimmed))) {
      seenHeading = true;
      const h = sectionOf(trimmed);
      inExperience = EXPERIENCE_HEADINGS.has(h);
      inPlain = PLAIN_HEADINGS.has(h);
      currentEmployer = -1;
      currentEmployerOrg = "";
      currentEmployerDates = "";
      expectingEmployer = inExperience;
      lines.push({
        kind: "heading",
        text: trimmed.replace(/[:#*]/g, "").trim(),
      });
      return;
    }

    const bulleted = /^[-•*·]\s+/.test(trimmed);
    if (bulleted) {
      const text = trimmed.replace(/^[-•*·]\s+/, "");
      // Education / Certification / closing skills are plain lines in the
      // template, so a stray bullet there is flattened.
      if (inPlain) lines.push({ kind: "text", text });
      else lines.push({ kind: "bullet", text, tight: inExperience });
      return;
    }

    if (!seenHeading && trimmed) {
      if (!namedHeader) {
        namedHeader = true;
        lines.push({ kind: "name", text: trimmed });
      } else {
        lines.push({ kind: "contact", text: trimmed });
      }
      return;
    }

    if (inExperience && trimmed) {
      const { head, dates } = splitDates(trimmed);
      const prose = looksLikeProse(head, dates);
      const combined = prose ? null : splitCombinedEntry(head);
      if (combined) {
        // "Role - COMPANY | dates" — one company, one role, same as the block.
        const sameOrg = currentEmployerOrg && orgKey(currentEmployerOrg) === orgKey(combined.org);
        if (!sameOrg) {
          currentEmployer = lines.filter((l) => l.kind === "employer").length;
          currentEmployerOrg = combined.org;
          currentEmployerDates = dates;
          lines.push({
            kind: "employer",
            text: `${combined.org}${dates ? ` | ${dates}` : ""}`,
            org: combined.org,
            dates,
          });
        }
        expectingEmployer = false;
        lines.push({
          kind: "role",
          text: `${combined.role}${dates ? ` | ${dates}` : ""}`,
          role: combined.role,
          dates,
        });
        return;
      }
      const isEmployer =
        (expectingEmployer && !prose) || (currentEmployer >= 0 && !prose && looksLikeEmployer(raw, head));
      if (isEmployer) {
        currentEmployer = lines.filter((l) => l.kind === "employer").length;
        currentEmployerOrg = head;
        currentEmployerDates = dates;
        expectingEmployer = false;
        lines.push({
          kind: "employer",
          text: trimmed,
          // Exact spelling as the candidate wrote it — never re-cased.
          org: head,
          dates,
        });
      } else if (prose) {
        // An unmarked achievement sentence — never a job title.
        lines.push({ kind: "bullet", text: trimmed, tight: true });
      } else {
        // A title written under its company inherits that company's dates, so
        // the block layout records exactly what the one-line layout records.
        lines.push({
          kind: "role",
          text: trimmed,
          role: head,
          dates: dates || currentEmployerDates,
        });
      }

      return;
    }

    if (!inPlain && trimmed && /\*\*(.+?)\*\*/.test(raw)) {
      lines.push({ kind: "strong", text: trimmed, segments: toSegments(raw) });
      return;
    }
    lines.push({ kind: "text", text: trimmed });
  });

  return lines.filter((line, index) => {
    if (line.kind !== "heading") return true;
    for (let next = index + 1; next < lines.length; next++) {
      const item = lines[next];
      if (!item || item.kind === "heading") return false;
      if (item.text.trim()) return true;
    }
    return false;
  });
}

/**
 * Pulls the resume out of an assistant reply: prefers a fenced block, else the
 * span from the header through the end of the last section.
 *
 * `lockedName` — the candidate's own name, exactly as locked from their
 * source resume — is used to find where the header actually starts. Counting
 * a fixed number of lines back from the first section heading, or trying to
 * judge by shape which lines "look like" a header, both break the moment
 * spacing or phrasing varies even slightly (a preamble sentence, an extra
 * blank line, a 3- vs 4-line header). The name is not a guess: the system
 * prompt already hard-requires the model to reproduce it verbatim, so a
 * direct search for that exact string is a reliable anchor where any
 * heuristic is not. If it can't be found (or wasn't supplied), the resume
 * body still extracts correctly — it just won't include any header text,
 * which is safe, since the caller always reconstructs the header from locked
 * facts regardless of what (if anything) was found here.
 */
export function extractResume(reply: string, lockedName?: string): string | null {
  const fenced = /```(?:markdown|text|resume)?\s*([\s\S]*?)```/i.exec(reply);
  const candidate = fenced?.[1]?.trim();
  const body = candidate && looksLikeResume(candidate) ? candidate : reply;

  const lines = body.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => HEADINGS.has(normalizeHeading(clean(l).trim())));
  if (startIdx === -1) return null;

  let headerStart = startIdx;
  const wanted = lockedName?.trim().toLowerCase();
  if (wanted) {
    const lookback = Math.max(0, startIdx - 20);
    for (let i = startIdx - 1; i >= lookback; i--) {
      if (
        clean(lines[i] ?? "")
          .trim()
          .toLowerCase() === wanted
      ) {
        headerStart = i;
        break;
      }
    }
  }

  const closing = new Set([normalizeHeading(SECTIONS_EN[5]), normalizeHeading(SECTIONS_AR[5])]);
  let endIdx = lines.length;
  for (let i = startIdx; i < lines.length; i++) {
    if (closing.has(normalizeHeading(clean(lines[i] ?? "").trim()))) {
      // include the closing section until a non-resume heading appears
      for (let j = i + 1; j < lines.length; j++) {
        const l = clean(lines[j] ?? "").trim();
        if (/^#{1,4}\s/.test(lines[j] ?? "") && !HEADINGS.has(normalizeHeading(l))) {
          endIdx = j;
          break;
        }
      }
      break;
    }
  }
  // Trim the agent's analysis sections that follow the resume.
  const stop = /^(what changed|keyword coverage|counts?:|ما تغيّر|تغطية الكلمات)/i;
  const out: string[] = [];
  for (const line of lines.slice(headerStart, endIdx)) {
    const bare = clean(line)
      .replace(/^\s*[-•*·]\s+/, "")
      .trim();
    if (stop.test(bare) || UNVERIFIED_HEADING.test(bare)) break;
    out.push(line);
  }
  // Inline [VERIFY] markers never travel with the resume either.
  const text = stripUnverified(out.join("\n"));
  return looksLikeResume(text) ? text : null;
}


function looksLikeResume(text: string): boolean {
  let hits = 0;
  for (const line of text.split(/\r?\n/)) {
    if (HEADINGS.has(normalizeHeading(clean(line).trim()))) hits++;
  }
  return hits >= 2;
}

/* ----------------------------------------------------------------- export */

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Leave guards read this so a file download is never mistaken for leaving.
  (window as unknown as { __fwDownloading?: number }).__fwDownloading = Date.now();
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give slower browsers time to read the file before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Template constants mirroring the sir tharaa default resume format. */
const ACCENT = "1F4E79";
/** Right tab stop at the right margin: A4 (11906) less 720 twips each side. */
const RIGHT_TAB = 10466;

/** Word bytes for a resume: the single renderer behind both the download and the page-count guard test. */
export async function docxBytes(resume: string, template: TemplateId = "classic"): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    LevelFormat,
    TabStopType,
    convertInchesToTwip,
  } = await import("docx");
  const pdfStyle = TEMPLATE_STYLES[template].pdf;
  const st = {
    nameSize: pdfStyle.nameSize * 2, contactSize: pdfStyle.contactSize * 2,
    headingSize: pdfStyle.headingSize * 2, bodySize: pdfStyle.bodySize * 2,
    headingBefore: pdfStyle.headingBefore * 20, headingAfter: pdfStyle.headingAfter * 20,
    employerBefore: pdfStyle.employerBefore * 20, roleBefore: pdfStyle.roleBefore * 20,
    bulletAfter: pdfStyle.bulletAfter * 20, lineAfter: 20,
  };
  const rtl = hasArabic(resume);
  const lines = toDocLines(resume);
  const align = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const base = { bidirectional: rtl, alignment: align };
  const run = (text: string, extra: Record<string, unknown> = {}) => new TextRun({ text, rightToLeft: rtl, ...extra });

  let contactIndex = 0;
  const bodyLine = { line: Math.round(pdfStyle.bodySize * pdfStyle.lead * 20), lineRule: "exact" as const };
  // Blank markdown lines never become Word paragraphs: each real paragraph carries its own spacing.
  const children = lines.filter((l) => !("text" in l) || l.kind !== "text" || l.text.trim()).map((l) => {
    if (l.kind === "name")
      return new Paragraph({
        ...base,
        spacing: { after: 40, line: Math.round(pdfStyle.nameSize * pdfStyle.lead * 20), lineRule: "exact" },
        children: [run(l.text, { bold: true, size: st.nameSize, color: ACCENT })],
      });
    if (l.kind === "contact") {
      const first = contactIndex === 0;
      contactIndex += 1;
      return new Paragraph({
        ...base,
        spacing: { after: 20, line: Math.round(pdfStyle.contactSize * pdfStyle.lead * 20), lineRule: "exact" },
        children: [run(l.text, { size: st.contactSize, italics: first })],
      });
    }

    if (l.kind === "heading")
      return new Paragraph({
        ...base,
        keepNext: true,
        spacing: { before: st.headingBefore, after: st.headingAfter, line: Math.round(pdfStyle.headingSize * pdfStyle.lead * 20), lineRule: "exact" },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 12,
            space: 4,
            color: ACCENT,
          },
        },
        children: [
          run(l.text.toUpperCase(), {
            bold: true,
            size: st.headingSize,
            color: ACCENT,
          }),
        ],
      });

    if (l.kind === "employer")
      return new Paragraph({
        ...base,
        spacing: { before: st.employerBefore, after: 20, ...bodyLine },
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        children: l.dates
          ? [run(l.org, { bold: true }), new TextRun({ children: ["\t", l.dates], rightToLeft: rtl })]
          : [run(l.org, { bold: true })],
      });

    if (l.kind === "role")
      return new Paragraph({
        ...base,
        spacing: { before: st.roleBefore, after: 20, ...bodyLine },
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        children: l.dates
          ? [run(l.role, { italics: true }), new TextRun({ children: ["\t", l.dates], rightToLeft: rtl })]
          : [run(l.role, { italics: true })],
      });

    if (l.kind === "strong")
      return new Paragraph({
        ...base,
        spacing: { before: 80, after: 0, ...bodyLine },
        children: l.segments.map((s) => run(s.text, { bold: s.bold })),
      });

    if (l.kind === "bullet")
      return new Paragraph({
        ...base,
        numbering: { reference: "fw-bullets", level: 0 },
        spacing: { after: l.tight ? 0 : st.bulletAfter, ...bodyLine },
        children: [run(l.text)],
      });
    return new Paragraph({
      ...base,
      spacing: { after: st.lineAfter, ...bodyLine },
      children: [run(l.text)],
    });
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: st.bodySize }, paragraph: { spacing: { line: Math.round(pdfStyle.bodySize * pdfStyle.lead * 20), lineRule: "exact" } } } },
    },
    numbering: {
      config: [
        {
          reference: "fw-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 280, hanging: 120 } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5),
            },
          },
        },
        children,
      },
    ],
  });
  return await Packer.toBlob(doc);
}

/** Browser download wrapper around the shared Word renderer. */
export async function downloadDocx(resume: string, filename: string, template: TemplateId = "classic") {
  download(await docxBytes(resume, template), filename);
}

/** Shared bytes: preview and download use the identical document renderer. */
export async function resumePdfBytes(
  resume: string,
  filename: string,
  template: TemplateId = "classic",
  opts: { watermark?: boolean } = {},
) {
  if (hasArabic(resume)) throw new ArabicPdfUnsupported();
  const st = TEMPLATE_STYLES[template].pdf;
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdf = await PDFDocument.create();
  const body = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const accent = rgb(0x1f / 255, 0x4e / 255, 0x79 / 255);

  const W = 595.28;
  const H = 841.89;
  const margin = 36; // 0.5 inch, matching the template
  const maxWidth = W - margin * 2;
  let page = pdf.addPage([W, H]);
  let y = H - margin;

  const ascii = (s: string) =>
    s
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2014/g, "\u2013")
      .replace(/\u00B7/g, "\u2022")
      // WinAnsi covers the en dash and bullet glyphs the template uses.
      .replace(/[^\x20-\x7E\u2013\u2022\u00AE\u00A9\u2122]/g, "");

  const wrap = (text: string, font: typeof body, size: number, indent = 0) => {
    const words = text.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > maxWidth - indent && line) {
        out.push(line);
        line = w;
      } else line = next;
    }
    if (line) out.push(line);
    return out.length ? out : [""];
  };

  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - margin;
  };

  const write = (
    text: string,
    opts: {
      font: typeof body;
      size: number;
      gapBefore?: number;
      gapAfter?: number;
      indent?: number;
      hanging?: number;
      color?: ReturnType<typeof rgb>;
      rule?: boolean;
      right?: { text: string; font: typeof body } | undefined;
    },
  ) => {
    y -= opts.gapBefore ?? 0;
    const indent = opts.indent ?? 0;
    const lines = wrap(text, opts.font, opts.size, indent + (opts.hanging ?? 0));
    lines.forEach((line, i) => {
      if (y < margin + opts.size) newPage();
      page.drawText(line, {
        x: margin + indent + (i > 0 ? (opts.hanging ?? 0) : 0),
        y,
        size: opts.size,
        font: opts.font,
        color: opts.color ?? rgb(0, 0, 0),
      });
      if (i === 0 && opts.right) {
        const rf = opts.right.font;
        page.drawText(opts.right.text, {
          x: W - margin - rf.widthOfTextAtSize(opts.right.text, opts.size),
          y,
          size: opts.size,
          font: rf,
          color: rgb(0, 0, 0),
        });
      }
      y -= opts.size * st.lead;
    });
    if (opts.rule) {
      const ruleY = y + opts.size * st.lead - 4;
      page.drawLine({
        start: { x: margin, y: ruleY },
        end: { x: W - margin, y: ruleY },
        thickness: 0.9,
        color: accent,
      });
      y -= 3;
    }
    y -= opts.gapAfter ?? 0;
  };

  /** Draws a partially bold line, wrapping word by word. */
  const writeSegments = (segments: Segment[], size: number, gap: number) => {
    y -= gap;
    if (y < margin + size) newPage();
    let x = margin;
    for (const seg of segments) {
      const font = seg.bold ? bold : body;
      const words = ascii(seg.text)
        .split(/(\s+)/)
        .filter((w) => w !== "");
      for (const word of words) {
        const w = font.widthOfTextAtSize(word, size);
        if (x + w > W - margin && word.trim()) {
          y -= size * st.lead;
          if (y < margin + size) newPage();
          x = margin;
        }
        if (!(x === margin && !word.trim())) {
          page.drawText(word, { x, y, size, font, color: rgb(0, 0, 0) });
          x += w;
        }
      }
    }
    y -= size * st.lead;
  };

  let headerLine = 0;
  for (const l of toDocLines(resume)) {
    const text = ascii(l.text);
    if (!text.trim()) {
      y -= 4;
      continue;
    }
    if (l.kind === "name")
      write(text, {
        font: bold,
        size: st.nameSize,
        color: accent,
        gapAfter: 2,
      });
    else if (l.kind === "contact") {
      write(text, {
        font: headerLine === 0 ? italic : body,
        size: st.contactSize,
        gapAfter: 1,
      });
      headerLine += 1;
    } else if (l.kind === "heading")
      write(text.toUpperCase(), {
        font: bold,
        size: st.headingSize,
        color: accent,
        gapBefore: st.headingBefore,
        rule: true,
        gapAfter: st.headingAfter,
      });
    else if (l.kind === "employer")
      write(ascii(l.org), {
        font: bold,
        size: st.bodySize,
        gapBefore: st.employerBefore,
        gapAfter: 1,
        right: l.dates ? { text: ascii(l.dates), font: body } : undefined,
      });
    else if (l.kind === "role")
      write(ascii(l.role), {
        font: italic,
        size: st.bodySize,
        gapBefore: st.roleBefore,
        gapAfter: 1,
        right: l.dates ? { text: ascii(l.dates), font: body } : undefined,
      });
    else if (l.kind === "strong") writeSegments(l.segments, st.bodySize, 4);
    else if (l.kind === "bullet")
      write(`\u2022 ${text}`, {
        font: body,
        size: st.bodySize,
        indent: 8,
        hanging: 6,
        gapAfter: l.tight ? 0 : st.bulletAfter,
      });
    else write(text, { font: body, size: st.bodySize, gapAfter: 1 });
  }

  const bytes = await pdf.save();
  const out = opts.watermark ? await rasterizeWithWatermark(bytes) : bytes;
  return out;
}

export async function downloadPdf(resume: string, filename: string, template: TemplateId = "classic", opts: { watermark?: boolean } = {}) {
  const out = await resumePdfBytes(resume, filename, template, opts);
  download(new Blob([out as unknown as ArrayBuffer], { type: "application/pdf" }), filename);
}

/**
 * Free-plan export: each page is rendered to an image, stamped with a
 * repeating watermark and re-packed, so the file holds no selectable text.
 */
async function rasterizeWithWatermark(bytes: Uint8Array): Promise<Uint8Array> {
  installPdfPolyfills();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const workerUrl = (
      (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")) as unknown as { default: string }
    ).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    /* fall back to whatever worker is already configured */
  }
  const { PDFDocument } = await import("pdf-lib");
  const src = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const out = await PDFDocument.create();
  const SCALE = 1.4;

  for (let i = 1; i <= src.numPages; i++) {
    const p = await src.getPage(i);
    const vp = p.getViewport({ scale: SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await p.render({ canvasContext: ctx, viewport: vp, canvas } as never).promise;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = "rgba(31, 78, 121, 0.2)";
    ctx.font = `bold ${26 * SCALE}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center";
    const label = "SIR THARAA · FREE PREVIEW";
    const stepY = 80 * SCALE;
    const stepX = 380 * SCALE;
    const span = Math.max(canvas.width, canvas.height);
    for (let y = -span; y <= span; y += stepY) {
      const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
      for (let x = -span; x <= span; x += stepX) ctx.fillText(label, x + offset, y);
    }
    ctx.restore();

    const jpg = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("render failed"))), "image/jpeg", 0.55),
    );
    const img = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
    const base = p.getViewport({ scale: 1 });
    const page = out.addPage([base.width, base.height]);
    page.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
  }
  return out.save();
}

/* ------------------------------------------------------------ word counts */

const SUMMARY_HEADINGS = new Set(
  [SECTIONS_EN[0], SECTIONS_AR[0], "Executive Summary", "الملخص التنفيذي"].map((h) => normalizeHeading(h)),
);

const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** Client-side counts so the agent never has to narrate its arithmetic. */
export function resumeCounts(resume: string): {
  total: number;
  summary: number;
  competencies: number;
} {
  const lines = toDocLines(resume);
  let summary = 0;
  let competencies = 0;
  let inSummary = false;
  let inCompetencies = false;
  const competencyHeadings = new Set([normalizeHeading(SECTIONS_EN[1]), normalizeHeading(SECTIONS_AR[1])]);

  for (const l of lines) {
    if (l.kind === "heading") {
      const h = sectionOf(l.text);
      inSummary = SUMMARY_HEADINGS.has(h);
      inCompetencies = competencyHeadings.has(h);
      continue;
    }
    if (inSummary) summary += countWords(l.text);
    if (inCompetencies && l.text.trim()) competencies += 1;
  }

  // The contact header (everything before the first section heading) is not
  // part of the word budget.
  const firstHeading = lines.findIndex((l) => l.kind === "heading");
  const body = firstHeading === -1 ? lines : lines.slice(firstHeading);

  return {
    total: countWords(body.map((l) => l.text).join(" ")),
    summary,
    competencies,
  };
}
