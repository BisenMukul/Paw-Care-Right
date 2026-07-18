import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";

import { strings } from "../../src/strings";

// Brand green (tailwind-preset.mjs `brand.700`, matches `PrimaryButton`'s
// `bg-brand-700` and `AppTitle`'s `text-brand-700`) -- the SAME hex used
// everywhere else in the app, not a new invented color.
const BRAND_ACTIVE_TINT = "#1f6350";
const MUTED_INACTIVE_TINT = "#9ca3af";
// Dark-mode scheme-aware pair (design-system.md §1.1a/§1.6 -- react-navigation
// tint/style are runtime native props, not `className`, so they can't carry a
// `dark:` class and are computed from `useColorScheme()` instead, PAWSAATHI-4
// plan decision 6). `accent.bright`/`ink.muted-dark` are the SAME verified
// tokens used everywhere else -- no new pairing.
const DARK_ACTIVE_TINT = "#2EA57C";
const DARK_INACTIVE_TINT = "#9AA8A1";
const DARK_TAB_BAR_STYLE = { backgroundColor: "#16241F", borderTopColor: "#22392F" };

export default function TabsLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? DARK_ACTIVE_TINT : BRAND_ACTIVE_TINT,
        tabBarInactiveTintColor: isDark ? DARK_INACTIVE_TINT : MUTED_INACTIVE_TINT,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        ...(isDark ? { tabBarStyle: DARK_TAB_BAR_STYLE } : {}),
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
