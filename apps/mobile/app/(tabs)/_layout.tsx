import { Tabs } from "expo-router";

import { strings } from "../../src/strings";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: strings.tabs.home }} />
      <Tabs.Screen name="care" options={{ title: strings.tabs.care }} />
      <Tabs.Screen
        name="timeline"
        options={{ title: strings.tabs.timeline }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: strings.tabs.settings }}
      />
    </Tabs>
  );
}
