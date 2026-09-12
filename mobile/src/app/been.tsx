import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DotWorld from "@/components/DotWorld";
import { beenYears, inYear, summarise, tripsInYear } from "@/lib/been";
import { beenPlaces } from "@/lib/place-groups";
import { flagEmoji } from "@/lib/flag";
import { type } from "@/lib/type";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/lib/auth";
import { usePalette } from "@/lib/use-palette";
import { RADIUS } from "@/lib/brand";
import type { Place, Trip } from "@/lib/api";

const PAGE = 20;
const GAP = 12;

/// A month and year, for under a city's name.
const WHEN = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" });

/// Everywhere you have been, as a picture rather than a list.
///
/// The question a travel app is really asked — how much of the world have I
/// seen — wants a number and a shape. Showing the same map again with a filter
/// on was answering it with the thing that prompted it.
export default function BeenScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  /// Two tiles to a row, measured rather than given as a percentage: a
  /// percentage width and an aspect ratio together leave React Native with
  /// nothing to compute the height from, and the tiles collapse to nothing.
  const { width } = useWindowDimensions();
  const tile = (width - PAGE * 2 - GAP) / 2;

  const { data, error, loading } = useApi<{ places: Place[] }>("/api/places");
  const { data: tripData } = useApi<{ trips: Trip[] }>("/api/trips");

  const places = useMemo(() => data?.places ?? [], [data]);
  const years = useMemo(() => beenYears(places), [places]);
  const [year, setYear] = useState<number | null>(null);

  const stats = useMemo(() => summarise(places, year), [places, year]);
  const trips = tripsInYear(tripData?.trips ?? [], year);

  /// One card per city, newest first. A city is the unit people remember a
  /// trip in, and eight cards for eight restaurants in Lisbon is a worse
  /// answer than one that says Lisbon.
  const recent = useMemo(() => {
    const cards: {
      key: string;
      city: string;
      country: string | null;
      countryCode: string | null;
      when: string | null;
      photoUrl: string | null;
    }[] = [];

    const dated = [...beenPlaces(places)].sort((a, b) =>
      (b.visitedAt ?? "").localeCompare(a.visitedAt ?? ""),
    );

    for (const place of inYear(dated, year)) {
      const city = place.city?.trim();
      if (!city) continue;
      const key = `${city}, ${place.country ?? ""}`;
      const already = cards.find((c) => c.key === key);
      if (already) {
        // A city already carded takes the first photograph that turns up.
        if (!already.photoUrl && place.photoUrl) already.photoUrl = place.photoUrl;
        continue;
      }
      cards.push({
        key,
        city,
        country: place.country,
        countryCode: place.countryCode,
        when: place.visitedAt,
        photoUrl: place.photoUrl,
      });
    }
    return cards;
  }, [places, year]);

  if (loading && !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
    >
      {error && <Text style={[type.meta, { color: palette.muted }]}>{error}</Text>}

      <Text style={[type.meta, { color: palette.muted }]}>
        {user?.name ? `${user.name} has been to` : "You have been to"}
      </Text>
      <Text style={[type.title, styles.headline, { color: palette.ink }]}>
        <Text style={{ color: palette.accentText }}>{stats.countries}</Text>{" "}
        {stats.countries === 1 ? "country" : "countries"}
      </Text>

      <View style={styles.stats}>
        <Stat n={stats.cities} one="city" many="cities" />
        <Stat n={stats.places} one="place" many="places" />
        <Stat n={trips} one="trip" many="trips" />
      </View>

      {years.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <YearChip on={year === null} onPress={() => setYear(null)}>
            All time
          </YearChip>
          {years.map((y) => (
            <YearChip key={y} on={year === y} onPress={() => setYear(y)}>
              {String(y)}
            </YearChip>
          ))}
        </ScrollView>
      )}

      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        <DotWorld countryCodes={stats.countryCodes} />
      </View>

      <View style={styles.recentHead}>
        <Text style={[type.section, { color: palette.ink }]}>Recently</Text>
        <Pressable onPress={() => router.replace("/")}>
          <Text style={[type.metaStrong, { color: palette.accentText }]}>See all</Text>
        </Pressable>
      </View>

      {recent.length === 0 ? (
        <Text style={[type.body, { color: palette.muted }]}>
          Nothing marked as been there yet. Mark a place you have been and it
          will light up on the map above.
        </Text>
      ) : (
        <View style={styles.grid}>
          {recent.slice(0, 8).map((card) => (
            <View
              key={card.key}
              style={[
                styles.tile,
                { width: tile, height: (tile * 3) / 4, backgroundColor: palette.brandSurface },
              ]}
            >
              {card.photoUrl ? (
                <Image source={{ uri: card.photoUrl }} style={StyleSheet.absoluteFill} />
              ) : (
                // No photograph yet. The flag rather than a grey box: it says
                // which country this was without pretending to be a picture
                // of it.
                <View style={styles.flag}>
                  <Text style={styles.flagGlyph}>{flagEmoji(card.countryCode)}</Text>
                </View>
              )}

              {/* Dark at the foot, where the name sits, and fading out above
                  it — the photograph is the point of the card, and a solid
                  band drawn across it reads as a bar rather than as shade. */}
              <LinearGradient
                colors={["transparent", "rgba(11,33,28,0.82)"]}
                locations={[0, 0.75]}
                style={styles.caption}
              >
                <Text style={[type.item, styles.captionName]} numberOfLines={1}>
                  {card.city}
                </Text>
                <Text style={[type.meta, styles.captionWhen]} numberOfLines={1}>
                  {[card.country, card.when ? WHEN.format(new Date(card.when)) : null]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </LinearGradient>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ n, one, many }: { n: number; one: string; many: string }) {
  const palette = usePalette();
  return (
    <Text style={[type.meta, { color: palette.muted }]}>
      <Text style={[type.metaStrong, { color: palette.ink }]}>{n}</Text>{" "}
      {n === 1 ? one : many}
    </Text>
  );
}

function YearChip({
  on,
  onPress,
  children,
}: {
  on: boolean;
  onPress: () => void;
  children: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: palette.border, backgroundColor: palette.surface },
        on && { backgroundColor: palette.primary, borderColor: palette.primary },
      ]}
    >
      <Text style={[type.metaStrong, { color: on ? palette.onPrimary : palette.ink }]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: PAGE, gap: 0 },
  headline: { fontSize: 40, lineHeight: 44, marginTop: 2 },
  stats: { flexDirection: "row", gap: 18, marginTop: 10 },
  chips: { flexDirection: "row", gap: 8, paddingVertical: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  card: { borderRadius: RADIUS.card, padding: 14 },
  recentHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: { borderRadius: RADIUS.photo, overflow: "hidden" },
  flag: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  flagGlyph: { fontSize: 34 },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    paddingTop: 30,
  },
  captionName: { color: "#fff" },
  captionWhen: { color: "rgba(255,255,255,0.8)" },
});
