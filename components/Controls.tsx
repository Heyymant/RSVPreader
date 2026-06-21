"use client";

import { useEffect, useState } from "react";
import type { Chapter } from "@/lib/chapters";

const MIN_WPM = 30;
const MAX_WPM = 1500;

export default function Controls({
  playing,
  onTogglePlay,
  wpm,
  onWpmChange,
  page,
  numPages,
  onPageChange,
  wordIndex,
  totalWords,
  onSeekWord,
  onRestartPage,
  chapters,
  currentChapterIdx,
  onChapterChange,
}: {
  playing: boolean;
  onTogglePlay: () => void;
  wpm: number;
  onWpmChange: (wpm: number) => void;
  page: number;
  numPages: number;
  onPageChange: (page: number) => void;
  wordIndex: number;
  totalWords: number;
  onSeekWord: (index: number) => void;
  onRestartPage: () => void;
  chapters: Chapter[];
  currentChapterIdx: number;
  onChapterChange: (idx: number) => void;
}) {
  const progress = totalWords > 0 ? (wordIndex + 1) / totalWords : 0;

  // Local text state lets the user freely type a speed; we clamp on commit.
  const [wpmText, setWpmText] = useState(String(wpm));
  useEffect(() => {
    setWpmText(String(wpm));
  }, [wpm]);

  function commitWpm(raw: string) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n <= 0) {
      setWpmText(String(wpm));
      return;
    }
    const clamped = Math.min(MAX_WPM, Math.max(MIN_WPM, n));
    onWpmChange(clamped);
    setWpmText(String(clamped));
  }

  return (
    <div className="w-full space-y-4">
      {/* progress bar (seek within page) */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={Math.max(0, totalWords - 1)}
          value={Math.min(wordIndex, Math.max(0, totalWords - 1))}
          onChange={(e) => onSeekWord(Number(e.target.value))}
          className="w-full accent-[var(--accent-2)]"
          aria-label="Seek word"
        />
        <div className="flex justify-between text-xs text-[var(--muted)]">
          <span>
            Word {totalWords === 0 ? 0 : wordIndex + 1} / {totalWords}
          </span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
      </div>

      {/* transport + page controls */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 0}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition hover:border-[var(--accent-2)] disabled:opacity-40"
          title="Previous page"
        >
          ‹ Page
        </button>

        <button
          onClick={() => onSeekWord(Math.max(0, wordIndex - 1))}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition hover:border-[var(--accent-2)]"
          title="Previous word (←)"
        >
          ‹‹
        </button>

        <button
          onClick={onTogglePlay}
          className="min-w-24 rounded-lg bg-[var(--accent-2)] px-5 py-2 font-medium text-white transition hover:opacity-90"
        >
          {playing ? "Pause" : "Play"}
        </button>

        <button
          onClick={() => onSeekWord(wordIndex + 1)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition hover:border-[var(--accent-2)]"
          title="Next word (→)"
        >
          ››
        </button>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= numPages - 1}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition hover:border-[var(--accent-2)] disabled:opacity-40"
          title="Next page"
        >
          Page ›
        </button>
      </div>

      {/* chapter selector */}
      {chapters.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="shrink-0 text-xs text-[var(--muted)]">Chapter</label>
          <select
            value={currentChapterIdx}
            onChange={(e) => onChapterChange(Number(e.target.value))}
            className="min-w-0 flex-1 truncate rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent-2)]"
          >
            {currentChapterIdx === -1 && (
              <option value={-1} disabled>
                (front matter)
              </option>
            )}
            {chapters.map((c, i) => (
              <option key={`${c.page}-${i}`} value={i}>
                {c.title} — p. {c.page + 1}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* speed + page jump + restart */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <span className="text-xs text-[var(--muted)]">Speed</span>
          <input
            type="range"
            min={100}
            max={900}
            step={25}
            value={Math.min(900, Math.max(100, wpm))}
            onChange={(e) => onWpmChange(Number(e.target.value))}
            className="flex-1 accent-[var(--accent)]"
            aria-label="Reading speed slider"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={MIN_WPM}
              max={MAX_WPM}
              value={wpmText}
              onChange={(e) => {
                setWpmText(e.target.value);
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= MIN_WPM && n <= MAX_WPM) {
                  onWpmChange(Math.round(n));
                }
              }}
              onBlur={(e) => commitWpm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitWpm((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-16 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-[var(--accent-2)]"
              aria-label="Words per minute"
            />
            <span className="text-sm text-[var(--muted)]">wpm</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-[var(--muted)]">Page</label>
          <select
            value={page}
            onChange={(e) => onPageChange(Number(e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm outline-none"
          >
            {Array.from({ length: numPages }, (_, i) => (
              <option key={i} value={i}>
                {i + 1} / {numPages}
              </option>
            ))}
          </select>
          <button
            onClick={onRestartPage}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm transition hover:border-[var(--accent-2)]"
            title="Restart this page"
          >
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}
