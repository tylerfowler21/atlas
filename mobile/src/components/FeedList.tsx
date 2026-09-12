import { useCallback } from "react";
import { SEMANTIC } from "@/lib/brand";
import { tripWhere } from "@/lib/trip-where";
import {
  ActionSheetIOS,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabBarSpace } from "@/lib/layout";
import { REPORT_REASONS } from "@/lib/report-reasons";

function dates(trip: FeedTrip) {
  if (!trip.startDate) return null;
  if (!trip.endDate) return formatDay(trip.startDate);
  return `${formatDay(trip.startDate, { year: undefined })} – ${formatDay(trip.endDate)}`;
}

export default function FeedList() {
  const { data, error, loading, reload } = useApi<{ trips: FeedTrip[] }>("/api/feed");
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  /// Reporting the trip itself, not only whoever published it.
  ///
  /// A published itinerary is somebody else's writing appearing on your phone,
  /// and the way to complain about it has to be on the thing you are looking
  /// at. Blocking the author lives on the person, where anyone would look for
  /// it; a trip needs its own door, because the objection is usually to the
  /// trip rather than to them.
  const report = useCallback((trip: FeedTrip) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Report "${trip.title}"`,
        message: "Nothing is shared with whoever published it.",
        options: ["Cancel", ...REPORT_REASONS.map((r) => r.label)],
        cancelButtonIndex: 0,
      },
      async (chosen) => {
        if (chosen === 0) return;
        const reason = REPORT_REASONS[chosen - 1];
        if (!reason) return;
        try {
          await api("/api/report", {
            method: "POST",
            body: JSON.stringify({ reason: reason.id, tripId: trip.id }),
          });
          Alert.alert("Reported", "Thank you — this has been sent for review.");
        } catch (e) {
          Alert.alert("Could not report", e instanceof Error ? e.message : "Try again");
        }
      },
    );
  }, []);

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
        // The tab bar floats over this list rather than sitting below it, so
        // without this the last card is cut in half by it — or drawn past the
        // bottom of the screen entirely.
        contentContainerStyle={{ paddingBottom: tabBarSpace(insets.bottom) }}
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
              <Pressable
                style={styles.body}
                // Reading somebody's trip should not cost you a copy of it.
                onPress={() =>
                  router.push({ pathname: "/published/[id]", params: { id: item.id } })
                }
              >
                <Text style={[styles.author, { color: palette.muted }]} numberOfLines={1}>
                  {item.author.name ?? item.author.username ?? "Someone"}
                  {item.author.username ? ` · @${item.author.username}` : ""}
                </Text>
                <Text style={[styles.title, { color: palette.ink }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.meta, { color: palette.muted }]} numberOfLines={1}>
                  {[tripWhere(item), when, `${item.stopCount} stops`]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <View style={styles.actions}>
                  {/* Read it first. Copying somebody's trip is a decision
                      about its contents, and the feed shows a title and a
                      stop count — not enough to make it on. */}
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: "/published/[id]", params: { id: item.id } })
                    }
                    style={[styles.copy, { borderColor: palette.border }]}
                  >
                    <Text style={{ color: palette.accentText, fontSize: 13, fontWeight: "600" }}>
                      View trip
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => report(item)}
                    hitSlop={8}
                    accessibilityLabel={`Report ${item.title}`}
                    style={[styles.copy, { borderColor: palette.border }]}
                  >
                    <Text style={{ color: palette.muted, fontSize: 13 }}>Report</Text>
                  </Pressable>
                </View>
              </Pressable>
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
  error: { color: SEMANTIC.danger, padding: 16 },
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
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  copy: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
});
