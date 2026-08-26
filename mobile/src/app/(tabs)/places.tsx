import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePalette } from "@/lib/use-palette";
import PlaceEditor, { placeToDraft, type PlaceDraft } from "@/components/PlaceEditor";
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
  const [draft, setDraft] = useState<PlaceDraft | null>(null);
  const palette = usePalette();

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
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      <PlaceEditor draft={draft} onClose={() => setDraft(null)} onSaved={reload} />

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[
              styles.chip,
              { backgroundColor: palette.surface, borderColor: palette.border },
              filter === f.id && { backgroundColor: palette.accent, borderColor: palette.accent },
            ]}
          >
            <Text
              style={[
                { fontSize: 13, color: palette.muted },
                filter === f.id && { color: palette.onAccent, fontWeight: "600" },
              ]}
            >
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
          <Pressable style={styles.row} onPress={() => setDraft(placeToDraft(item))}>
            <Text style={styles.rowGlyph}>{placeIcon(item)}</Text>
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, { color: palette.ink }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.rowWhere, { color: palette.muted }]} numberOfLines={1}>
                {[item.city, item.country].filter(Boolean).join(", ") || "—"}
              </Text>
            </View>
            {item.status === "visited" && <Text style={styles.tick}>✅</Text>}
            {item.status === "lived" && <Text style={styles.tick}>🏠</Text>}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  error: { color: "#ef4444", paddingHorizontal: 16, paddingBottom: 8 },
  empty: { textAlign: "center", padding: 32 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowGlyph: { fontSize: 20 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "500" },
  rowWhere: { fontSize: 13, marginTop: 2 },
  tick: { fontSize: 14 },
});
