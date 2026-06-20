"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteDocumentButton({
  documentId,
}: {
  documentId: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this document and its reading progress?")) return;
    setDeleting(true);

    const supabase = createClient();

    // Look up the storage path first so we can remove the file too.
    const { data: doc } = await supabase
      .from("documents")
      .select("storage_path")
      .eq("id", documentId)
      .maybeSingle();

    if (doc?.storage_path) {
      await supabase.storage.from("pdfs").remove([doc.storage_path]);
    }

    await supabase.from("documents").delete().eq("id", documentId);
    setDeleting(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      title="Delete"
      className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
    >
      {deleting ? "..." : "Delete"}
    </button>
  );
}
