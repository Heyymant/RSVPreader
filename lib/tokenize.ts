export interface Token {
  /** The display text of the word (including trailing punctuation). */
  text: string;
  /** Index of the Optimal Recognition Point (pivot) character within `text`. */
  pivot: number;
}

/**
 * Splits page text into a flat list of words suitable for RSVP playback.
 * Whitespace (including newlines) is used as the delimiter; empty tokens are
 * dropped. Very long "words" (e.g. URLs) are kept whole.
 */
export function tokenize(text: string): Token[] {
  const raw = text.split(/\s+/u).filter((w) => w.length > 0);
  return raw.map((w) => ({ text: w, pivot: orpIndex(w) }));
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
