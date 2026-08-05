import { useIsOffline } from "@bombaypetcompany/api-client";
import { FEEDBACK_CATEGORIES, type FeedbackCategory, type SubmitFeedbackInput } from "@bombaypetcompany/types";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Switch, Text, View } from "react-native";

import { requestScreenshotUploadUrl, useSubmitFeedback } from "../src/api/feedback-api";
import { Chip } from "../src/components/chip";
import { PrimaryButton } from "../src/components/primary-button";
import { ScreenScaffold } from "../src/components/screen-scaffold";
import { TextField } from "../src/components/text-field";
import { useNavBack } from "../src/hooks/use-nav-back";
import { getAppVersion } from "../src/config";
import { getLogEntries } from "../src/observability/log-buffer";
import { addFeedbackBreadcrumb, currentSentryRelease, getLastSentryEventId } from "../src/observability/sentry";
import { compressImage } from "../src/pets/compress-image";
import { strings } from "../src/strings";

/**
 * T104 in-app feedback + bug report screen (plan step 19). Reached from the
 * beta-banner CTA, the Settings row, or (once a real detector lands) a
 * device shake. No screenshot auto-capture (D2) -- the user attaches an
 * image they captured themselves via the existing `expo-image-picker` +
 * `compressImage` idiom. The logs-consent toggle defaults OFF; the server
 * independently re-enforces the consent gate (`FeedbackService.submit`)
 * regardless of what this screen sends.
 */
export default function FeedbackScreen() {
  const router = useRouter();
  const onBack = useNavBack("/(tabs)");
  const isOffline = useIsOffline();
  const submitFeedback = useSubmitFeedback();

  const [category, setCategory] = useState<FeedbackCategory>("BUG");
  const [message, setMessage] = useState("");
  const [attachLogsConsent, setAttachLogsConsent] = useState(false);
  const [screenshotKey, setScreenshotKey] = useState<string | undefined>(undefined);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);

  const messageEmpty = message.trim().length === 0;

  async function handleAttachImage() {
    setImageError(undefined);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        setImageError(strings.intake.photo.permissionError);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync();
      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0]!;
      const compressed = await compressImage({ uri: asset.uri, width: asset.width, height: asset.height });

      setImageBusy(true);
      const { uploadUrl, key } = await requestScreenshotUploadUrl();
      const blob = await (await fetch(compressed.uri)).blob();
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/jpeg" },
      });
      if (!putRes.ok) {
        throw new Error("screenshot upload failed");
      }
      setScreenshotKey(key);
    } catch {
      setImageError(strings.intake.photo.permissionError);
    } finally {
      setImageBusy(false);
    }
  }

  function handleSubmit() {
    if (messageEmpty || isOffline) {
      return;
    }

    addFeedbackBreadcrumb(category);

    const sentryEventId = getLastSentryEventId();

    const input: SubmitFeedbackInput = {
      category,
      message,
      platform: Platform.OS === "ios" ? "ios" : "android",
      appVersion: getAppVersion(),
      attachLogs: attachLogsConsent,
      ...(attachLogsConsent ? { logs: [...getLogEntries()] } : {}),
      ...(screenshotKey !== undefined ? { screenshotKey } : {}),
      ...(sentryEventId !== undefined ? { sentryEventId } : {}),
      // T117 F2: reads the SAME release-naming function `sentry.ts` tags
      // its events with, so this id never drifts from what a founder would
      // actually find in Sentry search.
      sentryRelease: currentSentryRelease(),
    };

    submitFeedback.mutate(input, {
      onSuccess: () => {
        setSubmitted(true);
        setTimeout(() => router.back(), 1200);
      },
    });
  }

  return (
    <ScreenScaffold
      title={strings.feedback.title}
      onBack={onBack}
      footer={
        <PrimaryButton
          testID="feedback-submit"
          label={submitFeedback.isPending ? strings.feedback.submitting : strings.feedback.submit}
          loading={submitFeedback.isPending}
          disabled={messageEmpty || isOffline || submitted}
          onPress={handleSubmit}
        />
      }
    >
      {submitted ? (
        <Text testID="feedback-success" className="text-center text-sm text-brand-900 dark:text-ink-dark font-body">
          {strings.feedback.success}
        </Text>
      ) : null}

      {isOffline ? (
        <Text testID="feedback-offline" className="text-center text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {strings.feedback.offline}
        </Text>
      ) : null}

      {submitFeedback.isError ? (
        <Text testID="feedback-error" className="text-center text-sm text-red-700 dark:text-red-400">
          {strings.feedback.errorGeneric}
        </Text>
      ) : null}

      <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{strings.feedback.body}</Text>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
          {strings.feedback.categoryLabel}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {FEEDBACK_CATEGORIES.map((value) => (
            <Chip
              key={value}
              testID={`feedback-category-${value}`}
              label={strings.feedback.categories[value]}
              selected={category === value}
              onPress={() => setCategory(value)}
            />
          ))}
        </View>
      </View>

      <TextField
        testID="feedback-message"
        label={strings.feedback.messageLabel}
        placeholder={strings.feedback.messagePlaceholder}
        value={message}
        onChangeText={setMessage}
      />

      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
            {strings.feedback.attachLogsLabel}
          </Text>
          <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
            {strings.feedback.attachLogsHint}
          </Text>
        </View>
        <Switch
          testID="feedback-logs-consent"
          value={attachLogsConsent}
          onValueChange={setAttachLogsConsent}
        />
      </View>

      <View className="gap-2">
        <PrimaryButton
          testID="feedback-attach-image"
          label={screenshotKey !== undefined ? strings.feedback.imageAttached : strings.feedback.attachImage}
          loading={imageBusy}
          disabled={imageBusy || screenshotKey !== undefined}
          onPress={() => void handleAttachImage()}
        />
        {imageError !== undefined ? (
          <Text testID="feedback-image-error" className="text-sm text-red-700 dark:text-red-400">
            {imageError}
          </Text>
        ) : null}
      </View>
    </ScreenScaffold>
  );
}
