import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useFonts } from "expo-font";

/**
 * Non-blocking loader for the PawSaathi-visual-language display/body faces
 * (design-system.md §1.4, PAWSAATHI-1 plan Decision 2). `useFonts` returns
 * `[loaded, error]`, but this hook deliberately returns `void` and the
 * caller (`app/_layout.tsx`) never branches on either value: while the
 * fonts are pending or fail to load, every `font-display`/`font-body*`
 * NativeWind class falls back to the OS system font (RN's default
 * `fontFamily` resolution) rather than blocking startup or rendering
 * nothing. This mirrors the app's existing "uncertainty fails upward, but
 * NEVER by blocking the UI" posture (CLAUDE.md §7 rule 5) applied to a
 * purely cosmetic concern.
 */
export function useAppFonts(): void {
  useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
}
