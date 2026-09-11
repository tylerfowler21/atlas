/// Adding the places from a reel to the day you are looking at.
///
/// This is the whole point of the feature being on a phone: you see the video
/// on a phone, so the places should go in from a phone. The website could do
/// it, which meant copying a link, leaving the app, finding a browser, signing
/// in and finding the trip again — six steps for something that should be one.
///
/// The checking is not skipped for being on a small screen. Every place the
/// caption named is looked up against a real gazetteer and shown with what
/// came back. A model reading somebody's caption is a rough process, and
/// nothing reaches a trip on its say-so.
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
import { api, type SearchResult, type Trip } from "@/lib/api";
import { searchPlaces } from "@/lib/search-places";
import { usePalette } from "@/lib/use-palette";
import { dayLabel } from "@/lib/dates";

type Found = {
  title: string;
  note: string | null;
  match: SearchResult | null;
  keep: boolean;
};

/// TikTok is the only one that parts with a caption, so anything else asks
/// for a paste rather than failing after a round trip.
function needsPastedCaption(url: string) {
  const value = url.trim();
  return value.length > 12 && !/tiktok\.com/i.test(value);
}

export default function AddFromLink({
  trip,
  days,
  activeDay,
  region,
  initialUrl,
  onClose,
  onAdded,
}: {
  trip: Trip;
  days: number;
  /// The day the person was looking at, which is nearly always the one they
  /// mean.
  activeDay: number;
  region: string[] | string | null;
  /// A link that arrived from the share sheet, already filled in, so the only
  /// thing left to say is which day it belongs to.
  initialUrl?: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const palette = usePalette();
  const [day, setDay] = useState(Math.max(0, activeDay));
  const [url, setUrl] = useState(initialUrl ?? "");
  const [caption, setCaption] = useState("");
  const [needsCaption, setNeedsCaption] = useState(
    initialUrl ? needsPastedCaption(initialUrl) : false,
  );
  const [rows, setRows] = useState<Found[] | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function read() {
    setBusy(true);
    setNote(null);
    try {
      const body = await api<{
        needsCaption?: boolean;
        error?: string;
        count?: number;
        text?: string;
      }>("/api/import/link", {
        method: "POST",
        body: JSON.stringify({
          url: url.trim() || undefined,
          caption: caption.trim() || undefined,
        }),
      });

      if (body.needsCaption) {
        setNeedsCaption(true);
        setNote(body.error ?? null);
        return;
      }
      if (!body.count) {
        setNote("No places in that one — the caption may not name any.");
        return;
      }
      await check(body.text ?? "");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not read that");
    } finally {
      setBusy(false);
    }
  }

  /// Each name against a real map, one at a time — the geocoders behind this
  /// allow about a request a second, and the progress is worth seeing.
  async function check(text: string) {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setProgress({ done: 0, total: lines.length });
    const found: Found[] = [];

    for (const [i, line] of lines.entries()) {
      const [namePart, ...rest] = line.split(" — ");
      const name = (namePart ?? line).trim();
      let match: SearchResult | null = null;
      try {
        const hits = await searchPlaces(name, "full", region);
        match = hits[0] ?? null;
      } catch {
        // A failed lookup reads the same as one that found nothing: the row
        // stays, unmatched, for somebody to decide about.
      }
      found.push({
        title: name,
        note: rest.join(" — ").trim() || null,
        match,
        keep: match !== null,
      });
      setProgress({ done: i + 1, total: lines.length });
      setRows([...found]);
    }
  }

  async function add() {
    const keeping = (rows ?? []).filter((r) => r.keep && r.match);
    if (keeping.length === 0) return;

    setBusy(true);
    try {
      await api("/api/trips/import", {
        method: "POST",
        body: JSON.stringify({
          tripId: trip.id,
          // A trip being planned collects places you want to go, not ones you
          // have been to.
          markVisited: false,
          entries: keeping.map((r) => ({
            dayIndex: day,
            title: r.title,
            startTime: null,
            notes: r.note,
            category: r.match!.category,
            place: {
              name: r.match!.name,
              lat: r.match!.lat,
              lng: r.match!.lng,
              address: r.match!.address,
              city: r.match!.city,
              country: r.match!.country,
              countryCode: r.match!.countryCode,
            },
          })),
        }),
      });
      onAdded();
      onClose();
    } catch (e) {
      Alert.alert("Could not add those", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  const keeping = (rows ?? []).filter((r) => r.keep && r.match).length;
  const field = { color: palette.ink, borderColor: palette.border };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={styles.sheet}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: palette.ink }]}>Add from TikTok</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: palette.muted, fontSize: 15 }}>Close</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { color: palette.muted }]}>Which day</Text>
        <View style={styles.days}>
          {Array.from({ length: days }, (_, i) => (
            <Pressable
              key={i}
              onPress={() => setDay(i)}
              style={[styles.dayChip, { borderColor: day === i ? palette.accent : palette.border }]}
            >
              <Text style={{ fontSize: 13, color: palette.ink }}>{dayLabel(trip, i)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: palette.muted }]}>Link</Text>
        <TextInput
          value={url}
          onChangeText={(next) => {
            setUrl(next);
            if (needsPastedCaption(next)) setNeedsCaption(true);
          }}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="Paste a TikTok link"
          placeholderTextColor={palette.muted}
          style={[styles.input, field]}
        />

        {needsCaption && (
          <>
            <Text style={[styles.label, { color: palette.muted }]}>Caption</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              multiline
              placeholder="Paste the caption — the text under the video"
              placeholderTextColor={palette.muted}
              style={[styles.input, styles.caption, field]}
            />
          </>
        )}

        {note && <Text style={{ color: palette.muted, fontSize: 12, marginTop: 8 }}>{note}</Text>}

        <Pressable
          onPress={read}
          disabled={busy || (!url.trim() && !caption.trim())}
          style={[
            styles.primary,
            {
              backgroundColor: palette.accent,
              opacity: busy || (!url.trim() && !caption.trim()) ? 0.5 : 1,
            },
          ]}
        >
          <Text style={{ color: palette.onAccent, fontWeight: "600", fontSize: 15 }}>
            {busy ? "Reading…" : needsCaption ? "Read this caption" : "Read this link"}
          </Text>
        </Pressable>

        {progress.total > 0 && progress.done < progress.total && (
          <View style={styles.waiting}>
            <ActivityIndicator />
            <Text style={{ color: palette.muted, fontSize: 13, marginTop: 8 }}>
              Checking place {progress.done} of {progress.total} against the map…
            </Text>
          </View>
        )}

        {rows?.map((row, i) => (
          <Pressable
            key={`${row.title}-${i}`}
            onPress={() =>
              row.match &&
              setRows((all) => all!.map((r, j) => (i === j ? { ...r, keep: !r.keep } : r)))
            }
            style={[
              styles.row,
              { borderColor: row.keep && row.match ? palette.accent : palette.border },
              !row.match && { opacity: 0.55 },
            ]}
          >
            <Text style={{ fontSize: 16 }}>{row.match ? (row.keep ? "☑️" : "⬜️") : "⚠️"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.ink, fontSize: 14 }} numberOfLines={1}>
                {row.title}
              </Text>
              <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
                {row.match
                  ? (row.match.address ?? row.match.city ?? row.match.name)
                  : "Not found on the map"}
              </Text>
            </View>
          </Pressable>
        ))}

        {rows && rows.length > 0 && (
          <Pressable
            onPress={add}
            disabled={busy || keeping === 0}
            style={[
              styles.primary,
              { backgroundColor: palette.accent, opacity: busy || keeping === 0 ? 0.5 : 1 },
            ]}
          >
            <Text style={{ color: palette.onAccent, fontWeight: "600", fontSize: 15 }}>
              Add {keeping} to {dayLabel(trip, day)}
            </Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: 18, paddingBottom: 40 },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  title: { flex: 1, fontSize: 20, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  caption: { minHeight: 90, textAlignVertical: "top" },
  primary: { marginTop: 18, borderRadius: 10, alignItems: "center", paddingVertical: 14 },
  waiting: { alignItems: "center", paddingVertical: 20 },
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
