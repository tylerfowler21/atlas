import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import type { FeedTrip } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";
import { formatDay } from "@/lib/dates";

function dates(trip: FeedTrip) {
  if (!trip.startDate) return null;
  if (!trip.endDate) return formatDay(trip.startDate);
  return `${formatDay(trip.startDate, { year: undefined })} – ${formatDay(trip.endDate)}`;
}

export default function FeedScreen() {
  const { data, error, loading, reload } = useApi<{ trips: FeedTrip[] }>("/api/feed");
  const palette = usePalette();
  const router = useRouter();
  const [copying, setCopying] = useState<string | null>(null);

  /// Copying takes someone else's itinerary and makes it yours to change,
  /// which is what the feed is for. It opens straight into the copy: landing
  /// back on the feed leaves you wondering whether it worked.
  const copy = useCallback(
    async (tripId: string, title: string) => {
      setCopying(tripId);
      try {
        const { tripId: mine } = await api<{ tripId: string }>(
          `/api/trips/${tripId}/copy`,
          { method: "POST" },
        );
        router.push({ pathname: "/trip/[id]", params: { id: mine } });
      } catch (e) {
        Alert.alert(`Could not copy "${title}"`, e instanceof Error ? e.message : "Try again");
      } finally {
        setCopying(null);
      }
    },
    [router],
  );

  if (loading && !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={data?.trips ?? []}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: palette.muted }]}>
            Nothing here yet. Follow someone on the People tab and the trips they
            publish show up here.
          </Text>
        }
        renderItem={({ item }) => {
          const when = dates(item);
          return (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={[styles.stripe, { backgroundColor: item.color }]} />
              <View style={styles.body}>
                <Text style={[styles.author, { color: palette.muted }]} numberOfLines={1}>
                  {item.author.name ?? item.author.username ?? "Someone"}
                  {item.author.username ? ` · @${item.author.username}` : ""}
                </Text>
                <Text style={[styles.title, { color: palette.ink }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.meta, { color: palette.muted }]} numberOfLines={1}>
                  {[item.destination, when, `${item.stopCount} stops`]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <Pressable
                  onPress={() => copy(item.id, item.title)}
                  disabled={copying === item.id}
                  style={[styles.copy, { borderColor: palette.border }]}
                >
                  {copying === item.id ? (
                    <ActivityIndicator />
                  ) : (
                    <Text style={{ color: palette.accentText, fontSize: 13, fontWeight: "600" }}>
                      Copy into my trips
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#E07A5F", padding: 16 },
  empty: { textAlign: "center", padding: 32, lineHeight: 20 },
  card: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  stripe: { width: 4, borderRadius: 2 },
  body: { flex: 1 },
  author: { fontSize: 12 },
  title: { fontSize: 16, fontWeight: "600", marginTop: 2 },
  meta: { fontSize: 13, marginTop: 4 },
  copy: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
});
