/// Turns a pasted itinerary into structured entries.
///
/// The format is meant to be what someone would naturally type from memory,
/// so the rules are forgiving: day headers in several shapes, optional bullets,
/// optional times, optional notes after a dash.
///
///   Day 1: Lauterbrunnen
///   - Trümmelbach Falls
///   Day 2
///   09:00 Jungfraujoch — book tickets ahead
///   Kleine Scheidegg

import { categoryFromWord } from "@/lib/category-words";

export type ParsedEntry = {
  /// 0-based day offset
  dayIndex: number;
  title: string;
  /// "HH:mm" if the line began with a time
  startTime: string | null;
  /// whatever followed a dash
  note: string | null;
  /// A journey rather than a place: "Montreal → Quebec City".
  ///
  /// A multi-city trip has a morning on a train in the middle of it, and
  /// writing that as a stop called "Gare du Palais" loses the fact that
  /// anybody went anywhere. The app has always held journeys; nothing that
  /// produced an itinerary ever wrote one.
  travel?: {
    /// Where it is going. Where it leaves from is the entry's own title.
    to: string;
    /// train, bus, plane, ferry, car, walk — or null when the line did not say.
    mode: string | null;
    /// "HH:mm" arrival, when the line said one.
    endTime: string | null;
  };
};

// "Day 1", "Day 2:", "day 3 -", "DAY 4 —", optionally followed by a place.
const DAY_HEADER = /^day\s*(\d{1,3})\s*[:.–—-]?\s*(.*)$/i;
// Leading bullet of any common kind.
const BULLET = /^[-*•·]\s+/;
// Leading "9:30", "09:30", "9.30".
const LEADING_TIME = /^(\d{1,2})[:.](\d{2})\s+(.*)$/;
// " - note", " — note", " – note" (needs the surrounding space so hyphenated
// place names like "Baden-Baden" survive).
const NOTE_SPLIT = /\s+[–—-]\s+/;
// "Montreal → Quebec City", or the same typed as "->". Spaces required either
// side, so a name containing an arrow character would have to be trying.
const JOURNEY_SPLIT = /\s+(?:→|->)\s+/;
// "arrives 12:30", anywhere in the note.
const ARRIVES = /\barrives?\s+(\d{1,2})[:.](\d{2})\b/i;
/// The modes a journey can be, as the words somebody writes them.
const MODES: Record<string, string> = {
  train: "train", rail: "train", metro: "train", subway: "train",
  bus: "bus", coach: "bus",
  plane: "plane", flight: "plane", fly: "plane", flying: "plane",
  ferry: "ferry", boat: "ferry",
  car: "car", drive: "car", driving: "car", taxi: "car",
  walk: "walk", walking: "walk",
};

/// Whether a would-be note starts by naming a category, the way the note in
/// this format does: "restaurant, book two weeks ahead".
function namesACategory(note: string) {
  return categoryFromWord((note.split(",")[0] ?? "").trim()) !== null;
}

function splitNote(text: string): { title: string; note: string | null } {
  const parts = text.split(NOTE_SPLIT);
  if (parts.length < 2) return { title: text.trim(), note: null };

  /// Which dash ends the name, when a line has more than one.
  ///
  /// The first one, nearly always: "Café de Flore — coffee — go early" is a
  /// place and then a note that happens to contain a dash of its own. But some
  /// places have a dash in the name they trade under — "Chez Boulay — bistro
  /// boréal, Québec — restaurant, book ahead" — and cutting at the first one
  /// there took the title down to "Chez Boulay", pushed the city into the note
  /// and left the category no longer at the front of it, so a restaurant came
  /// in as a shop.
  ///
  /// The category is what tells the two apart. The note this format writes
  /// begins by naming one; a name that happens to contain a dash does not. So
  /// a later cut is taken only when it finds a category the first cut missed,
  /// and the first cut wins every other time — including when nothing names a
  /// category at all, which is most of what people paste.
  let at = 1;
  if (!namesACategory(parts.slice(1).join(" — "))) {
    for (let i = 2; i < parts.length; i += 1) {
      if (namesACategory(parts.slice(i).join(" — "))) {
        at = i;
        break;
      }
    }
  }

  return {
    title: parts.slice(0, at).join(" — ").trim(),
    note: parts.slice(at).join(" — ").trim() || null,
  };
}

function buildEntry(raw: string, dayIndex: number): ParsedEntry | null {
  let text = raw.replace(BULLET, "").trim();
  if (!text) return null;

  let startTime: string | null = null;
  const timed = text.match(LEADING_TIME);
  if (timed) {
    const hours = Number(timed[1]);
    const minutes = Number(timed[2]);
    if (hours < 24 && minutes < 60) {
      startTime = `${String(hours).padStart(2, "0")}:${timed[2]}`;
      text = timed[3]!.trim();
    }
  }

  const { title, note } = splitNote(text);
  if (!title) return null;

  /// Two places with an arrow between them is a journey, not a place called
  /// "A → B". The mode is the note's first word, where a category would be on
  /// an ordinary line.
  const legs = title.split(JOURNEY_SPLIT);
  if (legs.length === 2 && legs[0]!.trim() && legs[1]!.trim()) {
    const first = (note?.split(",")[0] ?? "").trim().toLowerCase();
    const landing = note?.match(ARRIVES);
    return {
      dayIndex,
      title: legs[0]!.trim(),
      startTime,
      note,
      travel: {
        to: legs[1]!.trim(),
        mode: MODES[first] ?? null,
        endTime: landing
          ? `${String(Number(landing[1])).padStart(2, "0")}:${landing[2]}`
          : null,
      },
    };
  }

  return { dayIndex, title, startTime, note };
}

export function parseItinerary(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  // With no day headers at all, everything lands on day 1.
  let currentDay = 0;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const header = trimmed.match(DAY_HEADER);
    if (header) {
      currentDay = Math.max(0, Number(header[1]) - 1);
      const remainder = header[2]?.trim();
      if (remainder) {
        const entry = buildEntry(remainder, currentDay);
        if (entry) entries.push(entry);
      }
      continue;
    }

    const entry = buildEntry(trimmed, currentDay);
    if (entry) entries.push(entry);
  }

  return entries;
}

/// How many days the parsed itinerary spans.
export function parsedDayCount(entries: ParsedEntry[]) {
  return entries.length === 0 ? 1 : Math.max(...entries.map((e) => e.dayIndex)) + 1;
}
