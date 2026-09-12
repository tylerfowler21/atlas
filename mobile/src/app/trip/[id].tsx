import { useCallback, useEffect, useMemo, useState } from "react";
import { timingLabel } from "@/lib/duration";
import { tripRegion } from "@/lib/place-groups";
import { useCategories } from "@/lib/categories";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  PanResponder,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import TripEditor from "@/components/TripEditor";
import ItemEditor, { type ItemDraft } from "@/components/ItemEditor";
import TripMap, { openDirections } from "@/components/TripMap";
import { travelMode } from "@/lib/taxonomy";
import { dayLabel } from "@/lib/dates";
import { tripRegions } from "@/lib/trip-where";
import { useTripWeather } from "@/lib/use-trip-weather";
import { condition, weatherSegments } from "@/lib/weather";
import {
  API_URL,
  api,
  type ItineraryItem,
  type Place,
  type Trip,
  type TripResource,
  type TripDocument,
} from "@/lib/api";
import TripBookings from "@/components/TripBookings";
import TripCalendar from "@/components/TripCalendar";
import TripResources from "@/components/TripResources";
import TripFiles from "@/components/TripFiles";
import AddFromLink from "@/components/AddFromLink";
import { BOOKING_BOOKED, BOOKING_NEEDED, outstanding } from "@/lib/bookings";
import { syncReminders } from "@/lib/booking-reminders";
import { useApi } from "@/lib/use-api";
import { usePalette } from "@/lib/use-palette";

type TripResponse = {
  trip: Trip;
  role: string;
  items: ItineraryItem[];
  resources: TripResource[];
  documents: TripDocument[];
};

function dayCount(trip: Trip, items: ItineraryItem[]) {
  const fromDates =
    trip.startDate && trip.endDate
      ? Math.round(
          (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86_400_000,
        ) + 1
      : 0;
  // Never fewer days than there are entries, or a stop could have nowhere to
  // be — including the morning an overnight flight lands, which is a day of
  // the trip even before anything else is planned on it.
  const fromItems = items.reduce(
    (n, i) => Math.max(n, i.dayIndex + (i.endDayOffset ?? 0) + 1),
    0,
  );
  return Math.max(1, fromDates, fromItems);
}

/// Each row's measured height, per day, so a distance dragged becomes a number
/// of rows. Rows differ — a long title wraps — so the row being dragged
/// supplies the unit.
///
/// Kept outside the component and reached through functions: the gesture
/// callbacks are built during render, and neither a React ref read nor a
/// direct mutation is allowed from there.
const rowHeights: Record<number, number[]> = {};

function recordRowHeight(day: number, index: number, height: number) {
  (rowHeights[day] ??= [])[index] = height;
}

/// How many rows a drag of `dy` covers, from the height of the row being
/// dragged. Falls back to a typical row when nothing has been measured yet.
function rowsMoved(day: number, index: number, dy: number) {
  const unit = rowHeights[day]?.[index] || 64;
  return Math.round(dy / unit);
}

/// Where each day's section sits down the page, and how tall it is. Needed to
/// answer the only question a cross-day drag asks: which day is under the
/// finger now.
const dayBounds: Record<number, { y: number; height: number }> = {};

function recordDayBounds(day: number, y: number, height: number) {
  dayBounds[day] = { y, height };
}

/// Where a row sits within its own day, so a drag can be turned into a
/// position on the page rather than only a distance.
const rowOffsets: Record<number, number[]> = {};

function recordRowOffset(day: number, index: number, y: number) {
  (rowOffsets[day] ??= [])[index] = y;
}

/// Which day the finger is over, or null when it is over none — past the last
/// day, or over a gap nothing has measured yet.
function dayUnder(pageY: number): number | null {
  for (const [day, bounds] of Object.entries(dayBounds)) {
    if (pageY >= bounds.y && pageY < bounds.y + bounds.height) return Number(day);
  }
  return null;
}

export default function TripScreen() {
  const { stopIconOf } = useCategories();
  const { id, shareUrl } = useLocalSearchParams<{ id: string; shareUrl?: string }>();
  const { data, error, loading, reload } = useApi<TripResponse>(`/api/trips/${id}`);
  const { data: placeData } = useApi<{ places: Place[] }>("/api/places");
  const palette = usePalette();

  const router = useRouter();
  const [settings, setSettings] = useState(false);
  const [item, setItem] = useState<ItemDraft | null>(null);
  /// Which day the map is showing. Null is the whole trip, which is the right
  /// opening view — the shape of the thing before its parts.
  const [mapDay, setMapDay] = useState<number | null>(null);
  /// Which of the trip's three lists is showing: the trip as it will happen,
  /// and the two ways it has to be prepared for.
  const [view, setView] = useState<"days" | "bookings" | "before" | "files">("days");
  /// Which day the link importer is adding to, or null when it is closed.
  ///
  /// A link shared in from TikTok opens it straight away: the person has
  /// already said which trip, and the day is the one thing the share sheet
  /// could not ask.
  const [linkDay, setLinkDay] = useState<number | null>(shareUrl ? 0 : null);

  const days = useMemo(
    () => (data ? dayCount(data.trip, data.items) : 0),
    [data],
  );
  const toBook = outstanding(data?.items ?? []).length;

  /// Keep the phone's reminders matching what the trip says.
  ///
  /// Done on every read of the trip rather than when a deadline is set: a
  /// booking ticked off on the website, or by whoever you are travelling with,
  /// has to stop reminding you too — and the only moment this screen reliably
  /// learns about that is when it reads the trip.
  const reminderKey = (data?.items ?? [])
    .map((i) => `${i.id}:${i.booking ?? ""}:${i.bookBy ?? ""}`)
    .join("|");

  useEffect(() => {
    if (!data) return;
    void syncReminders(
      data.items
        .filter((i) => i.booking === BOOKING_NEEDED && i.bookBy)
        .map((i) => ({
          id: i.id,
          title: i.title,
          bookBy: i.bookBy!,
          tripTitle: data.trip.title,
        })),
      data.items.map((i) => i.id),
    );
    // Keyed on what the reminders are made of, so a re-render that changes
    // nothing does not reschedule the lot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderKey]);

  /// Where to ask about, day by day. A trip through three cities is three
  /// questions; one that stays put is still one.
  const segments = useMemo(
    () =>
      data?.trip.startDate
        ? weatherSegments(data.trip.startDate, days, data.items)
        : [],
    [data, days],
  );
  const weather = useTripWeather(segments);
  /// Stops per day, for the dots on the calendar.
  const dayCounts = useMemo(() => {
    const counts = Array.from({ length: days }, () => 0);
    for (const item of data?.items ?? []) {
      if (item.dayIndex < counts.length) counts[item.dayIndex] += 1;
    }
    return counts;
  }, [data, days]);
  const toSort = (data?.resources ?? []).filter((r) => !r.ready).length;

  /// A share link is a secret URL: anyone holding it reads the itinerary
  /// without an account, which is the point. The endpoint returns a path
  /// rather than a URL — it has no opinion about which host serves it — so the
  /// address is assembled here.
  const share = useCallback(async () => {
    try {
      const { share: link } = await api<{ share: { path: string } }>(
        `/api/trips/${id}/share`,
        { method: "POST" },
      );
      await Share.share({ message: `${API_URL}${link.path}` });
    } catch (e) {
      Alert.alert("Could not make a link", e instanceof Error ? e.message : "Try again");
    }
  }, [id]);

  /// Moving something within its day. The API assigns positions in order, so
  /// swapping two is a matter of trading them — no renumbering, and no chance
  /// of two entries claiming the same slot.
  const move = useCallback(
    async (entry: ItineraryItem, direction: -1 | 1) => {
      const sameDay = (data?.items ?? [])
        .filter((i) => i.dayIndex === entry.dayIndex)
        .sort((a, b) => a.position - b.position);
      const at = sameDay.findIndex((i) => i.id === entry.id);
      const swap = sameDay[at + direction];
      if (!swap) return;

      try {
        await Promise.all([
          api(`/api/items/${entry.id}`, {
            method: "PATCH",
            body: JSON.stringify({ position: swap.position }),
          }),
          api(`/api/items/${swap.id}`, {
            method: "PATCH",
            body: JSON.stringify({ position: entry.position }),
          }),
        ]);
        reload();
      } catch (e) {
        Alert.alert("Could not move that", e instanceof Error ? e.message : "Try again");
      }
    },
    [data, reload],
  );

  /// Moving a stop to another day.
  ///
  /// It lands at the end of the day it arrives on, which is where the API puts
  /// anything whose position is not stated — and is the right guess, since a
  /// stop dropped on a day has no opinion about what it comes before.
  const moveToDay = useCallback(
    async (item: ItineraryItem, dayIndex: number) => {
      if (item.dayIndex === dayIndex) return;
      const last = (data?.items ?? [])
        .filter((i) => i.dayIndex === dayIndex)
        .reduce((n, i) => Math.max(n, i.position + 1), 0);
      try {
        await api(`/api/items/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ dayIndex, position: last }),
        });
        reload();
      } catch (e) {
        Alert.alert("Could not move that", e instanceof Error ? e.message : "Try again");
      }
    },
    [data?.items, reload],
  );

  /// Dragging a stop up or down its day.
  ///
  /// PanResponder rather than a gesture library: it is part of React Native, so
  /// this needs no native module and works on the build already on the phone.
  ///
  /// Each row reports its height as it lays out, so the distance dragged can be
  /// turned into a number of rows. Rows are not all the same height — a long
  /// title wraps — so the row being dragged supplies the unit, which is the one
  /// whose height the finger is actually tracking.

  /// The drag in progress. State because the rows are drawn from it, and
  /// mirrored into a ref because the gesture's release handler runs long after
  /// the render that created it and would otherwise close over an old value.
  const [drag, setDrag] = useState<{
    day: number;
    from: number;
    to: number;
    /// Another day being dragged onto, when the finger has left this one.
    onto: number | null;
  } | null>(null);


  const moveTo = useCallback(
    async (day: number, from: number, to: number) => {
      if (from === to) return;
      const sameDay = (data?.items ?? [])
        .filter((i) => i.dayIndex === day)
        .sort((a, b) => a.position - b.position);

      const next = [...sameDay];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);

      try {
        // Renumbered from zero, and only the rows that really moved are sent.
        await Promise.all(
          next
            .map((item, i) =>
              item.position === i
                ? null
                : api(`/api/items/${item.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ position: i }),
                  }),
            )
            .filter(Boolean),
        );
        reload();
      } catch (e) {
        Alert.alert("Could not move that", e instanceof Error ? e.message : "Try again");
      }
    },
    [data?.items, reload],
  );

  const remove = useCallback(
    (entry: ItineraryItem) => {
      Alert.alert(entry.title, "Remove this from the trip?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/api/items/${entry.id}`, { method: "DELETE" });
              reload();
            } catch (e) {
              Alert.alert("Could not remove that", e instanceof Error ? e.message : "Try again");
            }
          },
        },
      ]);
    },
    [reload],
  );

  if (loading && !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={[styles.centre, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.muted }}>{error ?? "Trip not found"}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: data.trip.title,
          headerBackTitle: "Trips",
          headerRight: () => (
            <Pressable onPress={() => setSettings(true)} hitSlop={10}>
              <Text style={{ color: palette.accentText, fontSize: 15 }}>Edit</Text>
            </Pressable>
          ),
        }}
      />

      {linkDay !== null && data && (
        <AddFromLink
          trip={data.trip}
          days={days}
          activeDay={linkDay}
          initialUrl={shareUrl}
          region={
            (tripRegions(data.trip).length > 0 ? tripRegions(data.trip) : null) ??
            tripRegion(data.items.map((i) => i.place).filter((p) => p !== null))
          }
          onClose={() => setLinkDay(null)}
          onAdded={reload}
        />
      )}

      <ItemEditor
        draft={item}
        destination={
          // What the trip says it is, or what its stops say it is.
          // Every place the trip goes to, so a search ranks all of them first
          // rather than only wherever it starts.
          (data && tripRegions(data.trip).length > 0 ? tripRegions(data.trip) : null) ??
          tripRegion((data?.items ?? []).map((i) => i.place).filter((p) => p !== null))
        }
        places={placeData?.places ?? []}
        documents={data?.documents ?? []}
        days={days}
        onClose={() => setItem(null)}
        onSaved={reload}
      />

      {settings && (
        <TripEditor
          trip={data.trip}
          onClose={() => setSettings(false)}
          onSaved={(tripId) => {
            // An empty id means it was deleted; there is nothing to go back to.
            if (tripId) reload();
            else router.back();
          }}
        />
      )}
      <ScrollView style={[styles.fill, { backgroundColor: palette.background }]}>
        <TripMap
          items={
            mapDay === null ? data.items : data.items.filter((i) => i.dayIndex === mapDay)
          }
          color={data.trip.color}
        />

        {/* Three lists, not three screens. The counts sit on the tabs because
            something unbooked that has been forgotten about is the only one of
            the three that can cost you anything. */}
        <View style={styles.views}>
          {(
            [
              ["days", "Days", 0],
              ["bookings", "Bookings", toBook],
              ["before", "Before you go", toSort],
              ["files", "Files", (data?.documents ?? []).length],
            ] as const
          ).map(([id, label, count]) => {
            const on = view === id;
            return (
              <Pressable
                key={id}
                onPress={() => setView(id)}
                style={[
                  styles.viewTab,
                  { borderColor: on ? palette.primary : palette.border },
                  on && { backgroundColor: palette.primary },
                ]}
              >
                <Text style={{ fontSize: 13, color: on ? palette.onPrimary : palette.muted }}>
                  {label}
                  {count > 0 ? ` ${count}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {view === "bookings" && (
          <TripBookings trip={data.trip} items={data.items} onChanged={reload} />
        )}

        {view === "before" && (
          <TripResources
            tripId={id}
            resources={data.resources ?? []}
            onChanged={reload}
          />
        )}

        {view === "files" && (
          <TripFiles tripId={id} files={data.documents ?? []} onChanged={reload} />
        )}

        {view === "days" && (
          <>
        {/* A calendar once the trip has dates, because "day 3" is a number you
            have to convert before it tells you anything. A trip with no dates
            has nothing to align to, so it keeps the row of chips. */}
        {data.trip.startDate ? (
          <TripCalendar
            startDate={data.trip.startDate}
            days={days}
            color={data.trip.color}
            activeDay={mapDay}
            counts={dayCounts}
            onPick={setMapDay}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayChips}
          >
            {[null, ...Array.from({ length: days }, (_, d) => d)].map((d) => {
              const on = mapDay === d;
              return (
                <Pressable
                  key={d ?? "all"}
                  onPress={() => setMapDay(d)}
                  style={[
                    styles.dayChip,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                    on && { backgroundColor: palette.primary, borderColor: palette.primary },
                  ]}
                >
                  <Text style={{ fontSize: 13, color: on ? palette.onPrimary : palette.muted }}>
                    {d === null ? "Whole trip" : `Day ${d + 1}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Picking a date shows that day. It used to only move the map, which
            made the calendar look broken: you tap the 20th, the list underneath
            is still every day of the trip, and nothing appears to have
            happened. "Whole trip" is still there for the long view. */}
        {(mapDay === null ? Array.from({ length: days }, (_, d) => d) : [mapDay]).map((day) => {
          const stops = data.items.filter((i) => i.dayIndex === day);
          return (
            <View
              key={day}
              style={styles.day}
              onLayout={(e) =>
                recordDayBounds(day, e.nativeEvent.layout.y, e.nativeEvent.layout.height)
              }
            >
              <View style={styles.dayHeading}>
                <Text
                  style={[
                    styles.dayLabel,
                    { color: mapDay === day ? palette.accentText : palette.muted },
                    // The day under the finger, so a drop is aimed rather than
                    // hoped for.
                    drag?.onto === day && { color: palette.accentText },
                  ]}
                >
                  {dayLabel(data.trip, day)}
                  {drag?.onto === day ? "  · drop here" : ""}
                </Text>
                {/* Only when there is something real to say. A day beyond the
                    forecast shows nothing rather than a number to pack from. */}
                {(() => {
                  const date = data.trip.startDate
                    ? new Date(Date.parse(data.trip.startDate) + day * 86_400_000)
                        .toISOString()
                        .slice(0, 10)
                    : null;
                  const sky = date ? weather.get(date) : undefined;
                  if (!sky) return null;
                  return (
                    <Text style={{ color: palette.muted, fontSize: 12 }}>
                      {condition(sky.code).icon} {sky.high}°/{sky.low}°
                    </Text>
                  );
                })()}
              </View>

              {/* An overnight flight belongs to the evening it left, but the
                  morning it lands is a real part of this day and the one thing
                  on it that cannot move. */}
              {data.items
                .filter(
                  (i) =>
                    i.kind === "travel" &&
                    i.endDayOffset > 0 &&
                    i.endTime &&
                    i.dayIndex + i.endDayOffset === day,
                )
                .map((leg) => (
                  <Text
                    key={`arrives-${leg.id}`}
                    style={{ color: palette.accentText, fontSize: 13, marginTop: 6 }}
                  >
                    ✈️ Lands {leg.endTime}
                    {leg.toPlace ? ` · ${leg.toPlace.name}` : ""}
                  </Text>
                ))}

              {stops.map((entry, index) => {
                const leg = entry.kind === "travel";
                const mode = leg ? travelMode(entry.mode) : null;

                // Made per row so it closes over this row's day and index
                // rather than over whatever they were when the screen mounted.
                // PanResponder.create is a plain factory, not a hook.
                const landingIndex = (dy: number) =>
                  Math.max(0, Math.min(stops.length - 1, index + rowsMoved(day, index, dy)));

                /// Where the finger is down the page, from where this row
                /// started plus how far it has travelled.
                const pageY = (dy: number) =>
                  (dayBounds[day]?.y ?? 0) + (rowOffsets[day]?.[index] ?? 0) + dy;

                /// The day being dragged over, when it is a different one.
                /// Dragging within a day is a reorder and stays that way.
                const overDay = (dy: number) => {
                  const found = dayUnder(pageY(dy));
                  return found === null || found === day ? null : found;
                };

                const pan = PanResponder.create({
                  onStartShouldSetPanResponder: () => true,
                  onMoveShouldSetPanResponder: () => true,
                  onPanResponderGrant: () =>
                    setDrag({ day, from: index, to: index, onto: null }),
                  onPanResponderMove: (_event, gesture) => {
                    const onto = overDay(gesture.dy);
                    setDrag({
                      day,
                      from: index,
                      to: onto === null ? landingIndex(gesture.dy) : index,
                      onto,
                    });
                  },
                  // The final distance comes with the release, so where it
                  // lands is worked out from the gesture rather than read back
                  // out of state written by an earlier render.
                  onPanResponderRelease: (_event, gesture) => {
                    setDrag(null);
                    const onto = overDay(gesture.dy);
                    if (onto !== null) void moveToDay(entry, onto);
                    else void moveTo(day, index, landingIndex(gesture.dy));
                  },
                  onPanResponderTerminate: () => setDrag(null),
                });

                const held = drag?.day === day && drag.from === index;
                const target = drag?.day === day && drag.to === index;

                return (
                  <View
                    key={entry.id}
                    onLayout={(e) => {
                      recordRowHeight(day, index, e.nativeEvent.layout.height);
                      recordRowOffset(day, index, e.nativeEvent.layout.y);
                    }}
                    style={[
                      styles.stop,
                      { backgroundColor: palette.surface, borderColor: palette.border },
                      held && { opacity: 0.4 },
                      target && !held && { borderColor: palette.primary, borderWidth: 2 },
                      // A journey is drawn differently from a stop: the day
                      // reads as a sequence, and the thing that moves you
                      // between places should not look like another place.
                      leg && { borderStyle: "dashed", borderColor: palette.primary },
                    ]}
                  >
                    <Pressable
                      style={styles.stopMain}
                      onPress={() => setItem({ mode: "edit", item: entry })}
                    >
                      <Text style={styles.glyph}>
                        {entry.emoji || mode?.icon || stopIconOf(entry)}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stopTitle, { color: palette.ink }]} numberOfLines={2}>
                          {entry.title}
                        </Text>
                        {(timingLabel(entry) || entry.notes || entry.booking) && (
                          <Text style={[styles.stopMeta, { color: palette.muted }]} numberOfLines={1}>
                            {[
                              // A journey reads as its times, a stop as how
                              // long it takes; the +1 stays on a flight that
                              // lands the next morning.
                              entry.kind === "travel" && entry.endDayOffset > 0
                                ? `${timingLabel(entry)} +${entry.endDayOffset}`
                                : timingLabel(entry),
                              entry.notes,
                              entry.booking === BOOKING_BOOKED ? "booked ✓" : null,
                              entry.booking === BOOKING_NEEDED ? "to book" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        )}
                      </View>
                    </Pressable>

                    <View style={styles.controls}>
                      <View {...pan.panHandlers} hitSlop={8} style={styles.grip}>
                        <Text style={{ color: palette.muted, fontSize: 16 }}>≡</Text>
                      </View>
                      {entry.place && (
                        <Pressable
                          onPress={() =>
                            openDirections(entry.place!.lat, entry.place!.lng, entry.title)
                          }
                          hitSlop={8}
                          accessibilityLabel={`Directions to ${entry.title}`}
                        >
                          {/* The supplied artwork, not a redrawn one — so it
                              keeps its own colours rather than following the
                              row's. 22px because the corner badge is a smudge
                              much below that. */}
                          <Image
                            source={require("../../../assets/images/directions.png")}
                            style={styles.directions}
                          />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => move(entry, -1)}
                        disabled={index === 0}
                        hitSlop={8}
                      >
                        <Text style={{ color: index === 0 ? palette.border : palette.muted, fontSize: 16 }}>
                          ↑
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => move(entry, 1)}
                        disabled={index === stops.length - 1}
                        hitSlop={8}
                      >
                        <Text
                          style={{
                            color: index === stops.length - 1 ? palette.border : palette.muted,
                            fontSize: 16,
                          }}
                        >
                          ↓
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => remove(entry)} hitSlop={8}>
                        <Text style={{ color: palette.muted, fontSize: 18 }}>×</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              <View style={styles.addRow}>
                <Pressable
                  onPress={() =>
                    setItem({ mode: "create", tripId: id, dayIndex: day, kind: "stop" })
                  }
                  style={styles.add}
                >
                  <Text style={{ color: palette.accentText, fontSize: 14 }}>+ Add a stop</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setItem({ mode: "create", tripId: id, dayIndex: day, kind: "travel" })
                  }
                  style={styles.add}
                >
                  <Text style={{ color: palette.accentText, fontSize: 14 }}>+ Add a journey</Text>
                </Pressable>
                {/* The reel is on this phone, so the places should go in from
                    this phone — and onto the day whose button was pressed. */}
                <Pressable onPress={() => setLinkDay(day)} style={styles.add}>
                  <Text style={{ color: palette.accentText, fontSize: 14 }}>+ From TikTok</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
          </>
        )}

        <Pressable onPress={share} style={styles.share}>
          <Text style={{ color: palette.accentText, fontSize: 14 }}>
            Share a read-only link
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  views: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingTop: 12 },
  viewTab: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  dayChips: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
  dayChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  day: { paddingHorizontal: 12, paddingTop: 16 },
  dayHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  stop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  glyph: { fontSize: 18 },
  stopMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  stopTitle: { fontSize: 15 },
  stopMeta: { fontSize: 12, marginTop: 2 },
  grip: { paddingHorizontal: 4, paddingVertical: 2 },
  controls: { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: 10 },
  addRow: { flexDirection: "row", gap: 16 },
  add: { paddingVertical: 10, paddingHorizontal: 4, marginTop: 4 },
  share: { alignItems: "center", paddingVertical: 18, marginTop: 12 },
  directions: { width: 22, height: 22 },
});
