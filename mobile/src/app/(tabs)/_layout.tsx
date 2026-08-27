import { Tabs } from "expo-router";
import {
  FeedIcon,
  JournalIcon,
  MapIcon,
  PeopleIcon,
  PlacesIcon,
  TripsIcon,
  YourProfileIcon,
} from "@/components/nav-icons";
import { usePalette } from "@/lib/use-palette";

/// Six destinations. There were seven, and "Been" was the one to go: its list
/// was the places list filtered, and its counts now sit above that list where
/// they describe something. The map it stood for is the Map tab with a status
/// filter, which is what "everywhere I have been" always was.
///
/// iOS shows five before collapsing the rest into "More", so the order here is
/// what you reach for while travelling.
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
      <Tabs.Screen
        name="account"
        options={{ title: "You", tabBarIcon: ({ color }) => <YourProfileIcon color={color} /> }}
      />
    </Tabs>
  );
}
