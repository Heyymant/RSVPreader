"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Chapter } from "@/lib/chapters";
import { detectChaptersFromText } from "@/lib/chapters";

export interface ExtractResult {
  pages: string[];
  chapters: Chapter[];
}

/**
 * Extracts per-page text and a chapter list from a PDF. Chapters come from the
 * PDF's embedded outline/bookmarks when present, falling back to heuristic
 * heading detection. Runs entirely in the browser via a dynamic import of
 * pdfjs-dist so it is never bundled/executed on the server.
 */
export async function extractPdf(file: File): Promise<ExtractResult> {
  const pdfjs = await import("pdfjs-dist");

  // Worker is copied into /public during setup (see scripts/copy worker).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // Reassemble text. pdfjs gives positioned items; we insert spaces between
    // items and treat the `hasEOL` flag as a soft line break.
    let text = "";
    for (const item of content.items) {
      // TextItem has `str`; TextMarkedContent does not.
      if ("str" in item) {
        text += item.str;
        if ((item as { hasEOL?: boolean }).hasEOL) {
          text += "\n";
        } else {
          text += " ";
        }
      }
    }

    pages.push(normalizeWhitespace(text));
  }

  let chapters: Chapter[] = [];
  try {
    chapters = await extractOutline(doc);
  } catch {
    chapters = [];
  }
  if (chapters.length === 0) {
    chapters = detectChaptersFromText(pages);
  }

  return { pages, chapters };
}

interface OutlineItem {
  title: string;
  dest: string | unknown[] | null;
  items?: OutlineItem[];
}

/** Reads the PDF's bookmark outline and resolves each entry to a page index. */
async function extractOutline(doc: PDFDocumentProxy): Promise<Chapter[]> {
  const outline = (await doc.getOutline()) as OutlineItem[] | null;
  if (!outline || outline.length === 0) return [];

  const result: Chapter[] = [];

  async function walk(items: OutlineItem[], depth: number) {
    for (const item of items) {
      const page = await destToPageIndex(doc, item.dest);
      if (page != null && item.title) {
        result.push({
          title: item.title.trim().slice(0, 120),
          page,
          depth,
        });
      }
      if (item.items && item.items.length > 0 && depth < 1) {
        await walk(item.items, depth + 1);
      }
    }
  }

  await walk(outline, 0);
  return result;
}

async function destToPageIndex(
  doc: PDFDocumentProxy,
  dest: string | unknown[] | null
): Promise<number | null> {
  try {
    let explicit = dest;
    if (typeof dest === "string") {
      explicit = await doc.getDestination(dest);
    }
    if (!Array.isArray(explicit) || explicit.length === 0) return null;

    const ref = explicit[0];
    if (ref && typeof ref === "object") {
      const idx = await doc.getPageIndex(
        ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0]
      );
      return typeof idx === "number" ? idx : null;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00ad/g, "") // soft hyphens
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
