"use client";

import type { Token } from "@/lib/tokenize";

/**
 * Renders a single line of context with the current word highlighted and kept
 * in the exact horizontal center. Surrounding words fill the left/right and are
 * clipped at the edges so the highlighted word never drifts from the middle.
 */
export default function ContextLine({
  tokens,
  index,
}: {
  tokens: Token[];
  index: number;
}) {
  const current = tokens[index]?.text ?? "";
  const before = tokens
    .slice(Math.max(0, index - 12), index)
    .map((t) => t.text)
    .join(" ");
  const after = tokens
    .slice(index + 1, index + 13)
    .map((t) => t.text)
    .join(" ");

  return (
    <div className="font-reader grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 text-base text-[var(--muted)] sm:text-lg">
      <span className="overflow-hidden whitespace-nowrap text-right">
        {before}
      </span>
      <span className="rounded-md bg-[var(--accent-2)]/15 px-2 py-0.5 font-semibold text-[var(--foreground)]">
        {current}
      </span>
      <span className="overflow-hidden whitespace-nowrap text-left">
        {after}
      </span>
    </div>
  );
}
