/// The trip's bookings, gathered off its days.
///
/// Scattered through an itinerary, a booking is only ever found by opening the
/// day it happens on — which is no use for the question people actually ask,
/// which is what is still not booked. So they collect here, outstanding first.
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BOOKING_BOOKED, nextState, outstanding, tracked } from "@/lib/bookings";
import { api, type ItineraryItem, type Trip } from "@/lib/api";
import { usePalette } from "@/lib/use-palette";
import { dayLabel } from "@/lib/dates";

export default function TripBookings({
  trip,
  items,
  onChanged,
}: {
  trip: Trip;
  items: ItineraryItem[];
  onChanged: () => void;
}) {
  const palette = usePalette();
  const [saving, setSaving] = useState<string | null>(null);
  /// What is in each confirmation field. React Native's blur event carries no
  /// text, so the value has to be held to be saved on the way out.
  const [refs, setRefs] = useState<Record<string, string>>({});

  const all = tracked(items).sort(
    (a, b) => a.dayIndex - b.dayIndex || a.position - b.position,
  );
  const todo = outstanding(all);
  const done = all.filter((i) => i.booking === BOOKING_BOOKED);

  async function patch(item: ItineraryItem, changes: Record<string, unknown>) {
    setSaving(item.id);
    try {
      await api(`/api/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      onChanged();
    } catch (e) {
      Alert.alert("Could not save that", e instanceof Error ? e.message : "Try again");
    } finally {
      setSaving(null);
    }
  }

  if (all.length === 0) {
    return (
      <View style={styles.body}>
        <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>
          Nothing on this trip needs booking yet. Open a stop and turn on
          <Text style={{ color: palette.ink }}> Needs booking</Text> — the
          restaurant that takes reservations, the cable car, the tour that sells
          out — and it will collect here.
        </Text>
      </View>
    );
  }

  function row(item: ItineraryItem) {
    const isBooked = item.booking === BOOKING_BOOKED;
    return (
      <View
        key={item.id}
        style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]}
      >
        <Pressable
          onPress={() => patch(item, { booking: nextState(item.booking) })}
          disabled={saving === item.id}
          hitSlop={6}
          accessibilityLabel={`Mark ${item.title} ${isBooked ? "not booked" : "booked"}`}
        >
          <Text style={{ fontSize: 18 }}>{isBooked ? "☑️" : "⬜️"}</Text>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.title,
              { color: isBooked ? palette.muted : palette.ink },
              isBooked && styles.struck,
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
            {[dayLabel(trip, item.dayIndex), item.startTime, item.place?.city]
              .filter(Boolean)
              .join(" · ")}
          </Text>

          {isBooked && (
            <TextInput
              // Saved when the field is left rather than per keystroke: this is
              // a confirmation number being copied in, not something typed.
              key={`ref-${item.id}`}
              value={refs[item.id] ?? item.bookingRef ?? ""}
              onChangeText={(text) => setRefs((all) => ({ ...all, [item.id]: text }))}
              placeholder="Confirmation number, reference…"
              placeholderTextColor={palette.muted}
              onBlur={() => {
                const next = (refs[item.id] ?? item.bookingRef ?? "").trim() || null;
                if (next !== item.bookingRef) patch(item, { bookingRef: next });
              }}
              style={[styles.ref, { color: palette.ink, borderColor: palette.border }]}
            />
          )}
          {!isBooked && item.notes ? (
            <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
              {item.notes}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.body}>
      <Text style={{ color: palette.muted, fontSize: 12, marginBottom: 8 }}>
        {todo.length === 0 ? "All booked" : `${todo.length} still to book`}
      </Text>
      {todo.map(row)}
      {done.length > 0 && (
        <>
          <Text style={{ color: palette.muted, fontSize: 12, marginTop: 14, marginBottom: 6 }}>
            Booked
          </Text>
          {done.map(row)}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    marginBottom: 8,
  },
  title: { fontSize: 15, fontWeight: "500" },
  struck: { textDecorationLine: "line-through" },
  ref: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    fontSize: 13,
    marginTop: 7,
  },
});
