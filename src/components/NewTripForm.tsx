"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import DestinationField from "@/components/DestinationField";
import { pinFrom, pinsFor, type DestinationPin } from "@/lib/destination-pins";
import { TRIP_COLORS as COLORS } from "@/lib/brand";
import { regionLabel, regionOfColor } from "@/lib/regions";

export default function NewTripForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [destinations, setDestinations] = useState<string[]>([]);
  /// What the picker found for each one, so the server does not have to look
  /// the label up again and land on the province instead of the city.
  const [pins, setPins] = useState<Record<string, DestinationPin>>({});
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
        destinations,
        destinationPins: pinsFor(destinations, pins),
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
    // The wrapper is full width so the form takes a line of its own rather than
    // sitting beside the buttons it belongs under; the card inside keeps a
    // readable width. A max-width on the flex item itself was not enough —
    // wrapping is decided on the width the item would actually take.
    <div className="w-full">
      <div className="card w-full max-w-md space-y-3 p-4">
      <h2 className="text-sm font-semibold">New trip</h2>

      <input
        className="input"
        placeholder="Trip title — “Portugal, spring”"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <DestinationField
        value={destinations}
        onPick={(label, result) =>
          setPins((current) => ({ ...current, [label]: pinFrom(label, result) }))
        }
        onChange={setDestinations}
        placeholder="Where are you going? (optional)"
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

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Colour</span>
          {COLORS.map((c) => {
            const region = regionLabel(regionOfColor(c));
            return (
              <button
                key={c}
                type="button"
                // The region, not the hex. "#3C7FB0" tells a screen reader —
                // and a tooltip — nothing anybody wants to know.
                title={region ?? c}
                aria-label={region ? `Use the ${region} colour` : `Use colour ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`size-5 rounded-full transition-transform ${
                  color === c ? "scale-115 ring-2 ring-offset-2 ring-offset-surface" : ""
                }`}
                style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
              />
            );
          })}
          <span className="text-xs text-muted">{regionLabel(regionOfColor(color))}</span>
        </div>
      {/* What the colours mean, said once rather than left to be inferred.
          Every colour a trip can be given by where it goes is also one
          somebody can pick by hand, so a row of seven circles is really the
          seven regions — and nothing on screen said so. */}
      <p className="text-xs text-muted">
        Trips are coloured by region — {regionLabel("europe")} blue,{" "}
        {regionLabel("asia")} red, and so on — so the list reads as a map.
        Picking one here overrides that.
      </p>
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
    </div>
  );
}
