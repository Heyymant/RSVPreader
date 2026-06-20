"use client";

/**
 * Extracts text from a PDF, returning an array where each entry is the text of
 * one page. Runs entirely in the browser via a dynamic import of pdfjs-dist so
 * it is never bundled/executed on the server (which lacks browser APIs).
 */
export async function extractPdfText(file: File): Promise<string[]> {
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

  return pages;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u00ad/g, "") // soft hyphens
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
