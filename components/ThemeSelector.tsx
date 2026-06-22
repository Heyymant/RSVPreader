"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "night" | "sepia";

const STORAGE_KEY = "reader-theme";

export default function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme = stored ?? "dark";
    applyTheme(initial);
    setTheme(initial);
  }, []);

  function applyTheme(next: Theme) {
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-[var(--muted)]">Theme</label>
      <select
        value={theme}
        onChange={(e) => {
          const next = e.target.value as Theme;
          setTheme(next);
          applyTheme(next);
        }}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--foreground)] outline-none"
      >
        <option value="dark">Dark</option>
        <option value="night">Night</option>
        <option value="sepia">Sepia</option>
      </select>
    </div>
  );
}
