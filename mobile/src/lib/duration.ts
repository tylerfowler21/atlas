/// How long a stop takes, mirrored from the website so the two cannot
/// disagree about what "about 2 hours" means. Edit `src/lib/duration.ts` and
/// run `npm run sync:mirror`.
export type Timed = {
  kind?: string | null;
  minutes?: number | null;
  startTime?: string | null;
  endTime?: string | null;
};

/// A stop is a thing you do; a leg is a thing that carries you.
export function isTravel(item: { kind?: string | null }) {
  return item.kind === "travel";
}

/// The choices offered, in minutes. Long enough a list to cover a coffee and
/// a day trip, short enough that picking is faster than typing.
export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480] as const;

/// Minutes between two "HH:MM" strings, or null if either is missing or
/// unreadable. Crossing midnight is not handled on purpose: a stop that runs
/// past midnight is two days, and the itinerary already says which day a stop
/// is on.
export function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const parse = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  };
  const a = parse(start);
  const b = parse(end);
  if (a === null || b === null || b <= a) return null;
  return b - a;
}

/// How long this stop takes: what was chosen, or what the old start and end
/// times imply.
///
/// Trips made before durations existed carry times instead, and those times
/// are not thrown away — a stop entered as 15:30 to 17:30 reads as two hours
/// without anybody having to re-enter it.
export function durationOf(item: Timed): number | null {
  if (typeof item.minutes === "number" && item.minutes > 0) return item.minutes;
  return minutesBetween(item.startTime, item.endTime);
}

/// "45 min", "about an hour", "about 1½ hours".
///
/// Hedged on purpose. A stop lasting exactly two hours is not a thing anybody
/// knows in advance, and printing "2 hours" flat invites the reader to believe
/// a number the person who typed it did not mean that precisely.
export function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (rest === 0) return hours === 1 ? "about an hour" : `about ${hours} hours`;
  if (rest === 30) return hours === 1 ? "about 1½ hours" : `about ${hours}½ hours`;
  return `about ${hours} hr ${rest} min`;
}

/// What a travel leg reads as: the times it actually has.
export function formatLegTime(item: Timed): string | null {
  if (item.startTime && item.endTime) return `${item.startTime} – ${item.endTime}`;
  return item.startTime ?? null;
}

/// One line for a stop, whichever kind it is.
export function timingLabel(item: Timed): string | null {
  if (isTravel(item)) return formatLegTime(item);
  return formatDuration(durationOf(item));
}
