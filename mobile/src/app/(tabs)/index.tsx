import { useCallback, useMemo, useState } from "react";
import { usePalette } from "@/lib/use-palette";
import PlaceEditor, { placeToDraft, type PlaceDraft } from "@/components/PlaceEditor";
import { api, type Place, type SearchResult } from "@/lib/api";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
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
  const { data, error, loading, reload } = useApi<{ places: Place[] }>("/api/places");
  const palette = usePalette();

  const [draft, setDraft] = useState<PlaceDraft | null>(null);
  const [query, setQuery] = useState("");
  /// Status filtering lives here now the Been tab is gone: the map of
  /// everywhere you have been is the same map with everything else hidden.
  const [status, setStatus] = useState<string>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  /// Searched on demand rather than as you type: the geocoders behind this are
  /// rate limited, and a request per keystroke is how you get throttled.
  const search = useCallback(async () => {
    const q = query.trim();
    if (q.length < 3) return;
    Keyboard.dismiss();
    setSearching(true);
    try {
      const found = await api<{ results: SearchResult[] }>(
        `/api/geocode?q=${encodeURIComponent(q)}`,
      );
      setResults(found.results);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);
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

  const all = data?.places ?? [];
  const places = status === "all" ? all : all.filter((p) => p.status === status);

  return (
    <View style={styles.fill}>
      <PlaceEditor draft={draft} onClose={() => setDraft(null)} onSaved={reload} />

      <MapView
        style={styles.fill}
        initialRegion={initial}
        showsUserLocation
        // Long press rather than tap: a tap is how you dismiss things and pan,
        // and dropping a pin every time someone touches the map is maddening.
        onLongPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          setDraft({ name: "", lat: latitude, lng: longitude });
        }}
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            title={place.name}
            description={[place.city, place.country].filter(Boolean).join(", ")}
            onCalloutPress={() => setDraft(placeToDraft(place))}
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

      <View style={[styles.searchBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
          placeholder="Search anywhere in the world…"
          placeholderTextColor={palette.muted}
          style={{ flex: 1, fontSize: 15, color: palette.ink }}
        />
        {searching && <ActivityIndicator />}
      </View>

      <View style={styles.statusRow}>
        {[
          { id: "all", label: "All" },
          { id: "wishlist", label: "Want to go" },
          { id: "visited", label: "Been" },
          { id: "lived", label: "Lived" },
        ].map((s) => {
          const on = status === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setStatus(s.id)}
              style={[
                styles.statusChip,
                { backgroundColor: palette.surface, borderColor: palette.border },
                on && { backgroundColor: palette.accent, borderColor: palette.accent },
              ]}
            >
              <Text style={{ fontSize: 12, color: on ? palette.onAccent : palette.muted }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {results.length > 0 && (
        <ScrollView
          style={[styles.results, { backgroundColor: palette.surface, borderColor: palette.border }]}
          keyboardShouldPersistTaps="handled"
        >
          {results.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                setResults([]);
                setQuery("");
                setDraft({
                  name: r.name,
                  lat: r.lat,
                  lng: r.lng,
                  category: r.category,
                  address: r.address,
                  city: r.city,
                  country: r.country,
                  countryCode: r.countryCode,
                });
              }}
              style={[styles.result, { borderBottomColor: palette.border }]}
            >
              <Text style={{ color: palette.ink, fontSize: 15 }} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
                {r.context}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {places.length === 0 && results.length === 0 && (
        <View style={styles.empty} pointerEvents="none">
          <Text style={styles.emptyText}>
            Search above, or press and hold anywhere on the map to drop a pin.
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
  searchBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusRow: {
    position: "absolute",
    top: 62,
    left: 12,
    right: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  results: {
    position: "absolute",
    top: 104,
    left: 12,
    right: 12,
    maxHeight: 260,
    borderWidth: 1,
    borderRadius: 10,
  },
  result: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
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
