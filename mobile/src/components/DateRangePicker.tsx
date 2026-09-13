/// Picking when a trip happens, by pointing at it.
///
/// It was two boxes wanting "YYYY-MM-DD" typed into them, which is a poor way
/// to answer "when are you going" anywhere and a miserable one on a phone —
/// the keyboard alone covers half the question.
///
/// Drawn rather than handed to the system picker: a native date picker is a
/// native module, and adding one would mean a new build and an App Store
/// review for a calendar the app already knows how to draw.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { monthGrid, weekdayLabels, todayUTC } from "@/lib/trip-calendar";
import { usePalette } from "@/lib/use-palette";

const DAY_MS = 86_400_000;

function iso(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export default function DateRangePicker({
  start,
  end,
  onChange,
  single = false,
  emptyHint,
}: {
  /// "2026-09-18", or "" for unset.
  start: string;
  end: string;
  onChange: (next: { start: string; end: string }) => void;
  /// One date rather than a range — a booking deadline has no second end, and
  /// neither does a trip whose length is already decided somewhere else.
  single?: boolean;
  /// What the one date is for, when it is not a deadline. Shown under the
  /// calendar before anything is picked.
  emptyHint?: string;
}) {
  const palette = usePalette();

  /// Which month is on screen. Opens on the trip's own month when it has one,
  /// so editing a trip does not begin by scrolling back to find it.
  const opening = start ? new Date(`${start}T00:00:00Z`) : new Date(todayUTC());
  const [cursor, setCursor] = useState({
    year: opening.getUTCFullYear(),
    month: opening.getUTCMonth(),
  });

  const grid = monthGrid(cursor.year, cursor.month);
  const headings = weekdayLabels();
  const today = todayUTC();

  const startTime = start ? Date.parse(`${start}T00:00:00Z`) : null;
  const endTime = end ? Date.parse(`${end}T00:00:00Z`) : null;

  function pick(time: number) {
    if (single) {
      // Tapping the chosen day again takes it off, which is the only way to
      // say "no deadline after all" without a button for it.
      onChange({ start: startTime === time ? "" : iso(time), end: "" });
      return;
    }
    // First tap sets the start. Second extends to a range. A third starts
    // again — which is what someone reaching for a different week means, and
    // is cheaper than a "clear" button nobody looks for.
    if (startTime === null || endTime !== null) {
      onChange({ start: iso(time), end: "" });
      return;
    }
    if (time < startTime) {
      onChange({ start: iso(time), end: iso(startTime) });
      return;
    }
    onChange({ start: iso(startTime), end: iso(time) });
  }

  function step(by: number) {
    const next = new Date(Date.UTC(cursor.year, cursor.month + by, 1));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  return (
    <View>
      <View style={styles.head}>
        <Pressable onPress={() => step(-1)} hitSlop={10} accessibilityLabel="Previous month">
          <Text style={{ color: palette.accentText, fontSize: 18 }}>‹</Text>
        </Pressable>
        <Text style={[styles.month, { color: palette.ink }]}>{grid.label}</Text>
        <Pressable onPress={() => step(1)} hitSlop={10} accessibilityLabel="Next month">
          <Text style={{ color: palette.accentText, fontSize: 18 }}>›</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {headings.map((label, i) => (
          <View key={`h-${i}`} style={styles.cell}>
            <Text style={[styles.heading, { color: palette.muted }]}>{label.slice(0, 1)}</Text>
          </View>
        ))}

        {grid.weeks.flat().map((cell, i) => {
          if (cell.time === null) return <View key={i} style={styles.cell} />;

          const isStart = startTime !== null && cell.time === startTime;
          const isEnd = endTime !== null && cell.time === endTime;
          const inRange =
            startTime !== null &&
            endTime !== null &&
            cell.time > startTime &&
            cell.time < endTime;

          return (
            <Pressable
              key={i}
              onPress={() => pick(cell.time!)}
              accessibilityLabel={iso(cell.time)}
              style={styles.cell}
            >
              <View
                style={[
                  styles.day,
                  inRange && { backgroundColor: `${palette.primary}22` },
                  (isStart || isEnd) && { backgroundColor: palette.primary },
                  cell.time === today &&
                    !isStart &&
                    !isEnd && { borderWidth: 1, borderColor: palette.primary },
                ]}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: isStart || isEnd ? "#fff" : palette.ink,
                    fontWeight: isStart || isEnd ? "600" : "400",
                  }}
                >
                  {cell.dayOfMonth}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: palette.muted, fontSize: 12, marginTop: 6 }}>
        {single
          ? start
            ? `${start} · tap again to clear`
            : (emptyHint ?? "Tap a day, or leave it for no deadline.")
          : !start
          ? "Tap the first day."
          : !end
            ? "Tap the last day, or leave it for a single day."
            : `${start} → ${end} · ${Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1} days`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  month: { fontSize: 14, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 2 },
  heading: { fontSize: 11, paddingVertical: 3 },
  day: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
