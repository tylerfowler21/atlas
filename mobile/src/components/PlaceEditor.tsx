import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { api, type Place } from "@/lib/api";
import { openDirections } from "@/components/TripMap";
import { CATEGORIES } from "@/lib/taxonomy";
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
  const [name, setName] = useState(draft?.name ?? "");
  const [category, setCategory] = useState(draft?.category ?? "other");
  const [status, setStatus] = useState(draft?.status ?? "wishlist");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [emoji, setEmoji] = useState(draft?.emoji ?? "");
  const [busy, setBusy] = useState(false);

  if (!draft) return null;
  const editing = Boolean(draft.id);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Give it a name");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: trimmed,
        category,
        status,
        emoji: emoji.trim() || null,
        notes: notes.trim() || null,
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
    Alert.alert(draft!.name, "Remove this place?", [
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

          {/* Only for somewhere already saved: directions to a pin you have
              not yet decided to keep are not what anyone wants. */}
          {editing && (
            <Pressable
              onPress={() => openDirections(draft!.lat, draft!.lng, draft!.name)}
              style={[styles.directions, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Text style={{ color: palette.accentText, fontWeight: "600" }}>
                🧭  Directions
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
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  directions: { marginTop: 28, borderWidth: 1, borderRadius: 10, alignItems: "center", paddingVertical: 13 },
  remove: { marginTop: 12, alignItems: "center", paddingVertical: 12 },
});
