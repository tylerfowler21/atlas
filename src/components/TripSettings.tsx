"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toDateInput } from "@/lib/trips";
import type { TripDTO } from "@/lib/types";

const COLORS = [
  "#0D2B45", // deep navy
  "#4DB6AC", // teal
  "#4A6B8A", // slate
  "#E07A5F", // coral
  "#D9A441", // amber
  "#7A946B", // sage
];

export default function TripSettings({
  trip,
  onUpdated,
}: {
  trip: TripDTO;
  onUpdated: (trip: TripDTO) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination ?? "");
  const [startDate, setStartDate] = useState(toDateInput(trip.startDate));
  const [endDate, setEndDate] = useState(toDateInput(trip.endDate));
  const [color, setColor] = useState(trip.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Deleting a whole itinerary deserves a second click, not a browser dialog.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [published, setPublished] = useState(trip.publishedAt !== null);

  /// Saved on its own rather than with the rest of the form, so switching
  /// visibility takes effect immediately and can't be left pending.
  async function publish(next: boolean) {
    setPublished(next);
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/trips/${trip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setPublished(!next);
      setError(body.error ?? "Could not change who can see this");
      return;
    }
    onUpdated(body.trip);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="self-start text-xs text-muted hover:underline"
        onClick={() => setOpen(true)}
      >
        Edit trip
      </button>
    );
  }

  async function save() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/trips/${trip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        destination: destination.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
        color,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not save the trip");
      return;
    }
    onUpdated(body.trip);
    setOpen(false);
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });

    if (!res.ok) {
      setBusy(false);
      setError("Could not delete the trip");
      return;
    }
    router.push("/trips");
    router.refresh();
  }

  return (
    <div className="card space-y-3 p-3">
      <input
        className="input"
        aria-label="Trip title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="input"
        aria-label="Destination"
        placeholder="Destination"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Starts
          <input
            type="date"
            className="input mt-1"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="text-xs text-muted">
          Ends
          <input
            type="date"
            className="input mt-1"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Colour</span>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Use colour ${c}`}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            className="size-5 rounded-full"
            style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${c}66` : undefined }}
          />
        ))}
      </div>

      {/* Publishing is a different kind of decision from renaming, so it gets
          its own block rather than sitting among the text fields. */}
      <div className="space-y-1.5 border-t border-line pt-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={published}
            disabled={busy}
            onChange={(e) => publish(e.target.checked)}
          />
          <span>
            <span className="font-medium">Publish to my profile</span>
            <span className="mt-0.5 block text-xs text-muted">
              {published
                ? "Anyone can find this on your profile, and people who follow you see it in their feed. They can copy it, but not change yours."
                : "Private. Only you and anyone you've invited to edit can see it."}
            </span>
          </span>
        </label>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || title.trim().length === 0}
          onClick={save}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-ghost ml-auto text-red-500"
          disabled={busy}
          onClick={() => (confirmingDelete ? remove() : setConfirmingDelete(true))}
        >
          {confirmingDelete ? "Really delete?" : "Delete trip"}
        </button>
      </div>
    </div>
  );
}
