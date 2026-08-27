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
import { year } from "@/lib/dates";
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
    const chosen = filter === "all" ? all : all.filter((p) => p.status === filter);
    // Lived-in places read as chapters, so they run earliest first. Anywhere
    // without a start date sorts last, being unplaceable in a sequence.
    if (filter !== "lived") return chosen;
    return [...chosen].sort((a, b) => {
      if (!a.livedFrom) return b.livedFrom ? 1 : 0;
      if (!b.livedFrom) return -1;
      return new Date(a.livedFrom).getTime() - new Date(b.livedFrom).getTime();
    });
  }, [data, filter]);

  /// The counts the Been tab used to carry. They belong beside the list they
  /// describe rather than on a screen of their own showing the same places
  /// again.
  const counts = useMemo(() => {
    const all = data?.places ?? [];
    const been = all.filter((p) => p.status === "visited" || p.status === "lived");
    return {
      been: been.length,
      cities: new Set(been.map((p) => p.city).filter(Boolean)).size,
      countries: new Set(been.map((p) => p.country).filter(Boolean)).size,
      lived: all.filter((p) => p.status === "lived").length,
    };
  }, [data]);

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

      <View style={[styles.summary, { borderBottomColor: palette.border }]}>
        <Text style={[styles.summaryText, { color: palette.muted }]}>
          <Text style={{ color: palette.ink, fontWeight: "600" }}>{counts.been}</Text> been ·{" "}
          <Text style={{ color: palette.ink, fontWeight: "600" }}>{counts.cities}</Text> cities ·{" "}
          <Text style={{ color: palette.ink, fontWeight: "600" }}>{counts.countries}</Text>{" "}
          countries
          {counts.lived > 0 ? (
            <>
              {" · "}
              <Text style={{ color: palette.ink, fontWeight: "600" }}>{counts.lived}</Text> lived in
            </>
          ) : null}
        </Text>
      </View>

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
            {item.status === "lived" && (
              <Text style={[styles.when, { color: palette.muted }]}>
                {item.livedFrom
                  ? `${year(item.livedFrom)}–${item.livedTo ? year(item.livedTo) : "now"}`
                  : "🏠"}
              </Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  summary: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryText: { fontSize: 13, lineHeight: 18 },
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
  when: { fontSize: 12 },
});
