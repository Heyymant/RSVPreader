import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/lib/types";
import Reader from "@/components/Reader";

export const dynamic = "force-dynamic";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  type ReaderDoc = Pick<
    DocumentRow,
    "id" | "title" | "num_pages" | "pages" | "chapters"
  >;

  // Try selecting with the `chapters` column. If that column hasn't been added
  // to the database yet, retry without it so reading still works (chapters are
  // then detected heuristically by the reader).
  let doc: ReaderDoc | null = null;

  const withChapters = await supabase
    .from("documents")
    .select("id, title, num_pages, pages, chapters")
    .eq("id", id)
    .maybeSingle();

  if (withChapters.error) {
    console.error("[reader] select with chapters failed:", withChapters.error);
    const fallback = await supabase
      .from("documents")
      .select("id, title, num_pages, pages")
      .eq("id", id)
      .maybeSingle();
    if (fallback.error) {
      console.error("[reader] fallback select failed:", fallback.error);
    }
    doc = fallback.data
      ? ({ ...fallback.data, chapters: [] } as ReaderDoc)
      : null;
  } else {
    doc = withChapters.data as ReaderDoc | null;
  }

  if (!doc) {
    notFound();
  }

  return (
    <Reader
      documentId={doc.id}
      title={doc.title}
      pages={doc.pages ?? []}
      numPages={doc.num_pages}
      chapters={doc.chapters ?? []}
    />
  );
}
