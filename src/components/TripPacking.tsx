"use client";

import { useRef, useState } from "react";
import AskOttoToPack from "@/components/AskOttoToPack";
import { PACKING_KIND } from "@/lib/resources";
import type { TripResourceDTO } from "@/lib/types";

/// What to put in the bag.
///
/// The same rows as "Before you go", in the same table, through the same
/// routes — a packing item is a label, a tick and an order, which is exactly
/// what a resource is. What is different is the screen and the hands.
///
/// Four passes and twenty pairs of socks do not belong in one list. And they
/// are not written the same way: a resource is added one evening a week, with
/// a kind and often a link, while a packing list is written in one go at
/// eleven at night — so this is a box that takes a word, keeps the focus, and
/// waits for the next one. No kind to choose, no link to paste, nothing to
/// reach for the mouse over.

export default function TripPacking({
  tripId,
  initial,
  canEdit,
  otto = false,
}: {
  tripId: string;
  initial: TripResourceDTO[];
  canEdit: boolean;
  /// Whether Otto is around to be asked. Decided on the server, like
  /// everywhere else he appears.
  otto?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLInputElement>(null);

  const left = items.filter((i) => !i.ready).length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const what = label.trim();
    if (!what) return;
    setBusy(true);
    setError(null);
    // Cleared before the round trip, not after: the next thing is already
    // being typed by the time this comes back, and putting the box right at
    // that moment eats it.
    setLabel("");
    try {
      const res = await fetch(`/api/trips/${tripId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: what, kind: PACKING_KIND }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not add that");
      setItems((prev) => [...prev, body.resource]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that");
      setLabel(what);
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  }

  /// Ticked at once and asked afterwards. Packing is done standing over a
  /// suitcase with one hand free, and a tick that waits for a server is a tick
  /// somebody presses twice.
  async function tick(id: string, ready: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ready } : i)));
    try {
      const res = await fetch(`/api/resources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ready }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ready: !ready } : i)));
      setError("That didn't save");
    }
  }

  async function remove(id: string) {
    const gone = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/resources/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      if (gone) setItems((prev) => [...prev, gone].sort((a, b) => a.position - b.position));
      setError("That didn't save");
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold">
        Packing
        {items.length > 0 && (
          <span className="ml-2 text-xs font-normal text-muted">
            {left === 0 ? "all packed" : `${left} to pack`}
          </span>
        )}
      </h2>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {items.length === 0 && !canEdit && (
        <p className="mt-2 text-xs text-muted">Nothing on the packing list yet.</p>
      )}

      {items.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-2 rounded-lg px-1 py-1">
              <input
                type="checkbox"
                checked={item.ready}
                disabled={!canEdit}
                onChange={(e) => void tick(item.id, e.target.checked)}
                aria-label={`Packed ${item.label}`}
                className="size-4 shrink-0 accent-[color:var(--accent)]"
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  item.ready ? "text-muted line-through" : ""
                }`}
              >
                {item.label}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void remove(item.id)}
                  aria-label={`Remove ${item.label}`}
                  className="shrink-0 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && otto && (
        <AskOttoToPack
          tripId={tripId}
          onAdded={(added) => setItems((prev) => [...prev, ...added])}
        />
      )}

      {canEdit && (
        <form onSubmit={add} className="mt-2">
          <input
            ref={box}
            className="input text-sm"
            placeholder="Passport, adapter, walking shoes…"
            aria-label="Something to pack"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={busy}
          />
        </form>
      )}
    </div>
  );
}
