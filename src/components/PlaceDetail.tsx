"use client";

import { useState } from "react";
import CategoryPicker from "@/components/CategoryPicker";
import StarRating from "@/components/StarRating";
import { category as categoryOf } from "@/lib/taxonomy";
import { flagEmoji } from "@/lib/geo";
import type { PlaceDTO, TripDTO } from "@/lib/types";

export default function PlaceDetail({
  place,
  trips,
  onUpdated,
  onDeleted,
  onClose,
}: {
  place: PlaceDTO;
  trips: TripDTO[];
  onUpdated: (place: PlaceDTO) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(place);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<string | null>(null);

  // Selecting a different pin resets this editor: the parent gives it a
  // `key` of the place id, so React remounts it rather than carrying edits over.

  const dirty =
    draft.name !== place.name ||
    draft.category !== place.category ||
    draft.status !== place.status ||
    draft.rating !== place.rating ||
    draft.notes !== place.notes;

  async function patch(changes: Partial<PlaceDTO>) {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/places/${place.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not save those changes");
      return;
    }
    onUpdated(body.place);
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/places/${place.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onDeleted(place.id);
    else setError("Could not delete that place");
  }

  async function addToTrip(tripId: string) {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/trips/${tripId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: place.name,
        placeId: place.id,
        category: place.category,
        dayIndex: 0,
      }),
    });
    setBusy(false);

    if (!res.ok) {
      setError("Could not add that to the trip");
      return;
    }
    setAddedTo(trips.find((t) => t.id === tripId)?.title ?? "trip");
  }

  const meta = categoryOf(draft.category);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {flagEmoji(place.countryCode)}{" "}
            {[place.city, place.country].filter(Boolean).join(", ") || "Saved place"}
          </p>
          <input
            className="input mt-1 font-medium"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md px-2 py-1 text-muted hover:bg-foreground/5"
        >
          ✕
        </button>
      </div>

      {place.address && <p className="text-xs text-muted">{place.address}</p>}

      <div className="flex gap-1.5">
        {(["wishlist", "visited"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setDraft({ ...draft, status: s })}
            className={`chip ${draft.status === s ? "is-on" : ""}`}
          >
            {s === "wishlist" ? "🔖 Want to go" : "✅ Been there"}
          </button>
        ))}
      </div>

      {draft.status === "visited" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Rating</span>
          <StarRating
            value={draft.rating}
            onChange={(rating) => setDraft({ ...draft, rating })}
          />
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs text-muted">
          Category — currently <span style={{ color: meta.color }}>{meta.label}</span>
        </p>
        <CategoryPicker
          value={draft.category}
          onChange={(category) => setDraft({ ...draft, category })}
        />
      </div>

      <textarea
        className="input min-h-20 resize-y"
        value={draft.notes ?? ""}
        placeholder="Notes"
        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !dirty || draft.name.trim().length === 0}
          onClick={() =>
            patch({
              name: draft.name.trim(),
              category: draft.category,
              status: draft.status,
              rating: draft.status === "visited" ? draft.rating : null,
              notes: draft.notes?.trim() || null,
            })
          }
        >
          {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={remove}>
          Delete
        </button>
      </div>

      {trips.length > 0 && (
        <div className="border-t border-line pt-3">
          <label className="text-xs text-muted" htmlFor="add-to-trip">
            Add to a trip
          </label>
          <select
            id="add-to-trip"
            className="input mt-1"
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && addToTrip(e.target.value)}
          >
            <option value="">Choose a trip…</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          {addedTo && (
            <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              Added to {addedTo} — day 1.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
