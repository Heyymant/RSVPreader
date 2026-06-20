export interface Chapter {
  title: string;
  /** 0-based page index where the chapter begins. */
  page: number;
  /** Nesting depth (0 = top-level chapter/part). */
  depth: number;
}

const HEADING_WORD =
  /^(chapter|chap\.?|part|book|section|prologue|epilogue|introduction|preface|foreword|afterword|appendix|interlude|contents)\b/i;

/**
 * Heuristically detects chapter headings from already-extracted page text.
 * Used as a fallback when a PDF has no embedded outline/bookmarks. Looks at the
 * top few lines of each page for heading-like text and keeps one entry per page.
 */
export function detectChaptersFromText(pages: string[]): Chapter[] {
  const found: Chapter[] = [];

  pages.forEach((pageText, pageIdx) => {
    const lines = pageText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .slice(0, 6);

    for (const line of lines) {
      if (isHeading(line)) {
        found.push({ title: truncate(line), page: pageIdx, depth: 0 });
        break;
      }
    }
  });

  return dedupe(found);
}

function isHeading(line: string): boolean {
  if (line.length === 0 || line.length > 80) return false;
  if (HEADING_WORD.test(line)) return true;

  // A short ALL-CAPS line with no sentence-ending punctuation reads as a title.
  const letters = line.replace(/[^A-Za-z]/g, "");
  const words = line.split(/\s+/);
  if (
    letters.length >= 3 &&
    words.length <= 6 &&
    line === line.toUpperCase() &&
    /[A-Z]/.test(line) &&
    !/[.!?,;:]$/.test(line)
  ) {
    return true;
  }

  return false;
}

function truncate(s: string): string {
  return s.length > 100 ? s.slice(0, 99) + "…" : s;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Collapses duplicate titles (e.g. ToC entry + real heading), keeping the
 * last occurrence (the real chapter start), then orders by page. */
function dedupe(list: Chapter[]): Chapter[] {
  const byTitle = new Map<string, Chapter>();
  for (const c of list) byTitle.set(norm(c.title), c);
  return [...byTitle.values()].sort((a, b) => a.page - b.page);
}
