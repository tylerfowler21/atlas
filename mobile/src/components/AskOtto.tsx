import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Otto, { OTTO_FOR } from "@/components/Otto";
import { api } from "@/lib/api";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

/// Asking Otto to fill an empty day.
///
/// He proposes and never writes. What comes back is a list of entries in the
/// shape the importer already takes, so this shows them the way a pasted
/// itinerary is shown — every row with a tick beside it — and posts only the
/// ones still ticked. Nothing reaches the trip that somebody did not look at.
///
/// The website has had this since he was built; the phone has not, which is
/// the wrong way round for the thing somebody does sitting on a hotel bed with
/// a day going spare tomorrow.

type OttoPlace = {
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
};

type OttoEntry = {
  kind: "stop" | "travel";
  dayIndex: number;
  title: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  category: string;
  mode: string | null;
  place: OttoPlace | null;
  toPlace: OttoPlace | null;
};

export default function AskOtto({
  tripId,
  dayIndex,
  onApplied,
}: {
  tripId: string;
  dayIndex: number;
  onApplied: () => void;
}) {
  const palette = usePalette();
  const [stage, setStage] = useState<"offering" | "asking" | "reviewing" | "saving">("offering");
  const [say, setSay] = useState("");
  const [entries, setEntries] = useState<OttoEntry[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [remaining, setRemaining] = useState<number | null>(null);
  const [failed, setFailed] = useState("");

  async function ask() {
    setStage("asking");
    setFailed("");
    try {
      const body = await api<{ say: string; entries: OttoEntry[]; remaining?: number }>(
        `/api/trips/${tripId}/otto`,
        { method: "POST", body: JSON.stringify({ dayIndex }) },
      );
      setSay(body.say);
      setEntries(body.entries);
      setChosen(new Set(body.entries.map((_, i) => i)));
      if (typeof body.remaining === "number") setRemaining(body.remaining);
      setStage("reviewing");
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "He could not finish that.");
      setStage("offering");
    }
  }

  async function keep() {
    const taking = entries.filter((_, i) => chosen.has(i));
    if (taking.length === 0) {
      setEntries([]);
      setStage("offering");
      return;
    }
    setStage("saving");
    setFailed("");
    try {
      await api("/api/trips/import", {
        method: "POST",
        // A day being planned is a day nobody has been to yet.
        body: JSON.stringify({ tripId, markVisited: false, entries: taking }),
      });
      setEntries([]);
      setStage("offering");
      onApplied();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Could not add those.");
      setStage("reviewing");
    }
  }

  return (
    <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <View style={styles.head}>
        {/* He reacts to the answer rather than standing there the same way
            throughout: thinking while he looks, and afterwards either the
            pose for having found something or the one for having found
            nothing. The names come from the shared mapping so this does not
            have to know which drawing is which. */}
        <Otto
          pose={
            stage === "asking"
              ? OTTO_FOR.thinking
              : stage === "reviewing" || stage === "saving"
                ? entries.length === 0
                  ? OTTO_FOR.empty
                  : OTTO_FOR.found
                : OTTO_FOR.resting
          }
        />
        <View style={styles.words}>
          {stage === "offering" && !failed && (
            <Text style={[type.meta, { color: palette.muted }]}>
              Nothing on this day yet. Otto can read the days either side and
              find real places near where you already are.
            </Text>
          )}
          {stage === "asking" && (
            <Text style={[type.meta, { color: palette.muted }]}>Looking…</Text>
          )}
          {(stage === "reviewing" || stage === "saving") && say ? (
            <Text style={[type.body, { color: palette.ink }]}>{say}</Text>
          ) : null}
          {failed ? <Text style={[type.meta, styles.failed]}>{failed}</Text> : null}
        </View>
      </View>

      {(stage === "reviewing" || stage === "saving") &&
        entries.map((entry, i) => (
          <Pressable
            key={`${entry.title}-${i}`}
            onPress={() =>
              setChosen((was) => {
                const next = new Set(was);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              })
            }
            style={styles.entry}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: chosen.has(i) }}
          >
            <Text style={{ fontSize: 18 }}>{chosen.has(i) ? "☑️" : "⬜️"}</Text>
            <View style={styles.words}>
              <Text style={[type.body, { color: palette.ink }]}>
                {entry.startTime ? `${entry.startTime} · ` : ""}
                {entry.title}
              </Text>
              {entry.place?.city ? (
                <Text style={[type.meta, { color: palette.muted }]}>{entry.place.city}</Text>
              ) : null}
              {entry.notes ? (
                <Text style={[type.meta, { color: palette.muted }]}>{entry.notes}</Text>
              ) : null}
            </View>
          </Pressable>
        ))}

      <View style={styles.actions}>
        {stage === "offering" && (
          <Pressable
            onPress={() => void ask()}
            style={[styles.button, { backgroundColor: palette.primary }]}
          >
            <Text style={[type.button, { color: palette.onPrimary }]}>
              Fill day {dayIndex + 1}
            </Text>
          </Pressable>
        )}

        {stage === "reviewing" && entries.length > 0 && (
          <>
            <Pressable
              onPress={() => void keep()}
              style={[styles.button, { backgroundColor: palette.primary }]}
            >
              <Text style={[type.button, { color: palette.onPrimary }]}>
                Add {chosen.size} {chosen.size === 1 ? "stop" : "stops"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setEntries([]);
                setStage("offering");
              }}
              hitSlop={8}
            >
              <Text style={[type.metaStrong, { color: palette.muted }]}>Discard</Text>
            </Pressable>
          </>
        )}

        {stage === "reviewing" && entries.length === 0 && (
          <Text style={[type.meta, { color: palette.muted }]}>
            He found nothing worth putting here.
          </Text>
        )}

        {stage === "saving" && <Text style={[type.meta, { color: palette.muted }]}>Adding…</Text>}

        {/* Said while deciding whether to spend one, which is the only moment
            the number matters. */}
        {remaining !== null && stage === "offering" && (
          <Text style={[type.meta, { color: palette.muted }]}>{remaining} left this month</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 10, gap: 8 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  words: { flex: 1, gap: 2, paddingTop: 2 },
  entry: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
  actions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4 },
  button: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderRadius: 22 },
  failed: { color: "#D65A4A" },
});
