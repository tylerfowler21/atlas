"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toDateInput } from "@/lib/trips";
import type { TripDTO } from "@/lib/types";

const COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

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
