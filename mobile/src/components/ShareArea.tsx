/// Handing somebody the part of a city you think they should know about.
///
/// The same thing the website does, against the same endpoint, so a link made
/// on the phone is identical to one made on a laptop — and both appear in the
/// same list in settings.
import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, API_URL, type Place } from "@/lib/api";
import { placeName } from "@/lib/place-name";
import { useCategories } from "@/lib/categories";
import { usePalette } from "@/lib/use-palette";
import { STATUSES } from "@/lib/taxonomy";

export default function ShareArea({
  area,
  places,
  onClose,
  onPreview,
}: {
  area: string;
  /// Everything saved in this place, unfiltered. The sheet shows what the link
  /// will contain, because on a phone it covers the map completely — the
  /// website can put this panel beside the map and let the pins answer the
  /// question, and here there is nothing behind the sheet to look at.
  places: Place[];
  onClose: () => void;
  /// Still reported, so the map underneath matches when the sheet is dismissed.
  onPreview: (covers: { categories: string[]; statuses: string[] }) => void;
}) {
  const palette = usePalette();
  const { categories, categoryOf } = useCategories();

  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set(["visited", "lived"]));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  /// What the link covers as it stands. One function, so the preview and the
  /// thing that gets saved cannot disagree about what "everything" means.
  function covers(nextCategories: Set<string>, nextStatuses: Set<string>) {
    return {
      categories:
        nextCategories.size === 0 || nextCategories.size === categories.length
          ? []
          : [...nextCategories],
      statuses: [...nextStatuses],
    };
  }

  /// The places the link would contain right now, by the same rule the server
  /// applies when somebody opens it.
  const chosenNow = covers(chosen, statuses);
  const included = places.filter(
    (p) =>
      (chosenNow.categories.length === 0 || chosenNow.categories.includes(p.category)) &&
      (chosenNow.statuses.length === 0 || chosenNow.statuses.includes(p.status)),
  );

  function toggle(set: Set<string>, id: string, apply: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
    return next;
  }

  async function create() {
    setBusy(true);
    try {
      const { share } = await api<{ share: { path: string } }>("/api/place-shares", {
        method: "POST",
        body: JSON.stringify({ area, ...covers(chosen, statuses), note: note.trim() || null }),
      });
      setLink(`${API_URL}${share.path}`);
    } catch {
      Alert.alert("Could not make that link", "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={styles.sheet}
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: palette.ink }]}>Share {area}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: palette.muted, fontSize: 15 }}>Close</Text>
          </Pressable>
        </View>

        {link ? (
          <>
            <Text style={{ color: palette.muted, fontSize: 13, marginBottom: 12 }}>
              It stays up to date — anything you add in {area} later shows up
              here too. You can revoke it in settings on the website.
            </Text>
            <Text
              selectable
              style={[styles.link, { color: palette.ink, borderColor: palette.border }]}
            >
              {link}
            </Text>
            <Pressable
              style={[styles.primary, { backgroundColor: palette.accent }]}
              onPress={() => void Share.share({ message: link })}
            >
              <Text style={{ color: palette.onAccent, fontWeight: "600", fontSize: 15 }}>
                Send it
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: palette.muted }]}>What to include</Text>
            <View style={styles.chips}>
              {categories.map((c) => {
                const on = chosen.size === 0 || chosen.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      const next = toggle(
                        // The list starts as everything, so the first tap means
                        // "all but this one".
                        chosen.size === 0 ? new Set(categories.map((x) => x.id)) : chosen,
                        c.id,
                        setChosen,
                      );
                      onPreview(covers(next, statuses));
                    }}
                    style={[
                      styles.chip,
                      { borderColor: on ? c.color : palette.border, opacity: on ? 1 : 0.45 },
                    ]}
                  >
                    <Text style={{ color: palette.ink, fontSize: 13 }}>
                      {c.icon} {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {chosen.size === 0 && (
              <Text style={{ color: palette.muted, fontSize: 12, marginTop: 6 }}>
                Everything, unless you narrow it.
              </Text>
            )}

            <Text style={[styles.label, { color: palette.muted, marginTop: 20 }]}>
              Which of your places
            </Text>
            <View style={styles.chips}>
              {STATUSES.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    const next = toggle(statuses, s.id, setStatuses);
                    onPreview(covers(chosen, next));
                  }}
                  style={[
                    styles.chip,
                    {
                      borderColor: statuses.has(s.id) ? palette.accent : palette.border,
                      opacity: statuses.has(s.id) ? 1 : 0.45,
                    },
                  ]}
                >
                  <Text style={{ color: palette.ink, fontSize: 13 }}>
                    {s.icon} {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* What the link actually contains, as it stands. */}
            <Text style={[styles.label, { color: palette.muted, marginTop: 22 }]}>
              {included.length} {included.length === 1 ? "place" : "places"} in this link
            </Text>
            {included.length === 0 ? (
              <Text style={{ color: palette.muted, fontSize: 13 }}>
                Nothing matches what you have chosen.
              </Text>
            ) : (
              included.map((p) => (
                <View key={p.id} style={[styles.included, { borderColor: palette.border }]}>
                  <Text style={{ fontSize: 15 }}>{p.emoji || categoryOf(p.category).icon}</Text>
                  <Text
                    style={{ color: palette.ink, fontSize: 14, flex: 1 }}
                    numberOfLines={1}
                  >
                    {placeName(p)}
                  </Text>
                  <Text style={{ color: palette.muted, fontSize: 12 }}>
                    {categoryOf(p.category).label}
                  </Text>
                </View>
              ))
            )}

            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={280}
              placeholder="A note, if you like"
              placeholderTextColor={palette.muted}
              style={[styles.input, { color: palette.ink, borderColor: palette.border }]}
            />

            <Pressable
              onPress={create}
              disabled={busy || statuses.size === 0}
              style={[
                styles.primary,
                {
                  backgroundColor: palette.accent,
                  opacity: busy || statuses.size === 0 ? 0.5 : 1,
                },
              ]}
            >
              <Text style={{ color: palette.onAccent, fontWeight: "600", fontSize: 15 }}>
                {busy ? "Making the link…" : "Make a link"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: 18, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  title: { flex: 1, fontSize: 20, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 20,
  },
  primary: { marginTop: 20, borderRadius: 10, alignItems: "center", paddingVertical: 14 },
  included: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  link: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 4 },
});
