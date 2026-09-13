/// How long a stop takes, rather than when it starts and ends.
///
/// Nobody plans a museum for 14:30 to 16:15. A day is a handful of things in
/// an order with a rough sense of how long each one eats, and the moment a
/// plan claims otherwise it is wrong by ten in the morning — everything after
/// the first overrun is a lie you then have to go and edit.
///
/// Scheduled travel is the exception and keeps real times, because a flight
/// leaves at 09:40 whatever anybody intended. That distinction lives in
/// `kind`, not here.
export type Timed = {
  kind?: string | null;
  mode?: string | null;
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
  if (isTravel(item)) {
    // A journey that knows both reads as both: when it goes, and how long you
    // are on it. Either alone is the whole line.
    return (
      [formatLegTime(item), takesTime(item) ? formatDuration(item.minutes) : null]
        .filter(Boolean)
        .join(" · ") || null
    );
  }
  return formatDuration(durationOf(item));
}

/// Journeys that are not flights can say how long they take.
///
/// A flight is the one leg whose clock times are the fact: it leaves at 09:40
/// and lands at 13:05, and the hours in between are somebody else's problem.
/// Everything else — a train, a drive, a ferry, a walk across town — is known
/// the other way round. You know it is about two hours; you find out when you
/// are leaving on the day.
export function takesTime(item: { kind?: string | null; mode?: string | null }) {
  return isTravel(item) && item.mode !== "plane";
}

/// Reads a length of time the way somebody would write one.
///
/// An open field rather than a list of choices, because the list was built for
/// stops — a museum is an hour or two — and journeys run from a ten-minute
/// walk to a fourteen-hour drive. No list covers that without becoming a
/// scrolling menu of numbers.
///
/// A bare number is minutes, which is the unit everything is stored in. Every
/// other reading is spelled out, and whatever is understood is echoed back
/// under the field, so a wrong guess is visible rather than silent.
export function parseDuration(text: string): number | null {
  const clean = text.trim().toLowerCase();
  if (!clean) return null;

  let minutes: number | null = null;

  // "2:15", the way a timetable writes it.
  const clock = /^(\d{1,2}):([0-5]\d)$/.exec(clean);
  if (clock) {
    minutes = Number(clock[1]) * 60 + Number(clock[2]);
  } else {
    // "2h30" — the minutes unmarked, which is how most people write two and a
    // half hours in a hurry. Tried first: the general pattern below would read
    // the "2h" and throw the 30 away.
    const stuck = /^(\d{1,2})\s*h\s*(\d{1,2})$/.exec(clean);
    if (stuck) {
      minutes = Number(stuck[1]) * 60 + Number(stuck[2]);
    } else {
      // "2h 15m", "2 hours", "90 min", "1.5h" — either part alone is enough.
      const hours = /(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours)/.exec(clean);
      const mins = /(\d+)\s*(?:m|min|mins|minute|minutes)\b/.exec(clean);

      if (hours || mins) {
        const h = hours ? Number(hours[1].replace(",", ".")) : 0;
        const m = mins ? Number(mins[1]) : 0;
        minutes = Math.round(h * 60 + m);
      } else if (/^\d+$/.test(clean)) {
        minutes = Number(clean);
      }
    }
  }

  if (minutes === null || !Number.isFinite(minutes)) return null;
  // The bounds the itinerary itself keeps: nothing shorter than five minutes
  // is worth recording, and nothing on one leg runs past a day.
  if (minutes < 5 || minutes > 1440) return null;
  return minutes;
}
