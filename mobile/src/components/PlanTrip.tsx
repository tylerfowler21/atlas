/// Drafting a trip on the phone, then checking it.
///
/// The draft is the easy half. The half that matters is what follows: every
/// place the model named is looked up against a real gazetteer, shown with what
/// came back, and kept or dropped one at a time. A model will name a restaurant
/// that closed years ago as confidently as one that is open, and the only
/// honest defence is to ask something that knows.
///
/// So nothing here reaches the map until somebody has seen a real address next
/// to a suggested name — the same bargain the website's importer makes.
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, type SearchResult } from "@/lib/api";
import { useCategories } from "@/lib/categories";
import { usePalette } from "@/lib/use-palette";
import { searchPlaces } from "@/lib/search-places";

type Stop = {
  day: number;
  time: string | null;
  name: string;
  city: string;
  category: string;
  note: string | null;
};

type Checked = Stop & {
  /// What the map found, or null when nothing matched — which is the signal
  /// worth reading.
  match: SearchResult | null;
  keep: boolean;
};

export default function PlanTrip({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const palette = usePalette();
  const { categoryOf } = useCategories();

  const [where, setWhere] = useState("");
  const [days, setDays] = useState("3");
  const [interests, setInterests] = useState("");
  const [pace, setPace] = useState<"relaxed" | "balanced" | "packed">("balanced");

  const [stage, setStage] = useState<"asking" | "drafting" | "checking" | "review">("asking");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [checked, setChecked] = useState<Checked[]>([]);
  const [saving, setSaving] = useState(false);

  async function draft() {
    setStage("drafting");
    try {
      const body = await api<{
        title: string;
        destination: string;
        summary: string;
        stops: Stop[];
      }>("/api/trips/generate", {
        method: "POST",
        body: JSON.stringify({
          destination: where.trim(),
          days: Math.max(1, Math.min(14, Number(days) || 3)),
          interests: interests.trim() || null,
          pace,
        }),
      });

      setTitle(body.title);
      setSummary(body.summary);

      // Looked up one at a time, deliberately: the geocoders behind this allow
      // about a request a second, and the progress is worth seeing anyway.
      setStage("checking");
      setProgress({ done: 0, total: body.stops.length });

      const results: Checked[] = [];
      for (const [i, stop] of body.stops.entries()) {
        let match: SearchResult | null = null;
        try {
          const hits = await searchPlaces(
            stop.city && !stop.name.includes(stop.city) ? `${stop.name}, ${stop.city}` : stop.name,
            "full",
            body.destination,
          );
          match = hits[0] ?? null;
        } catch {
          // A lookup that failed is the same as one that found nothing: the
          // row stays, unmatched, for somebody to decide about.
        }
        results.push({ ...stop, match, keep: match !== null });
        setProgress({ done: i + 1, total: body.stops.length });
        setChecked([...results]);
      }

      setStage("review");
    } catch (e) {
      setStage("asking");
      Alert.alert(
        "That draft didn't come back",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    }
  }

  async function save() {
    const keeping = checked.filter((c) => c.keep && c.match);
    if (keeping.length === 0) {
      Alert.alert("Nothing to save", "Keep at least one place.");
      return;
    }

    setSaving(true);
    try {
      const { tripId } = await api<{ tripId: string }>("/api/trips/import", {
        method: "POST",
        body: JSON.stringify({
          trip: { title: title.trim() || where.trim(), destination: where.trim() },
          // A trip somebody is about to take, not one they have taken.
          markVisited: false,
          entries: keeping.map((c) => ({
            dayIndex: Math.max(0, c.day - 1),
            title: c.name,
            startTime: c.time,
            notes: c.note,
            category: c.category,
            place: {
              name: c.name,
              lat: c.match!.lat,
              lng: c.match!.lng,
              address: c.match!.address,
              city: c.match!.city,
              country: c.match!.country,
              countryCode: c.match!.countryCode,
            },
          })),
        }),
      });
      onCreated();
      onClose();
      return tripId;
    } catch (e) {
      Alert.alert("Could not save that trip", e instanceof Error ? e.message : "Try again");
    } finally {
      setSaving(false);
    }
  }

  const keeping = checked.filter((c) => c.keep && c.match).length;
  const unmatched = checked.filter((c) => !c.match).length;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={styles.sheet}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: palette.ink }]}>Plan a trip</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: palette.muted, fontSize: 15 }}>Close</Text>
          </Pressable>
        </View>

        {stage === "asking" && (
          <>
            <TextInput
              value={where}
              onChangeText={setWhere}
              placeholder="Where — Lisbon"
              placeholderTextColor={palette.muted}
              style={[styles.input, { color: palette.ink, borderColor: palette.border }]}
            />
            <TextInput
              value={days}
              onChangeText={setDays}
              keyboardType="number-pad"
              placeholder="How many days"
              placeholderTextColor={palette.muted}
              style={[styles.input, { color: palette.ink, borderColor: palette.border }]}
            />
            <TextInput
              value={interests}
              onChangeText={setInterests}
              placeholder="What you're into (optional)"
              placeholderTextColor={palette.muted}
              style={[styles.input, { color: palette.ink, borderColor: palette.border }]}
            />

            <View style={styles.chips}>
              {(["relaxed", "balanced", "packed"] as const).map((id) => (
                <Pressable
                  key={id}
                  onPress={() => setPace(id)}
                  style={[
                    styles.chip,
                    { borderColor: pace === id ? palette.accent : palette.border },
                  ]}
                >
                  <Text style={{ color: palette.ink, fontSize: 13, textTransform: "capitalize" }}>
                    {id}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={draft}
              disabled={where.trim().length < 2}
              style={[
                styles.primary,
                { backgroundColor: palette.accent, opacity: where.trim().length < 2 ? 0.5 : 1 },
              ]}
            >
              <Text style={{ color: palette.onAccent, fontWeight: "600", fontSize: 15 }}>
                Draft me an itinerary
              </Text>
            </Pressable>

            <Text style={{ color: palette.muted, fontSize: 12, marginTop: 14 }}>
              Every place it suggests is checked against a real map before
              anything is saved. Whatever it invents simply won&apos;t be found.
            </Text>
          </>
        )}

        {(stage === "drafting" || stage === "checking") && (
          <View style={styles.waiting}>
            <ActivityIndicator />
            <Text style={{ color: palette.muted, fontSize: 14, marginTop: 12 }}>
              {stage === "drafting"
                ? "Drafting…"
                : `Checking place ${progress.done} of ${progress.total} against the map…`}
            </Text>
          </View>
        )}

        {stage === "review" && (
          <>
            <Text style={{ color: palette.ink, fontSize: 15, fontWeight: "600" }}>{title}</Text>
            <Text style={{ color: palette.muted, fontSize: 13, marginTop: 4 }}>{summary}</Text>
            <Text style={{ color: palette.muted, fontSize: 12, marginTop: 12 }}>
              {keeping} of {checked.length} found on the map
              {unmatched > 0 ? ` · ${unmatched} couldn't be found` : ""}
            </Text>

            {checked.map((c, i) => (
              <Pressable
                key={`${c.name}-${i}`}
                onPress={() =>
                  c.match &&
                  setChecked((all) =>
                    all.map((x, j) => (i === j ? { ...x, keep: !x.keep } : x)),
                  )
                }
                style={[
                  styles.row,
                  { borderColor: c.keep && c.match ? palette.accent : palette.border },
                  !c.match && { opacity: 0.55 },
                ]}
              >
                <Text style={{ fontSize: 16 }}>
                  {c.match ? (c.keep ? "☑️" : "⬜️") : "⚠️"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.ink, fontSize: 14 }} numberOfLines={1}>
                    Day {c.day} · {c.name}
                  </Text>
                  <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
                    {c.match
                      ? `${categoryOf(c.category).icon} ${c.match.address ?? c.match.city ?? c.match.name}`
                      : "Not found on the map — it may not exist"}
                  </Text>
                </View>
              </Pressable>
            ))}

            <Pressable
              onPress={save}
              disabled={saving || keeping === 0}
              style={[
                styles.primary,
                { backgroundColor: palette.accent, opacity: saving || keeping === 0 ? 0.5 : 1 },
              ]}
            >
              <Text style={{ color: palette.onAccent, fontWeight: "600", fontSize: 15 }}>
                {saving ? "Saving…" : `Create trip with ${keeping} stops`}
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
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  chips: { flexDirection: "row", gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  primary: { marginTop: 20, borderRadius: 10, alignItems: "center", paddingVertical: 14 },
  waiting: { alignItems: "center", paddingVertical: 60 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 8,
  },
});
