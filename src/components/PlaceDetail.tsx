"use client";

import { useState } from "react";
import CategoryPicker from "@/components/CategoryPicker";
import EmojiField from "@/components/EmojiField";
import StarRating from "@/components/StarRating";
import { category as categoryOf } from "@/lib/taxonomy";
import { dayCount, toDateInput } from "@/lib/trips";
import { flagEmoji } from "@/lib/geo";
import { directionsUrl } from "@/lib/directions";
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
  const [tripId, setTripId] = useState("");
  const [dayIndex, setDayIndex] = useState(0);

  // Selecting a different pin resets this editor: the parent gives it a
  // `key` of the place id, so React remounts it rather than carrying edits over.

  const dirty =
    draft.name !== place.name ||
    draft.category !== place.category ||
    draft.emoji !== place.emoji ||
    draft.status !== place.status ||
    draft.rating !== place.rating ||
    draft.notes !== place.notes ||
    draft.visitedAt !== place.visitedAt;

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

  async function addToTrip() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/trips/${tripId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: place.name,
        placeId: place.id,
        category: place.category,
        dayIndex,
      }),
    });
    setBusy(false);

    if (!res.ok) {
      setError("Could not add that to the trip");
      return;
    }
    const trip = trips.find((t) => t.id === tripId);
    setAddedTo(`${trip?.title ?? "trip"} — day ${dayIndex + 1}`);
  }

  const meta = categoryOf(draft.category);
  const selectedTrip = trips.find((t) => t.id === tripId) ?? null;
  // Days come from the trip's own dates; an undated trip starts at one day.
  const tripDays = selectedTrip ? dayCount(selectedTrip, []) : 1;

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

      <a
        href={directionsUrl({ lat: place.lat, lng: place.lng, name: place.name })}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost w-full justify-center"
      >
        Directions in Apple Maps →
      </a>

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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Rating</span>
            <StarRating
              value={draft.rating}
              onChange={(rating) => setDraft({ ...draft, rating })}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            Went
            <input
              type="date"
              className="input w-36 px-2 py-1 text-xs"
              value={toDateInput(draft.visitedAt)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  // A date input is a plain date; store it as UTC midnight.
                  visitedAt: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
            />
          </label>
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

      <EmojiField
        emoji={draft.emoji}
        category={draft.category}
        onChange={(emoji) => setDraft({ ...draft, emoji })}
      />

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
              emoji: draft.emoji,
              status: draft.status,
              rating: draft.status === "visited" ? draft.rating : null,
              notes: draft.notes?.trim() || null,
              visitedAt: draft.status === "visited" ? draft.visitedAt : null,
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
        <div className="space-y-2 border-t border-line pt-3">
          <label className="block text-xs text-muted" htmlFor="add-to-trip">
            Add to a trip
          </label>
          <select
            id="add-to-trip"
            className="input"
            value={tripId}
            disabled={busy}
            onChange={(e) => {
              setTripId(e.target.value);
              setDayIndex(0);
              setAddedTo(null);
            }}
          >
            <option value="">Choose a trip…</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          {selectedTrip && (
            <div className="flex gap-2">
              <select
                aria-label="Day"
                className="input w-32 shrink-0"
                value={dayIndex}
                disabled={busy}
                onChange={(e) => setDayIndex(Number(e.target.value))}
              >
                {Array.from({ length: tripDays }, (_, i) => (
                  <option key={i} value={i}>
                    Day {i + 1}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={addToTrip}
              >
                Add to trip
              </button>
            </div>
          )}

          {addedTo && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Added to {addedTo}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
