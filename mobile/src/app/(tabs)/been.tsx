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
import type { Place } from "@/lib/api";
import { placeIcon } from "@/lib/taxonomy";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";

/// Everywhere you have been, and how much of it there is.
///
/// Derived from the places list rather than a dedicated endpoint: the counts
/// are of what the app already has, so a separate call could only disagree
/// with what is on screen.
type Tile = "places" | "cities" | "countries" | "lived";

export default function BeenScreen() {
  const { data, error, loading, reload } = useApi<{ places: Place[] }>("/api/places");
  const palette = usePalette();
  const [tile, setTile] = useState<Tile>("places");

  const stats = useMemo(() => {
    const all = data?.places ?? [];
    const been = all.filter((p) => p.status === "visited" || p.status === "lived");
    return {
      been,
      lived: all.filter((p) => p.status === "lived"),
      cities: new Set(been.map((p) => p.city).filter(Boolean)),
      countries: new Set(been.map((p) => p.country).filter(Boolean)),
    };
  }, [data]);

  /// Tapping a number shows what is behind it — the same idea as the website,
  /// where the tiles are the way into the list rather than decoration.
  const shown = useMemo(() => {
    if (tile === "lived") return stats.lived;
    return stats.been;
  }, [tile, stats]);

  if (loading && !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const tiles: { id: Tile; n: number; label: string }[] = [
    { id: "places", n: stats.been.length, label: "Places" },
    { id: "cities", n: stats.cities.size, label: "Cities" },
    { id: "countries", n: stats.countries.size, label: "Countries" },
    { id: "lived", n: stats.lived.length, label: "Lived" },
  ];

  return (
    <View style={[styles.fill, { backgroundColor: palette.background }]}>
      {error && <Text style={[styles.error, { color: "#E07A5F" }]}>{error}</Text>}

      <View style={styles.tiles}>
        {tiles.map((t) => {
          const active = tile === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTile(t.id)}
              style={[
                styles.tile,
                { backgroundColor: palette.surface, borderColor: palette.border },
                active && { borderColor: palette.accent },
              ]}
            >
              <Text style={[styles.tileNumber, { color: palette.ink }]}>{t.n}</Text>
              <Text
                style={[styles.tileLabel, { color: active ? palette.accentText : palette.muted }]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: palette.muted }]}>
            {tile === "lived"
              ? "Nowhere marked as lived in yet."
              : "Mark somewhere as been there and it appears here."}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowGlyph}>{placeIcon(item)}</Text>
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, { color: palette.ink }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.rowWhere, { color: palette.muted }]} numberOfLines={1}>
                {[item.city, item.country].filter(Boolean).join(", ") || "—"}
              </Text>
            </View>
            {item.status === "lived" && <Text style={styles.tick}>🏠</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { paddingHorizontal: 16, paddingBottom: 8 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  tile: {
    flexGrow: 1,
    minWidth: 76,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tileNumber: { fontSize: 22, fontWeight: "600" },
  tileLabel: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: "center", padding: 32 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowGlyph: { fontSize: 20 },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "500" },
  rowWhere: { fontSize: 13, marginTop: 2 },
  tick: { fontSize: 14 },
});
