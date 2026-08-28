import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, type Place } from "@/lib/api";
import { openDirections } from "@/components/TripMap";
import { CATEGORIES } from "@/lib/taxonomy";
import { placeName } from "@/lib/place-name";
import { usePalette } from "@/lib/use-palette";

/// The three things a place can be, in the order people move through them.
const STATUSES = [
  { id: "wishlist", label: "Want to go" },
  { id: "visited", label: "Been there" },
  { id: "lived", label: "Lived there" },
] as const;

export type PlaceDraft = {
  /// Present when editing something already saved.
  id?: string;
  name: string;
  category?: string;
  status?: string;
  emoji?: string | null;
  notes?: string | null;
  rating?: number | null;
  lat: number;
  lng: number;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
};

/// One sheet for both saving something new and changing something saved.
///
/// The same fields either way — a place found by search, a pin dropped on the
/// map and a place being corrected are all the same thing at different stages,
/// and giving each its own screen is how they drift apart.
export default function PlaceEditor({
  draft,
  onClose,
  onSaved,
}: {
  draft: PlaceDraft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const palette = usePalette();
  const router = useRouter();
  const [name, setName] = useState(draft?.name ?? "");
  const [category, setCategory] = useState(draft?.category ?? "other");
  const [status, setStatus] = useState(draft?.status ?? "wishlist");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [emoji, setEmoji] = useState(draft?.emoji ?? "");
  const [rating, setRating] = useState<number | null>(draft?.rating ?? null);
  const [busy, setBusy] = useState(false);

  /// The trips this place is already on.
  ///
  /// Tagged with the place it describes rather than cleared when the place
  /// changes: clearing means a setState in the effect body, and last place's
  /// answer must not be shown against this one meanwhile.
  const [fetched, setFetched] = useState<{
    placeId: string;
    trips: { id: string; title: string; color: string; dayIndex: number; times: number }[];
  } | null>(null);

  const placeId = draft?.id;

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    (async () => {
      try {
        const body = await api<{
          trips: { id: string; title: string; color: string; dayIndex: number; times: number }[];
        }>(`/api/places/${placeId}/trips`);
        if (!cancelled) setFetched({ placeId, trips: body.trips });
      } catch {
        if (!cancelled) setFetched({ placeId, trips: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  const onTrips =
    fetched && placeId && fetched.placeId === placeId ? fetched.trips : [];

  if (!draft) return null;
  const editing = Boolean(draft.id);

  async function save() {
    // No name needed. A pin dropped on a city is that city, and being asked to
    // type its name in order to change an emoji is a form standing between
    // someone and a two-second edit.
    const trimmed = placeName({ name, city: draft!.city, country: draft!.country });
    setBusy(true);
    try {
      const body = {
        name: trimmed,
        category,
        status,
        emoji: emoji.trim() || null,
        notes: notes.trim() || null,
        // Cleared for somewhere you have not been. A rating on a wishlist entry
        // is a rating of somewhere you have not seen — the website drops it for
        // the same reason.
        rating: status === "wishlist" ? null : rating,
        lat: draft!.lat,
        lng: draft!.lng,
        address: draft!.address ?? null,
        city: draft!.city ?? null,
        country: draft!.country ?? null,
        countryCode: draft!.countryCode ?? null,
      };
      await api(editing ? `/api/places/${draft!.id}` : "/api/places", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    // Names the trips it will change. Deleting a place removes it from the days
    // it is on, which is not obvious from a screen about a place.
    const onTripsNow = onTrips;
    const message =
      onTripsNow.length > 0
        ? `This is on ${onTripsNow.length === 1 ? "a trip" : `${onTripsNow.length} trips`}: ${onTripsNow
            .map((t) => t.title)
            .join(", ")}. Deleting it removes those stops too.`
        : "Remove this place?";

    Alert.alert(draft!.name || "This place", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/places/${draft!.id}`, { method: "DELETE" });
            onSaved();
            onClose();
          } catch (e) {
            Alert.alert("Could not remove", e instanceof Error ? e.message : "Try again");
          }
        },
      },
    ]);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.surface }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: palette.muted, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.ink }]}>
            {editing ? "Edit place" : "Save place"}
          </Text>
          <Pressable onPress={save} disabled={busy} hitSlop={10}>
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: palette.accentText, fontSize: 16, fontWeight: "600" }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.body}>
          <Text style={[styles.label, { color: palette.muted }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={placeName({ name: null, city: draft.city, country: draft.country })}
            placeholderTextColor={palette.muted}
            style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink }]}
          />

          {(draft.city || draft.country) && (
            <Text style={[styles.where, { color: palette.muted }]}>
              {[draft.city, draft.country].filter(Boolean).join(", ")}
            </Text>
          )}

          <Text style={[styles.label, { color: palette.muted }]}>Status</Text>
          <View style={styles.chips}>
            {STATUSES.map((s) => {
              const on = status === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setStatus(s.id)}
                  style={[
                    styles.chip,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                    on && { backgroundColor: palette.accent, borderColor: palette.accent },
                  ]}
                >
                  <Text style={{ fontSize: 13, color: on ? palette.onAccent : palette.muted }}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {status !== "wishlist" && (
            <>
              <Text style={[styles.label, { color: palette.muted }]}>
                Rating — tap the same star again to clear it
              </Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setRating(rating === n ? null : n)}
                    hitSlop={6}
                    accessibilityLabel={`Rate ${n} out of 5`}
                  >
                    <Text
                      style={[
                        styles.star,
                        { color: rating && n <= rating ? "#D9A441" : palette.border },
                      ]}
                    >
                      ★
                    </Text>
                  </Pressable>
                ))}
                {rating !== null && (
                  <Pressable onPress={() => setRating(null)} hitSlop={6} style={styles.clear}>
                    <Text style={{ color: palette.muted, fontSize: 13 }}>Clear</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}

          <Text style={[styles.label, { color: palette.muted }]}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => {
              const on = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[
                    styles.chip,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                    on && { borderColor: c.color, backgroundColor: palette.surface },
                  ]}
                >
                  <Text style={{ fontSize: 13, color: on ? palette.ink : palette.muted }}>
                    {c.icon} {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: palette.muted }]}>
            Emoji — leave empty to use the category&apos;s
          </Text>
          <TextInput
            value={emoji}
            onChangeText={setEmoji}
            placeholder="🍜"
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.emoji, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink }]}
          />

          <Text style={[styles.label, { color: palette.muted }]}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            style={[
              styles.input,
              styles.notes,
              { backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink },
            ]}
          />

          {onTrips.length > 0 && (
            <>
              <Text style={[styles.label, { color: palette.muted }]}>Already on</Text>
              {onTrips.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    onClose();
                    router.push({ pathname: "/trip/[id]", params: { id: t.id } });
                  }}
                  style={[styles.onTrip, { borderColor: palette.border, backgroundColor: palette.surface }]}
                >
                  <View style={[styles.tripDot, { backgroundColor: t.color }]} />
                  <Text style={{ color: palette.ink, flex: 1 }} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text style={{ color: palette.muted, fontSize: 12 }}>
                    day {t.dayIndex + 1}
                    {t.times > 1 ? ` · ${t.times}×` : ""}
                  </Text>
                </Pressable>
              ))}
            </>
          )}

          {/* Only for somewhere already saved: directions to a pin you have
              not yet decided to keep are not what anyone wants. */}
          {editing && (
            <Pressable
              onPress={() => openDirections(draft!.lat, draft!.lng, draft!.name)}
              style={[styles.directions, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Image
                source={require("../../assets/images/directions.png")}
                style={styles.directionsIcon}
              />
              <Text style={{ color: palette.accentText, fontWeight: "600" }}>
                Directions
              </Text>
            </Pressable>
          )}

          {editing && (
            <Pressable onPress={remove} style={styles.remove}>
              <Text style={{ color: "#E07A5F", fontWeight: "500" }}>Remove this place</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function placeToDraft(place: Place): PlaceDraft {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    status: place.status,
    emoji: place.emoji,
    notes: place.notes,
    rating: place.rating,
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    city: place.city,
    country: place.country,
    countryCode: place.countryCode,
  };
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  body: { padding: 16, paddingBottom: 48 },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 18, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  emoji: { width: 90, fontSize: 22 },
  notes: { minHeight: 90, textAlignVertical: "top" },
  where: { fontSize: 13, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stars: { flexDirection: "row", alignItems: "center", gap: 8 },
  star: { fontSize: 30 },
  clear: { marginLeft: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  directions: {
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  directionsIcon: { width: 22, height: 22 },
  onTrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  tripDot: { width: 10, height: 10, borderRadius: 5 },
  remove: { marginTop: 12, alignItems: "center", paddingVertical: 12 },
});
