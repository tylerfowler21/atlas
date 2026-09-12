import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type ItineraryItem, type Place, type Trip } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { dayLabel } from "@/lib/dates";
import { tripWhere } from "@/lib/trip-where";
import { dayCount } from "@/lib/trip-days";
import { RADIUS } from "@/lib/brand";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

/// Putting a saved place on a trip, in two taps: which trip, then which day.
///
/// Two steps rather than one long list of every day of every trip. A trip is
/// the thing somebody has in mind — "this goes on Japan" — and the day is a
/// detail they answer once they are looking at that trip's days.
///
/// An overlay rather than a Modal, because the screen this opens from is
/// itself a page sheet and iOS will not present a second one inside the
/// first: the button simply did nothing, with no error anywhere.
export default function AddToTrip({
  place,
  onClose,
  onAdded,
}: {
  place: Place | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { data, loading } = useApi<{ trips: Trip[] }>("/api/trips");
  const [trip, setTrip] = useState<Trip | null>(null);
  /// The chosen trip's own entries, fetched when it is chosen.
  ///
  /// Its dates are not enough to know how many days it has: a trip planned
  /// before anybody decided when it happens has days made only of what is on
  /// them, and offering "Day 1" alone would put everything on the first
  /// morning.
  const [days, setDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickTrip(chosen: Trip) {
    setTrip(chosen);
    setDays(null);
    try {
      const body = await api<{ items: ItineraryItem[] }>(`/api/trips/${chosen.id}`);
      setDays(dayCount(chosen, body.items));
    } catch {
      setDays(dayCount(chosen, []));
    }
  }

  if (!place) return null;
  const trips = data?.trips ?? [];

  async function add(chosen: Trip, dayIndex: number) {
    setBusy(true);
    try {
      await api(`/api/trips/${chosen.id}/items`, {
        method: "POST",
        body: JSON.stringify({
          kind: "stop",
          placeId: place!.id,
          title: place!.name,
          category: place!.category,
          dayIndex,
        }),
      });
      setTrip(null);
      onAdded();
    } catch (e) {
      Alert.alert("Could not add it", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.overlay,
        { backgroundColor: palette.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.fill}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Pressable onPress={() => (trip ? setTrip(null) : onClose())} hitSlop={10}>
            <Text style={{ color: palette.muted, fontSize: 16 }}>
              {trip ? "Back" : "Cancel"}
            </Text>
          </Pressable>
          <Text style={[type.item, { color: palette.ink }]}>
            {trip ? "Which day?" : "Which trip?"}
          </Text>
          <View style={{ width: 52 }} />
        </View>

        {busy && <ActivityIndicator style={styles.busy} />}

        <ScrollView contentContainerStyle={styles.body}>
          {!trip &&
            (loading && trips.length === 0 ? (
              <ActivityIndicator />
            ) : trips.length === 0 ? (
              <Text style={[type.body, { color: palette.muted }]}>
                No trips yet. Start one and this will be somewhere to put.
              </Text>
            ) : (
              trips.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => void pickTrip(t)}
                  style={[styles.row, { borderColor: palette.border }]}
                >
                  <View style={[styles.dot, { backgroundColor: t.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.item, { color: palette.ink }]} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={[type.meta, { color: palette.muted }]} numberOfLines={1}>
                      {tripWhere(t) || "No destination yet"}
                    </Text>
                  </View>
                  <Text style={{ color: palette.muted, fontSize: 18 }}>›</Text>
                </Pressable>
              ))
            ))}

          {trip && days === null && <ActivityIndicator />}

          {trip &&
            days !== null &&
            Array.from({ length: days }, (_, day) => (
              <Pressable
                key={day}
                onPress={() => void add(trip, day)}
                disabled={busy}
                style={[styles.row, { borderColor: palette.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type.item, { color: palette.ink }]}>Day {day + 1}</Text>
                  <Text style={[type.meta, { color: palette.muted }]}>
                    {dayLabel(trip, day)}
                  </Text>
                </View>
              </Pressable>
            ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 10 },
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  busy: { paddingTop: 12 },
  body: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    padding: 14,
  },
  dot: { width: 4, height: 34, borderRadius: 2 },
});
