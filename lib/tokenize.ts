export interface Token {
  /** The display text of the word (including trailing punctuation). */
  text: string;
  /** Index of the Optimal Recognition Point (pivot) character within `text`. */
  pivot: number;
}

/**
 * Splits page text into a flat list of words suitable for RSVP playback.
 * The text is first cleaned of non-prose noise (page numbers, prices, ISBNs,
 * copyright boilerplate, URLs, stray symbols) so reading feels like a book.
 */
export function tokenize(text: string): Token[] {
  const cleaned = cleanReadingText(text);
  const raw = cleaned.split(/\s+/u).filter(isReadableWord);
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
  const lines = text.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (JUNK_LINE_PATTERNS.some((re) => re.test(t))) continue;

    // Drop lines that are mostly non-letters (e.g. tables of numbers, decoration)
    // while keeping anything with a reasonable amount of words.
    const letters = (t.match(/\p{L}/gu) ?? []).length;
    if (letters < 2 && t.length > 0) continue;

    kept.push(t);
  }

  return kept.join(" ").replace(/[ \t]+/g, " ").trim();
}

/** Rejects empty/symbol-only tokens so the reader never flashes a lone glyph. */
function isReadableWord(word: string): boolean {
  if (word.length === 0) return false;
  // Must contain at least one letter or digit; pure punctuation is dropped.
  return /[\p{L}\p{N}]/u.test(word);
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
