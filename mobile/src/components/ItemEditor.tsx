import { useState } from "react";
import { usePlaceSearch } from "@/lib/use-place-search";
import { searchPlaces } from "@/lib/search-places";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import { api, type ItineraryItem, type Place, type SearchResult } from "@/lib/api";
import { CATEGORIES, TRAVEL_MODES } from "@/lib/taxonomy";
import { usePalette } from "@/lib/use-palette";

/// "09:30" — the shape the API stores and the website's time input produces.
const TIME_HINT = "HH:MM";
function isTime(value: string) {
  return value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export type ItemDraft =
  | { mode: "create"; tripId: string; dayIndex: number; kind: "stop" | "travel" }
  | { mode: "edit"; item: ItineraryItem };

/// One sheet for a stop and for a leg between two places.
///
/// They are the same row in the same table with a different `kind`, and the
/// itinerary reads as one sequence — a morning, a train, an afternoon. Two
/// separate editors would make them feel like different kinds of thing.
/// Declared here rather than inside the editor: a component defined during
/// render is a different component type each time, so React discards and
/// rebuilds it — losing scroll position and anything else it held.
function PlacePicker({
  label,
  places,
  selected,
  onSelect,
  palette,
}: {
  label: string;
  places: Place[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  palette: ReturnType<typeof usePalette>;
}) {
  return (
    <>
      <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={() => onSelect(null)}
          style={[
            styles.chip,
            { backgroundColor: palette.surface, borderColor: palette.border },
            !selected && { borderColor: palette.accent },
          ]}
        >
          <Text style={{ fontSize: 13, color: palette.muted }}>None</Text>
        </Pressable>
        {places.map((p) => {
          const on = selected === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelect(p.id)}
              style={[
                styles.chip,
                { backgroundColor: palette.surface, borderColor: palette.border },
                on && { borderColor: palette.accent },
              ]}
            >
              <Text style={{ fontSize: 13, color: on ? palette.ink : palette.muted }} numberOfLines={1}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

export default function ItemEditor({
  draft,
  places,
  onClose,
  onSaved,
}: {
  draft: ItemDraft | null;
  places: Place[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const palette = usePalette();
  const existing = draft?.mode === "edit" ? draft.item : null;
  const kind = existing?.kind ?? (draft?.mode === "create" ? draft.kind : "stop");

  const [title, setTitle] = useState(existing?.title ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "");
  const [category, setCategory] = useState(existing?.category ?? "other");
  const [startTime, setStartTime] = useState(existing?.startTime ?? "");
  const [endTime, setEndTime] = useState(existing?.endTime ?? "");
  const [travelMode, setTravelMode] = useState(existing?.mode ?? "train");
  const [placeId, setPlaceId] = useState(existing?.placeId ?? null);
  const [toPlaceId, setToPlaceId] = useState(existing?.toPlaceId ?? null);
  const [busy, setBusy] = useState(false);

  /// Searching the world, then saving what you pick.
  ///
  /// The pickers below only ever offered places already saved, so planning a
  /// stop somewhere new meant leaving for the map, saving it, and coming back.
  /// This is what the website does: find it, save it, attach it, in one go.
  const [query, setQuery] = useState("");

  /// Places created here, so they appear in the pickers without refetching.
  const [added, setAdded] = useState<Place[]>([]);

  const options = [...added, ...places];

  /// Searched as you type, the same as the map tab and the website.
  const { results, searching } = usePlaceSearch(query, searchPlaces);

  /// Saved as somewhere you want to go: it is on an itinerary, which is a plan
  /// rather than a record. Marking it visited is a thing you do afterwards.
  async function saveAndAttach(result: SearchResult, target: "from" | "to") {
    try {
      const { place } = await api<{ place: Place }>("/api/places", {
        method: "POST",
        body: JSON.stringify({
          name: result.name,
          lat: result.lat,
          lng: result.lng,
          category: result.category,
          status: "wishlist",
          address: result.address,
          city: result.city,
          country: result.country,
          countryCode: result.countryCode,
        }),
      });
      setAdded((current) => [place, ...current]);
      if (target === "to") setToPlaceId(place.id);
      else setPlaceId(place.id);
      if (!title.trim()) setTitle(result.name);
      setQuery("");
    } catch (e) {
      Alert.alert("Could not save that place", e instanceof Error ? e.message : "Try again");
    }
  }

  if (!draft) return null;
  const travel = kind === "travel";

  async function save() {
    const name = title.trim();
    if (!name) {
      Alert.alert("Give it a title");
      return;
    }
    if (!isTime(startTime) || !isTime(endTime)) {
      Alert.alert("Check the times", `Use ${TIME_HINT}, or leave them empty.`);
      return;
    }
    setBusy(true);
    try {
      const body = {
        title: name,
        kind,
        notes: notes.trim() || null,
        emoji: emoji.trim() || null,
        category: travel ? "transport" : category,
        startTime: startTime || null,
        endTime: travel ? endTime || null : null,
        mode: travel ? travelMode : null,
        placeId,
        toPlaceId: travel ? toPlaceId : null,
      };
      if (draft!.mode === "create") {
        await api(`/api/trips/${draft!.tripId}/items`, {
          method: "POST",
          body: JSON.stringify({ ...body, dayIndex: draft!.dayIndex }),
        });
      } else {
        await api(`/api/items/${draft!.item.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  const field = {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    color: palette.ink,
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.surface }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: palette.muted, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.ink }]}>
            {travel ? "Journey" : "Stop"}
          </Text>
          <Pressable onPress={save} disabled={busy} hitSlop={10}>
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text style={{ color: palette.accentText, fontSize: 16, fontWeight: "600" }}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.body}>
          <Text style={[styles.label, { color: palette.muted }]}>
            {travel ? "What journey?" : "What are you doing?"}
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={travel ? "Train to Porto" : "Lunch at the market"}
            placeholderTextColor={palette.muted}
            style={[styles.input, field]}
          />

          {travel && (
            <>
              <Text style={[styles.label, { color: palette.muted }]}>How</Text>
              <View style={styles.chips}>
                {TRAVEL_MODES.map((m) => {
                  const on = travelMode === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setTravelMode(m.id)}
                      style={[
                        styles.chip,
                        { backgroundColor: palette.surface, borderColor: palette.border },
                        on && { borderColor: palette.accent },
                      ]}
                    >
                      <Text style={{ fontSize: 13, color: on ? palette.ink : palette.muted }}>
                        {m.icon} {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.times}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: palette.muted }]}>
                {travel ? "Departs" : "Time"}
              </Text>
              <TextInput
                value={startTime}
                onChangeText={setStartTime}
                placeholder={TIME_HINT}
                placeholderTextColor={palette.muted}
                keyboardType="numbers-and-punctuation"
                style={[styles.input, field]}
              />
            </View>
            {travel && (
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: palette.muted }]}>Arrives</Text>
                <TextInput
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder={TIME_HINT}
                  placeholderTextColor={palette.muted}
                  keyboardType="numbers-and-punctuation"
                  style={[styles.input, field]}
                />
              </View>
            )}
          </View>

          <Text style={[styles.label, { color: palette.muted }]}>
            Search anywhere — saves it and attaches it
          </Text>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => Keyboard.dismiss()}
              returnKeyType="search"
              placeholder="Paris, Sagrada Família…"
              placeholderTextColor={palette.muted}
              style={[styles.input, { flex: 1 }, field]}
            />
            {searching && <ActivityIndicator />}
          </View>

          {results.map((r) => (
            <View
              key={r.id}
              style={[styles.result, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Text style={{ color: palette.ink, fontSize: 15 }} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
                {r.context}
              </Text>
              <View style={styles.resultActions}>
                <Pressable onPress={() => saveAndAttach(r, "from")} hitSlop={6}>
                  <Text style={{ color: palette.accentText, fontWeight: "600", fontSize: 13 }}>
                    {travel ? "Leaving from here" : "Use this place"}
                  </Text>
                </Pressable>
                {travel && (
                  <Pressable onPress={() => saveAndAttach(r, "to")} hitSlop={6}>
                    <Text style={{ color: palette.accentText, fontWeight: "600", fontSize: 13 }}>
                      Arriving here
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}

          <PlacePicker
            label={travel ? "Leaving from" : "Which saved place?"}
            places={options}
            selected={placeId}
            onSelect={setPlaceId}
            palette={palette}
          />
          {travel && (
            <PlacePicker
              label="Arriving at"
              places={options}
              selected={toPlaceId}
              onSelect={setToPlaceId}
              palette={palette}
            />
          )}

          {!travel && (
            <>
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
                        on && { borderColor: c.color },
                      ]}
                    >
                      <Text style={{ fontSize: 13, color: on ? palette.ink : palette.muted }}>
                        {c.icon} {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[styles.label, { color: palette.muted }]}>
            Emoji — leave empty to use the category&apos;s
          </Text>
          <TextInput
            value={emoji}
            onChangeText={setEmoji}
            placeholder="🚂"
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.emoji, field]}
          />

          <Text style={[styles.label, { color: palette.muted }]}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Seat 12A, platform 3…"
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.notes, field]}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
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
  notes: { minHeight: 80, textAlignVertical: "top" },
  times: { flexDirection: "row", gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingRight: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  result: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8 },
  resultActions: { flexDirection: "row", gap: 20, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 200 },
});
