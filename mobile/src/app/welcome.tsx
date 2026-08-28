/// The app's welcome, matching the website's: what this is, a username, and
/// one real place saved before you arrive.
///
/// The app had none at all, which meant somebody who signed up on their phone —
/// most people, given Sign in with Apple — landed on an empty map with no idea
/// what to do with it.
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Place, type SearchResult } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePalette } from "@/lib/use-palette";
import { usePlaceSearch } from "@/lib/use-place-search";
import { searchPlaces } from "@/lib/search-places";
import { category as categoryOf } from "@/lib/taxonomy";
import {
  BeenIcon,
  MapIcon,
  PlacesIcon,
  TripsIcon,
  YourProfileIcon,
} from "@/components/nav-icons";

/// Each card carries the icon of the tab where that thing actually happens, so
/// the tour teaches the navigation while it explains the features — and matches
/// the website card for card.
const TOUR = [
  { Icon: MapIcon, title: "Save places", body: "Anywhere you want to go, or have been." },
  { Icon: TripsIcon, title: "Plan trips", body: "Day by day, with the map alongside." },
  { Icon: BeenIcon, title: "Keep a map", body: "Everywhere you've been, counted." },
];

export default function WelcomeScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();

  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(user?.username ?? "");
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const { results, searching } = usePlaceSearch(query, searchPlaces);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api("/api/me", { method: "PATCH", body: JSON.stringify(body) });
      return true;
    } catch (e) {
      Alert.alert("That didn't save", e instanceof Error ? e.message : "Try again");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function savePlace(result: SearchResult, status: "wishlist" | "visited") {
    try {
      await api<{ place: Place }>("/api/places", {
        method: "POST",
        body: JSON.stringify({
          name: result.name,
          lat: result.lat,
          lng: result.lng,
          category: result.category,
          status,
          address: result.address,
          city: result.city,
          country: result.country,
          countryCode: result.countryCode,
        }),
      });
      setSaved((current) => [...current, result.name]);
      setQuery("");
    } catch {
      Alert.alert("Could not save that place", "Try another one");
    }
  }

  /// Marks the welcome as seen, which is what lets the tabs render.
  async function finish() {
    if (await patch({ onboarded: true })) updateUser({ onboarded: true });
  }

  const heading = { color: palette.ink };
  const body = { color: palette.muted };

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={[
        styles.page,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {step === 0 && (
        <>
          <Image source={require("../../assets/images/icon.png")} style={styles.mark} />
          <Text style={[styles.title, heading]}>
            {user?.name ? `Welcome, ${user.name.split(" ")[0]}` : "Welcome to Roava"}
          </Text>
          <Text style={[styles.body, body]}>
            A map of the places you want to go and the ones you&apos;ve been.
          </Text>

          {TOUR.map((t) => (
            <View key={t.title} style={[styles.card, { borderColor: palette.border }]}>
              <t.Icon size={22} color={palette.accentText} />
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, heading]}>{t.title}</Text>
                <Text style={[styles.cardBody, body]}>{t.body}</Text>
              </View>
            </View>
          ))}

          <Primary label="Get started" onPress={() => setStep(1)} palette={palette} />
        </>
      )}

      {step === 1 && (
        <>
          <YourProfileIcon size={34} color={palette.accentText} />
          <Text style={[styles.title, heading]}>Pick a username</Text>
          <Text style={[styles.body, body]}>
            It&apos;s how friends find and follow you. Without one you don&apos;t
            appear anywhere — which is fine if that&apos;s what you want.
          </Text>

          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="yourname"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.ink, borderColor: palette.border }]}
          />

          <Primary
            label={busy ? "Saving…" : "That's my name"}
            disabled={busy || username.trim().length < 3}
            palette={palette}
            onPress={async () => {
              if (await patch({ username: username.trim().toLowerCase() })) {
                updateUser({ username: username.trim().toLowerCase() });
                setStep(2);
              }
            }}
          />
          <Ghost label="Skip for now" onPress={() => setStep(2)} palette={palette} />
        </>
      )}

      {step === 2 && (
        <>
          <PlacesIcon size={34} color={palette.accentText} />
          <Text style={[styles.title, heading]}>Put something on your map</Text>
          <Text style={[styles.body, body]}>
            Anywhere at all — a city you loved, a restaurant you keep meaning to
            try. It&apos;s nicer to arrive at a map with something on it.
          </Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search anywhere in the world…"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.ink, borderColor: palette.border }]}
          />
          {searching && <ActivityIndicator style={{ marginTop: 8 }} />}

          {results.slice(0, 5).map((r: SearchResult) => (
            <View key={r.id} style={[styles.result, { borderColor: palette.border }]}>
              <Text style={[styles.resultName, heading]} numberOfLines={1}>
                {categoryOf(r.category).icon} {r.name}
              </Text>
              <Text style={[styles.cardBody, body]} numberOfLines={1}>
                {[r.city, r.country].filter(Boolean).join(", ")}
              </Text>
              <View style={styles.resultActions}>
                <Pressable
                  style={[styles.small, { borderColor: palette.border }]}
                  onPress={() => void savePlace(r, "wishlist")}
                >
                  <Text style={{ color: palette.ink, fontSize: 13 }}>🔖 Want to go</Text>
                </Pressable>
                <Pressable
                  style={[styles.small, { borderColor: palette.border }]}
                  onPress={() => void savePlace(r, "visited")}
                >
                  <Text style={{ color: palette.ink, fontSize: 13 }}>✅ Been there</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {saved.map((name, i) => (
            <Text key={`${name}-${i}`} style={[styles.cardBody, body, { marginTop: 4 }]}>
              ✓ {name} — saved
            </Text>
          ))}

          <Primary
            label={saved.length === 0 ? "Save one to continue" : "Show me my map"}
            disabled={saved.length === 0 || busy}
            palette={palette}
            onPress={finish}
          />
          <Ghost label="Skip — I'll add places later" onPress={finish} palette={palette} />
        </>
      )}

      {step > 0 && (
        <Text style={[styles.stepCount, body]}>Step {step + 1} of 3</Text>
      )}
    </ScrollView>
  );
}

type Palette = ReturnType<typeof usePalette>;

function Primary({
  label,
  onPress,
  palette,
  disabled,
}: {
  label: string;
  onPress: () => void;
  palette: Palette;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primary, { backgroundColor: palette.accent, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={{ color: palette.onAccent, fontWeight: "600", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function Ghost({
  label,
  onPress,
  palette,
}: {
  label: string;
  onPress: () => void;
  palette: Palette;
}) {
  return (
    <Pressable onPress={onPress} style={styles.ghost}>
      <Text style={{ color: palette.muted, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 22, gap: 4 },
  mark: { width: 64, height: 64, borderRadius: 14 },
  title: { fontSize: 24, fontWeight: "700", marginTop: 12 },
  body: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  card: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  cardBody: { fontSize: 12, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 16,
  },
  result: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
  resultName: { fontSize: 14, fontWeight: "500" },
  resultActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  small: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  primary: {
    marginTop: 20,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 14,
  },
  ghost: { marginTop: 10, alignItems: "center", paddingVertical: 8 },
  stepCount: { fontSize: 12, textAlign: "center", marginTop: 20 },
});
