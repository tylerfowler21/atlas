/// Somebody else's profile.
///
/// The People tab has been a list of Follow buttons: you could follow a
/// stranger but never find out who they were first. This is the page behind
/// the name — what they say about themselves, where they are based, and the
/// trips they chose to publish.
///
/// Everything here is already public to anyone holding the handle. Saved
/// places, private trips and anything unpublished stay where they are.
import { useCallback, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, type FeedTrip } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";
import { formatDay } from "@/lib/dates";
import { tripWhere } from "@/lib/trip-where";
import { RADIUS } from "@/lib/brand";
import { type } from "@/lib/type";
import { REPORT_REASONS } from "@/lib/report-reasons";

type Profile = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  bio: string | null;
  homeCity: string | null;
  wantsToGo: string | null;
  travelStyle: string | null;
  followers: number;
  following: number;
  isFollowing: boolean;
  isSelf: boolean;
};

function dates(trip: FeedTrip) {
  if (!trip.startDate) return null;
  if (!trip.endDate) return formatDay(trip.startDate);
  return `${formatDay(trip.startDate, { year: undefined })} – ${formatDay(trip.endDate)}`;
}

export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { data, error, loading, reload } = useApi<{ profile: Profile; trips: FeedTrip[] }>(
    `/api/people/${username}`,
  );
  const palette = usePalette();
  const router = useRouter();
  /// Following is answered here rather than waiting for a reload: the button
  /// is the whole reason somebody opened this, and a second of "did that
  /// work?" is worse than being briefly wrong.
  const [followingNow, setFollowingNow] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const profile = data?.profile;
  const following = followingNow ?? profile?.isFollowing ?? false;

  const toggleFollow = useCallback(async () => {
    if (!profile?.username) return;
    const next = !following;
    setBusy(true);
    setFollowingNow(next);
    try {
      await api("/api/follow", {
        method: next ? "POST" : "DELETE",
        body: JSON.stringify({ username: profile.username }),
      });
    } catch (e) {
      setFollowingNow(!next);
      Alert.alert("Could not do that", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }, [following, profile]);

  /// Report and block, on the person, where anyone would look for them — and
  /// where the App Store expects to find them.
  const moderate = useCallback(() => {
    if (!profile?.username) return;
    const name = profile.name ?? `@${profile.username}`;

    ActionSheetIOS.showActionSheetWithOptions(
      { title: name, options: ["Cancel", "Report", "Block"], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
      (chosen) => {
        if (chosen === 1) {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: `Report ${name}`,
              message: "Nothing is shared with them.",
              options: ["Cancel", ...REPORT_REASONS.map((r) => r.label)],
              cancelButtonIndex: 0,
            },
            async (pick) => {
              if (pick === 0) return;
              const reason = REPORT_REASONS[pick - 1];
              if (!reason) return;
              try {
                await api("/api/report", {
                  method: "POST",
                  body: JSON.stringify({ reason: reason.id, username: profile.username }),
                });
                Alert.alert("Reported", "Thank you — this has been sent for review.");
              } catch (e) {
                Alert.alert("Could not report", e instanceof Error ? e.message : "Try again");
              }
            },
          );
        }
        if (chosen === 2) {
          Alert.alert(
            `Block ${name}?`,
            "Neither of you will see the other's profile or published trips, and any follows between you are removed.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: async () => {
                  try {
                    await api("/api/block", {
                      method: "POST",
                      body: JSON.stringify({ username: profile.username }),
                    });
                    router.back();
                  } catch (e) {
                    Alert.alert("Could not block", e instanceof Error ? e.message : "Try again");
                  }
                },
              },
            ],
          );
        }
      },
    );
  }, [profile, router]);

  if (loading && !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.muted }}>{error ?? "No such person."}</Text>
      </View>
    );
  }

  const title = profile.name ?? (profile.username ? `@${profile.username}` : "Profile");
  const trips = data?.trips ?? [];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title, headerBackTitle: "Back" }} />
      <ScrollView
        style={[styles.fill, { backgroundColor: palette.background }]}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
      >
        <View style={styles.head}>
          {profile.image ? (
            <Image source={{ uri: profile.image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.initial, { backgroundColor: palette.border }]}>
              <Text style={[type.item, { color: palette.ink }]}>
                {title.replace("@", "").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={[type.section, { color: palette.ink }]} numberOfLines={1}>
              {profile.name ?? `@${profile.username}`}
            </Text>
            <Text style={[type.meta, { color: palette.muted }]} numberOfLines={1}>
              {[profile.name && profile.username ? `@${profile.username}` : null, profile.homeCity]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>

        {profile.bio && (
          <Text style={[type.body, { color: palette.ink }]}>{profile.bio}</Text>
        )}

        <Text style={[type.meta, { color: palette.muted }]}>
          {profile.followers} {profile.followers === 1 ? "follower" : "followers"} ·{" "}
          {profile.following} following
        </Text>

        {/* Each stands alone — most people fill in one and not the other, and
            a heading with nothing under it is worse than no heading. */}
        {profile.wantsToGo && (
          <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[type.meta, { color: palette.muted }]}>Wants to go</Text>
            <Text style={[type.body, { color: palette.ink, marginTop: 2 }]}>
              {profile.wantsToGo}
            </Text>
          </View>
        )}
        {profile.travelStyle && (
          <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[type.meta, { color: palette.muted }]}>How they travel</Text>
            <Text style={[type.body, { color: palette.ink, marginTop: 2 }]}>
              {profile.travelStyle}
            </Text>
          </View>
        )}

        {!profile.isSelf && (
          <View style={styles.actions}>
            <Pressable
              onPress={() => void toggleFollow()}
              disabled={busy}
              style={[
                styles.follow,
                following
                  ? { borderColor: palette.border }
                  : { backgroundColor: palette.ink, borderColor: palette.ink },
              ]}
            >
              <Text
                style={{
                  color: following ? palette.ink : palette.background,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {following ? "Following" : "Follow"}
              </Text>
            </Pressable>
            <Pressable onPress={moderate} hitSlop={10} style={styles.more}>
              <Text style={{ color: palette.muted, fontSize: 20 }}>···</Text>
            </Pressable>
          </View>
        )}

        <Text style={[type.item, { color: palette.ink, marginTop: 8 }]}>
          {trips.length} published {trips.length === 1 ? "trip" : "trips"}
        </Text>

        {trips.length === 0 ? (
          <Text style={[type.meta, { color: palette.muted }]}>
            {profile.isSelf
              ? "Nothing published yet. Open a trip and switch on publishing."
              : "Nothing published yet."}
          </Text>
        ) : (
          trips.map((trip) => (
            <Pressable
              key={trip.id}
              onPress={() =>
                router.push({ pathname: "/published/[id]", params: { id: trip.id } })
              }
              style={[
                styles.tripCard,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <View style={[styles.stripe, { backgroundColor: trip.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[type.item, { color: palette.ink }]} numberOfLines={2}>
                  {trip.title}
                </Text>
                <Text style={[type.meta, { color: palette.muted }]} numberOfLines={1}>
                  {[tripWhere(trip), dates(trip), `${trip.stopCount} stops`]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  initial: { alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  follow: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  more: { paddingHorizontal: 6 },
  card: { borderWidth: 1, borderRadius: RADIUS.card, padding: 14 },
  tripCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    padding: 14,
  },
  stripe: { width: 4, height: 38, borderRadius: 2 },
});
