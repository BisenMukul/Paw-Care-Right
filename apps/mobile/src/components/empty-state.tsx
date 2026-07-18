import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Text, View } from "react-native";

import { PrimaryButton } from "./primary-button";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface EmptyStateProps {
  testID?: string;
  icon: IconName;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  ctaTestID?: string;
}

/**
 * The one "nothing here yet" surface (design-system.md §2.7): icon + title
 * + optional body, with an OPTIONAL trailing CTA (SWEEP-4 plan Risk R1 --
 * several in-scope consumers have no single "create the missing thing"
 * action reachable without inventing a new router target, so the CTA only
 * renders when a caller supplies both `ctaLabel` and `onCtaPress`). No
 * `accessibilityRole` on the container -- the title/body carry their own
 * semantics as plain text.
 */
export function EmptyState({ testID, icon, title, body, ctaLabel, onCtaPress, ctaTestID }: EmptyStateProps) {
  return (
    <View testID={testID} className="items-center gap-4 rounded-2xl bg-white px-6 py-10">
      <Ionicons name={icon} size={56} color="#2f8f74" />
      <Text className="text-center text-xl font-semibold text-brand-900">{title}</Text>
      {body ? <Text className="text-center text-base text-brand-700">{body}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <PrimaryButton {...(ctaTestID !== undefined ? { testID: ctaTestID } : {})} label={ctaLabel} onPress={onCtaPress} />
      ) : null}
    </View>
  );
}
