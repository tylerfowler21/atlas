"use client";

import { useCategories } from "@/components/CategoriesProvider";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
// taxonomy comes through the provider
import { parseItinerary, parsedDayCount, type ParsedEntry } from "@/lib/itinerary-parser";
import { categoryFromWord } from "@/lib/category-words";
import DraftTrip from "@/components/DraftTrip";
import type { SearchResult } from "@/lib/types";

const PLACEHOLDER = `Day 1: Zürich
- Lindenhof
09:00 Grossmünster — climb the tower

Day 2
Lauterbrunnen
Trümmelbach Falls - loud, bring a jacket

Day 3: Jungfraujoch
Kleine Scheidegg`;

type Row = ParsedEntry & {
  /// Geocoder matches, best first. Empty once lookup has failed or found nothing.
  candidates: SearchResult[];
  /// Index into candidates, or -1 for "no map pin".
  chosen: number;
  /// The geocoder's guess is often "other"; this is what actually gets saved.
  category: string;
  state: "waiting" | "looking" | "done";
};

/// A spreadsheet's Category column ends up at the front of the note, because
/// that is where the columns it came from put it. These read it back out.
function leadingWord(note: string | null) {
  return note ? (note.split(",")[0] ?? "").trim() : null;
}

function withoutLeadingWord(note: string | null) {
  if (!note) return note;
  const rest = note.split(",").slice(1).join(",").trim();
  return rest || null;
}

/// Drops a trailing ", Somewhere" when that somewhere is already the place's
/// city — the suffix a spreadsheet's location column added to help the search.
function withoutTrailing(title: string, city: string | null) {
  if (!city) return title;
  const suffix = `, ${city}`.toLowerCase();
  return title.toLowerCase().endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

export default function TripImporter() {
  const { categories, categoryOf } = useCategories();
  const router = useRouter();

  /// What the list becomes. A trip has days and dates; a set of places has
  /// neither, and the commonest list anybody keeps — the restaurants they
  /// liked — is the second kind. Wrapping one in an invented trip would put
  /// something on the Trips page that never happened.
  const [destination, setDestination] = useState<"trip" | "places" | "draft">("trip");

  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("");
  const [startDate, setStartDate] = useState("");
  const [markVisited, setMarkVisited] = useState(true);
  const [text, setText] = useState("");

  const [rows, setRows] = useState<Row[] | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => parseItinerary(text), [text]);
  const dayCount = parsedDayCount(preview);

  /// Looks each entry up one at a time. The geocoder allows roughly one
  /// request a second and the server queues to enforce that, so this is
  /// deliberately sequential with visible progress rather than a burst.
  async function resolve() {
    const parsed = parseItinerary(text);
    if (parsed.length === 0) {
      setError("Nothing to import — paste an itinerary first.");
      return;
    }

    setError(null);
    setBusy(true);
    setProgress({ done: 0, total: parsed.length });

    const initial: Row[] = parsed.map((entry) => ({
      ...entry,
      candidates: [],
      chosen: -1,
      category: "other",
      state: "waiting",
    }));
    setRows(initial);

    const hint = region.trim();
    const working = [...initial];

    for (let i = 0; i < working.length; i += 1) {
      working[i] = { ...working[i]!, state: "looking" };
      setRows([...working]);

      const url = `/api/geocode?q=${encodeURIComponent(working[i]!.title)}${
        hint ? `&region=${encodeURIComponent(hint)}` : ""
      }`;
      try {
        const res = await fetch(url);
        const body = await res.json();
        const candidates: SearchResult[] = body.results ?? [];
        // A category the person wrote themselves beats the gazetteer's guess:
        // they know the building is a restaurant, and OpenStreetMap thinks it
        // is a building. A word we do not recognise is left alone — the
        // category stays whatever the map made of it, and the picker below is
        // there for exactly that.
        const own = categoryFromWord(leadingWord(working[i]!.note));

        working[i] = {
          ...working[i]!,
          candidates,
          chosen: candidates.length > 0 ? 0 : -1,
          category: own ?? candidates[0]?.category ?? "other",
          note: own ? withoutLeadingWord(working[i]!.note) : working[i]!.note,
          state: "done",
        };
      } catch {
        working[i] = { ...working[i]!, candidates: [], chosen: -1, state: "done" };
      }

      setRows([...working]);
      setProgress({ done: i + 1, total: working.length });
    }

    setBusy(false);
  }

  async function create() {
    if (!rows) return;
    setBusy(true);
    setError(null);

    const days = parsedDayCount(rows);
    // A trip you've already taken has a known length, so the end date follows
    // from the start date and the number of days rather than being asked for.
    const endDate = startDate
      ? new Date(Date.parse(startDate) + (days - 1) * 86400000).toISOString().slice(0, 10)
      : null;

    const entries = () =>
      rows.map((row) => {
        const match = row.chosen >= 0 ? row.candidates[row.chosen] : null;
        return {
          dayIndex: row.dayIndex,
          title: row.title,
          startTime: row.startTime,
          notes: row.note,
          category: row.category,
          place: match
            ? {
                // "Husk, Charleston" was written that way so the geocoder had
                // something to work with; the city is stored separately, so
                // saying it twice on the pin is just noise.
                name: withoutTrailing(row.title, match.city),
                lat: match.lat,
                lng: match.lng,
                address: match.address,
                city: match.city,
                country: match.country,
                countryCode: match.countryCode,
              }
              : null,
        };
      });

    const res =
      destination === "places"
        ? await fetch("/api/places/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: markVisited ? "visited" : "wishlist",
              entries: entries(),
            }),
          })
        : await fetch("/api/trips/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              trip: {
                title: title.trim(),
                destination: region.trim() || null,
                startDate: startDate || null,
                endDate,
              },
              markVisited,
              entries: entries(),
            }),
          });

    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not import that");
      return;
    }

    if (destination === "places") {
      // Straight to the map, which is where they now are.
      router.push("/");
      router.refresh();
      return;
    }
    router.push(`/trips/${body.tripId}`);
    router.refresh();
  }

  const matched = rows?.filter((r) => r.chosen >= 0).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold">
        {destination === "trip"
          ? "Add a trip you've taken"
          : destination === "places"
            ? "Import a list of places"
            : "Plan a trip"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {destination === "trip"
          ? "Paste where you went, roughly by day, or upload the document you planned it in. Every place is looked up on the map and saved to your places, so you only type names."
          : destination === "places"
            ? "Upload or paste a list — a note full of restaurants, a spreadsheet, anything one-per-line. Every place is looked up on the map, and you confirm each one before it is saved."
            : "Say where you're going and get a first draft. It lands in the box below as an ordinary itinerary, and goes through the same checking as anything else — nothing is saved until you have been through it."}
      </p>

      {/* What the list becomes. Asked first, because it changes what the rest
          of this page needs to know: a trip has a name and dates, a list of
          places has neither. */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(
          [
            ["trip", "🧳", "A trip I took"],
            ["places", "📍", "Just places"],
            ["draft", "✨", "Plan one for me"],
          ] as const
        ).map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            className={`chip ${destination === id ? "is-on" : ""}`}
            aria-pressed={destination === id}
            onClick={() => setDestination(id)}
          >
            <span aria-hidden>{icon}</span>
            {label}
          </button>
        ))}
      </div>
      {destination !== "places" && (
        <Link
          href="/trips/import"
          className="mt-1 inline-block text-xs text-muted hover:underline"
        >
          Rather pick dates and click through the days? Use the guided version
        </Link>
      )}

      <div className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {destination !== "places" && (
            <label className="text-xs text-muted">
              Trip name
              <input
                className="input mt-1"
                placeholder="Switzerland"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
          )}
          {/* This matters more for a list, not less. A note full of restaurants
              is a note about one place, and without saying which, "Husk" finds
              the one in Sydney. */}
          <label className="text-xs text-muted">
            {destination !== "places" ? "Country or region" : "Where these are"}
            <input
              className="input mt-1"
              placeholder={destination !== "places" ? "Switzerland" : "Charleston"}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
            <span className="mt-1 block text-xs text-muted">
              Added to every search, so “Husk” finds the right one.
            </span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* A list of places has no first day. */}
          {destination !== "places" && (
            <label className="text-xs text-muted">
              First day (optional)
              <input
                type="date"
                className="input mt-1"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
          )}
          <label className="flex items-end gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={markVisited}
              onChange={(e) => setMarkVisited(e.target.checked)}
              className="mb-1.5 size-4"
            />
            <span className="mb-1">
              {destination !== "places"
                ? "Mark every place as “Been there”"
                : "These are places I’ve been"}
            </span>
          </label>
        </div>

        {destination === "draft" && (
          <DraftTrip
            onDrafted={(draft) => {
              setText(draft.text);
              // A drafted trip is still a trip: it needs a name and a region,
              // and the model has just supplied both.
              if (!title.trim()) setTitle(draft.title);
              if (!region.trim()) setRegion(draft.destination);
              setFileNote("Drafted. Read it through — the next step checks every place against a real map.");
            }}
          />
        )}

        {/* A file, for the list somebody already keeps somewhere else.
            Everything lands in the same box, so what gets imported is always
            something they have read first. */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn btn-ghost cursor-pointer text-xs">
            {reading ? "Reading…" : "Upload a file"}
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.rtf,.csv,.tsv,.docx,.xlsx"
              disabled={reading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                // Cleared so choosing the same file twice still fires.
                e.target.value = "";
                if (!file) return;

                setReading(true);
                setError(null);
                setFileNote(null);
                try {
                  const form = new FormData();
                  form.append("file", file);
                  const res = await fetch("/api/import/extract", { method: "POST", body: form });
                  const body = await res.json();
                  if (!res.ok) {
                    setError(body.error ?? "That file could not be read");
                    return;
                  }
                  setText((current) => (current.trim() ? `${current}\n${body.text}` : body.text));
                  setFileNote(body.note ?? `Read ${file.name}. Check it over before importing.`);
                } catch {
                  setError("That file could not be read");
                } finally {
                  setReading(false);
                }
              }}
            />
          </label>
          <span className="text-xs text-muted">
            Word, Excel, CSV or plain text. Google Docs and Sheets export as
            .docx and .xlsx — or just paste below.
          </span>
        </div>

        {fileNote && <p className="text-xs text-muted">{fileNote}</p>}

        <label className="block text-xs text-muted">
          Itinerary
          <textarea
            className="input mt-1 min-h-56 resize-y font-mono text-xs"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>

        <p className="text-xs text-muted">
          One place per line, and anything after <code> — </code> becomes a note.
          {destination !== "places" && (
            <>
              {" "}
              <code>Day 2</code> starts a new day and a leading <code>09:00</code>{" "}
              sets a time.
            </>
          )}
          {preview.length > 0 && (
            <>
              {" "}
              <span className="text-foreground">
                {preview.length} {preview.length === 1 ? "entry" : "entries"}
                {destination !== "places" && (
                  <>
                    {" "}
                    across {dayCount} {dayCount === 1 ? "day" : "days"}
                  </>
                )}
                .
              </span>
            </>
          )}
        </p>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || preview.length === 0}
          onClick={resolve}
        >
          {busy && progress.total > 0
            ? `Looking up ${progress.done} of ${progress.total}…`
            : "Find these places"}
        </button>
        {busy && (
          <p className="text-xs text-muted">
            One lookup a second — that&apos;s the free map service&apos;s limit, not slowness.
          </p>
        )}
      </div>

      {rows && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold">
            Check the matches
            <span className="ml-2 text-xs font-normal text-muted">
              {matched} of {rows.length} found
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted">
            Pick a different match where it guessed wrong. “No map pin” keeps the
            entry on the day without adding it to your places.
          </p>

          <ul className="mt-3 space-y-2">
            {rows.map((row, index) => {
              const match = row.chosen >= 0 ? row.candidates[row.chosen] : null;
              const meta = categoryOf(match?.category ?? "other");
              return (
                <li key={index} className="card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* A list of places has no days in it. */}
                    {destination !== "places" && (
                      <span className="chip">Day {row.dayIndex + 1}</span>
                    )}
                    {row.startTime && (
                      <span className="text-xs text-muted tabular-nums">{row.startTime}</span>
                    )}
                    <span className="text-sm font-medium">{row.title}</span>
                    {row.state === "looking" && (
                      <span className="text-xs text-muted">looking up…</span>
                    )}
                    {row.state === "done" && !match && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        not found — will be added without a pin
                      </span>
                    )}
                  </div>

                  {row.note && (
                    <p className="mt-1 text-xs text-muted">{row.note}</p>
                  )}

                  {row.candidates.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span aria-hidden>{meta.icon}</span>
                      <select
                        aria-label={`Match for ${row.title}`}
                        className="input text-xs"
                        value={row.chosen}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setRows((prev) =>
                            prev!.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    chosen: next,
                                    category:
                                      next >= 0 ? (r.candidates[next]?.category ?? r.category) : r.category,
                                  }
                                : r,
                            ),
                          );
                        }}
                      >
                        {row.candidates.map((c, i) => (
                          <option key={c.id} value={i}>
                            {c.context}
                          </option>
                        ))}
                        <option value={-1}>No map pin</option>
                      </select>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-muted" htmlFor={`cat-${index}`}>
                      Category
                    </label>
                    <select
                      id={`cat-${index}`}
                      className="input w-40 text-xs"
                      value={row.category}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev!.map((r, i) =>
                            i === index ? { ...r, category: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              // A list of places needs no name; a trip does.
              disabled={busy || (destination !== "places" && title.trim().length === 0)}
              onClick={create}
            >
              {busy
                ? "Saving…"
                : destination !== "places"
                  ? `Create trip with ${rows.length} stops`
                  : `Add ${matched} ${matched === 1 ? "place" : "places"} to my map`}
            </button>
            {destination !== "places" && title.trim().length === 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Give the trip a name first.
              </span>
            )}
            {destination === "places" && matched < rows.length && (
              <span className="text-xs text-muted">
                {rows.length - matched} without a map match will be skipped.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
