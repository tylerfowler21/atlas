import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { FeedTrip } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";

function dates(trip: FeedTrip) {
  const start = trip.startDate ? new Date(trip.startDate) : null;
  const end = trip.endDate ? new Date(trip.endDate) : null;
  const long: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (start && end) {
    return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(undefined, long)}`;
  }
  return start ? start.toLocaleDateString(undefined, long) : null;
}

export default function FeedScreen() {
  const { data, error, loading, reload } = useApi<{ trips: FeedTrip[] }>("/api/feed");
  const palette = usePalette();

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
});
