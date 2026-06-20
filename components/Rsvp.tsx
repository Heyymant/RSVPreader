"use client";

import type { Token } from "@/lib/tokenize";

export default function Rsvp({ token }: { token: Token | null }) {
  const text = token?.text ?? "";
  const pivot = token?.pivot ?? 0;

  const before = text.slice(0, pivot);
  const pivotChar = text.slice(pivot, pivot + 1);
  const after = text.slice(pivot + 1);

  return (
    <div className="relative w-full select-none">
      {/* center guide ticks */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-[var(--accent)]/60" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-[var(--accent)]/60" />

      <div className="font-reader grid grid-cols-[1fr_auto_1fr] items-baseline py-6 text-5xl font-bold tracking-tight sm:text-7xl">
        <span className="overflow-hidden whitespace-nowrap text-right">
          {before}
        </span>
        <span className="text-[var(--accent)]">{pivotChar}</span>
        <span className="overflow-hidden whitespace-nowrap text-left">
          {after}
        </span>
      </div>
    </div>
  );
}
