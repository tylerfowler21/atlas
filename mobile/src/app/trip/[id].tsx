import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import TripEditor from "@/components/TripEditor";
import ItemEditor, { type ItemDraft } from "@/components/ItemEditor";
import TripMap, { openDirections } from "@/components/TripMap";
import { stopIcon, travelMode } from "@/lib/taxonomy";
import { dayAfter, formatDay } from "@/lib/dates";
import { API_URL, api, type ItineraryItem, type Place, type Trip } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";

type TripResponse = { trip: Trip; role: string; items: ItineraryItem[] };

/// A trip runs from its start date; without one it is still a list of days,
/// just unlabelled ones. Matching the website, which lets a trip exist before
/// anyone has decided when it happens.
function dayLabel(trip: Trip, index: number) {
  if (!trip.startDate) return `Day ${index + 1}`;
  return formatDay(dayAfter(trip.startDate, index).toISOString(), {
    weekday: "short",
    year: undefined,
  });
}

function dayCount(trip: Trip, items: ItineraryItem[]) {
  const fromDates =
    trip.startDate && trip.endDate
      ? Math.round(
          (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86_400_000,
        ) + 1
      : 0;
  // Never fewer days than there are entries, or a stop could have nowhere to be.
  const fromItems = items.reduce((n, i) => Math.max(n, i.dayIndex + 1), 0);
  return Math.max(1, fromDates, fromItems);
}

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<TripResponse>(`/api/trips/${id}`);
  const { data: placeData } = useApi<{ places: Place[] }>("/api/places");
  const palette = usePalette();

  const router = useRouter();
  const [settings, setSettings] = useState(false);
  const [item, setItem] = useState<ItemDraft | null>(null);
  /// Which day the map is showing. Null is the whole trip, which is the right
  /// opening view — the shape of the thing before its parts.
  const [mapDay, setMapDay] = useState<number | null>(null);

  const days = useMemo(
    () => (data ? dayCount(data.trip, data.items) : 0),
    [data],
  );

  /// A share link is a secret URL: anyone holding it reads the itinerary
  /// without an account, which is the point. The endpoint returns a path
  /// rather than a URL — it has no opinion about which host serves it — so the
  /// address is assembled here.
  const share = useCallback(async () => {
    try {
      const { share: link } = await api<{ share: { path: string } }>(
        `/api/trips/${id}/share`,
        { method: "POST" },
      );
      await Share.share({ message: `${API_URL}${link.path}` });
    } catch (e) {
      Alert.alert("Could not make a link", e instanceof Error ? e.message : "Try again");
    }
  }, [id]);

  /// Moving something within its day. The API assigns positions in order, so
  /// swapping two is a matter of trading them — no renumbering, and no chance
  /// of two entries claiming the same slot.
  const move = useCallback(
    async (entry: ItineraryItem, direction: -1 | 1) => {
      const sameDay = (data?.items ?? [])
        .filter((i) => i.dayIndex === entry.dayIndex)
        .sort((a, b) => a.position - b.position);
      const at = sameDay.findIndex((i) => i.id === entry.id);
      const swap = sameDay[at + direction];
      if (!swap) return;

      try {
        await Promise.all([
          api(`/api/items/${entry.id}`, {
            method: "PATCH",
            body: JSON.stringify({ position: swap.position }),
          }),
          api(`/api/items/${swap.id}`, {
            method: "PATCH",
            body: JSON.stringify({ position: entry.position }),
          }),
        ]);
        reload();
      } catch (e) {
        Alert.alert("Could not move that", e instanceof Error ? e.message : "Try again");
      }
    },
    [data, reload],
  );

  const remove = useCallback(
    (entry: ItineraryItem) => {
      Alert.alert(entry.title, "Remove this from the trip?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/api/items/${entry.id}`, { method: "DELETE" });
              reload();
            } catch (e) {
              Alert.alert("Could not remove that", e instanceof Error ? e.message : "Try again");
            }
          },
        },
      ]);
    },
    [reload],
  );

  if (loading && !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.muted }}>{error ?? "Trip not found"}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: data.trip.title,
          headerBackTitle: "Trips",
          headerRight: () => (
            <Pressable onPress={() => setSettings(true)} hitSlop={10}>
              <Text style={{ color: palette.accentText, fontSize: 15 }}>Edit</Text>
            </Pressable>
          ),
        }}
      />

      <ItemEditor
        draft={item}
        places={placeData?.places ?? []}
        onClose={() => setItem(null)}
        onSaved={reload}
      />

      {settings && (
        <TripEditor
          trip={data.trip}
          onClose={() => setSettings(false)}
          onSaved={(tripId) => {
            // An empty id means it was deleted; there is nothing to go back to.
            if (tripId) reload();
            else router.back();
          }}
        />
      )}
      <ScrollView style={[styles.fill, { backgroundColor: palette.background }]}>
        <TripMap
          items={
            mapDay === null ? data.items : data.items.filter((i) => i.dayIndex === mapDay)
          }
          color={data.trip.color}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayChips}
        >
          {[null, ...Array.from({ length: days }, (_, d) => d)].map((d) => {
            const on = mapDay === d;
            return (
              <Pressable
                key={d ?? "all"}
                onPress={() => setMapDay(d)}
                style={[
                  styles.dayChip,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                  on && { backgroundColor: palette.accent, borderColor: palette.accent },
                ]}
              >
                <Text style={{ fontSize: 13, color: on ? palette.onAccent : palette.muted }}>
                  {d === null ? "Whole trip" : dayLabel(data.trip, d)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {Array.from({ length: days }, (_, day) => {
          const stops = data.items.filter((i) => i.dayIndex === day);
          return (
            <View key={day} style={styles.day}>
              <Text
                style={[
                  styles.dayLabel,
                  { color: mapDay === day ? palette.accentText : palette.muted },
                ]}
              >
                {dayLabel(data.trip, day)}
                {mapDay === day ? "  · on the map" : ""}
              </Text>

              {stops.map((entry, index) => {
                const leg = entry.kind === "travel";
                const mode = leg ? travelMode(entry.mode) : null;
                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.stop,
                      { backgroundColor: palette.surface, borderColor: palette.border },
                      // A journey is drawn differently from a stop: the day
                      // reads as a sequence, and the thing that moves you
                      // between places should not look like another place.
                      leg && { borderStyle: "dashed", borderColor: palette.accent },
                    ]}
                  >
                    <Pressable
                      style={styles.stopMain}
                      onPress={() => setItem({ mode: "edit", item: entry })}
                    >
                      <Text style={styles.glyph}>
                        {entry.emoji || mode?.icon || stopIcon(entry)}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stopTitle, { color: palette.ink }]} numberOfLines={2}>
                          {entry.title}
                        </Text>
                        {(entry.startTime || entry.notes) && (
                          <Text style={[styles.stopMeta, { color: palette.muted }]} numberOfLines={1}>
                            {[
                              entry.startTime && entry.endTime
                                ? `${entry.startTime}–${entry.endTime}`
                                : entry.startTime,
                              entry.notes,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        )}
                      </View>
                    </Pressable>

                    <View style={styles.controls}>
                      {entry.place && (
                        <Pressable
                          onPress={() =>
                            openDirections(entry.place!.lat, entry.place!.lng, entry.title)
                          }
                          hitSlop={8}
                        >
                          <Text style={{ fontSize: 15 }}>🧭</Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => move(entry, -1)}
                        disabled={index === 0}
                        hitSlop={8}
                      >
                        <Text style={{ color: index === 0 ? palette.border : palette.muted, fontSize: 16 }}>
                          ↑
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => move(entry, 1)}
                        disabled={index === stops.length - 1}
                        hitSlop={8}
                      >
                        <Text
                          style={{
                            color: index === stops.length - 1 ? palette.border : palette.muted,
                            fontSize: 16,
                          }}
                        >
                          ↓
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => remove(entry)} hitSlop={8}>
                        <Text style={{ color: palette.muted, fontSize: 18 }}>×</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              <View style={styles.addRow}>
                <Pressable
                  onPress={() =>
                    setItem({ mode: "create", tripId: id, dayIndex: day, kind: "stop" })
                  }
                  style={styles.add}
                >
                  <Text style={{ color: palette.accentText, fontSize: 14 }}>+ Add a stop</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setItem({ mode: "create", tripId: id, dayIndex: day, kind: "travel" })
                  }
                  style={styles.add}
                >
                  <Text style={{ color: palette.accentText, fontSize: 14 }}>+ Add a journey</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Pressable onPress={share} style={styles.share}>
          <Text style={{ color: palette.accentText, fontSize: 14 }}>
            Share a read-only link
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  dayChips: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
  dayChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  day: { paddingHorizontal: 12, paddingTop: 16 },
  dayLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  stop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  glyph: { fontSize: 18 },
  stopMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  stopTitle: { fontSize: 15 },
  stopMeta: { fontSize: 12, marginTop: 2 },
  controls: { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 10 },
  addRow: { flexDirection: "row", gap: 16 },
  add: { paddingVertical: 10, paddingHorizontal: 4, marginTop: 4 },
  share: { alignItems: "center", paddingVertical: 18, marginTop: 12 },
});
