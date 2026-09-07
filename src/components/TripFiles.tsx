"use client";

import { useRef, useState } from "react";
import { formatDay } from "@/lib/trips";
import { MAX_DOCUMENT_BYTES, documentIcon, formatBytes } from "@/lib/trip-documents";
import type { TripDocumentDTO } from "@/lib/types";

/// The paperwork a trip collects: hotel confirmations, tickets, the itinerary
/// somebody emailed over. These live in an inbox until the morning they are
/// needed, which is reliably the morning the wifi is bad.
///
/// Two shapes, one component, because they are the same list read two ways.
/// Attached to the hotel it confirms, a file is one tap from the night you are
/// checking; gathered on the Files tab, the same file is findable when you
/// cannot remember which day the hotel was.
export default function TripFiles({
  files,
  onUpload,
  onRemove,
  itemId = null,
  labelFor,
  busy,
}: {
  files: TripDocumentDTO[];
  onUpload: (file: File, itemId: string | null) => Promise<string | null>;
  onRemove: (id: string) => void;
  /// Set to show only this stop's files, and to attach anything added here to
  /// it. Null is the whole trip.
  itemId?: string | null;
  /// What a file is attached to, for the trip-wide list.
  labelFor?: (itemId: string) => string | null;
  busy?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const shown = itemId === null ? files : files.filter((f) => f.itemId === itemId);
  const compact = itemId !== null;

  async function send(chosen: FileList | null) {
    if (!chosen || chosen.length === 0) return;
    setUploading(true);
    setError(null);
    // One at a time and in order, so a failure names the file that failed
    // rather than leaving you to work out which of five did not arrive.
    for (const file of Array.from(chosen)) {
      if (file.size > MAX_DOCUMENT_BYTES) {
        setError(`${file.name} is bigger than ${formatBytes(MAX_DOCUMENT_BYTES)}`);
        continue;
      }
      const failed = await onUpload(file, itemId);
      if (failed) setError(`${file.name}: ${failed}`);
    }
    setUploading(false);
  }

  const adding = uploading || busy;

  return (
    <div>
      {!compact && (
        <h2 className="text-sm font-semibold">
          Files
          {files.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">{files.length}</span>
          )}
        </h2>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {shown.length === 0
        ? !compact && (
            <p className="mt-2 text-xs text-muted">
              Hotel confirmations, tickets, anything you were emailed. PDFs,
              Word, Excel, text and photos, up to {formatBytes(MAX_DOCUMENT_BYTES)}{" "}
              each. Everyone this trip is shared with can read them.
            </p>
          )
        : (
          <ul className={compact ? "space-y-1" : "mt-2 space-y-1.5"}>
            {shown.map((file) => {
              const attached = file.itemId ? labelFor?.(file.itemId) : null;
              return (
                <li
                  key={file.id}
                  className={`flex items-center gap-2 rounded-lg border border-line ${compact ? "px-2 py-1" : "p-2"}`}
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
                    <span className="block truncate text-xs text-accent-text hover:underline">
                      {file.name}
                    </span>
                    {!compact && (
                      <span className="block truncate text-xs text-muted">
                        {formatBytes(file.size)}
                        {attached ? ` · ${attached}` : ""} · added{" "}
                        {formatDay(new Date(file.createdAt), { weekday: undefined })}
                      </span>
                    )}
                  </a>
                  <button
                    type="button"
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-foreground/5"
                    onClick={() => onRemove(file.id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

      <label className={compact ? "mt-1 inline-block" : "mt-3 inline-block"}>
        <span className={`${compact ? "text-xs text-accent-text hover:underline" : "btn text-xs"} ${adding ? "opacity-50" : ""}`}>
          {adding ? "Uploading…" : compact ? "📎 Attach a file" : "Add a file"}
        </span>
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          disabled={adding}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
          onChange={(e) => {
            void send(e.target.files);
            // Cleared so choosing the same file twice still fires a change.
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
