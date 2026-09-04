"use client";

import { useState } from "react";
import { RESOURCE_KINDS, resourceKind } from "@/lib/resources";
import type { TripResourceDTO } from "@/lib/types";

/// Apps, passes and paperwork for one trip.
///
/// Every trip has a handful of these and they are always learned the hard way:
/// the transit app that wants a card registered before you land, the museum
/// pass that is cheaper bought at home, the visa form with a lead time. They
/// live in a group chat until the morning they are needed, which is the one
/// morning nobody can find them.
export default function TripResources({
  tripId,
  initial,
  canEdit,
}: {
  tripId: string;
  initial: TripResourceDTO[];
  canEdit: boolean;
}) {
  const [resources, setResources] = useState(initial);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<string>("app");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), url: url.trim() || null, kind }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not add that");
      setResources((prev) => [...prev, body.resource]);
      setLabel("");
      setUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, changes: Partial<TripResourceDTO>) {
    // Ticked first, saved after: the checkbox is the whole interaction, and a
    // round trip's worth of delay makes it feel broken.
    setResources((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    const res = await fetch(`/api/resources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (!res.ok) setError("That change didn't save");
  }

  async function remove(id: string) {
    const gone = resources.find((r) => r.id === id);
    setResources((prev) => prev.filter((r) => r.id !== id));
    const res = await fetch(`/api/resources/${id}`, { method: "DELETE" });
    if (!res.ok && gone) {
      setResources((prev) => [...prev, gone].sort((a, b) => a.position - b.position));
      setError("Could not remove that");
    }
  }

  const waiting = resources.filter((r) => !r.ready).length;

  return (
    <div>
      <h2 className="text-sm font-semibold">
        Before you go
        {resources.length > 0 && (
          <span className="ml-2 text-xs font-normal text-muted">
            {waiting === 0 ? "all sorted" : `${waiting} to sort out`}
          </span>
        )}
      </h2>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {resources.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          The apps, passes and paperwork this trip needs — the transit app, the
          rail pass worth buying early, the offline map, the visa form.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {resources.map((r) => {
            const meta = resourceKind(r.kind);
            return (
              <li key={r.id} className="flex items-start gap-2 rounded-lg border border-line p-2">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0"
                  checked={r.ready}
                  disabled={!canEdit}
                  aria-label={`${r.label} is sorted`}
                  onChange={() => patch(r.id, { ready: !r.ready })}
                />
                <span aria-hidden className="text-sm">
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block truncate text-sm hover:underline ${r.ready ? "text-muted line-through" : "text-accent-text"}`}
                    >
                      {r.label}
                    </a>
                  ) : (
                    <p className={`truncate text-sm ${r.ready ? "text-muted line-through" : ""}`}>
                      {r.label}
                    </p>
                  )}
                  {r.note && <p className="truncate text-xs text-muted">{r.note}</p>}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted hover:bg-foreground/5"
                    onClick={() => remove(r.id)}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={add} className="mt-3 space-y-1.5">
          <input
            className="input text-sm"
            placeholder="SBB Mobile, Swiss Travel Pass, passport…"
            aria-label="What you need"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="flex gap-1.5">
            <select
              aria-label="What kind"
              className="input w-32 text-xs"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {RESOURCE_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.icon} {k.label}
                </option>
              ))}
            </select>
            <input
              className="input flex-1 text-xs"
              placeholder="Link (optional)"
              aria-label="Link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit" className="btn text-xs" disabled={busy || !label.trim()}>
              Add
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
