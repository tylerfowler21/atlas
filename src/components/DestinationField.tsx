"use client";

import { useState } from "react";
import { usePlaceSearch } from "@/lib/use-place-search";
import { searchPlaces } from "@/lib/search-places";
import type { SearchResult } from "@/lib/types";

/// A trip's destinations, as a list you build by picking real ones.
///
/// It was a text box, which meant a trip's destination was whatever somebody
/// typed — "Swizerland", "the alps", "CH" — and the place search that leans on
/// it got a hint it could do nothing with. Suggestions come from the same
/// gazetteer the stops do, so the words the trip is narrowed by are words the
/// map has heard of.
///
/// Typed text still counts. Somewhere the gazetteer has never heard of is
/// still somewhere you went, and refusing it would be worse than a bad hint.
function labelFor(result: SearchResult): string {
  // A city and its country, not a street address: this is the region a search
  // gets narrowed to, and "76 Queen Street" narrows it to nothing.
  const place = result.city ?? result.name;
  return [place, result.country].filter(Boolean).join(", ");
}

export default function DestinationField({
  value,
  onChange,
  placeholder = "Where are you going?",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const { results, searching } = usePlaceSearch(query, searchPlaces);

  // One entry per city rather than one per matching café in it.
  const suggestions = [...new Map(results.map((r) => [labelFor(r), r])).keys()]
    .filter((label) => !value.includes(label))
    .slice(0, 6);

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setQuery("");
  }

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1.5">
          {value.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="chip is-on"
                onClick={() => onChange(value.filter((n) => n !== name))}
                aria-label={`Remove ${name}`}
              >
                {name}
                <span aria-hidden className="text-muted">
                  ✕
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        className="input"
        placeholder={value.length > 0 ? "Add another" : placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter takes what is typed. Inside a form that would otherwise
          // submit the whole thing on the way to adding one word.
          if (e.key === "Enter") {
            e.preventDefault();
            add(query);
          }
          if (e.key === "Backspace" && query === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
      />

      {query.trim().length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {suggestions.map((label) => (
            <li key={label}>
              <button
                type="button"
                className="w-full rounded-lg border border-line px-2.5 py-1.5 text-left text-xs hover:bg-foreground/5"
                onClick={() => add(label)}
              >
                {label}
              </button>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="px-1 text-xs text-muted">
              {searching ? "Looking…" : "Nothing found — press Enter to use what you typed."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
