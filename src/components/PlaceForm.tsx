"use client";

import { useState } from "react";
import { placeName } from "@/lib/place-name";
import CategoryPicker from "@/components/CategoryPicker";
import { STATUSES } from "@/lib/taxonomy";
import StarRating from "@/components/StarRating";
import type { PlaceDTO, PlaceDraft } from "@/lib/types";

export default function PlaceForm({
  draft,
  onCancel,
  onSaved,
}: {
  draft: PlaceDraft;
  onCancel: () => void;
  onSaved: (place: PlaceDTO) => void;
}) {
  const [name, setName] = useState(draft.name);
  const [category, setCategory] = useState(draft.category);
  const [status, setStatus] = useState<string>("wishlist");
  const [rating, setRating] = useState<number | null>(null);
  // Empty means "no particular date" — the server stamps today for a visit.
  const [visitedAt, setVisitedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: placeName({ name, city: draft.city, country: draft.country }),
        category,
        status,
        lat: draft.lat,
        lng: draft.lng,
        address: draft.address,
        city: draft.city,
        country: draft.country,
        countryCode: draft.countryCode,
        notes: notes.trim() || null,
        rating: status === "wishlist" ? null : rating,
        visitedAt:
          status === "visited" && visitedAt
            ? new Date(visitedAt).toISOString()
            : undefined,
      }),
    });

    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? "Could not save that place");
      return;
    }
    onSaved(body.place);
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Save this place</h2>
        {draft.address && (
          <p className="mt-0.5 text-xs text-muted">{draft.address}</p>
        )}
        <p className="mt-0.5 text-xs text-muted">
          {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
        </p>
      </div>

      <input
        className="input"
        value={name}
        placeholder="Name"
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />

      <CategoryPicker value={category} onChange={setCategory} />

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatus(s.id)}
            className={`chip ${status === s.id ? "is-on" : ""}`}
          >
            <span aria-hidden>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {status !== "wishlist" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Rating</span>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            Went
            <input
              type="date"
              className="input w-36 px-2 py-1 text-xs"
              value={visitedAt}
              onChange={(e) => setVisitedAt(e.target.value)}
            />
          </label>
        </div>
      )}

      <textarea
        className="input min-h-16 resize-y"
        value={notes}
        placeholder="Notes — what to order, when to go, who recommended it…"
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || name.trim().length === 0}
          onClick={save}
        >
          {saving ? "Saving…" : "Save place"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
