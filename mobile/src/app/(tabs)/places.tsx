import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import type { Place } from "@/lib/api";
import { placeIcon } from "@/lib/taxonomy";
import { useApi } from "@/lib/use-api";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "wishlist", label: "Want to go" },
  { id: "visited", label: "Been there" },
  { id: "lived", label: "Lived there" },
] as const;

export default function PlacesScreen() {
  const { data, error, loading, reload } = useApi<{ places: Place[] }>("/api/places");
  const [filter, setFilter] = useState<string>("all");
  const dark = useColorScheme() === "dark";

  const places = useMemo(() => {
    const all = data?.places ?? [];
    return filter === "all" ? all : all.filter((p) => p.status === filter);
  }, [data, filter]);

  if (loading && !data) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.fill, dark && styles.fillDark]}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.chip, filter === f.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === f.id && styles.chipTextOn]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={places}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === "all" ? "No places saved yet." : "Nothing in here yet."}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowGlyph}>{placeIcon(item)}</Text>
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, dark && styles.textDark]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowWhere} numberOfLines={1}>
                {[item.city, item.country].filter(Boolean).join(", ") || "—"}
              </Text>
            </View>
            {item.status === "visited" && <Text style={styles.tick}>✅</Text>}
            {item.status === "lived" && <Text style={styles.tick}>🏠</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#fff" },
  fillDark: { backgroundColor: "#000" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#f4f4f5" },
  chipOn: { backgroundColor: "#2563eb" },
  chipText: { fontSize: 13, color: "#3f3f46" },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  error: { color: "#ef4444", paddingHorizontal: 16, paddingBottom: 8 },
  empty: { textAlign: "center", color: "#a1a1aa", padding: 32 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowGlyph: { fontSize: 20 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "500" },
  rowWhere: { fontSize: 13, color: "#71717a", marginTop: 2 },
  textDark: { color: "#fff" },
  tick: { fontSize: 14 },
});
