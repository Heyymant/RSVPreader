"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { tokenize, delayMultiplier } from "@/lib/tokenize";
import { loadProgress, saveProgress } from "@/lib/progress";
import Rsvp from "@/components/Rsvp";
import ContextLine from "@/components/ContextLine";
import Controls from "@/components/Controls";

const DEFAULT_WPM = 300;

export default function Reader({
  documentId,
  title,
  pages,
  numPages,
}: {
  documentId: string;
  title: string;
  pages: string[];
  numPages: number;
}) {
  const [ready, setReady] = useState(false);
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
      } else {
        // New book: skip front-matter and begin on the first page of text.
        setPage(firstReadingPage);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, numPages, firstReadingPage]);

  // Playback loop: schedule the next word based on WPM and per-word weighting.
  useEffect(() => {
    if (!playing || !ready) return;
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

  // Keyboard shortcuts.
  useEffect(() => {
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
  }, [togglePlay, seekWord, wordIndex]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-57px)] max-w-3xl flex-col px-4 py-4 sm:px-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Link
          href="/library"
          className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          ‹ Library
        </Link>
        <h1 className="truncate text-sm font-medium text-[var(--muted)]">
          {title}
        </h1>
      </div>

      {/* Reading stage */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {!ready ? (
          <p className="text-sm text-[var(--muted)]">Loading...</p>
        ) : totalWords === 0 ? (
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
        />
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          Space = play/pause · ← → = word · ↑ ↓ = speed
        </p>
      </div>
    </div>
  );
}
