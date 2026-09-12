import { Tabs } from "expo-router";
import {
  JournalIcon,
  MapIcon,
  DiscoverIcon,
  TripsIcon,
} from "@/components/nav-icons";
import TabBar from "@/components/TabBar";

/// Four destinations, down from eight, and nothing hidden behind "More".
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
///
/// You went last, to the avatar on the map, where the kit puts it. It is a
/// place you visit to change something, not one of the four you move between.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        // The map is the app's ground, and a title bar over it is a strip of
        // paint where the map should be. Every screen draws its own heading.
        headerShown: false,
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
        options={{ title: "Discover", tabBarIcon: ({ color }) => <DiscoverIcon color={color} /> }}
      />
    </Tabs>
  );
}
