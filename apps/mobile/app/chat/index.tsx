import { useIsOffline } from "@bombaypetcompany/api-client";
import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";
import type { SymptomCategory } from "@bombaypetcompany/types";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePets } from "../../src/api/pets-api";
import { usePremiumStore } from "../../src/billing/premium-store";
import { isNearBottom } from "../../src/chat/scroll";
import type { ChatUiMessage } from "../../src/chat/chat-store";
import { useChatStream } from "../../src/chat/use-chat-stream";
import { AppHeader } from "../../src/components/app-header";
import { ActivePetBadge } from "../../src/components/chat/active-pet-badge";
import { ChatBubble } from "../../src/components/chat/chat-bubble";
import { ChatComposer } from "../../src/components/chat/chat-composer";
import { NudgeCard } from "../../src/components/chat/nudge-card";
import { QuickPrompts } from "../../src/components/chat/quick-prompts";
import { TypingIndicator } from "../../src/components/chat/typing-indicator";
import { EmptyState } from "../../src/components/empty-state";
import { PrimaryButton } from "../../src/components/primary-button";
import { SecondaryButton } from "../../src/components/secondary-button";
import { Skeleton } from "../../src/components/skeleton";
import { VetDisclaimer } from "../../src/components/vet-disclaimer";
import { useLayoutBucket } from "../../src/hooks/use-layout-bucket";
import { useNavBack } from "../../src/hooks/use-nav-back";
import { useActivePet } from "../../src/pets/use-active-pet";
import { strings } from "../../src/strings";

/**
 * Chat screen (T083 plan, F7 "Ask Bombay Pet Company"): pushed from the home
 * tab's quick-actions grid (D9 — not a 5th tab). Composes the active-pet
 * badge, streaming transcript, quick prompts, a tappable nudge card into
 * the EXISTING `/check/[category]` intake, and a PERSISTENT non-dismissible
 * `<VetDisclaimer/>` footer that renders in EVERY state below (CLAUDE §7
 * rule 3 / plan Safety statement 2) — it is not inside any conditional
 * branch. Hand-built `SafeAreaView` + `AppHeader` + `KeyboardAvoidingView` +
 * transcript `ScrollView` + footer (rather than `ScreenScaffold`) so the
 * transcript can own a scroll ref/`onScroll` for the auto-scroll-pin
 * behavior (D11), which `ScreenScaffold` does not expose.
 */
export default function ChatScreen() {
  const router = useRouter();
  const onBack = useNavBack("/(tabs)");
  const { pet, isLoading: petLoading, isError: petError } = useActivePet();
  // Same query key as inside `useActivePet` (`petsKeys.all`) -- dedupes to
  // the SAME cached query, just gives this screen a `refetch` for its own
  // error retry without touching `use-active-pet.ts` (out of scope).
  const { refetch: refetchPets } = usePets();
  const isOffline = useIsOffline();
  const premiumStatus = usePremiumStore((state) => state.status);
  const chat = useChatStream(pet?.id);
  const [draft, setDraft] = useState("");
  // Design-system §7.9: on `wide` (>=768dp) the reading column caps at
  // `max-w-2xl self-center` (this is a text-heavy reading screen, same
  // bucket rule as check-result/paywall); the `regular`/`compact` string
  // stays byte-identical to the base class (jest's default width 750
  // resolves `regular`, per `layout-bucket.test.tsx`'s pinned invariant).
  const bucket = useLayoutBucket();
  const transcriptContentClassName =
    bucket === "wide" ? "gap-3 px-4 pb-4 pt-2 w-full max-w-2xl self-center" : "gap-3 px-4 pb-4 pt-2";

  const scrollRef = useRef<ScrollView>(null);
  const pinnedToBottomRef = useRef(true);

  useEffect(() => {
    if (pinnedToBottomRef.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [chat.messages]);

  // FINDING-3 (design-system §7.5 "no flow dead-ends"): `blocked402` was a
  // permanent dead-end for the FEATURE-LOCK case -- the composer stays
  // disabled forever, and `send()` (the only exit) is unreachable through a
  // disabled composer. This screen stays mounted underneath the pushed
  // `/paywall` route, so a successful purchase there flips the shared
  // `premiumStatus` while this screen is still alive. Reset fires ONLY on
  // that non-entitled -> entitled TRANSITION while blocked -- the fair-use
  // QUOTA case never sees this fire, because the caller was already
  // "entitled" for the entire time it was quota-blocked (`previous` is
  // already "entitled", so the transition check is false), so that lock
  // legitimately persists until next month.
  const previousPremiumStatusRef = useRef(premiumStatus);
  useEffect(() => {
    const previousStatus = previousPremiumStatusRef.current;
    previousPremiumStatusRef.current = premiumStatus;
    if (previousStatus !== "entitled" && premiumStatus === "entitled" && chat.state === "blocked402") {
      chat.reset();
    }
    // `chat.reset` is referentially stable (`useCallback` with `[]` deps in
    // `useChatStream`) -- depending on it (not the whole `chat` object,
    // which is a fresh literal every render) keeps this effect from
    // re-running on every unrelated re-render.
  }, [premiumStatus, chat.state, chat.reset]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentSize, layoutMeasurement, contentOffset } = event.nativeEvent;
    pinnedToBottomRef.current = isNearBottom({
      contentHeight: contentSize.height,
      layoutHeight: layoutMeasurement.height,
      offsetY: contentOffset.y,
    });
  };

  const handleSend = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      return;
    }
    chat.send(trimmed);
    setDraft("");
  };

  const handleQuickPrompt = (text: string) => {
    // D10: prefill only -- never sends, never a network call.
    setDraft(text);
  };

  const handleNudgePress = (category: SymptomCategory) => {
    if (!pet) {
      return;
    }
    router.push({ pathname: "/check/[category]", params: { category, petId: pet.id } });
  };

  const goToPaywall = () => {
    router.push({ pathname: "/paywall", params: { source: "chat" } });
  };

  const composerDisabled =
    !pet || isOffline || chat.state === "blocked402" || chat.state === "sending" || chat.state === "streaming";

  function renderMessage(message: ChatUiMessage) {
    const showTyping = message.role === "assistant" && message.status === "streaming" && message.text.length === 0;

    return (
      <View key={message.id} testID={`chat-message-${message.id}`} className="gap-2">
        {message.role === "assistant" && message.nudgeCategory !== undefined ? (
          <NudgeCard testID="chat-nudge-card" onPress={() => handleNudgePress(message.nudgeCategory as SymptomCategory)} />
        ) : null}
        {showTyping ? <TypingIndicator /> : <ChatBubble message={message} />}
      </View>
    );
  }

  return (
    <SafeAreaView testID="chat-screen" edges={["top"]} className="flex-1 bg-surface-page dark:bg-surface-page-dark">
      <AppHeader title={strings.chat.title(APP_DISPLAY_NAME)} onBack={onBack} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          testID="chat-transcript"
          ref={scrollRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          className="flex-1"
          contentContainerClassName={transcriptContentClassName}
        >
          {petLoading ? (
            <Skeleton testID="chat-loading" lines={3} />
          ) : petError ? (
            <View testID="chat-error" className="items-center gap-4 px-6 py-10">
              <Text className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
                {strings.chat.error}
              </Text>
              <SecondaryButton testID="chat-retry-pet" label={strings.chat.retry} onPress={() => void refetchPets()} />
            </View>
          ) : !pet ? (
            <EmptyState testID="chat-no-pet" icon="paw-outline" title={strings.chat.noPet} />
          ) : (
            <>
              <ActivePetBadge pet={pet} />
              <Text testID="chat-subtitle" className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                {strings.chat.subtitle}
              </Text>
              {chat.messages.length === 0 ? (
                <View testID="chat-empty" className="items-center gap-4 rounded-2xl bg-white dark:bg-surface-card-dark px-6 py-10">
                  <Text className="text-center text-xl font-semibold text-brand-900 dark:text-ink-dark font-display">
                    {strings.chat.empty.title}
                  </Text>
                  <Text className="text-center text-base text-brand-700 dark:text-ink-muted-dark font-body">
                    {strings.chat.empty.body}
                  </Text>
                  <Text className="text-sm font-semibold text-brand-700 dark:text-ink-muted-dark font-body-semibold">
                    {strings.chat.quickPromptsHeading}
                  </Text>
                  <QuickPrompts onSelect={handleQuickPrompt} />
                </View>
              ) : (
                chat.messages.map(renderMessage)
              )}
              {chat.state === "dropped" || chat.state === "error" ? (
                <View
                  testID={chat.state === "dropped" ? "chat-stream-dropped" : "chat-stream-error"}
                  className="gap-2 rounded-2xl bg-brand-50 dark:bg-surface-raised-dark px-4 py-3"
                >
                  <Text className="text-sm text-brand-900 dark:text-ink-dark font-body">
                    {chat.state === "dropped" ? strings.chat.dropped.title : strings.chat.errorNotice}
                  </Text>
                  <SecondaryButton testID="chat-retry" label={strings.chat.dropped.retry} onPress={chat.retry} />
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        <View className="gap-3 border-t border-brand-100 dark:border-hairline-dark bg-surface-page dark:bg-surface-page-dark px-4 pb-6 pt-3">
          {isOffline ? (
            <Text
              testID="chat-offline-banner"
              accessibilityRole="alert"
              className="text-center text-sm text-brand-700 dark:text-ink-muted-dark"
            >
              {strings.chat.offlineBanner}
            </Text>
          ) : null}
          {chat.state === "blocked402" ? (
            premiumStatus === "entitled" ? (
              <View testID="chat-blocked-quota" className="gap-1 rounded-2xl bg-brand-50 dark:bg-surface-raised-dark px-4 py-3">
                <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                  {strings.chat.blocked.quotaTitle}
                </Text>
                <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                  {strings.chat.blocked.quotaBody}
                </Text>
              </View>
            ) : (
              <View testID="chat-blocked-upgrade" className="gap-2 rounded-2xl bg-brand-50 dark:bg-surface-raised-dark px-4 py-3">
                <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                  {strings.chat.blocked.upgradeTitle(APP_DISPLAY_NAME)}
                </Text>
                <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                  {strings.chat.blocked.upgradeBody}
                </Text>
                <PrimaryButton testID="chat-402-upgrade" label={strings.chat.blocked.upgradeCta} onPress={goToPaywall} />
              </View>
            )
          ) : null}
          <ChatComposer value={draft} onChangeText={setDraft} onSend={handleSend} disabled={composerDisabled} />
          <VetDisclaimer />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
