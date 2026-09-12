import { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Place } from "@/lib/api";
import { useCategories } from "@/lib/categories";
import { openDirections } from "@/components/TripMap";
import { NavigationArrowIcon } from "@/components/nav-icons";
import StatusIcon from "@/components/StatusIcon";
import AddToTrip from "@/components/AddToTrip";
import { placeName } from "@/lib/place-name";
import { STATUSES } from "@/lib/taxonomy";
import { RADIUS } from "@/lib/brand";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

const PHOTO_HEIGHT = 300;
const AVATAR = 64;

type OnTrip = { id: string; title: string; color: string; dayIndex: number; times: number };

/// A saved place, as something to read rather than a form to fill in.
///
/// Tapping a place used to open the editor — every field at once, for a screen
/// people mostly open to remember what somewhere was and decide what to do
/// about it. The things you actually do from here are quick: change what it is
/// to you, rate it, put it on a trip, get directions. Editing the name and the
/// category is behind the ⋯, which is where a rarely-wanted thing belongs.
export default function PlaceDetail({
  place,
  onClose,
  onChanged,
  onEdit,
}: {
  place: Place | null;
  onClose: () => void;
  /// Something about the place changed on the server.
  onChanged: () => void;
  /// Open the full editor for this place.
  onEdit: (place: Place) => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { categoryOf, placeIconOf } = useCategories();

  /// Kept here as well as on the server so a tap lands immediately. The screen
  /// behind us reloads in its own time; waiting for it would make every chip
  /// feel like it had not registered.
  ///
  /// Seeded from the place and never synced back to it. The caller mounts this
  /// with the place's id as its key, so opening a different place makes a
  /// different component with its own starting values — which is the same
  /// thing an effect copying props into state would achieve, without the
  /// render where the two disagree.
  const [status, setStatus] = useState(place?.status ?? "wishlist");
  const [rating, setRating] = useState<number | null>(place?.rating ?? null);
  const [trips, setTrips] = useState<OnTrip[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const placeId = place?.id;
  /// Bumped to ask the trips for this place again, after one is added.
  const [tripsSeq, setTripsSeq] = useState(0);

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    (async () => {
      try {
        const body = await api<{ trips: OnTrip[] }>(`/api/places/${placeId}/trips`);
        if (!cancelled) setTrips(body.trips);
      } catch {
        // The trips this is on are a detail of the screen, not the screen.
        // Failing to load them shows none rather than an error over a place
        // somebody opened to read.
        if (!cancelled) setTrips([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId, tripsSeq]);

  if (!place) return null;
  const category = categoryOf(place.category);

  /// Saves one field without touching the rest.
  ///
  /// PATCH rather than the editor's whole-object save: sending the entire
  /// place back to change a star would overwrite anything edited elsewhere
  /// since this screen was opened.
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/api/places/${place!.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onChanged();
    } catch (e) {
      Alert.alert("Could not save that", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  function pickStatus(next: string) {
    setStatus(next);
    // A rating on somewhere you have not been is a rating of somewhere you
    // have not seen, so it goes with the status that implies it.
    const nextRating = next === "wishlist" ? null : rating;
    setRating(nextRating);
    void patch({ status: next, rating: nextRating });
  }

  function pickRating(stars: number) {
    // Tapping the star you already gave clears it, which is the only way back
    // from "I rated this" without a separate control saying so.
    const next = rating === stars ? null : stars;
    setRating(next);
    void patch({ rating: next });
  }

  function remove() {
    const on = trips ?? [];
    Alert.alert(
      place!.name,
      on.length > 0
        ? `This is on ${on.length === 1 ? "a trip" : `${on.length} trips`}. Removing it takes it off ${on.length === 1 ? "that day" : "those days"} too.`
        : "Remove this place?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/api/places/${place!.id}`, { method: "DELETE" });
              onChanged();
              onClose();
            } catch (e) {
              Alert.alert("Could not remove", e instanceof Error ? e.message : "Try again");
            }
          },
        },
      ],
    );
  }

  function openMenu() {
    const actions: [string, () => void][] = [
      ["Edit", () => onEdit(place!)],
      ["Remove from your places", remove],
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Cancel", ...actions.map(([label]) => label)],
        cancelButtonIndex: 0,
        destructiveButtonIndex: actions.length,
      },
      (chosen) => {
        if (chosen > 0) actions[chosen - 1]?.[1]();
      },
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.fill, { backgroundColor: palette.background }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
          {/* The photograph, or the category's colour when there is none —
              which is most places, since Wikipedia has landmarks and not the
              bar round the corner. */}
          <View style={[styles.photo, { backgroundColor: category.color }]}>
            {place.photoUrl && (
              <Image
                source={{ uri: place.photoUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            )}
            <LinearGradient
              colors={["rgba(11,33,28,0.4)", "transparent"]}
              locations={[0, 0.4]}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.topRow}>
              <Round onPress={onClose} label="Close">
                ✕
              </Round>
              <Round onPress={openMenu} label="More">
                ⋯
              </Round>
            </View>
          </View>

          <View style={[styles.sheet, { backgroundColor: palette.background }]}>
            {/* Sits on the seam between the photograph and the page, which is
                what tells you the two belong to each other. */}
            <View
              style={[
                styles.avatar,
                { backgroundColor: category.color, borderColor: palette.background },
              ]}
            >
              <Text style={styles.avatarGlyph}>{placeIconOf(place)}</Text>
            </View>

            <Text style={[type.title, { color: palette.ink }]}>{placeName(place)}</Text>
            <Text style={[type.body, styles.meta, { color: palette.muted }]}>
              {[category.label, place.city, place.country].filter(Boolean).join(" · ")}
            </Text>

            {/* One line that scrolls rather than two that wrap. The three of
                them are a single question with one answer, and splitting them
                across rows makes the third look like a different kind of
                thing from the first two. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.statusScroll}
              contentContainerStyle={styles.statuses}
            >
              {STATUSES.map((s) => {
                const on = status === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => pickStatus(s.id)}
                    style={[
                      styles.statusChip,
                      { borderColor: palette.border, backgroundColor: palette.surface },
                      // Sun rather than Evergreen, as the kit draws it: this is
                      // what the place is to you, not a filter you have set.
                      on && { borderColor: palette.accent, backgroundColor: palette.accentTint },
                    ]}
                  >
                    <StatusIcon status={s.id} color={on ? palette.accentText : palette.ink} />
                    <Text
                      style={[
                        type.metaStrong,
                        { color: on ? palette.accentText : palette.ink },
                      ]}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Only for somewhere you have been. */}
            {status !== "wishlist" && (
              <View style={styles.ratingRow}>
                <Text style={[type.metaStrong, { color: palette.ink }]}>Your rating</Text>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => pickRating(n)}
                      hitSlop={6}
                      accessibilityLabel={`Rate ${n} out of 5`}
                    >
                      <Text
                        style={[
                          styles.star,
                          { color: (rating ?? 0) >= n ? palette.accent : palette.border },
                        ]}
                      >
                        ★
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {place.notes ? (
              <Pressable
                onPress={() => onEdit(place)}
                style={[styles.note, { backgroundColor: palette.brandSurface }]}
              >
                <Text style={styles.noteGlyph}>✎</Text>
                <Text style={[type.body, { flex: 1, color: palette.ink }]}>{place.notes}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => onEdit(place)}
                style={[styles.note, { backgroundColor: palette.brandSurface }]}
              >
                <Text style={styles.noteGlyph}>✎</Text>
                <Text style={[type.body, { flex: 1, color: palette.muted }]}>
                  Add a note — what to order, when to go, who told you about it.
                </Text>
              </Pressable>
            )}

            {/* Wikipedia's picture comes with a licence that requires naming
                the author, so the credit travels with the photograph. Your own
                photograph needs none, which is why this is not always here. */}
            {place.photoAttribution && (
              <Text
                style={[type.meta, styles.credit, { color: palette.muted }]}
                onPress={() =>
                  place.photoSourceUrl && void Linking.openURL(place.photoSourceUrl)
                }
                suppressHighlighting
              >
                Photo: {place.photoAttribution}
              </Text>
            )}

            {trips === null ? (
              <ActivityIndicator style={styles.tripsLoading} />
            ) : (
              trips.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    onClose();
                    router.push({ pathname: "/trip/[id]", params: { id: t.id } });
                  }}
                  style={[styles.tripRow, { borderColor: palette.border }]}
                >
                  <View style={[styles.tripDot, { backgroundColor: t.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.item, { color: palette.ink }]} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={[type.meta, { color: palette.muted }]}>
                      Day {t.dayIndex + 1}
                      {t.times > 1 ? ` · ${t.times}×` : ""}
                    </Text>
                  </View>
                  <Text style={{ color: palette.muted, fontSize: 18 }}>›</Text>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>

        {/* The two things you came here to do, always reachable rather than
            scrolled past. */}
        <View
          style={[
            styles.actions,
            {
              paddingBottom: insets.bottom + 12,
              backgroundColor: palette.background,
              borderTopColor: palette.border,
            },
          ]}
        >
          <Pressable
            onPress={() => setAdding(true)}
            style={[styles.addButton, { backgroundColor: palette.primary }]}
          >
            {busy ? (
              <ActivityIndicator color={palette.onPrimary} />
            ) : (
              <Text style={[type.button, { color: palette.onPrimary }]}>+ Add to trip</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => openDirections(place.lat, place.lng, place.name)}
            accessibilityLabel="Directions"
            style={[styles.directions, { backgroundColor: palette.brandSurface }]}
          >
            <NavigationArrowIcon size={22} color={palette.ink} />
          </Pressable>
        </View>

        <AddToTrip
          place={adding ? place : null}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            setTripsSeq((n) => n + 1);
            onChanged();
          }}
        />
      </View>
    </Modal>
  );
}

function Round({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={styles.round} hitSlop={8}>
      <Text style={styles.roundGlyph}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  photo: { height: PHOTO_HEIGHT },
  topRow: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,33,28,0.38)",
  },
  roundGlyph: { color: "#fff", fontSize: 17, lineHeight: 21 },
  sheet: {
    marginTop: -22,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 34,
  },
  avatar: {
    position: "absolute",
    top: -AVATAR / 2,
    left: 20,
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGlyph: { fontSize: 28 },
  meta: { marginTop: 4 },
  /// Negative margins so the row can scroll past the page's own padding
  /// rather than stopping short of the edge.
  statusScroll: { marginHorizontal: -20, marginTop: 18 },
  statuses: { flexDirection: "row", gap: 8, paddingHorizontal: 20 },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
  },
  stars: { flexDirection: "row", gap: 4 },
  star: { fontSize: 26, lineHeight: 30 },
  note: {
    flexDirection: "row",
    gap: 10,
    borderRadius: RADIUS.card,
    padding: 14,
    marginTop: 20,
  },
  noteGlyph: { fontSize: 15, marginTop: 2 },
  credit: { marginTop: 10 },
  tripsLoading: { marginTop: 20 },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    padding: 12,
    marginTop: 12,
  },
  tripDot: { width: 4, height: 34, borderRadius: 2 },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  directions: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
