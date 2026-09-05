import { useMemo, useRef, useState } from "react";
import ShareArea from "@/components/ShareArea";
import { nearbyPlaces } from "@/lib/here";
import { groupPlaces } from "@/lib/place-groups";
import FirstSteps from "@/components/FirstSteps";
import { useCategories } from "@/lib/categories";
import { usePlaceSearch } from "@/lib/use-place-search";
import { searchPlaces } from "@/lib/search-places";
import { usePalette } from "@/lib/use-palette";
import { useMyLocation } from "@/lib/use-my-location";
import PlaceEditor, { placeToDraft, type PlaceDraft } from "@/components/PlaceEditor";
import { type Place, type SearchResult } from "@/lib/api";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { status as statusOf } from "@/lib/taxonomy";
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
  const { placeIconOf, categoryOf } = useCategories();
  const { data, error, loading, reload } = useApi<{ places: Place[] }>("/api/places");
  const palette = usePalette();
  const map = useRef<MapView>(null);
  // Asked for when the map opens rather than when somebody presses "I'm here
  // now", so the dot is on the map for everyone who has agreed to it.
  const { granted, locate } = useMyLocation();

  const [draft, setDraft] = useState<PlaceDraft | null>(null);
  /// What was found under a long press, waiting to be chosen from.
  const [underFinger, setUnderFinger] = useState<
    { lat: number; lng: number; found: SearchResult[] } | null
  >(null);
  const [looking, setLooking] = useState(false);

  async function offerWhatIsHere(lat: number, lng: number) {
    setLooking(true);
    try {
      const found = await nearbyPlaces(lat, lng, 0.08);
      if (found.length === 0) {
        // Nothing named there, so the old behaviour is the right one.
        setDraft({ name: "", lat, lng });
        return;
      }
      setUnderFinger({ lat, lng, found });
    } catch {
      setDraft({ name: "", lat, lng });
    } finally {
      setLooking(false);
    }
  }
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
  /// The share sheet for that place, and what it currently covers — the map
  /// and the list follow it, so what is on screen is what the person receiving
  /// the link will open.
  const [sharing, setSharing] = useState(false);
  const [sharePreview, setSharePreview] = useState<{
    categories: string[];
    statuses: string[];
  } | null>(null);
  /// Searched as you type. The hook asks the fast geocoder while you are still
  /// typing and both of them once you stop, so nobody has to press anything to
  /// find out whether the place they mean exists.
  const { results, searching } = usePlaceSearch(query, searchPlaces);
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
  /// Shared with the website so the two cannot disagree about a number somebody
  /// might repeat out loud.
  const groups = useMemo(() => groupPlaces(all), [all]);
  const counts = groups.counts;

  /// What the list actually shows, once the view, any drill-down, and any
  /// share being composed are applied.
  ///
  /// While the sheet is open the list is the link: turning a category off takes
  /// those places out of it, which is the only way to judge whether the link
  /// says what you meant.
  const preview = sharing ? sharePreview : null;

  const listed = useMemo(() => {
    const base = view === "all" ? places : places.filter((p) => p.status !== "wishlist");
    const here = within
      ? base.filter((p) => p.city === within || p.country === within)
      : base;
    if (!preview) return here;

    return here.filter(
      (p) =>
        (preview.categories.length === 0 || preview.categories.includes(p.category)) &&
        (preview.statuses.length === 0 || preview.statuses.includes(p.status)),
    );
  }, [places, view, within, preview]);

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
      {/* A long press that does nothing for a second reads as a press that
          missed. */}
      {looking && (
        <View style={[styles.looking, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <ActivityIndicator />
          <Text style={{ color: palette.muted, fontSize: 13 }}>Looking at what&apos;s there…</Text>
        </View>
      )}

      <PlaceEditor draft={draft} onClose={() => setDraft(null)} onSaved={reload} />

      {/* What was found under a long press. A sheet rather than an alert: the
          answer is a list with icons and addresses, and an alert would flatten
          it into a paragraph. */}
      <Modal
        visible={underFinger !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setUnderFinger(null)}
      >
        <View style={[styles.hereSheet, { backgroundColor: palette.background }]}>
          <View style={styles.hereHead}>
            <Text style={[styles.hereTitle, { color: palette.ink }]}>What&apos;s here?</Text>
            <Pressable onPress={() => setUnderFinger(null)} hitSlop={8}>
              <Text style={{ color: palette.muted, fontSize: 15 }}>Close</Text>
            </Pressable>
          </View>

          <ScrollView>
            {(underFinger?.found ?? []).map((r: SearchResult) => (
              <Pressable
                key={r.id}
                style={[styles.hereRow, { borderColor: palette.border }]}
                onPress={() => {
                  setUnderFinger(null);
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
              >
                <Text style={{ fontSize: 18 }}>{categoryOf(r.category).icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.ink, fontSize: 15 }} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
                    {r.address ?? r.city ?? ""}
                  </Text>
                </View>
              </Pressable>
            ))}

            {/* Still an option: not everything worth remembering is a place
                anybody has named. */}
            <Pressable
              style={[styles.hereRow, { borderColor: palette.border }]}
              onPress={() => {
                const at = underFinger;
                setUnderFinger(null);
                if (at) setDraft({ name: "", lat: at.lat, lng: at.lng });
              }}
            >
              <Text style={{ fontSize: 18 }}>📌</Text>
              <Text style={{ color: palette.accentText, fontSize: 15 }}>
                None of these — just drop a pin
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <MapView
        ref={map}
        style={styles.fill}
        initialRegion={initial}
        showsUserLocation={granted}
        // Long press rather than tap: a tap is how you dismiss things and pan,
        // and acting every time someone touches the map is maddening.
        //
        // It asks what is actually there before offering a blank pin. Apple
        // draws the restaurants and museums right there on the map, and having
        // to type the name of the thing you are pressing on is a strange way to
        // save it. The app cannot be told which label was pressed — that only
        // reaches Google's maps on iOS, not Apple's — so it asks what stands
        // within eighty metres of the point instead, which is the same question
        // from the other end.
        onLongPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          void offerWhatIsHere(latitude, longitude);
        }}
      >
        {/* The map shows what the list shows. While a link is being composed
            that means the link, so turning a category off takes its pins off
            the map too. */}
        {(preview ? listed : places).map((place) => (
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
              <Text style={styles.pinGlyph}>{placeIconOf(place)}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* iOS draws no button of its own for this, and "where am I among my
          pins" is the question a saved map exists to answer while you are out
          in the city. */}
      <Pressable
        onPress={async () => {
          const here = await locate();
          if (!here) return;
          map.current?.animateCamera({
            center: { latitude: here.lat, longitude: here.lng },
          });
        }}
        style={styles.findMe}
        accessibilityLabel="Show where I am"
      >
        {/* The supplied artwork, which brings its own tile — so the button
            draws no surface of its own. */}
        <Image source={require("../../../assets/images/locate.png")} style={styles.findMeIcon} />
      </Pressable>

      <View style={[styles.searchBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => Keyboard.dismiss()}
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
          {results.map((r: SearchResult) => (
            <Pressable
              key={r.id}
              onPress={() => {
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
              <View style={styles.backRow}>
                <Pressable onPress={() => setWithin(null)} style={styles.back}>
                  <Text style={{ color: palette.accentText, fontSize: 13 }}>
                    ← Everything in {within}
                  </Text>
                </Pressable>
                {/* Looking at one city is the moment somebody might want to
                    hand it to a friend who is going there. */}
                <Pressable
                  onPress={() => {
                    setSharing(true);
                    setSharePreview({ categories: [], statuses: ["visited", "lived"] });
                  }}
                  style={styles.back}
                  hitSlop={8}
                >
                  <Text style={{ color: palette.accentText, fontSize: 13 }}>Share</Text>
                </Pressable>
              </View>
            )}

            {within && sharing && (
              <ShareArea
                area={within}
                // Everything saved here, before the sheet's own filtering —
                // the sheet decides what the link contains and shows it.
                places={all.filter((p) => p.city === within || p.country === within)}
                onPreview={setSharePreview}
                onClose={() => {
                  setSharing(false);
                  setSharePreview(null);
                }}
              />
            )}

            {(view === "cities" || view === "countries") && !within ? (
              <FlatList
                // Distinct from the places list below. Both sit in the same
                // slot, so without separate identities React reuses one list
                // across the switch and keeps its scroll offset — you tap a
                // country you scrolled down to, and its places open already
                // scrolled past the end, which looks like nothing is there.
                key="groups"
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
                key={`places-${view}-${within ?? "all"}`}
                data={listed}
                keyExtractor={(p) => p.id}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
                ListHeaderComponent={<FirstSteps />}
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
                    <Text style={styles.rowGlyph}>{placeIconOf(item)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: palette.ink }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.rowWhere, { color: palette.muted }]} numberOfLines={1}>
                        {[item.city, item.country].filter(Boolean).join(", ") || "—"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13 }}>{statusOf(item.status).icon}</Text>
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
  findMe: { position: "absolute", right: 12, bottom: 92 },
  findMeIcon: { width: 44, height: 44 },
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
  looking: {
    position: "absolute",
    top: 104,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 10,
  },
  hereSheet: { flex: 1, paddingHorizontal: 18, paddingTop: 18 },
  hereHead: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  hereTitle: { flex: 1, fontSize: 18, fontWeight: "600" },
  hereRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
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
  backRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
