import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { DocumentListItem } from "@/lib/types";
import UploadDropzone from "@/components/UploadDropzone";
import DeleteDocumentButton from "@/components/DeleteDocumentButton";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, title, num_pages, created_at")
    .order("created_at", { ascending: false });

  const documents = (data ?? []) as DocumentListItem[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-reader text-2xl font-bold">Your library</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload a PDF, then read it one word at a time.
        </p>
      </div>

      <UploadDropzone />

      <div className="mt-8 space-y-3">
        {documents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
            No documents yet. Upload your first PDF above.
          </p>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:border-[var(--accent-2)]"
            >
              <Link href={`/reader/${doc.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{doc.title}</p>
                <p className="text-xs text-[var(--muted)]">
                  {doc.num_pages} page{doc.num_pages === 1 ? "" : "s"} ·{" "}
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href={`/reader/${doc.id}`}
                  className="rounded-lg bg-[var(--accent-2)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Read
                </Link>
                <DeleteDocumentButton documentId={doc.id} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
