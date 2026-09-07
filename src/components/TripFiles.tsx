"use client";

import { useState } from "react";
import { formatDay } from "@/lib/trips";
import {
  MAX_DOCUMENT_BYTES,
  documentIcon,
  formatBytes,
} from "@/lib/trip-documents";
import type { TripDocumentDTO } from "@/lib/types";

/// The paperwork a trip collects: hotel confirmations, tickets, the itinerary
/// somebody emailed over.
///
/// These live in an inbox until the morning they are needed, which is the one
/// morning the wifi is bad and the email will not load. Kept on the trip, they
/// are one tap from the day they belong to — and everyone the trip is shared
/// with has them too, rather than one person holding all the bookings.
export default function TripFiles({
  tripId,
  initial,
}: {
  tripId: string;
  initial: TripDocumentDTO[];
}) {
  const [files, setFiles] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(chosen: FileList | null) {
    if (!chosen || chosen.length === 0) return;
    setBusy(true);
    setError(null);

    // One at a time, in order, so a failure names the file that failed rather
    // than leaving you to work out which of five did not arrive.
    for (const file of Array.from(chosen)) {
      if (file.size > MAX_DOCUMENT_BYTES) {
        setError(`${file.name} is bigger than ${formatBytes(MAX_DOCUMENT_BYTES)}`);
        continue;
      }
      const body = new FormData();
      body.append("file", file);
      try {
        const res = await fetch(`/api/trips/${tripId}/documents`, { method: "POST", body });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not upload that");
        setFiles((prev) => [json.document, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? `${file.name}: ${e.message}` : "Could not upload that");
      }
    }
    setBusy(false);
  }

  async function remove(id: string) {
    const gone = files.find((f) => f.id === id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok && gone) {
      setFiles((prev) =>
        [gone, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
      setError("Could not remove that file");
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold">
        Files
        {files.length > 0 && (
          <span className="ml-2 text-xs font-normal text-muted">{files.length}</span>
        )}
      </h2>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {files.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          Hotel confirmations, tickets, anything you were emailed. PDFs, Word,
          Excel, text and photos, up to {formatBytes(MAX_DOCUMENT_BYTES)} each.
          Everyone this trip is shared with can read them.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-lg border border-line p-2"
            >
              <span aria-hidden className="text-sm">
                {documentIcon(file.contentType)}
              </span>
              <a
                href={`/api/documents/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1"
              >
                <span className="block truncate text-sm text-accent-text hover:underline">
                  {file.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {formatBytes(file.size)} · added{" "}
                  {formatDay(new Date(file.createdAt), { weekday: undefined })}
                </span>
              </a>
              <button
                type="button"
                className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-foreground/5"
                onClick={() => remove(file.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-3 inline-block">
        <span className={`btn text-xs ${busy ? "opacity-50" : ""}`}>
          {busy ? "Uploading…" : "Add a file"}
        </span>
        <input
          type="file"
          multiple
          className="sr-only"
          disabled={busy}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
          onChange={(e) => {
            void upload(e.target.files);
            // Cleared so choosing the same file twice still fires a change.
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
