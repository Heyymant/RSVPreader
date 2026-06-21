"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { tokenize, delayMultiplier } from "@/lib/tokenize";
import { detectChaptersFromText, type Chapter } from "@/lib/chapters";
import { loadProgress, saveProgress } from "@/lib/progress";
import Rsvp from "@/components/Rsvp";
import ContextLine from "@/components/ContextLine";
import Controls from "@/components/Controls";
import Contents from "@/components/Contents";

const DEFAULT_WPM = 300;

export default function Reader({
  documentId,
  title,
  pages,
  numPages,
  chapters,
}: {
  documentId: string;
  title: string;
  pages: string[];
  numPages: number;
  chapters: Chapter[];
}) {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"contents" | "reading">("contents");
  const [hasProgress, setHasProgress] = useState(false);
  const [page, setPage] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [playing, setPlaying] = useState(false);

  // Clean + tokenize every page once so we can skip pages that are pure
  // front-matter (cover, copyright) and find where the real reading starts.
  const pageTokens = useMemo(() => pages.map((p) => tokenize(p)), [pages]);

  const firstReadingPage = useMemo(() => {
    const idx = pageTokens.findIndex((t) => t.length > 0);
    return idx === -1 ? 0 : idx;
  }, [pageTokens]);

  // Prefer the PDF's stored outline; fall back to heuristic detection so books
  // uploaded before chapters existed still get a usable table of contents.
  const effectiveChapters = useMemo<Chapter[]>(() => {
    const source =
      chapters && chapters.length > 0
        ? chapters
        : detectChaptersFromText(pages);
    return source
      .map((c) => ({
        ...c,
        page: Math.min(Math.max(0, c.page), Math.max(0, numPages - 1)),
      }))
      .filter((c) => c.title.trim().length > 0);
  }, [chapters, pages, numPages]);

  // The current chapter is the last one whose start page is at or before us.
  const currentChapterIdx = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < effectiveChapters.length; i++) {
      if (effectiveChapters[i].page <= page) idx = i;
      else break;
    }
    return idx;
  }, [effectiveChapters, page]);

  const currentChapter =
    currentChapterIdx >= 0 ? effectiveChapters[currentChapterIdx] : null;

  const nextReadingPage = useCallback(
    (from: number) => {
      for (let i = from + 1; i < pageTokens.length; i++) {
        if (pageTokens[i].length > 0) return i;
      }
      return -1;
    },
    [pageTokens]
  );

  const tokens = pageTokens[page] ?? [];
  const totalWords = tokens.length;
  const currentToken = tokens[wordIndex] ?? null;

  // Load saved progress on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const progress = await loadProgress(documentId);
      if (cancelled) return;
      if (progress) {
        const p = Math.min(Math.max(0, progress.current_page), numPages - 1);
        setPage(p);
        setWordIndex(Math.max(0, progress.current_word_index));
        if (progress.wpm) setWpm(progress.wpm);
        // Only offer "Resume" if there is meaningful prior progress.
        setHasProgress(p > 0 || progress.current_word_index > 0);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, numPages]);

  // Playback loop: schedule the next word based on WPM and per-word weighting.
  useEffect(() => {
    if (!playing || !ready || view !== "reading") return;
    if (totalWords === 0) {
      setPlaying(false);
      return;
    }
    const base = 60000 / wpm;
    const delay = base * delayMultiplier(currentToken?.text ?? "");

    const timer = setTimeout(() => {
      if (wordIndex + 1 < totalWords) {
        setWordIndex(wordIndex + 1);
      } else {
        // Jump to the next page that actually has readable text.
        const next = nextReadingPage(page);
        if (next !== -1) {
          setPage(next);
          setWordIndex(0);
        } else {
          setPlaying(false);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [
    playing,
    ready,
    view,
    wordIndex,
    page,
    wpm,
    totalWords,
    currentToken,
    nextReadingPage,
  ]);

  // Debounced autosave whenever position/speed changes.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      saveProgress({
        documentId,
        currentPage: page,
        currentWordIndex: wordIndex,
        wpm,
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [ready, documentId, page, wordIndex, wpm]);

  const changePage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), numPages - 1);
      setPage(clamped);
      setWordIndex(0);
    },
    [numPages]
  );

  const seekWord = useCallback(
    (next: number) => {
      setWordIndex(Math.min(Math.max(0, next), Math.max(0, totalWords - 1)));
    },
    [totalWords]
  );

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const restartPage = useCallback(() => {
    setWordIndex(0);
    setPlaying(false);
  }, []);

  const startReading = useCallback(
    (targetPage: number, targetWord: number, autoplay: boolean) => {
      setPage(Math.min(Math.max(0, targetPage), Math.max(0, numPages - 1)));
      setWordIndex(Math.max(0, targetWord));
      setView("reading");
      setPlaying(autoplay);
    },
    [numPages]
  );

  const handleSelectChapter = useCallback(
    (chapter: Chapter) => startReading(chapter.page, 0, true),
    [startReading]
  );

  // Jump between chapters while reading, preserving the play/pause state.
  const jumpToChapter = useCallback(
    (idx: number) => {
      const ch = effectiveChapters[idx];
      if (!ch) return;
      setPage(Math.min(Math.max(0, ch.page), Math.max(0, numPages - 1)));
      setWordIndex(0);
    },
    [effectiveChapters, numPages]
  );

  const handleStartBeginning = useCallback(
    () => startReading(firstReadingPage, 0, true),
    [startReading, firstReadingPage]
  );

  const handleResume = useCallback(() => {
    setView("reading");
    setPlaying(false);
  }, []);

  const openContents = useCallback(() => {
    setPlaying(false);
    setView("contents");
  }, []);

  // Keyboard shortcuts (reading view only).
  useEffect(() => {
    if (view !== "reading") return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA")
      ) {
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekWord(wordIndex - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekWord(wordIndex + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          setWpm((w) => Math.min(900, w + 25));
          break;
        case "ArrowDown":
          e.preventDefault();
          setWpm((w) => Math.max(100, w - 25));
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, togglePlay, seekWord, wordIndex]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-57px)] max-w-3xl flex-col px-4 py-4 sm:px-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Link
          href="/library"
          className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          ‹ Library
        </Link>
        {view === "reading" ? (
          <button
            onClick={openContents}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Contents
          </button>
        ) : (
          <h1 className="truncate text-sm font-medium text-[var(--muted)]">
            {title}
          </h1>
        )}
      </div>

      {!ready ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[var(--muted)]">Loading...</p>
        </div>
      ) : view === "contents" ? (
        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <Contents
            title={title}
            chapters={effectiveChapters}
            hasProgress={hasProgress}
            resumePage={page}
            onResume={handleResume}
            onStartBeginning={handleStartBeginning}
            onSelectChapter={handleSelectChapter}
          />
        </div>
      ) : (
        <>
          {/* Running chapter heading */}
          {currentChapter && (
            <div className="mb-1 border-b border-[var(--border)] pb-2 text-center">
              <span className="font-reader text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {currentChapter.title}
              </span>
            </div>
          )}

          {/* Reading stage */}
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            {totalWords === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                This page has no readable text. Try another page.
              </p>
            ) : (
              <>
                <div className="paper w-full rounded-2xl border border-[var(--border)] px-4 py-10">
                  <Rsvp token={currentToken} />
                </div>
                <ContextLine tokens={tokens} index={wordIndex} />
              </>
            )}
          </div>

          {/* Controls */}
          <div className="paper mt-6 rounded-2xl border border-[var(--border)] p-4">
            <Controls
              playing={playing}
              onTogglePlay={togglePlay}
              wpm={wpm}
              onWpmChange={setWpm}
              page={page}
              numPages={numPages}
              onPageChange={changePage}
              wordIndex={wordIndex}
              totalWords={totalWords}
              onSeekWord={seekWord}
              onRestartPage={restartPage}
              chapters={effectiveChapters}
              currentChapterIdx={currentChapterIdx}
              onChapterChange={jumpToChapter}
            />
            <p className="mt-3 text-center text-xs text-[var(--muted)]">
              Space = play/pause · ← → = word · ↑ ↓ = speed
            </p>
          </div>
        </>
      )}
    </div>
  );
}
