/**
 * T100 plan step 8 -- pure data: the four store device canvases and the
 * canonical 8-shot set. `route` values are verified against real
 * expo-router files under `apps/mobile/app/` (see each shot's comment);
 * `captionKey` matches a key under `marketing-strings.ts`'s `shots` map.
 *
 * "04-food-safety" and "07-chat" intentionally share the `/chat` route:
 * F3 (Food & Toxin Safety) has no dedicated mobile screen -- it is answered
 * by chat itself (see `apps/mobile/src/components/chat/quick-prompts.tsx`'s
 * header comment, verified: no `apps/api/src/**\/food*`, no `toxin` match,
 * no mobile F3 screen). Shot ids stay unique; routes do not need to be.
 */

export interface DeviceProfile {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly store: "app-store" | "play-store";
  readonly frameRadiusRatio: number;
  readonly bezelRatio: number;
}

export const DEVICE_PROFILES: readonly DeviceProfile[] = [
  { id: "ios-6-7", label: 'iOS 6.7"', width: 1290, height: 2796, store: "app-store", frameRadiusRatio: 0.09, bezelRatio: 0.02 },
  { id: "ios-6-1", label: 'iOS 6.1"', width: 1179, height: 2556, store: "app-store", frameRadiusRatio: 0.09, bezelRatio: 0.02 },
  { id: "ios-5-5", label: 'iOS 5.5"', width: 1242, height: 2208, store: "app-store", frameRadiusRatio: 0.06, bezelRatio: 0.02 },
  { id: "android-phone", label: "Android phone", width: 1080, height: 1920, store: "play-store", frameRadiusRatio: 0.05, bezelRatio: 0.015 },
] as const;

export interface Shot {
  readonly id: string;
  readonly order: number;
  /** A real expo-router path under `apps/mobile/app/`. */
  readonly route: string;
  readonly captureNotes: string;
  readonly captionKey: string;
}

export const SHOT_SET: readonly Shot[] = [
  {
    id: "01-home",
    order: 1,
    route: "/(tabs)", // app/(tabs)/index.tsx
    captureNotes: "Home tab with an active pet, care-score card and today preview visible.",
    captionKey: "01-home",
  },
  {
    id: "02-symptom-check",
    order: 2,
    route: "/check", // app/check/index.tsx
    captureNotes: "Check entry screen showing the symptom category grid.",
    captionKey: "02-symptom-check",
  },
  {
    id: "03-check-result",
    order: 3,
    route: "/check/result/[checkId]", // app/check/result/[checkId].tsx
    captureNotes: "A non-emergency check result with the vet disclaimer visible in-frame.",
    captionKey: "03-check-result",
  },
  {
    id: "04-food-safety",
    order: 4,
    route: "/chat", // app/chat/index.tsx (F3 has no dedicated screen; answered in chat)
    captureNotes: "Chat screen after tapping the 'food' quick prompt, showing a food-safety answer.",
    captionKey: "04-food-safety",
  },
  {
    id: "05-reminders",
    order: 5,
    route: "/(tabs)/care", // app/(tabs)/care.tsx
    captureNotes: "Care tab agenda with upcoming vaccine/parasite/medication reminders.",
    captionKey: "05-reminders",
  },
  {
    id: "06-timeline",
    order: 6,
    route: "/(tabs)/timeline", // app/(tabs)/timeline.tsx
    captureNotes: "Timeline tab showing a pet's health-log history.",
    captionKey: "06-timeline",
  },
  {
    id: "07-chat",
    order: 7,
    route: "/chat", // app/chat/index.tsx
    captureNotes: "Chat screen with an in-progress conversation and the quick prompts row.",
    captionKey: "07-chat",
  },
  {
    id: "08-plus",
    order: 8,
    route: "/paywall", // app/paywall.tsx
    captureNotes: "Paywall/plans screen showing the subscription tiers.",
    captionKey: "08-plus",
  },
] as const;
