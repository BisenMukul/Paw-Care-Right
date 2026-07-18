// Startup crash trap FIRST: any fatal JS error from here on is logged with
// its stack before the app dies (founder hotfix -- silent crash-after-splash
// becomes a readable Metro/adb trace).
import "../src/startup-guard";

import { PersistedApiQueryProvider } from "@pawcareright/api-client";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { ReduceMotion, ReducedMotionConfig } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient, queryPersister } from "../src/api/query";
import { useAuthStore } from "../src/auth/auth-store";
import { usePurchasesInit } from "../src/billing/use-purchases-init";
import { UpdateGate } from "../src/components/update-gate";
import { UpsellSheet } from "../src/components/upsell-sheet";
import { AppErrorBoundary } from "../src/error-boundary";
import { useAppFonts } from "../src/fonts/use-app-fonts";
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

/**
 * Everything below the error boundary lives in ONE tree (founder hotfix:
 * the entry used to duplicate the provider stack across the restoring and
 * ready branches; a single tree is simpler and cannot drift). Hooks with
 * side effects (restore, auth gate, network, purchases) run here so a
 * failure in any of them surfaces inside the boundary, not above it.
 */
function AppRoot() {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    useAuthStore.getState().restore();
  }, []);

  useAuthGate();
  useNetworkListener();
  usePurchasesInit();

  if (status === "restoring") {
    return <View testID="auth-splash" className="flex-1 items-center justify-center bg-white" />;
  }

  return (
    <UpdateGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="push-rationale" />
        <Stack.Screen name="add-pet" options={{ presentation: "modal" }} />
        <Stack.Screen name="pets/[id]" />
        <Stack.Screen name="care-plan/[petId]" />
        <Stack.Screen name="reminders/edit" options={{ presentation: "modal" }} />
        <Stack.Screen name="check/index" />
        <Stack.Screen name="check/[category]" />
        <Stack.Screen name="check/waiting/[checkId]" />
        <Stack.Screen name="check/result/[checkId]" />
        <Stack.Screen name="check/emergency/[checkId]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="check/history/[petId]" />
        <Stack.Screen name="checks/[id]" />
        <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
        <Stack.Screen name="family" />
        <Stack.Screen name="join/[code]" />
      </Stack>
      <UpsellSheet />
    </UpdateGate>
  );
}

/**
 * Root layout: the error boundary is the OUTERMOST element (founder
 * hotfix -- it previously sat inside the query provider, so a provider
 * failure rendered nothing). The boundary itself uses only core RN
 * primitives, so it needs no provider to render its fallback.
 */
export default function RootLayout() {
  // Non-blocking font load (PAWSAATHI-1 plan): called once here, above the
  // boundary tree, and its return value is never read -- a pending load or
  // a load error can NEVER stop `AppErrorBoundary`/`AppRoot` from mounting
  // (see `use-app-fonts.ts`'s header comment).
  useAppFonts();

  return (
    <AppErrorBoundary>
      <PersistedApiQueryProvider client={queryClient} persister={queryPersister}>
        <SafeAreaProvider>
          {/* Belt-and-braces default (design-system.md §3.2): honours the OS
              "Reduce Motion" setting for any animation an author forgets to
              gate via `useReducedMotion()`. */}
          <ReducedMotionConfig mode={ReduceMotion.System} />
          <AppRoot />
        </SafeAreaProvider>
      </PersistedApiQueryProvider>
    </AppErrorBoundary>
  );
}
