"use client";

import Link from "next/link";
import { placeName } from "@/lib/place-name";
import { useEffect, useState } from "react";
import DirectionsIcon from "@/components/DirectionsIcon";
import CategoryPicker from "@/components/CategoryPicker";
import EmojiField from "@/components/EmojiField";
import Memories from "@/components/Memories";
import StarRating from "@/components/StarRating";
import { category as categoryOf, STATUSES } from "@/lib/taxonomy";
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

  /// The trips this place is already on.
  ///
  /// Fetched when the panel opens rather than shipped with every place: most
  /// places are never opened, and this is item-level data the map does not
  /// otherwise need.
  /// Tagged with the place it describes rather than cleared when the place
  /// changes: clearing means a setState in the effect body, and the answer for
  /// the previous place must not be shown against this one meanwhile.
  const [fetched, setFetched] = useState<{
    placeId: string;
    trips: { id: string; title: string; color: string; dayIndex: number; times: number }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/places/${place.id}/trips`);
        const body = res.ok ? await res.json() : { trips: [] };
        if (!cancelled) setFetched({ placeId: place.id, trips: body.trips ?? [] });
      } catch {
        if (!cancelled) setFetched({ placeId: place.id, trips: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [place.id]);

  const onTrips = fetched?.placeId === place.id ? fetched.trips : [];
  const [dayIndex, setDayIndex] = useState(0);

  // Selecting a different pin resets this editor: the parent gives it a
  // `key` of the place id, so React remounts it rather than carrying edits over.

  const dirty =
    draft.name !== place.name ||
    draft.category !== place.category ||
    draft.emoji !== place.emoji ||
    draft.status !== place.status ||
    draft.rating !== place.rating ||
    draft.livedFrom !== place.livedFrom ||
    draft.livedTo !== place.livedTo ||
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
    // Asked only when there is something to lose. Deleting a place now removes
    // it from the days it is on, and finding that out afterwards is too late.
    if (onTrips.length > 0) {
      const where = onTrips.map((t) => t.title).join(", ");
      const confirmed = window.confirm(
        `${placeName(place)} is on ${onTrips.length === 1 ? "a trip" : `${onTrips.length} trips`}: ${where}.\n\n` +
          `Deleting it removes those stops too. This cannot be undone.`,
      );
      if (!confirmed) return;
    }

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
      {/* Stuck to the top of the scrolling panel. Opening a place from the
          map leaves the panel scrolled part way down, which put this header —
          and the only way out — above the visible area. Opening the same place
          from the list happened to start at the top, which is why one route
          appeared to work and the other did not. */}
      <div className="sticky top-0 z-10 -mx-4 flex items-start justify-between gap-2 border-b border-line bg-surface px-4 pt-1 pb-2 lg:mx-0 lg:border-0 lg:px-0">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {flagEmoji(place.countryCode)}{" "}
            {[place.city, place.country].filter(Boolean).join(", ") || "Saved place"}
          </p>
          <input
            className="input mt-1 font-medium"
            value={draft.name}
            placeholder={placeName({ name: null, city: place.city, country: place.country })}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        {/* A labelled button, not a bare glyph. On a phone this panel
            covers the map, and a thin grey ✕ at the edge is the only way
            back — which is not a way back that anyone finds. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close and return to the map"
          className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:bg-foreground/5"
        >
          <span aria-hidden>✕</span>
          Close
        </button>
      </div>

      {place.address && <p className="text-xs text-muted">{place.address}</p>}

      <a
        href={directionsUrl({ lat: place.lat, lng: place.lng, name: place.name })}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost w-full justify-center gap-2"
      >
        <DirectionsIcon />
        Directions
      </a>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setDraft({ ...draft, status: s.id })}
            className={`chip ${draft.status === s.id ? "is-on" : ""}`}
          >
            <span aria-hidden>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {draft.status === "lived" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Moved in
            <input
              type="date"
              className="input mt-1"
              value={draft.livedFrom ? draft.livedFrom.slice(0, 10) : ""}
              onChange={(e) =>
                setDraft({ ...draft, livedFrom: e.target.value || null })
              }
            />
          </label>
          <label className="text-xs text-muted">
            Left
            <input
              type="date"
              className="input mt-1"
              value={draft.livedTo ? draft.livedTo.slice(0, 10) : ""}
              min={draft.livedFrom ? draft.livedFrom.slice(0, 10) : undefined}
              onChange={(e) => setDraft({ ...draft, livedTo: e.target.value || null })}
            />
            <span className="mt-1 block text-xs text-muted">
              Leave empty if you&apos;re still there.
            </span>
          </label>
        </div>
      )}

      {/* Anywhere you have actually been, which includes somewhere you
          lived. Saving keeps a rating for both — showing the control for
          only one of them left a rating you could see and not change. */}
      {draft.status !== "wishlist" && (
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
          // Not gated on a name. Somewhere with none is called after the city
          // it is in, so an empty field is a thing to fill in for you rather
          // than a reason to refuse the save.
          disabled={busy || !dirty}
          onClick={() =>
            patch({
              name: placeName({
                name: draft.name,
                city: place.city,
                country: place.country,
              }),
              category: draft.category,
              emoji: draft.emoji,
              status: draft.status,
              livedFrom: draft.status === "lived" ? draft.livedFrom : null,
              livedTo: draft.status === "lived" ? draft.livedTo : null,
              rating: draft.status === "wishlist" ? null : draft.rating,
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

      <Memories placeId={place.id} />

      {trips.length > 0 && (
        <div className="space-y-2 border-t border-line pt-3">
          {onTrips.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted">Already on</p>
              <ul className="space-y-1">
                {onTrips.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-xs">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: t.color }}
                    />
                    <Link href={`/trips/${t.id}`} className="truncate hover:underline">
                      {t.title}
                    </Link>
                    <span className="shrink-0 text-muted">
                      day {t.dayIndex + 1}
                      {t.times > 1 ? ` · ${t.times} times` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="block text-xs text-muted" htmlFor="add-to-trip">
            {onTrips.length > 0 ? "Add to another trip" : "Add to a trip"}
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
