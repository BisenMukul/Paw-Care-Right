import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { strings } from "../../src/strings";

// Brand green (tailwind-preset.mjs `brand.700`, matches `PrimaryButton`'s
// `bg-brand-700` and `AppTitle`'s `text-brand-700`) -- the SAME hex used
// everywhere else in the app, not a new invented color.
const BRAND_ACTIVE_TINT = "#1f6350";
const MUTED_INACTIVE_TINT = "#9ca3af";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND_ACTIVE_TINT,
        tabBarInactiveTintColor: MUTED_INACTIVE_TINT,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: strings.tabs.home,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="care"
        options={{
          title: strings.tabs.care,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? "paw" : "paw-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: strings.tabs.timeline,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: strings.tabs.settings,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? "settings" : "settings-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
