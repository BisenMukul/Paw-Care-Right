import { PersistedApiQueryProvider } from "@pawcareright/api-client";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient, queryPersister } from "../src/api/query";
import { useAuthStore } from "../src/auth/auth-store";
import { useNetworkListener } from "../src/offline/use-network-listener";

import "../global.css";

/**
 * Root auth gate (classic expo-router pattern, plan R2): a single effect
 * reads the current segment group + auth status and redirects. `(tabs)` is
 * kept untouched as the signed-in group (T008); `(auth)` is the sibling
 * signed-out group; `push-rationale` is a root-level signed-in screen.
 */
function useAuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === "restoring") {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";

    if (status === "signedOut" && !inAuthGroup) {
      router.replace("/(auth)/welcome");
    } else if (status === "signedIn" && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [status, segments, router]);
}

export default function RootLayout() {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    useAuthStore.getState().restore();
  }, []);

  useAuthGate();
  useNetworkListener();

  if (status === "restoring") {
    return (
      <PersistedApiQueryProvider client={queryClient} persister={queryPersister}>
        <SafeAreaProvider>
          <View testID="auth-splash" className="flex-1 items-center justify-center bg-white" />
        </SafeAreaProvider>
      </PersistedApiQueryProvider>
    );
  }

  return (
    <PersistedApiQueryProvider client={queryClient} persister={queryPersister}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="push-rationale" />
        </Stack>
      </SafeAreaProvider>
    </PersistedApiQueryProvider>
  );
}
