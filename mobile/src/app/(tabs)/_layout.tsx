import { Tabs } from "expo-router";
import {
  JournalIcon,
  MapIcon,
  PeopleIcon,
  TripsIcon,
  YourProfileIcon,
} from "@/components/nav-icons";
import { usePalette } from "@/lib/use-palette";

/// Five destinations, down from eight, and nothing hidden behind "More".
///
/// Feed and People became one: People exists mostly to fill the Feed, since
/// following someone is what gives the Feed anything to show.
///
/// Been went first: its list was the places list filtered, and its counts
/// describe that list rather than needing a screen. Places followed, because
/// once the map had the same status filters, a separate tab was the same
/// places under the same filters without the map behind them. Both now live on
/// Map — the list pulls up over it, which is what the website does at this
/// width.
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
        name="discover"
        options={{ title: "Discover", tabBarIcon: ({ color }) => <PeopleIcon color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "You", tabBarIcon: ({ color }) => <YourProfileIcon color={color} /> }}
      />
    </Tabs>
  );
}
