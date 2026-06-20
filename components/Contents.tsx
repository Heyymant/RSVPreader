"use client";

import type { Chapter } from "@/lib/chapters";

export default function Contents({
  title,
  chapters,
  hasProgress,
  resumePage,
  onResume,
  onStartBeginning,
  onSelectChapter,
}: {
  title: string;
  chapters: Chapter[];
  hasProgress: boolean;
  resumePage: number;
  onResume: () => void;
  onStartBeginning: () => void;
  onSelectChapter: (chapter: Chapter) => void;
}) {
  return (
    <div className="paper w-full rounded-2xl border border-[var(--border)] p-6 sm:p-8">
      <h1 className="font-reader text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Choose where to begin reading.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {hasProgress && (
          <button
            onClick={onResume}
            className="rounded-lg bg-[var(--accent-2)] px-4 py-2 font-medium text-white transition hover:opacity-90"
          >
            Resume (page {resumePage + 1})
          </button>
        )}
        <button
          onClick={onStartBeginning}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 font-medium transition hover:border-[var(--accent-2)]"
        >
          Start from the beginning
        </button>
      </div>

      <div className="mt-8">
        <h2 className="font-reader mb-3 text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
          Contents
        </h2>

        {chapters.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
            No chapters were detected in this book. Use “Start from the
            beginning” above, or jump to a page from the reader.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {chapters.map((chapter, i) => (
              <li key={`${chapter.page}-${i}`}>
                <button
                  onClick={() => onSelectChapter(chapter)}
                  className="group flex w-full items-baseline justify-between gap-4 py-2.5 text-left transition"
                  style={{ paddingLeft: `${chapter.depth * 1.25}rem` }}
                >
                  <span className="font-reader truncate text-[var(--foreground)] transition group-hover:text-[var(--accent-2)]">
                    {chapter.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                    p. {chapter.page + 1}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
