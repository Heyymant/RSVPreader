// Copies the pdf.js worker from node_modules into /public so it can be served
// at /pdf.worker.min.mjs. Runs automatically via the "postinstall" script.
import { copyFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)) + "/..";

const candidates = [
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "node_modules/pdfjs-dist/build/pdf.worker.mjs",
];

const dest = join(root, "public", "pdf.worker.min.mjs");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(join(root, "public"), { recursive: true });

  for (const rel of candidates) {
    const src = join(root, rel);
    if (await exists(src)) {
      await copyFile(src, dest);
      console.log(`[copy-pdf-worker] copied ${rel} -> public/pdf.worker.min.mjs`);
      return;
    }
  }

  console.warn(
    "[copy-pdf-worker] pdf.js worker not found in node_modules; skipping."
  );
}

main().catch((err) => {
  console.warn("[copy-pdf-worker] failed:", err.message);
});
