import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Memory } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";

/// When it happened, which is rarely when it was written — so the date shown
/// is the one the writer chose, falling back to when it was saved.
function when(memory: Memory) {
  const date = memory.happenedOn ?? memory.createdAt;
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function JournalScreen() {
  const { data, error, loading, reload } = useApi<{ memories: Memory[] }>("/api/memories");
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
        data={data?.memories ?? []}
        keyExtractor={(m) => m.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: palette.muted }]}>
            Nothing written yet. Journal entries you add on the website appear here.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.entry, { borderBottomColor: palette.border }]}>
            <Text style={[styles.date, { color: palette.muted }]}>
              {when(item)}
              {item.place ? ` · ${item.place.name}` : ""}
              {item.trip ? ` · ${item.trip.title}` : ""}
            </Text>
            {item.title && (
              <Text style={[styles.title, { color: palette.ink }]}>{item.title}</Text>
            )}
            <Text style={[styles.body, { color: palette.ink }]} numberOfLines={6}>
              {item.body}
            </Text>
            {item.photos.length > 0 && (
              <Text style={[styles.photos, { color: palette.accentText }]}>
                {item.photos.length} photo{item.photos.length === 1 ? "" : "s"}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#E07A5F", padding: 16 },
  empty: { textAlign: "center", padding: 32, lineHeight: 20 },
  entry: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  date: { fontSize: 12 },
  title: { fontSize: 16, fontWeight: "600", marginTop: 4 },
  body: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  photos: { fontSize: 12, marginTop: 6, fontWeight: "500" },
});
