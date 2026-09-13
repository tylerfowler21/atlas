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
import { TRIP_STYLES } from "@/lib/trip-styles";
import { TRAVEL_MODES } from "@/lib/taxonomy";
import DateRangePicker from "@/components/DateRangePicker";

/// A date this many days after the given one, as "YYYY-MM-DD". Noon UTC rather
/// than midnight, so adding days west of Greenwich does not land on the evening
/// before.
function dayAfter(date: string, days: number) {
  const at = new Date(`${date}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

type Stop = {
  day: number;
  time: string | null;
  name: string;
  city: string;
  category: string;
  note: string | null;
};

/// Getting from one city to the next: the morning on a train in the middle of
/// a multi-city trip, which a list of stops alone leaves out.
type Journey = {
  day: number;
  from: string;
  to: string;
  mode: string;
  departs: string | null;
  arrives: string | null;
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

  /// Where they are going, in the order they go, each with its own length.
  ///
  /// One box and one number was not the trip anybody was planning: two weeks in
  /// Canada is three days in Montréal and two in Québec, and which is which is
  /// the thing only the traveller knows. Kept as typed rather than as ids —
  /// the server geocodes these the same way it geocodes anything else.
  const [legs, setLegs] = useState<{ city: string; days: string }[]>([
    // Three days is what somebody means by "a few days somewhere", and a
    // number on screen is easier to change than one to supply.
    { city: "", days: "3" },
  ]);
  const [kinds, setKinds] = useState<string[]>([]);
  /// The first day, which is all anybody has to say: the days-per-city above
  /// already decide how long it runs, so the last day follows. A trip with no
  /// dates is still a trip, so this stays optional.
  const [start, setStart] = useState("");
  const [interests, setInterests] = useState("");
  const [pace, setPace] = useState<"relaxed" | "balanced" | "packed">("balanced");

  /// The legs worth sending: a city with a name, and its days as a number.
  const asked = legs
    .map((leg) => ({ city: leg.city.trim(), days: Math.max(1, Math.min(14, Number(leg.days) || 1)) }))
    .filter((leg) => leg.city.length >= 2);
  const total = asked.reduce((sum, leg) => sum + leg.days, 0);
  const where = asked.map((leg) => leg.city).join(", ");
  /// The same fortnight the server will not go past, said before the button is
  /// pressed rather than after.
  const tooLong = total > 14;

  /// Worked out rather than asked for, so the dates and the day counts cannot
  /// disagree with each other.
  const end = start && total > 0 ? dayAfter(start, total - 1) : "";

  function setLeg(index: number, patch: Partial<{ city: string; days: string }>) {
    setLegs((current) => current.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)));
  }

  const [stage, setStage] = useState<"asking" | "drafting" | "checking" | "review">("asking");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [checked, setChecked] = useState<Checked[]>([]);
  /// Kept as drafted rather than checked one by one: a journey's two ends are
  /// the cities already typed above, and they are looked up when the trip is
  /// saved along with everything else.
  const [journeys, setJourneys] = useState<Journey[]>([]);
  /// The cities journeys run between, looked up once each rather than once per
  /// journey that touches them.
  const [cities, setCities] = useState<Record<string, SearchResult | null>>({});
  const [saving, setSaving] = useState(false);

  async function draft() {
    setStage("drafting");
    try {
      const body = await api<{
        title: string;
        destination: string;
        summary: string;
        stops: Stop[];
        journeys: Journey[];
      }>("/api/trips/generate", {
        method: "POST",
        body: JSON.stringify({
          destination: where,
          days: total,
          legs: asked,
          styles: kinds,
          interests: interests.trim() || null,
          pace,
        }),
      });

      setTitle(body.title);
      setSummary(body.summary);
      setJourneys(body.journeys ?? []);

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

      // The cities the journeys run between. Looked up like anything else —
      // a model naming a city that does not exist should fail the same way a
      // model naming a restaurant that does not exist fails.
      const cityNames = [...new Set((body.journeys ?? []).flatMap((j) => [j.from, j.to]))];
      if (cityNames.length > 0) {
        setProgress({ done: body.stops.length, total: body.stops.length + cityNames.length });
        const found: Record<string, SearchResult | null> = {};
        for (const [n, name] of cityNames.entries()) {
          try {
            const hits = await searchPlaces(name, "full", body.destination);
            found[name] = hits[0] ?? null;
          } catch {
            found[name] = null;
          }
          setProgress({
            done: body.stops.length + n + 1,
            total: body.stops.length + cityNames.length,
          });
        }
        setCities(found);
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
          trip: {
            title: title.trim() || where,
            destination: where,
            // What the model said the trip is, kept as the trip's own notes
            // rather than shown once and dropped.
            notes: summary || null,
            startDate: start || null,
            endDate: end || null,
          },
          // A trip somebody is about to take, not one they have taken.
          markVisited: false,
          entries: [
            ...journeys.map((j) => {
              const from = cities[j.from] ?? null;
              const to = cities[j.to] ?? null;
              const asPlace = (r: SearchResult | null) =>
                r
                  ? {
                      name: r.city ?? r.name,
                      lat: r.lat,
                      lng: r.lng,
                      address: r.address,
                      city: r.city,
                      country: r.country,
                      countryCode: r.countryCode,
                    }
                  : null;
              return {
                dayIndex: Math.max(0, j.day - 1),
                title: `${j.from} → ${j.to}`,
                kind: "travel" as const,
                mode: j.mode,
                startTime: j.departs,
                endTime: j.arrives,
                notes: j.note,
                category: "transport",
                // A city the map could not place leaves that end without a
                // pin. The journey is still a journey and still says where it
                // went.
                place: asPlace(from),
                toPlace: asPlace(to),
              };
            }),
            ...keeping.map((c) => ({
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
          ],
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
            <Text style={[styles.label, { color: palette.muted }]}>
              Where, and how long in each
              {asked.length > 1 ? ` — ${total} ${total === 1 ? "day" : "days"} altogether` : ""}
            </Text>

            {legs.map((leg, i) => (
              <View key={`leg-${i}`} style={styles.leg}>
                <TextInput
                  value={leg.city}
                  onChangeText={(city) => setLeg(i, { city })}
                  placeholder={i === 0 ? "Lisbon" : "Then where?"}
                  placeholderTextColor={palette.muted}
                  autoCorrect={false}
                  style={[
                    styles.input,
                    styles.legCity,
                    { color: palette.ink, borderColor: palette.border },
                  ]}
                />
                <TextInput
                  value={leg.days}
                  onChangeText={(days) => setLeg(i, { days })}
                  keyboardType="number-pad"
                  accessibilityLabel={`Days in ${leg.city || "this city"}`}
                  style={[
                    styles.input,
                    styles.legDays,
                    { color: palette.ink, borderColor: palette.border },
                  ]}
                />
                <Text style={{ color: palette.muted, fontSize: 12, width: 30 }}>
                  {Number(leg.days) === 1 ? "day" : "days"}
                </Text>
                {/* Only once there is more than one, so the ordinary trip to
                    one city never grows a control for undoing something it
                    did not do. */}
                {legs.length > 1 && (
                  <Pressable
                    onPress={() => setLegs((current) => current.filter((_, j) => j !== i))}
                    hitSlop={10}
                    accessibilityLabel={`Remove ${leg.city || "this city"}`}
                  >
                    <Text style={{ color: palette.muted, fontSize: 17 }}>×</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <Pressable
              onPress={() => setLegs((current) => [...current, { city: "", days: "2" }])}
              hitSlop={8}
              style={styles.addCity}
            >
              <Text style={{ color: palette.primary, fontSize: 13, fontWeight: "600" }}>
                + Add another city
              </Text>
            </Pressable>

            {/* The handful of answers that change the shape of an itinerary
                rather than its details. Free text below covers the details. */}
            <Text style={[styles.label, { color: palette.muted, marginTop: 18 }]}>
              When{end ? ` — through ${end}` : ""}
            </Text>
            {/* One date, not a range: the days above already say how long it
                runs, and asking twice invites the two to disagree. */}
            <DateRangePicker
              single
              start={start}
              end={start}
              emptyHint="Tap the first day, or leave it for a trip with no dates."
              onChange={(next) => setStart(next.start)}
            />

            <Text style={[styles.label, { color: palette.muted, marginTop: 18 }]}>
              What kind of trip
            </Text>
            <View style={styles.chips}>
              {TRIP_STYLES.map((kind) => {
                const on = kinds.includes(kind.id);
                return (
                  <Pressable
                    key={kind.id}
                    onPress={() =>
                      setKinds((current) =>
                        on ? current.filter((id) => id !== kind.id) : [...current, kind.id],
                      )
                    }
                    style={[
                      styles.chip,
                      {
                        borderColor: on ? palette.primary : palette.border,
                        backgroundColor: on ? palette.brandSurface : "transparent",
                      },
                    ]}
                  >
                    <Text style={{ color: palette.ink, fontSize: 13 }}>{kind.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={interests}
              onChangeText={setInterests}
              placeholder="Anything else (optional)"
              placeholderTextColor={palette.muted}
              style={[
                styles.input,
                { color: palette.ink, borderColor: palette.border, marginTop: 18 },
              ]}
            />

            <Text style={[styles.label, { color: palette.muted }]}>Pace</Text>
            <View style={styles.chips}>
              {(["relaxed", "balanced", "packed"] as const).map((id) => (
                <Pressable
                  key={id}
                  onPress={() => setPace(id)}
                  style={[
                    styles.chip,
                    {
                      borderColor: pace === id ? palette.primary : palette.border,
                      backgroundColor: pace === id ? palette.brandSurface : "transparent",
                    },
                  ]}
                >
                  <Text style={{ color: palette.ink, fontSize: 13, textTransform: "capitalize" }}>
                    {id}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tooLong && (
              <Text style={{ color: palette.muted, fontSize: 12, marginTop: 14 }}>
                That&apos;s {total} days — a fortnight is the most it will draft at once.
              </Text>
            )}

            <Pressable
              onPress={draft}
              disabled={asked.length === 0 || tooLong}
              style={[
                styles.primary,
                {
                  backgroundColor: palette.primary,
                  opacity: asked.length === 0 || tooLong ? 0.5 : 1,
                },
              ]}
            >
              <Text style={{ color: palette.onPrimary, fontWeight: "600", fontSize: 15 }}>
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

            {/* The journeys, shown rather than hidden: a plan that moves
                between cities has a morning on a train in it, and somebody
                should see that before they save it. Nothing to tick — both
                ends are cities they already typed. */}
            {journeys.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ color: palette.muted, fontSize: 12, marginBottom: 6 }}>
                  Getting between them
                </Text>
                {journeys.map((j, i) => (
                  <View
                    key={`leg-${i}`}
                    style={[styles.row, { borderColor: palette.border }]}
                  >
                    <Text style={{ fontSize: 16 }}>
                      {TRAVEL_MODES.find((m) => m.id === j.mode)?.icon ?? "🚆"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.ink, fontSize: 14 }} numberOfLines={1}>
                        Day {j.day} · {j.from} → {j.to}
                      </Text>
                      <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
                        {[j.departs && j.arrives ? `${j.departs}–${j.arrives}` : null,
                          cities[j.to] === null ? "the map could not place this one" : null,
                          j.note]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {journeys.length > 0 && (
              <Text style={{ color: palette.muted, fontSize: 12, marginTop: 14, marginBottom: 2 }}>
                The places
              </Text>
            )}

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
                  { borderColor: c.keep && c.match ? palette.primary : palette.border },
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
                { backgroundColor: palette.primary, opacity: saving || keeping === 0 ? 0.5 : 1 },
              ]}
            >
              <Text style={{ color: palette.onPrimary, fontWeight: "600", fontSize: 15 }}>
                {saving
                  ? "Saving…"
                  : journeys.length > 0
                    ? `Create trip with ${keeping} stops and ${journeys.length} ${journeys.length === 1 ? "journey" : "journeys"}`
                    : `Create trip with ${keeping} stops`}
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
  label: { fontSize: 12, marginBottom: 8, marginTop: 4 },
  leg: { flexDirection: "row", alignItems: "center", gap: 8 },
  legCity: { flex: 1 },
  legDays: { width: 58, textAlign: "center" },
  addCity: { paddingVertical: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
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
