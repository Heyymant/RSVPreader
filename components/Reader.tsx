"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  cleanDocumentPages,
  delayMultiplier,
  splitParagraphs,
  tokenize,
} from "@/lib/tokenize";
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
  const [readingMode, setReadingMode] = useState<"rsvp" | "paragraph">("rsvp");
  const [hasProgress, setHasProgress] = useState(false);
  const [page, setPage] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [playing, setPlaying] = useState(false);

  // Document-level cleaning removes repeated headers/footers/page numbers.
  const cleanedPages = useMemo(() => cleanDocumentPages(pages), [pages]);

  // Token and paragraph indexes built from cleaned pages.
  const pageTokens = useMemo(
    () => cleanedPages.map((p) => tokenize(p)),
    [cleanedPages]
  );
  const pageParagraphs = useMemo(
    () => cleanedPages.map((p) => splitParagraphs(p)),
    [cleanedPages]
  );

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
        : detectChaptersFromText(cleanedPages);
    return source
      .map((c) => ({
        ...c,
        page: Math.min(Math.max(0, c.page), Math.max(0, numPages - 1)),
      }))
      .filter((c) => c.title.trim().length > 0);
  }, [chapters, cleanedPages, numPages]);

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
        if (pageTokens[i].length > 0 || pageParagraphs[i].length > 0) return i;
      }
      return -1;
    },
    [pageTokens, pageParagraphs]
  );

  const prevReadingPage = useCallback(
    (from: number) => {
      for (let i = from - 1; i >= 0; i--) {
        if (pageTokens[i].length > 0 || pageParagraphs[i].length > 0) return i;
      }
      return -1;
    },
    [pageTokens, pageParagraphs]
  );

  const tokens = pageTokens[page] ?? [];
  const paragraphs = pageParagraphs[page] ?? [];
  const currentParagraph = paragraphs[paragraphIndex] ?? "";
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
    if (!playing || !ready || view !== "reading" || readingMode !== "rsvp") {
      return;
    }
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
    readingMode,
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
      setParagraphIndex(0);
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
      setParagraphIndex(0);
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
      setParagraphIndex(0);
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

  const jumpToNextParagraph = useCallback(() => {
    if (paragraphIndex + 1 < paragraphs.length) {
      setParagraphIndex(paragraphIndex + 1);
      return;
    }
    const next = nextReadingPage(page);
    if (next !== -1) {
      setPage(next);
      setWordIndex(0);
      setParagraphIndex(0);
    }
  }, [paragraphIndex, paragraphs.length, nextReadingPage, page]);

  const jumpToPrevParagraph = useCallback(() => {
    if (paragraphIndex > 0) {
      setParagraphIndex(paragraphIndex - 1);
      return;
    }
    const prev = prevReadingPage(page);
    if (prev !== -1) {
      const prevParas = pageParagraphs[prev] ?? [];
      setPage(prev);
      setWordIndex(0);
      setParagraphIndex(Math.max(0, prevParas.length - 1));
    }
  }, [paragraphIndex, prevReadingPage, page, pageParagraphs]);

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
          if (readingMode === "rsvp") togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (readingMode === "rsvp") seekWord(wordIndex - 1);
          else jumpToPrevParagraph();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (readingMode === "rsvp") seekWord(wordIndex + 1);
          else jumpToNextParagraph();
          break;
        case "ArrowUp":
          e.preventDefault();
          if (readingMode === "rsvp") setWpm((w) => Math.min(900, w + 25));
          break;
        case "ArrowDown":
          e.preventDefault();
          if (readingMode === "rsvp") setWpm((w) => Math.max(100, w - 25));
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    view,
    readingMode,
    togglePlay,
    seekWord,
    wordIndex,
    jumpToPrevParagraph,
    jumpToNextParagraph,
  ]);

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

          <div className="mb-3 flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setReadingMode("paragraph");
                setPlaying(false);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                readingMode === "paragraph"
                  ? "bg-[var(--accent-2)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Paragraph mode
            </button>
            <button
              onClick={() => setReadingMode("rsvp")}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                readingMode === "rsvp"
                  ? "bg-[var(--accent-2)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              RSVP mode
            </button>
          </div>

          {/* Reading stage */}
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            {readingMode === "rsvp" ? (
              totalWords === 0 ? (
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
              )
            ) : paragraphs.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No readable paragraph on this page. Move to another page/chapter.
              </p>
            ) : (
              <div className="paper w-full rounded-2xl border border-[var(--border)] px-5 py-6">
                <p className="mb-3 text-xs text-[var(--muted)]">
                  Paragraph {paragraphIndex + 1} / {paragraphs.length}
                </p>
                <p className="text-base leading-8 text-[var(--foreground)] sm:text-lg">
                  {currentParagraph}
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          {readingMode === "rsvp" ? (
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
          ) : (
            <div className="paper mt-6 rounded-2xl border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={jumpToPrevParagraph}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition hover:border-[var(--accent-2)]"
                >
                  ‹ Prev paragraph
                </button>
                <button
                  onClick={jumpToNextParagraph}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition hover:border-[var(--accent-2)]"
                >
                  Next paragraph ›
                </button>
                <button
                  onClick={() => setParagraphIndex(0)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition hover:border-[var(--accent-2)]"
                >
                  Restart paragraph page
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {effectiveChapters.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[var(--muted)]">Chapter</label>
                    <select
                      value={currentChapterIdx}
                      onChange={(e) => jumpToChapter(Number(e.target.value))}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm outline-none"
                    >
                      {effectiveChapters.map((c, i) => (
                        <option key={`${c.page}-${i}`} value={i}>
                          {c.title} — p. {c.page + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--muted)]">Page</label>
                  <select
                    value={page}
                    onChange={(e) => changePage(Number(e.target.value))}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm outline-none"
                  >
                    {Array.from({ length: numPages }, (_, i) => (
                      <option key={i} value={i}>
                        {i + 1} / {numPages}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-[var(--muted)]">
                ← → = previous/next paragraph
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
