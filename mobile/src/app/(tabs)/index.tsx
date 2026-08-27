import { useCallback, useMemo, useState } from "react";
import { usePalette } from "@/lib/use-palette";
import PlaceEditor, { placeToDraft, type PlaceDraft } from "@/components/PlaceEditor";
import { api, type Place, type SearchResult } from "@/lib/api";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { placeIcon } from "@/lib/taxonomy";
import { year } from "@/lib/dates";
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
  /// The places list, which used to be its own tab. A panel rather than a
  /// separate screen: it is the same places under the same filters, and the
  /// map is the thing you want behind it.
  ///
  /// Tapped open and shut rather than dragged. A drag needs a threshold, and a
  /// threshold is something to get wrong; the bar says what it does.
  const [listOpen, setListOpen] = useState(false);
  /// Which of the four counts the list is showing. "cities" and "countries"
  /// are not filters but groupings — the question behind them is "where have I
  /// been", and the answer is a list of cities, not of restaurants.
  const [view, setView] = useState<"all" | "been" | "cities" | "countries">("all");
  /// Set by tapping a city or a country, which drills into it.
  const [within, setWithin] = useState<string | null>(null);
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

  /// Derived above the loading and error branches: hooks must run in the same
  /// order on every render, and an early return between them changes that.
  const all = useMemo(() => data?.places ?? [], [data]);

  const places = useMemo(() => {
    const chosen = status === "all" ? all : all.filter((p) => p.status === status);
    if (status !== "lived") return chosen;
    // Lived-in places read as chapters: earliest first, undated last.
    return [...chosen].sort((a, b) => {
      if (!a.livedFrom) return b.livedFrom ? 1 : 0;
      if (!b.livedFrom) return -1;
      return new Date(a.livedFrom).getTime() - new Date(b.livedFrom).getTime();
    });
  }, [all, status]);

  /// Cities and countries with how many places are in each, commonest first.
  const groups = useMemo(() => {
    const been = all.filter((p) => p.status === "visited" || p.status === "lived");
    const tally = (key: "city" | "country") => {
      const counted = new Map<string, number>();
      for (const p of been) {
        const value = p[key];
        if (!value) continue;
        counted.set(value, (counted.get(value) ?? 0) + 1);
      }
      return [...counted.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    };
    return { cities: tally("city"), countries: tally("country") };
  }, [all]);

  const counts = useMemo(() => {
    const been = all.filter((p) => p.status === "visited" || p.status === "lived");
    return {
      total: all.length,
      been: been.length,
      cities: groups.cities.length,
      countries: groups.countries.length,
    };
  }, [all, groups]);

  /// What the list actually shows, once the view and any drill-down are applied.
  const listed = useMemo(() => {
    const base = view === "all" ? places : places.filter((p) => p.status !== "wishlist");
    if (!within) return base;
    return base.filter((p) => p.city === within || p.country === within);
  }, [places, view, within]);

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

      <View
        style={[
          styles.sheet,
          { backgroundColor: palette.surface, borderColor: palette.border },
          listOpen && styles.sheetOpen,
        ]}
      >
        <Pressable onPress={() => setListOpen((open) => !open)} style={styles.handle}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <Text style={{ color: palette.muted, fontSize: 13 }}>
            {listOpen ? "Hide list" : "Show list"}
          </Text>
        </Pressable>

        {listOpen && (
          <>
            {/* The counts are the way into the list, not a caption above it.
                Places and Been filter it; Cities and Countries regroup it,
                because "3 countries" is answered by naming them. */}
            <View style={styles.tiles}>
              {(
                [
                  ["all", counts.total, "Places"],
                  ["been", counts.been, "Been"],
                  ["cities", counts.cities, "Cities"],
                  ["countries", counts.countries, "Countries"],
                ] as const
              ).map(([id, n, label]) => {
                const on = view === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      setView(id);
                      setWithin(null);
                    }}
                    style={[
                      styles.tile,
                      { backgroundColor: palette.background, borderColor: palette.border },
                      on && { borderColor: palette.accent },
                    ]}
                  >
                    <Text style={[styles.tileNumber, { color: palette.ink }]}>{n}</Text>
                    <Text
                      style={{ fontSize: 11, color: on ? palette.accentText : palette.muted }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {within && (
              <Pressable onPress={() => setWithin(null)} style={styles.back}>
                <Text style={{ color: palette.accentText, fontSize: 13 }}>
                  ← Everything in {within}
                </Text>
              </Pressable>
            )}

            {(view === "cities" || view === "countries") && !within ? (
              <FlatList
                data={view === "cities" ? groups.cities : groups.countries}
                keyExtractor={(g) => g.name}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
                ListEmptyComponent={
                  <Text style={[styles.listEmpty, { color: palette.muted }]}>
                    Mark somewhere as been there and it appears here.
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => setWithin(item.name)}
                    style={[styles.row, { borderBottomColor: palette.border }]}
                  >
                    <Text style={styles.rowGlyph}>{view === "cities" ? "🏙️" : "🌍"}</Text>
                    <Text style={[styles.rowName, { flex: 1, color: palette.ink }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ color: palette.muted, fontSize: 13 }}>
                      {item.count} {item.count === 1 ? "place" : "places"}
                    </Text>
                  </Pressable>
                )}
              />
            ) : (
              <FlatList
                data={listed}
                keyExtractor={(p) => p.id}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
                ListEmptyComponent={
                  <Text style={[styles.listEmpty, { color: palette.muted }]}>
                    Nothing here yet.
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => setDraft(placeToDraft(item))}
                    style={[styles.row, { borderBottomColor: palette.border }]}
                  >
                    <Text style={styles.rowGlyph}>{placeIcon(item)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: palette.ink }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.rowWhere, { color: palette.muted }]} numberOfLines={1}>
                        {[item.city, item.country].filter(Boolean).join(", ") || "—"}
                      </Text>
                    </View>
                    {item.status === "visited" && <Text style={{ fontSize: 13 }}>✅</Text>}
                    {item.status === "lived" && (
                      <Text style={{ color: palette.muted, fontSize: 12 }}>
                        {item.livedFrom
                          ? `${year(item.livedFrom)}–${item.livedTo ? year(item.livedTo) : "now"}`
                          : "🏠"}
                      </Text>
                    )}
                  </Pressable>
                )}
              />
            )}
          </>
        )}
      </View>

      {places.length === 0 && results.length === 0 && !listOpen && (
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
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: 72,
  },
  sheetOpen: { maxHeight: "70%" },
  handle: { alignItems: "center", paddingTop: 8, paddingBottom: 10 },
  tiles: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  tile: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tileNumber: { fontSize: 18, fontWeight: "600" },
  back: { paddingHorizontal: 14, paddingBottom: 8 },
  grabber: { width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowGlyph: { fontSize: 20 },
  rowName: { fontSize: 15, fontWeight: "500" },
  rowWhere: { fontSize: 13, marginTop: 2 },
  listEmpty: { textAlign: "center", padding: 24 },
  empty: { position: "absolute", left: 24, right: 24, bottom: 96 },
  emptyText: {
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    padding: 12,
    borderRadius: 10,
    textAlign: "center",
    overflow: "hidden",
  },
});
