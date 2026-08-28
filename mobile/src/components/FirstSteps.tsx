/// The website's first-steps list, in the app.
///
/// The same five steps, counted from the same data by the same endpoint, so
/// doing one on the phone ticks it off on the website and the other way round.
import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/lib/api";
import { usePalette } from "@/lib/use-palette";

type Step = { id: string; label: string; hint: string; done: boolean; href: string };
type Steps = { steps: Step[]; done: number; total: number; hidden: boolean };

/// Where each step happens in the app, which is not where it happens on the
/// website — the app has tabs, not routes.
const DESTINATIONS = {
  save: "/",
  been: "/",
  trip: "/trips",
  stop: "/trips",
  share: "/trips",
} as const satisfies Record<string, "/" | "/trips">;

type StepId = keyof typeof DESTINATIONS;

export default function FirstSteps() {
  const palette = usePalette();
  const router = useRouter();
  const [steps, setSteps] = useState<Steps | null>(null);
  const [open, setOpen] = useState(true);

  // Re-counted whenever the map comes back into view, so a place saved on
  // another tab is already ticked off by the time you return.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const found = await api<Steps>("/api/first-steps");
          if (!cancelled) setSteps(found);
        } catch {
          // A checklist is not worth an error message.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!steps || steps.hidden) return null;

  async function hide() {
    setSteps((current) => (current ? { ...current, hidden: true } : current));
    try {
      await api("/api/first-steps", { method: "DELETE" });
    } catch {
      // Hidden for this session either way.
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <Pressable style={styles.headerMain} onPress={() => setOpen((v) => !v)}>
          <Text style={{ color: palette.muted, fontSize: 12 }}>{open ? "▾" : "▸"}</Text>
          <Text style={[styles.title, { color: palette.ink }]}>First steps</Text>
          <Text style={{ color: palette.muted, fontSize: 12 }}>
            {steps.done} of {steps.total}
          </Text>
        </Pressable>
        <Pressable onPress={() => void hide()} hitSlop={8}>
          <Text style={{ color: palette.muted, fontSize: 12 }}>Hide</Text>
        </Pressable>
      </View>

      {open &&
        steps.steps.map((step) => (
          <Pressable
            key={step.id}
            style={[styles.row, { borderTopColor: palette.border }]}
            onPress={() => router.push(DESTINATIONS[step.id as StepId] ?? "/")}
          >
            <Text style={{ fontSize: 13 }}>{step.done ? "✅" : "⬜️"}</Text>
            <View style={styles.rowText}>
              <Text
                style={[
                  styles.rowLabel,
                  { color: palette.ink },
                  step.done && { textDecorationLine: "line-through", opacity: 0.55 },
                ]}
              >
                {step.label}
              </Text>
              {!step.done && (
                <Text style={[styles.rowHint, { color: palette.muted }]}>{step.hint}</Text>
              )}
            </View>
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden", marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  headerMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: 1 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 13 },
  rowHint: { fontSize: 11, marginTop: 2 },
});
