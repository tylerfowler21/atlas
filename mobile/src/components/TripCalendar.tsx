/// The trip's days on a real calendar.
///
/// "Day 3" is a number you have to convert before it means anything. The grid
/// does the converting: the weekend is where weekends are, and a day that
/// lands on a Monday looks like a Monday — which is when you remember the
/// museum is shut.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tripCalendar, weekdayLabels, todayUTC } from "@/lib/trip-calendar";
import { usePalette } from "@/lib/use-palette";

export default function TripCalendar({
  startDate,
  days,
  color,
  /// Which day the map is framing. Null is the whole trip, which is a real
  /// answer here and not a missing one.
  activeDay,
  counts,
  onPick,
}: {
  startDate: string;
  days: number;
  color: string;
  activeDay: number | null;
  counts: number[];
  onPick: (dayIndex: number | null) => void;
}) {
  const palette = usePalette();
  const months = tripCalendar(startDate, days);
  const today = todayUTC();
  const headings = weekdayLabels();

  return (
    <View style={styles.body}>
      {months.map((month) => (
        <View key={month.label} style={{ marginBottom: 10 }}>
          <Text style={[styles.month, { color: palette.ink }]}>{month.label}</Text>

          <View style={styles.grid}>
            {headings.map((label, i) => (
              <View key={`h-${i}`} style={styles.cell}>
                <Text style={[styles.heading, { color: palette.muted }]}>
                  {label.slice(0, 1)}
                </Text>
              </View>
            ))}

            {month.weeks.flat().map((cell, i) => {
              if (cell.dayOfMonth === null) return <View key={i} style={styles.cell} />;

              const inTrip = cell.dayIndex !== null;
              const on = inTrip && cell.dayIndex === activeDay;
              const isToday = cell.time === today;
              const has = inTrip && (counts[cell.dayIndex!] ?? 0) > 0;

              if (!inTrip) {
                return (
                  <View key={i} style={styles.cell}>
                    <Text style={[styles.number, { color: palette.border }]}>
                      {cell.dayOfMonth}
                    </Text>
                  </View>
                );
              }

              return (
                <Pressable
                  key={i}
                  onPress={() => onPick(cell.dayIndex!)}
                  accessibilityLabel={`Day ${cell.dayIndex! + 1}`}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.day,
                      // Filled for the day being framed, washed out for the
                      // rest, so the block reads as one thing and the current
                      // day still stands out of it.
                      { backgroundColor: on ? color : `${color}22` },
                      isToday && !on && { borderWidth: 1, borderColor: color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.number,
                        { color: on ? "#fff" : palette.ink, fontWeight: "600" },
                      ]}
                    >
                      {cell.dayOfMonth}
                    </Text>
                    {/* Marks a day with something planned. Always drawn, so
                        the numbers do not shift between days. */}
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: has ? (on ? "#fff" : color) : "transparent" },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Pressable
        onPress={() => onPick(null)}
        style={[
          styles.whole,
          { borderColor: activeDay === null ? color : palette.border },
          activeDay === null && { backgroundColor: `${color}22` },
        ]}
      >
        <Text style={{ fontSize: 13, color: palette.ink }}>Whole trip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 12, paddingTop: 12 },
  month: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  // Seven to a row, by width rather than by counting.
  cell: { width: `${100 / 7}%`, paddingVertical: 2, alignItems: "center" },
  heading: { fontSize: 11, paddingVertical: 3 },
  day: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  number: { fontSize: 13 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  whole: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 2,
  },
});
