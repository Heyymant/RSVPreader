"use client";

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
}) {
  const progress = totalWords > 0 ? (wordIndex + 1) / totalWords : 0;

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

      {/* speed + page jump + restart */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <span className="text-xs text-[var(--muted)]">Speed</span>
          <input
            type="range"
            min={100}
            max={900}
            step={25}
            value={wpm}
            onChange={(e) => onWpmChange(Number(e.target.value))}
            className="flex-1 accent-[var(--accent)]"
            aria-label="Words per minute"
          />
          <span className="w-20 text-right text-sm tabular-nums">
            {wpm} wpm
          </span>
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
