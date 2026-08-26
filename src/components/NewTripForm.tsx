"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const COLORS = [
  "#0D2B45", // deep navy
  "#4DB6AC", // teal
  "#4A6B8A", // slate
  "#E07A5F", // coral
  "#D9A441", // amber
  "#7A946B", // sage
];

export default function NewTripForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [color, setColor] = useState(COLORS[0]!);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        New trip
      </button>
    );
  }

  async function create() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        destination: destination.trim() || null,
        // A date input gives "YYYY-MM-DD"; parsed as UTC midnight.
        startDate: startDate || null,
        endDate: endDate || null,
        color,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.error ?? "Could not create that trip");
      return;
    }
    router.push(`/trips/${body.trip.id}`);
  }

  return (
    <div className="card w-full max-w-md space-y-3 p-4">
      <h2 className="text-sm font-semibold">New trip</h2>

      <input
        className="input"
        placeholder="Trip title — “Portugal, spring”"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <input
        className="input"
        placeholder="Destination (optional)"
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
            className={`size-5 rounded-full transition-transform ${
              color === c ? "scale-115 ring-2 ring-offset-2 ring-offset-surface" : ""
            }`}
            style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
          />
        ))}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || title.trim().length === 0}
          onClick={create}
        >
          {saving ? "Creating…" : "Create trip"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
