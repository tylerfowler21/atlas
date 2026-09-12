import { ScrollView, Pressable, StyleSheet, Text } from "react-native";
import { dayAfter, formatDay } from "@/lib/dates";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";
import { RADIUS } from "@/lib/brand";

/// The trip's days, as a row of dates you can scroll along.
///
/// A month grid was here before, which is a lot of screen to choose between
/// four days — and most of what it showed was the weeks the trip is not on.
/// The row shows only the days the trip actually has, which is what somebody
/// is choosing between, and a trip with no dates gets the same row with
/// numbers instead of dates.
export default function TripDays({
  startDate,
  days,
  active,
  counts,
  onPick,
}: {
  startDate: string | null;
  days: number;
  /// The day being shown, or null for the whole trip.
  active: number | null;
  /// How many stops each day has, so an empty one can say so quietly.
  counts: number[];
  onPick: (day: number | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Card on={active === null} onPress={() => onPick(null)} top="All" bottom="days" />

      {Array.from({ length: days }, (_, day) => {
        const date = startDate ? dayAfter(startDate, day) : null;
        return (
          <Card
            key={day}
            on={active === day}
            onPress={() => onPick(day)}
            // A trip that has not decided when it happens still has days,
            // just unlabelled ones.
            top={
              date
                ? formatDay(date.toISOString(), {
                    weekday: "short",
                    day: undefined,
                    month: undefined,
                    year: undefined,
                  })
                : "Day"
            }
            bottom={
              date
                ? formatDay(date.toISOString(), {
                    day: "numeric",
                    month: undefined,
                    year: undefined,
                  })
                : String(day + 1)
            }
            empty={(counts[day] ?? 0) === 0}
          />
        );
      })}
    </ScrollView>
  );
}

function Card({
  on,
  onPress,
  top,
  bottom,
  empty = false,
}: {
  on: boolean;
  onPress: () => void;
  top: string;
  bottom: string;
  /// Nothing planned yet. Dimmed rather than marked, because an empty day is
  /// not a problem to be flagged — it is most of a trip, most of the time.
  empty?: boolean;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
        on && { backgroundColor: palette.primary, borderColor: palette.primary },
      ]}
    >
      <Text
        style={[
          type.meta,
          { color: on ? palette.onPrimary : palette.muted },
          !on && empty && styles.faded,
        ]}
      >
        {top}
      </Text>
      <Text
        style={[
          type.section,
          styles.number,
          { color: on ? palette.onPrimary : palette.ink },
          !on && empty && styles.faded,
        ]}
      >
        {bottom}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  card: {
    minWidth: 62,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  number: { fontSize: 20, lineHeight: 24, marginTop: 1 },
  faded: { opacity: 0.45 },
});
