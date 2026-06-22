export interface Token {
  /** The display text of the word (including trailing punctuation). */
  text: string;
  /** Index of the Optimal Recognition Point (pivot) character within `text`. */
  pivot: number;
}

const EDGE_SCAN_LINES = 4;

/**
 * Splits page text into a flat list of words suitable for RSVP playback.
 * The text is first cleaned of non-prose noise (page numbers, prices, ISBNs,
 * copyright boilerplate, URLs, stray symbols) so reading feels like a book.
 */
export function tokenize(text: string): Token[] {
  const cleaned = cleanReadingText(text);
  const raw = cleaned
    .split(/\s+/u)
    .map(normalizeToken)
    .filter(isReadableWord);
  return raw.map((w) => ({ text: w, pivot: orpIndex(w) }));
}

/** Matches a line that is front-matter / boilerplate rather than book prose. */
const JUNK_LINE_PATTERNS: RegExp[] = [
  /^\d{1,4}$/, // a standalone page number
  /^p(?:age|g)?\.?\s*\d+/i, // "Page 12", "p. 7"
  /\bisbn\b/i, // ISBN lines
  /\b97[89][\d\s-]{9,}\b/, // bare ISBN-13 digits
  /all rights reserved/i,
  /^copyright\b/i,
  /^©|^\(c\)\s/i,
  /\btrademark\b/i,
  /\bregistered trademark\b/i,
  /\bu\.s\.\s*pat/i,
  /\bforeign countries\b/i,
  /printed (?:and bound )?in\b/i,
  /first (?:published|edition|printing)/i,
  /\bpublished by\b/i,
  /^[$£€¥]\s?\d+(?:[.,]\d{1,2})?$/, // a standalone price like "$9.99"
  /^(?:us|uk|cdn|aus)?\$?\s?\d+\.\d{2}\s*(?:usd|gbp|eur|cad|aud)?$/i, // price w/ currency code
  /^(?:https?:\/\/|www\.)\S+$/i, // a bare URL line
  /^\S+@\S+\.\S+$/, // a bare email line
  /^[•▪◦·*\-–—_=~|.\s]+$/, // a line made only of symbols / rules
];

/**
 * Cleans raw page text line-by-line, dropping non-prose lines and joining the
 * remainder into a single readable stream. Conservative by design: only lines
 * that strongly look like metadata or decoration are removed.
 */
export function cleanReadingText(text: string): string {
  const page = cleanDocumentPages([text])[0] ?? "";
  return page
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Cleans all pages together so repeated headers/footers can be removed. */
export function cleanDocumentPages(pages: string[]): string[] {
  if (pages.length === 0) return [];

  const normalizedPages = pages.map((p) => normalizeInputText(p));
  const edgeCandidates = new Map<string, number>();

  for (const page of normalizedPages) {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);
    const perPage = new Set<string>();
    const head = lines.slice(0, EDGE_SCAN_LINES);
    const tail = lines.slice(-EDGE_SCAN_LINES);
    for (const line of [...head, ...tail]) {
      const key = lineFingerprint(line);
      if (key) perPage.add(key);
    }
    for (const key of perPage) {
      edgeCandidates.set(key, (edgeCandidates.get(key) ?? 0) + 1);
    }
  }

  const repeatThreshold = Math.max(3, Math.ceil(normalizedPages.length * 0.25));
  const repeatedEdgeLines = new Set(
    [...edgeCandidates.entries()]
      .filter(([, count]) => count >= repeatThreshold)
      .map(([key]) => key)
  );

  return normalizedPages.map((page) => {
    const lines = page.split("\n");
    const pageLooksLikeContents = detectContentsPage(lines);
    const kept: string[] = [];

    for (const line of lines) {
      const t = line.trim();
      if (!t) {
        if (kept.length > 0 && kept[kept.length - 1] !== "") kept.push("");
        continue;
      }

      if (JUNK_LINE_PATTERNS.some((re) => re.test(t))) continue;
      if (isStandalonePageMarker(t)) continue;
      if (pageLooksLikeContents && looksLikeContentsEntry(t)) continue;

      const fp = lineFingerprint(t);
      if (fp && repeatedEdgeLines.has(fp) && !looksLikeSectionHeading(t)) {
        continue;
      }

      // Drop lines that are mostly non-letters (e.g. tables of numbers).
      const letters = (t.match(/\p{L}/gu) ?? []).length;
      if (letters < 2 && t.length > 0) continue;

      kept.push(t);
    }

    return normalizeCleanedText(kept.join("\n"));
  });
}

/** Paragraph view helper: splits cleaned page text into readable chunks. */
export function splitParagraphs(pageText: string): string[] {
  const t = pageText.trim();
  if (!t) return [];

  const blocks = t
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  if (blocks.length > 1) return blocks;

  // Fallback for PDFs without blank lines: make sentence-group paragraphs.
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const grouped: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (!current) {
      current = s;
      continue;
    }
    if ((current + " " + s).length > 320) {
      grouped.push(current.trim());
      current = s;
    } else {
      current += " " + s;
    }
  }
  if (current.trim()) grouped.push(current.trim());
  return grouped.length > 0 ? grouped : [t];
}

/** Rejects empty/symbol-only tokens so the reader never flashes a lone glyph. */
function isReadableWord(word: string): boolean {
  if (word.length === 0) return false;
  // Must contain at least one letter or digit; pure punctuation is dropped.
  return /[\p{L}\p{N}]/u.test(word);
}

/** Light per-token cleanup for OCR/PDF artifacts without damaging prose. */
function normalizeToken(word: string): string {
  return word
    .replace(/^[|_*~•▪◦·]+/u, "")
    .replace(/[|_*~•▪◦·]+$/u, "")
    .replace(/^[\u00A0]+|[\u00A0]+$/gu, "")
    .trim();
}

function normalizeInputText(text: string): string {
  return text
    .replace(/\uFB00/g, "ff")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "—")
    .replace(/\u2026/g, "...")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Re-join hyphenated line-break words: "read-\ning" -> "reading".
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2");
}

function normalizeCleanedText(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?]){2,}/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function lineFingerprint(line: string): string {
  const t = line
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[^\p{L}# ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length >= 4 ? t : "";
}

function isStandalonePageMarker(line: string): boolean {
  const t = line.trim();
  return (
    /^[-–—]?\s*\d{1,4}\s*[-–—]?$/.test(t) ||
    /^[-–—]?\s*[ivxlcdm]{1,9}\s*[-–—]?$/i.test(t) ||
    /^page\s+\d+\s+of\s+\d+$/i.test(t)
  );
}

function looksLikeSectionHeading(line: string): boolean {
  if (/^(chapter|part|book|section|prologue|epilogue|appendix)\b/i.test(line)) {
    return true;
  }
  return (
    line.length <= 60 &&
    line === line.toUpperCase() &&
    /[A-Z]/.test(line) &&
    !/[.!?]$/.test(line)
  );
}

function detectContentsPage(lines: string[]): boolean {
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return false;

  if (nonEmpty.some((l) => /^contents$/i.test(l))) return true;

  const evidence = nonEmpty
    .slice(0, 18)
    .reduce((acc, l) => acc + (looksLikeContentsEntry(l) ? 1 : 0), 0);
  return evidence >= 3;
}

function looksLikeContentsEntry(line: string): boolean {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t) return false;

  // "Chapter One ........ 12"
  if (/^.{3,220}\.{2,}\s*\d{1,4}$/u.test(t)) return true;

  // "Selected Bibliography 240"
  if (/^[\p{L}"'(),:;.\- ]{3,220}\s+\d{1,4}$/u.test(t)) return true;

  // OCR-packed ToC line: "Title 7 Another Title 62 ... 204"
  if (countMatches(t, /\b\d{1,4}\b/g) >= 3 && t.length <= 260) return true;

  return false;
}

function countMatches(input: string, re: RegExp): number {
  const m = input.match(re);
  return m ? m.length : 0;
}

/**
 * Optimal Recognition Point: the character the eye should fixate on. Based on
 * word length, biased slightly left of center per common RSVP implementations.
 */
export function orpIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

/**
 * Returns a relative delay multiplier for a token so that long words and words
 * ending in punctuation linger a little longer than the base WPM cadence.
 */
export function delayMultiplier(word: string): number {
  let m = 1;
  if (word.length > 8) m += 0.35;
  if (word.length > 13) m += 0.4;
  if (/[,;:]$/.test(word)) m += 0.5;
  if (/[.!?]$/.test(word)) m += 1;
  if (/["')\]]$/.test(word) && /[.!?]/.test(word)) m += 0.3;
  return m;
}
