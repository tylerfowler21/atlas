"use client";

import { useState } from "react";
import { useCategories } from "@/components/CategoriesProvider";
import { usePlaceSearch } from "@/lib/use-place-search";
import { searchPlaces } from "@/lib/search-places";
import type { PlaceDTO, SearchResult } from "@/lib/types";

/// One end of a journey: a place you have saved, or one you have not.
///
/// This was a dropdown of saved places, which meant adding a train to Zermatt
/// began with going somewhere else to save Zermatt. The station you are
/// leaving from is exactly the kind of place nobody saves in advance — it is
/// not somewhere you are going, it is how you get there.
export default function PlaceChooser({
  label,
  places,
  value,
  onPick,
  onSaveNew,
  region,
}: {
  label: string;
  places: PlaceDTO[];
  /// The chosen place's id, or "" for none.
  value: string;
  onPick: (placeId: string) => void;
  /// Saves a searched place and returns its id, or null if that failed.
  onSaveNew: (result: SearchResult) => Promise<string | null>;
  region?: string[] | string | null;
}) {
  const { categoryOf } = useCategories();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const { results, searching } = usePlaceSearch(query, (q, mode) =>
    searchPlaces(q, mode, region),
  );

  const chosen = places.find((p) => p.id === value);

  if (chosen) {
    return (
      <div className="text-xs text-muted">
        {label}
        <div className="input mt-1 flex items-center gap-2">
          <span aria-hidden>{categoryOf(chosen.category).icon}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {chosen.name}
          </span>
          <button
            type="button"
            className="shrink-0 rounded px-1 text-muted hover:bg-foreground/5"
            aria-label={`Clear ${label}`}
            onClick={() => {
              onPick("");
              setQuery("");
            }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // Saved places first and unprompted, since most journeys run between two
  // places already on the trip. The world is there once you start typing.
  const saved = places
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 6);

  return (
    <div className="text-xs text-muted">
      {label}
      <input
        className="input mt-1"
        value={query}
        placeholder="Search your places or anywhere…"
        onChange={(e) => setQuery(e.target.value)}
      />

      {(saved.length > 0 || query.trim().length >= 2) && (
        <ul className="mt-1 max-h-44 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {saved.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-foreground/5"
                onClick={() => {
                  onPick(p.id);
                  setQuery("");
                }}
              >
                <span aria-hidden>{categoryOf(p.category).icon}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {p.name}
                </span>
              </button>
            </li>
          ))}

          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={saving}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-foreground/5 disabled:opacity-50"
                onClick={async () => {
                  setSaving(true);
                  const id = await onSaveNew(r);
                  setSaving(false);
                  if (id) {
                    onPick(id);
                    setQuery("");
                  }
                }}
              >
                <span aria-hidden>{categoryOf(r.category).icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{r.name}</span>
                  <span className="block truncate text-xs text-muted">{r.context}</span>
                </span>
                <span className="shrink-0 text-xs text-accent-text">Use</span>
              </button>
            </li>
          ))}

          {query.trim().length >= 2 && saved.length === 0 && results.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-muted">
              {searching ? "Looking…" : "Nothing found for that."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
