import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { usePalette } from "@/lib/use-palette";
import { formatDay } from "@/lib/dates";
import TripEditor from "@/components/TripEditor";
import type { Trip } from "@/lib/api";
import { useApi } from "@/lib/use-api";

/// "12–19 May 2025", or a single date, or nothing at all — trips are allowed
/// to have no dates, and a stray dash for a missing one looks like a bug.
function dateRange(trip: Trip) {
  if (!trip.startDate) return null;
  if (!trip.endDate) return formatDay(trip.startDate);
  return `${formatDay(trip.startDate, { year: undefined })} – ${formatDay(trip.endDate)}`;
}

export default function TripsScreen() {
  const { data, error, loading, reload } = useApi<{ trips: Trip[] }>("/api/trips");
  const palette = usePalette();
  const [creating, setCreating] = useState(false);

  if (loading && !data) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      {creating && (
        <TripEditor
          trip={null}
          onClose={() => setCreating(false)}
          onSaved={() => reload()}
        />
      )}

      <Pressable
        onPress={() => setCreating(true)}
        style={[styles.new, { backgroundColor: palette.accent }]}
      >
        <Text style={{ color: palette.onAccent, fontWeight: "600", fontSize: 15 }}>
          + New trip
        </Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={data?.trips ?? []}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListEmptyComponent={<Text style={[styles.empty, { color: palette.muted }]}>No trips yet.</Text>}
        renderItem={({ item }) => {
          const when = dateRange(item);
          return (
            <Link href={{ pathname: "/trip/[id]", params: { id: item.id } }} asChild>
              <Pressable style={styles.row}>
              <View style={[styles.stripe, { backgroundColor: item.color }]} />
              <View style={styles.rowBody}>
                <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.meta, { color: palette.muted }]} numberOfLines={1}>
                  {[item.destination, when].filter(Boolean).join(" · ") || "No dates yet"}
                </Text>
              </View>
              {item.publishedAt && (
                <Text style={[styles.badge, { color: palette.accentText }]}>Published</Text>
                )}
              </Pressable>
            </Link>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#ef4444", padding: 16 },
  empty: { textAlign: "center", padding: 32 },
  new: { margin: 12, borderRadius: 10, alignItems: "center", paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  stripe: { width: 4, height: 34, borderRadius: 2 },
  rowBody: { flex: 1 },
  title: { fontSize: 15, fontWeight: "500" },
  meta: { fontSize: 13, marginTop: 2 },
  badge: { fontSize: 11, fontWeight: "600" },
});
