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

export type ParsedEntry = {
  /// 0-based day offset
  dayIndex: number;
  title: string;
  /// "HH:mm" if the line began with a time
  startTime: string | null;
  /// whatever followed a dash
  note: string | null;
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

function splitNote(text: string): { title: string; note: string | null } {
  const parts = text.split(NOTE_SPLIT);
  if (parts.length < 2) return { title: text.trim(), note: null };
  const [title, ...rest] = parts;
  return { title: title!.trim(), note: rest.join(" — ").trim() || null };
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
