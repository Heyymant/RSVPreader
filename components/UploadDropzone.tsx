"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { extractPdf } from "@/lib/pdf";

type Status =
  | "idle"
  | "extracting"
  | "uploading"
  | "saving"
  | "error";

export default function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setStatus("error");
      setMessage("Please choose a PDF file.");
      return;
    }

    try {
      setMessage(null);
      setStatus("extracting");
      const { pages, chapters } = await extractPdf(file);

      const hasText = pages.some((p) => p.trim().length > 0);
      if (!hasText) {
        setStatus("error");
        setMessage(
          "No readable text found, even after OCR fallback. Try a clearer scan or a different PDF."
        );
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStatus("error");
        setMessage("Your session expired. Please sign in again.");
        return;
      }

      setStatus("uploading");
      const id = crypto.randomUUID();
      const storagePath = `${user.id}/${id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(storagePath, file, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      setStatus("saving");
      const title = file.name.replace(/\.pdf$/i, "");
      const base = {
        id,
        user_id: user.id,
        title,
        storage_path: storagePath,
        num_pages: pages.length,
        pages,
      };

      let { error: insertError } = await supabase
        .from("documents")
        .insert({ ...base, chapters });

      // If the `chapters` column hasn't been added yet, save without it.
      if (insertError) {
        console.error("Insert with chapters failed, retrying:", insertError);
        ({ error: insertError } = await supabase
          .from("documents")
          .insert(base));
      }
      if (insertError) throw insertError;

      setStatus("idle");
      router.refresh();
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  const busy =
    status === "extracting" ||
    status === "uploading" ||
    status === "saving";

  const busyLabel =
    status === "extracting"
      ? "Reading PDF text..."
      : status === "uploading"
        ? "Uploading file..."
        : status === "saving"
          ? "Saving..."
          : "";

  return (
    <div>
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver
            ? "border-[var(--accent-2)] bg-[var(--accent-2)]/5"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent-2)]"
        } ${busy ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {busy ? (
          <p className="text-sm text-[var(--accent-2)]">{busyLabel}</p>
        ) : (
          <>
            <p className="font-medium">Drop a PDF here or click to upload</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Text is extracted in your browser; the file is stored privately.
            </p>
          </>
        )}
      </div>

      {status === "error" && message && (
        <p className="mt-3 rounded-lg bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent)]">
          {message}
        </p>
      )}
    </div>
  );
}

