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

  const { data } = await supabase
    .from("documents")
    .select("id, title, num_pages, pages")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  const doc = data as Pick<
    DocumentRow,
    "id" | "title" | "num_pages" | "pages"
  >;

  return (
    <Reader
      documentId={doc.id}
      title={doc.title}
      pages={doc.pages ?? []}
      numPages={doc.num_pages}
    />
  );
}
