import { useMemo } from "react";
import { usePalette } from "@/lib/use-palette";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import type { Place } from "@/lib/api";
import { placeIcon } from "@/lib/taxonomy";
import { useApi } from "@/lib/use-api";

/// Enough of a margin that pins are not welded to the edge of the screen.
const PADDING = 1.4;
const MIN_SPAN = 0.02;

/// The region containing every pin. Somebody with places in Lisbon and Tokyo
/// legitimately gets the whole world; somebody with one place gets a
/// neighbourhood rather than a point zoomed in to the paving stones.
function regionFor(places: Place[]): Region | undefined {
  if (places.length === 0) return undefined;

  const lats = places.map((p) => p.lat);
  const lngs = places.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * PADDING, MIN_SPAN),
    longitudeDelta: Math.max((maxLng - minLng) * PADDING, MIN_SPAN),
  };
}

/// Status rings, matching the website's pins so a place looks the same in both.
const RING = {
  visited: "#14B8A6",
  lived: "#D9A441",
  wishlist: "#E07A5F",
} as const;

export default function MapScreen() {
  const { data, error, loading } = useApi<{ places: Place[] }>("/api/places");
  const palette = usePalette();
  // MapView reads initialRegion once, when it mounts, and ignores it after —
  // so recomputing this cannot drag the map out from under someone who has
  // panned away.
  const initial = useMemo(() => regionFor(data?.places ?? []), [data]);

  if (loading && !data) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centre}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const places = data?.places ?? [];

  return (
    <View style={styles.fill}>
      <MapView style={styles.fill} initialRegion={initial} showsUserLocation>
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            title={place.name}
            description={[place.city, place.country].filter(Boolean).join(", ")}
          >
            <View
              style={[
                styles.pin,
                {
                  backgroundColor: palette.surface,
                  borderColor: RING[place.status as keyof typeof RING] ?? RING.wishlist,
                },
              ]}
            >
              <Text style={styles.pinGlyph}>{placeIcon(place)}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {places.length === 0 && (
        <View style={styles.empty} pointerEvents="none">
          <Text style={styles.emptyText}>
            No places yet. Add one on the website and it appears here.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#ef4444", padding: 24, textAlign: "center" },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  pinGlyph: { fontSize: 16 },
  empty: { position: "absolute", left: 24, right: 24, bottom: 48 },
  emptyText: {
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    padding: 12,
    borderRadius: 10,
    textAlign: "center",
    overflow: "hidden",
  },
});
