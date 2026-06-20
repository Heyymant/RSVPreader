"use client";

import { createClient } from "@/lib/supabase/client";
import type { ReadingProgress } from "@/lib/types";

export async function loadProgress(
  documentId: string
): Promise<ReadingProgress | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reading_progress")
    .select("*")
    .eq("document_id", documentId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load progress", error);
    return null;
  }
  return data as ReadingProgress | null;
}

export async function saveProgress(input: {
  documentId: string;
  currentPage: number;
  currentWordIndex: number;
  wpm: number;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("reading_progress").upsert(
    {
      document_id: input.documentId,
      user_id: user.id,
      current_page: input.currentPage,
      current_word_index: input.currentWordIndex,
      wpm: input.wpm,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "document_id" }
  );

  if (error) {
    console.error("Failed to save progress", error);
  }
}
