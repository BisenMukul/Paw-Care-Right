import { useIsOffline } from "@pawcareright/api-client";
import { getCategoryDef } from "@pawcareright/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { uploadIntakePhoto } from "../../src/api/intake-photos-api";
import { IntakeForm } from "../../src/components/intake/intake-form";
import { PrimaryButton } from "../../src/components/primary-button";
import { useCheckSubmission } from "../../src/checks/use-check-submission";
import { strings } from "../../src/strings";

/**
 * Dynamic symptom-intake route (T045 plan), now wired to the real submit ->
 * branch flow (T047 plan "Flow & navigation contract"). This screen owns
 * `petId` (a T042 path param, NOT part of `CompletedIntake`) and delegates
 * the submit/red-flag/polling orchestration to `useCheckSubmission` —
 * `router.replace` (D9, not `push`) so the intake form leaves the back
 * stack. Collection + routing UI only: no AI output, no triage, no
 * emergency-interstitial content on this screen (CLAUDE.md §7 unaffected —
 * the emergency route itself is T049).
 */
export default function IntakeScreen() {
  const router = useRouter();
  const { category, petId } = useLocalSearchParams<{ category?: string; petId?: string }>();
  const isOffline = useIsOffline();
  const scheme = useColorScheme();
  const spinnerColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  const categoryDef = category !== undefined ? getCategoryDef(category) : undefined;

  // T046: the pet-scoped upload capability, built from this route's own
  // `petId` param — the schema-driven `IntakeForm`/`QuestionRenderer` never
  // learn `petId` themselves (plan §"petId / capability seam design").
  const photoUpload = useMemo(
    () =>
      petId !== undefined
        ? { upload: (uri: string, onProgress: (progress: number) => void) => uploadIntakePhoto(petId, uri, onProgress) }
        : undefined,
    [petId],
  );

  const submission = useCheckSubmission({
    petId,
    onEmergency: (checkId) =>
      router.replace({ pathname: "/check/emergency/[checkId]", params: { checkId } }),
    onPolling: (checkId) =>
      router.replace({ pathname: "/check/waiting/[checkId]", params: { checkId, petId: petId ?? "" } }),
  });

  if (categoryDef === undefined) {
    return (
      <SafeAreaView testID="intake-invalid-category" className="flex-1 items-center justify-center bg-surface-page dark:bg-surface-page-dark px-6">
        <Text className="text-center text-base text-brand-900 dark:text-ink-dark">{strings.intake.invalidCategory}</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface-page-dark">
      {isOffline ? (
        <Text testID="intake-offline-banner" className="px-6 pt-2 text-center text-sm text-brand-700 dark:text-ink-muted-dark">
          {strings.intake.offlineBanner}
        </Text>
      ) : null}

      {submission.state === "submitting" ? (
        <SafeAreaView
          testID="check-submit-submitting"
          className="absolute inset-0 z-10 items-center justify-center gap-4 bg-surface-page/95 dark:bg-surface-page-dark/95 px-6"
        >
          <ActivityIndicator color={spinnerColor} />
          <Text className="text-center text-base text-brand-900 dark:text-ink-dark">{strings.check.submit.submitting}</Text>
        </SafeAreaView>
      ) : null}

      {submission.state === "offline" ? (
        <SafeAreaView
          testID="check-submit-offline"
          className="absolute inset-0 z-10 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6"
        >
          <Text className="text-center text-base text-brand-900 dark:text-ink-dark">{strings.check.submit.offlineBlocked}</Text>
          <PrimaryButton
            testID="check-submit-offline-retry"
            label={strings.check.submit.offlineRetry}
            onPress={submission.retry}
          />
        </SafeAreaView>
      ) : null}

      {submission.state === "quota" ? (
        <SafeAreaView
          testID="check-submit-quota"
          className="absolute inset-0 z-10 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6"
        >
          <Text className="text-center text-lg font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
            {strings.check.submit.quotaTitle}
          </Text>
          <Text className="text-center text-base text-brand-700 dark:text-ink-muted-dark">{strings.check.submit.quotaBody}</Text>
          {/* Neutral "See plans" affordance (SPEC F8) — deep-links to the
              paywall (T075); this screen's quota state stays bespoke rather
              than the global upsell sheet (the check mutation carries
              `meta.skipUpsell`), so there is no double UI here. */}
          <PrimaryButton
            testID="check-submit-quota-upgrade"
            label={strings.check.submit.quotaUpgrade}
            onPress={() => router.push({ pathname: "/paywall", params: { source: "check-quota" } })}
          />
        </SafeAreaView>
      ) : null}

      {submission.state === "error" ? (
        <SafeAreaView
          testID="check-submit-error"
          className="absolute inset-0 z-10 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6"
        >
          <Text className="text-center text-base text-brand-900 dark:text-ink-dark">{strings.check.submit.error}</Text>
          <PrimaryButton
            testID="check-submit-error-retry"
            label={strings.check.submit.errorRetry}
            onPress={submission.retry}
          />
        </SafeAreaView>
      ) : null}

      <IntakeForm
        categoryDef={categoryDef}
        onExit={() => router.back()}
        onSubmit={submission.submit}
        photoUpload={photoUpload}
      />
    </View>
  );
}
