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

  const pagesWithOcr = await applyOcrFallback(doc, pages);

  let chapters: Chapter[] = [];
  try {
    chapters = await extractOutline(doc);
  } catch {
    chapters = [];
  }
  if (chapters.length === 0) {
    chapters = detectChaptersFromText(pagesWithOcr);
  }

  return { pages: pagesWithOcr, chapters };
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

function needsOcr(pageText: string): boolean {
  // If a page has very little alphanumeric content, it's likely scanned/image-only.
  const alnumCount = (pageText.match(/[\p{L}\p{N}]/gu) ?? []).length;
  return alnumCount < 30;
}

async function applyOcrFallback(
  doc: PDFDocumentProxy,
  pages: string[]
): Promise<string[]> {
  const ocrCandidates = pages
    .map((p, idx) => (needsOcr(p) ? idx : -1))
    .filter((idx) => idx >= 0);

  if (ocrCandidates.length === 0) return pages;

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const output = [...pages];

  try {
    for (const idx of ocrCandidates) {
      const ocrText = await ocrPdfPage(doc, idx + 1, worker);
      const normalized = normalizeWhitespace(ocrText);
      if (normalized.length > output[idx].length) {
        output[idx] = normalized;
      }
    }
  } catch {
    // If OCR fails for any reason, fall back to existing extracted text.
    return pages;
  } finally {
    await worker.terminate();
  }

  return output;
}

async function ocrPdfPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  await page.render({ canvasContext: ctx, viewport }).promise;
  const result = await worker.recognize(canvas);
  return result.data?.text ?? "";
}
