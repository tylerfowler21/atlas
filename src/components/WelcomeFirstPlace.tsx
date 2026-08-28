"use client";

import { useState } from "react";
import { usePlaceSearch } from "@/lib/use-place-search";
import { searchPlaces } from "@/lib/search-places";
import { category as categoryOf } from "@/lib/taxonomy";
import type { SearchResult } from "@/lib/types";

/// The step where somebody actually saves something.
///
/// The tour used to end by explaining the map and then showing you an empty
/// one, which is the moment a new account either becomes yours or gets closed.
/// Doing it once here — search, pick, saved — means the first thing you see is
/// a map with something on it, and the thing you did to get it there is the
/// thing you will keep doing.
///
/// Two questions only: where, and have you been. Everything else about a place
/// can be filled in later, from the place itself.

export default function WelcomeFirstPlace({
  onSaved,
  onSkip,
}: {
  onSaved: (count: number) => void;
  onSkip: () => void;
}) {
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<{ name: string; status: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { results, searching } = usePlaceSearch(query, searchPlaces);

  async function save(result: SearchResult, status: "wishlist" | "visited") {
    setBusy(result.id);
    setError(null);

    const res = await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: result.name,
        lat: result.lat,
        lng: result.lng,
        category: result.category,
        status,
        address: result.address,
        city: result.city,
        country: result.country,
        countryCode: result.countryCode,
      }),
    });
    setBusy(null);

    if (!res.ok) {
      setError("That didn't save — try another one");
      return;
    }
    setSaved((current) => [...current, { name: result.name, status }]);
    setQuery("");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-4xl" aria-hidden>
          📍
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Put something on your map</h1>
        <p className="mt-2 text-sm text-muted">
          Anywhere at all — a city you loved, a restaurant you keep meaning to
          try. This is the whole app in one move, and it&apos;s nicer to arrive
          at a map with something already on it.
        </p>
      </div>

      <div>
        <input
          className="input"
          value={query}
          autoFocus
          placeholder="Search anywhere in the world…"
          aria-label="Search for a place"
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && <p className="mt-1.5 text-xs text-muted">Searching…</p>}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {results.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {results.slice(0, 6).map((r) => (
            <li key={r.id} className="p-2.5">
              <div className="flex items-start gap-2">
                <span aria-hidden className="text-base">
                  {categoryOf(r.category).icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[r.city, r.country].filter(Boolean).join(", ") || r.address}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost flex-1 justify-center text-xs"
                  disabled={busy !== null}
                  onClick={() => void save(r, "wishlist")}
                >
                  🔖 Want to go
                </button>
                <button
                  type="button"
                  className="btn btn-ghost flex-1 justify-center text-xs"
                  disabled={busy !== null}
                  onClick={() => void save(r, "visited")}
                >
                  ✅ Been there
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {saved.length > 0 && (
        <ul className="space-y-1">
          {saved.map((s, i) => (
            <li key={`${s.name}-${i}`} className="text-xs text-muted">
              {s.status === "visited" ? "✅" : "🔖"} {s.name} — saved
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <button
          type="button"
          className="btn btn-primary w-full justify-center"
          disabled={saved.length === 0}
          onClick={() => onSaved(saved.length)}
        >
          {saved.length === 0
            ? "Save one to continue"
            : saved.length === 1
              ? "That's my first pin"
              : `Done — ${saved.length} pins`}
        </button>
        <button
          type="button"
          className="w-full text-xs text-muted hover:underline"
          onClick={onSkip}
        >
          Skip — I&apos;ll add places later
        </button>
      </div>
    </div>
  );
}
