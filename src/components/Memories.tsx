"use client";

import { useEffect, useState } from "react";
import type { MemoryDTO } from "@/lib/types";

function when(m: MemoryDTO) {
  const iso = m.happenedOn ?? m.createdAt;
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: m.happenedOn ? "UTC" : undefined,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/// Journal entries attached to one place. Loaded when opened rather than with
/// the place, since most visits to a place are not about reading its history.
export default function Memories({ placeId }: { placeId: string }) {
  const [open, setOpen] = useState(false);
  const [memories, setMemories] = useState<MemoryDTO[] | null>(null);
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [happenedOn, setHappenedOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || memories) return;
    let cancelled = false;

    fetch(`/api/memories?placeId=${encodeURIComponent(placeId)}`)
      .then((r) => r.json())
      .then((b) => {
        if (!cancelled) setMemories(b.memories ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your entries");
      });

    return () => {
      cancelled = true;
    };
  }, [open, memories, placeId]);

  async function add() {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId,
        title: title.trim() || null,
        body: body.trim(),
        happenedOn: happenedOn || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save that");
      return;
    }
    setMemories((prev) => [data.memory, ...(prev ?? [])]);
    setBody("");
    setTitle("");
    setHappenedOn("");
    setWriting(false);
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) setMemories((prev) => (prev ?? []).filter((m) => m.id !== id));
    else setError("Could not delete that");
  }

  if (!open) {
    return (
      <button
        type="button"
        className="self-start text-xs text-muted hover:underline"
        onClick={() => setOpen(true)}
      >
        Memories &amp; journal
      </button>
    );
  }

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">Memories</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-md px-2 py-1 text-muted hover:bg-foreground/5"
        >
          ✕
        </button>
      </div>

      {!writing ? (
        <button type="button" className="btn btn-ghost" onClick={() => setWriting(true)}>
          Write something
        </button>
      ) : (
        <div className="space-y-2">
          <input
            className="input text-sm"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input min-h-28 resize-y text-sm"
            placeholder="What happened here? Who were you with? What do you want to remember?"
            value={body}
            autoFocus
            onChange={(e) => setBody(e.target.value)}
          />
          <label className="block text-xs text-muted">
            When it happened (optional)
            <input
              type="date"
              className="input mt-1"
              value={happenedOn}
              onChange={(e) => setHappenedOn(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || body.trim().length === 0}
              onClick={add}
            >
              {busy ? "Saving…" : "Save entry"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setWriting(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {memories === null ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : memories.length === 0 ? (
        <p className="text-xs text-muted">
          Nothing written here yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {memories.map((m) => (
            <li key={m.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {m.title && <p className="text-sm font-medium">{m.title}</p>}
                  <p className="text-xs text-muted">{when(m)}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-foreground/5"
                  disabled={busy}
                  onClick={() => remove(m.id)}
                >
                  Delete
                </button>
              </div>
              <p className="mt-1.5 text-sm whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
