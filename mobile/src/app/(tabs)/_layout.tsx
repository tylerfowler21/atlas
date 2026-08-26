import { Tabs } from "expo-router";
import {
  BeenIcon,
  FeedIcon,
  JournalIcon,
  MapIcon,
  PeopleIcon,
  PlacesIcon,
  TripsIcon,
} from "@/components/nav-icons";
import { usePalette } from "@/lib/use-palette";

/// Seven destinations, and iOS shows five before collapsing the rest into
/// "More" on its own — the same pressure the website resolves with a bottom bar
/// and an overflow sheet. The order here is what you reach for while
/// travelling, so the four that matter most stay visible.
export default function TabsLayout() {
  const palette = usePalette();

  return (
    <Tabs
      screenOptions={{
        // Deep Ocean marks an active tab rather than the teal, which is a
        // call-to-action colour and too pale to read as selection.
        tabBarActiveTintColor: palette.accentText,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: { color: palette.ink },
        headerTintColor: palette.ink,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Map", tabBarIcon: ({ color }) => <MapIcon color={color} /> }}
      />
      <Tabs.Screen
        name="trips"
        options={{ title: "Trips", tabBarIcon: ({ color }) => <TripsIcon color={color} /> }}
      />
      <Tabs.Screen
        name="been"
        options={{ title: "Been", tabBarIcon: ({ color }) => <BeenIcon color={color} /> }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: "Journal", tabBarIcon: ({ color }) => <JournalIcon color={color} /> }}
      />
      <Tabs.Screen
        name="places"
        options={{ title: "Places", tabBarIcon: ({ color }) => <PlacesIcon color={color} /> }}
      />
      <Tabs.Screen
        name="feed"
        options={{ title: "Feed", tabBarIcon: ({ color }) => <FeedIcon color={color} /> }}
      />
      <Tabs.Screen
        name="people"
        options={{ title: "People", tabBarIcon: ({ color }) => <PeopleIcon color={color} /> }}
      />
    </Tabs>
  );
}
