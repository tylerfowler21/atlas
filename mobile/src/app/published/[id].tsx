/// Somebody else's published trip, read rather than taken.
///
/// The feed used to offer one thing: copy it into your own trips. That is a
/// strange price for reading something a person chose to publish — you end up
/// with a copy of a trip you only wanted to look at, and they end up with no
/// way to be read at all. The website has had a page for this since trips
/// could be published; this is the same thing on the phone.
import { useCallback, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TripMap from "@/components/TripMap";
import { api, type ItineraryItem, type Trip } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";
import { dayLabel, formatDay } from "@/lib/dates";
import { tripWhere } from "@/lib/trip-where";
import { travelMode } from "@/lib/taxonomy";

type Published = {
  trip: Trip;
  items: ItineraryItem[];
  author: { username: string | null; name: string | null } | null;
};

export default function PublishedTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading } = useApi<Published>(`/api/published/${id}`);
  const palette = usePalette();
  const router = useRouter();
  const [copying, setCopying] = useState(false);

  /// Copying is still offered — it is how you make someone else's trip yours
  /// to change. It is just no longer the only way to see it.
  const copy = useCallback(async () => {
    setCopying(true);
    try {
      const { tripId } = await api<{ tripId: string }>(`/api/trips/${id}/copy`, {
        method: "POST",
      });
      router.replace({ pathname: "/trip/[id]", params: { id: tripId } });
    } catch (e) {
      Alert.alert("Could not copy that", e instanceof Error ? e.message : "Try again");
      setCopying(false);
    }
  }, [id, router]);

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
        <Text style={{ color: palette.muted }}>
          {error ?? "That trip isn't published any more."}
        </Text>
      </View>
    );
  }

  const days = Math.max(
    1,
    ...data.items.map((i) => i.dayIndex + (i.endDayOffset ?? 0) + 1),
  );
  const by = data.author?.name ?? (data.author?.username ? `@${data.author.username}` : null);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: data.trip.title, headerBackTitle: "Feed" }} />
      <ScrollView style={[styles.fill, { backgroundColor: palette.background }]}>
        <TripMap items={data.items} color={data.trip.color} />

        <View style={styles.head}>
          <Text style={[styles.title, { color: palette.ink }]}>{data.trip.title}</Text>
          <Text style={{ color: palette.muted, fontSize: 13, marginTop: 2 }}>
            {[
              by && `by ${by}`,
              tripWhere(data.trip),
              data.trip.startDate ? formatDay(data.trip.startDate) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        {Array.from({ length: days }, (_, day) => {
          const stops = data.items
            .filter((i) => i.dayIndex === day)
            .sort((a, b) => a.position - b.position);
          const arrivals = data.items.filter(
            (i) =>
              i.kind === "travel" &&
              (i.endDayOffset ?? 0) > 0 &&
              i.endTime &&
              i.dayIndex + i.endDayOffset === day,
          );
          if (stops.length === 0 && arrivals.length === 0) return null;

          return (
            <View key={day} style={styles.day}>
              <Text style={[styles.dayLabel, { color: palette.muted }]}>
                {dayLabel(data.trip, day)}
              </Text>

              {arrivals.map((leg) => (
                <Text
                  key={`arrives-${leg.id}`}
                  style={{ color: palette.accentText, fontSize: 13, marginTop: 6 }}
                >
                  ✈️ Lands {leg.endTime}
                  {leg.toPlace ? ` · ${leg.toPlace.name}` : ""}
                </Text>
              ))}

              {stops.map((entry) => (
                <View
                  key={entry.id}
                  style={[
                    styles.stop,
                    { borderColor: palette.border, backgroundColor: palette.surface },
                    entry.kind === "travel" && { borderStyle: "dashed" },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>
                    {entry.emoji || (entry.kind === "travel" ? travelMode(entry.mode).icon : "📍")}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.ink, fontSize: 15 }} numberOfLines={2}>
                      {entry.title}
                    </Text>
                    {(entry.startTime || entry.notes) && (
                      <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={2}>
                        {[
                          entry.startTime && entry.endTime
                            ? `${entry.startTime}–${entry.endTime}${
                                (entry.endDayOffset ?? 0) > 0 ? ` +${entry.endDayOffset}` : ""
                              }`
                            : entry.startTime,
                          entry.notes,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          );
        })}

        <Pressable
          onPress={copy}
          disabled={copying}
          style={[styles.copy, { backgroundColor: palette.primary }]}
        >
          <Text style={{ color: palette.onPrimary, fontWeight: "600", fontSize: 15 }}>
            {copying ? "Copying…" : "Copy into my trips"}
          </Text>
        </Pressable>
        <Text style={{ color: palette.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 24 }}>
          Copying makes your own version to change. Reading it changes nothing.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  head: { paddingHorizontal: 16, paddingTop: 14 },
  title: { fontSize: 19, fontWeight: "700" },
  day: { paddingHorizontal: 12, paddingTop: 16 },
  dayLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  stop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    marginTop: 8,
  },
  copy: { margin: 16, borderRadius: 10, alignItems: "center", paddingVertical: 13 },
});
