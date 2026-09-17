import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Otto from "@/components/Otto";
import { api } from "@/lib/api";
import { PACKING_KIND } from "@/lib/resources";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

/// Otto, asked what to pack.
///
/// The same bargain as everywhere else he works: he suggests, you tick, and
/// only the ticked ones are saved. A packing list is the mildest thing in the
/// app to get wrong — a row nobody wanted is one tap to remove — but the rule
/// is not about stakes. Somebody who has once had a list rearranged without
/// being asked stops trusting whatever did it.

type Suggested = { label: string; because: string | null };

export default function AskOttoToPack({
  tripId,
  onAdded,
}: {
  tripId: string;
  onAdded: () => void;
}) {
  const palette = usePalette();
  const [stage, setStage] = useState<"offering" | "thinking" | "reviewing" | "saving">("offering");
  const [say, setSay] = useState("");
  const [items, setItems] = useState<Suggested[]>([]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [remaining, setRemaining] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function ask() {
    setStage("thinking");
    setFailed(null);
    try {
      const body = await api<{ say: string; items: Suggested[]; remaining?: number }>(
        `/api/trips/${tripId}/packing`,
        { method: "POST" },
      );
      setSay(body.say);
      setItems(body.items);
      // Everything ticked to begin with: he was asked, and a list that arrives
      // switched off makes somebody do the work twice.
      setChosen(new Set(body.items.map((_, i) => i)));
      if (typeof body.remaining === "number") setRemaining(body.remaining);
      setStage("reviewing");
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "That didn't work");
      setStage("offering");
    }
  }

  async function keep() {
    setStage("saving");
    const wanted = items.filter((_, i) => chosen.has(i));
    let saved = 0;
    try {
      // One at a time, in order, so they land in the order he suggested them
      // rather than whichever request came back first.
      for (const item of wanted) {
        await api(`/api/trips/${tripId}/resources`, {
          method: "POST",
          body: JSON.stringify({ label: item.label, kind: PACKING_KIND }),
        });
        saved += 1;
      }
      setItems([]);
      setStage("offering");
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Could not add those");
      setStage("reviewing");
    } finally {
      // Whatever did save stays saved, so the list is re-read either way.
      if (saved > 0) onAdded();
    }
  }

  return (
    <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <View style={styles.row}>
        <Otto pose={stage === "thinking" ? "thinking" : "planning"} />
        <View style={styles.words}>
          {stage === "offering" && (
            <Text style={[type.meta, { color: palette.muted }]}>
              Otto can suggest what this trip needs — where it goes, what the
              weather does there, and what you already have on the list.
            </Text>
          )}

          {stage === "thinking" && (
            <Text style={[type.meta, { color: palette.muted }]}>Thinking…</Text>
          )}

          {(stage === "reviewing" || stage === "saving") && (
            <>
              {say ? <Text style={[type.body, { color: palette.ink }]}>{say}</Text> : null}
              {items.length === 0 && (
                <Text style={[type.meta, { color: palette.muted }]}>
                  Nothing to add — the list already covers it.
                </Text>
              )}
            </>
          )}
        </View>
      </View>

      {(stage === "reviewing" || stage === "saving") &&
        items.map((item, i) => (
          <Pressable
            key={`${item.label}-${i}`}
            style={styles.suggestion}
            onPress={() =>
              setChosen((was) => {
                const next = new Set(was);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                return next;
              })
            }
            accessibilityRole="checkbox"
            accessibilityState={{ checked: chosen.has(i) }}
          >
            <Text style={{ fontSize: 18 }}>{chosen.has(i) ? "☑️" : "⬜️"}</Text>
            <View style={styles.words}>
              <Text style={[type.body, { color: palette.ink }]}>{item.label}</Text>
              {item.because ? (
                <Text style={[type.meta, { color: palette.muted }]}>{item.because}</Text>
              ) : null}
            </View>
          </Pressable>
        ))}

      {failed ? <Text style={[type.meta, styles.failed]}>{failed}</Text> : null}

      <View style={styles.actions}>
        {stage === "offering" && (
          <Pressable
            onPress={() => void ask()}
            style={[styles.button, { backgroundColor: palette.primary }]}
          >
            <Text style={[type.button, { color: palette.onPrimary }]}>
              Ask Otto what to pack
            </Text>
          </Pressable>
        )}

        {stage === "reviewing" && items.length > 0 && (
          <>
            <Pressable
              onPress={() => void keep()}
              style={[styles.button, { backgroundColor: palette.primary }]}
            >
              <Text style={[type.button, { color: palette.onPrimary }]}>
                Add {chosen.size} {chosen.size === 1 ? "thing" : "things"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setItems([]);
                setStage("offering");
              }}
              hitSlop={8}
            >
              <Text style={[type.metaStrong, { color: palette.muted }]}>Discard</Text>
            </Pressable>
          </>
        )}

        {stage === "saving" && (
          <Text style={[type.meta, { color: palette.muted }]}>Adding…</Text>
        )}

        {remaining !== null && stage === "offering" && (
          <Text style={[type.meta, { color: palette.muted }]}>{remaining} left this month</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 12, gap: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  words: { flex: 1, gap: 2, paddingTop: 2 },
  suggestion: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
  actions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4 },
  button: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderRadius: 22 },
  failed: { color: "#D65A4A" },
});
