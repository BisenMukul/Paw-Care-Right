import { useIsOffline } from "@pawcareright/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useInstantiateTemplate, useTemplateSuggestions } from "../../src/api/care-plan-api";
import { getDeviceRegionCode } from "../../src/checks/region";
import { Card } from "../../src/components/card";
import { EmptyState } from "../../src/components/empty-state";
import { GhostButton } from "../../src/components/ghost-button";
import { PrimaryButton } from "../../src/components/primary-button";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { Skeleton } from "../../src/components/skeleton";
import { strings } from "../../src/strings";

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const DAY_MS = 24 * 60 * 60 * 1000;

const STEPPER_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
const STEPPER_CLASS = "min-h-[44px] justify-center rounded-lg border border-brand-100 px-2 py-1";

function todayIso(): string {
  return new Date().toISOString();
}

/** Pure calendar-day shift on an ISO datetime string (plan decision 3 -- no new date-picker dependency). */
function shiftIsoDate(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

/** Deterministic YYYY-MM-DD display (mirrors `check-history.ts`'s `formatCheckDate`). */
function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

interface RowState {
  enabled: boolean;
  startAt: string;
}

/**
 * Care plan setup wizard (T059 plan): post-pet-creation prompt (also
 * reachable from the Care tab) that reviews the server-resolved
 * care-template suggestions, lets the owner toggle items on/off and edit
 * each item's start date, and on Confirm instantiates the reviewed
 * selection via `from-template`. Care-scheduling content only -- no AI
 * output, no `<VetDisclaimer/>`/emergency surface (plan Safety statement).
 * Every rendered row shows its (schema-enforced, vet-confirm) `note`
 * verbatim; the template content itself is read-only here.
 */
export default function CarePlanWizardScreen() {
  const router = useRouter();
  const { petId, localPhoto } = useLocalSearchParams<{ petId: string; localPhoto?: string }>();
  const countryCode = getDeviceRegionCode();
  const { data: suggestions, isLoading, isError, refetch } = useTemplateSuggestions(
    petId,
    countryCode !== undefined ? { countryCode } : {},
  );
  const isOffline = useIsOffline();
  const instantiate = useInstantiateTemplate(petId);

  const [rows, setRows] = useState<Map<string, RowState>>(new Map());
  const [seeded, setSeeded] = useState(false);
  const [confirmError, setConfirmError] = useState(false);

  // Seed once per fetch (mirrors `settings/notifications.tsx`'s `seeded`
  // guard): enabled only when not already existing and the default date is
  // anchorable (plan Risk/decision 4); unanchorable rows default to today
  // and start disabled.
  useEffect(() => {
    if (suggestions && !seeded) {
      const next = new Map<string, RowState>();
      for (const item of suggestions.items) {
        next.set(item.templateKey, {
          enabled: !item.alreadyExists && item.defaultStartAt !== null,
          startAt: item.defaultStartAt ?? todayIso(),
        });
      }
      setRows(next);
      setSeeded(true);
    }
  }, [suggestions, seeded]);

  function toggleRow(templateKey: string, enabled: boolean) {
    setRows((prev) => {
      const next = new Map(prev);
      const current = next.get(templateKey);
      if (current) {
        next.set(templateKey, { ...current, enabled });
      }
      return next;
    });
  }

  function shiftRow(templateKey: string, days: number) {
    setRows((prev) => {
      const next = new Map(prev);
      const current = next.get(templateKey);
      if (current) {
        next.set(templateKey, { ...current, startAt: shiftIsoDate(current.startAt, days) });
      }
      return next;
    });
  }

  function goToPetHome() {
    router.replace({ pathname: "/pets/[id]", params: { id: petId, localPhoto: localPhoto ?? "" } });
  }

  async function handleConfirm() {
    setConfirmError(false);
    const selections = [...rows.entries()]
      .filter(([, row]) => row.enabled)
      .map(([templateKey, row]) => ({ templateKey, startAt: row.startAt }));

    try {
      // Same countryCode as the GET above (plan decision 1) -- keeps the
      // reviewed list and the created reminders resolving the identical pack.
      await instantiate.mutateAsync({
        timezone: DEFAULT_TIMEZONE,
        ...(countryCode !== undefined ? { countryCode } : {}),
        selections,
      });
      goToPetHome();
    } catch {
      setConfirmError(true);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Card testID="care-plan-loading">
          <Skeleton lines={3} />
        </Card>
        <Text className="text-center text-base text-brand-900">{strings.carePlan.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isOffline && !suggestions) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Text testID="care-plan-offline" className="text-center text-base text-brand-900">
          {strings.carePlan.offline}
        </Text>
        <PrimaryButton testID="care-plan-retry" label={strings.carePlan.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Text testID="care-plan-error" className="text-center text-base text-red-700">
          {strings.carePlan.error}
        </Text>
        <PrimaryButton testID="care-plan-retry" label={strings.carePlan.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!suggestions || suggestions.items.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <EmptyState
          testID="care-plan-empty"
          icon="clipboard-outline"
          title={strings.carePlan.empty}
          body={strings.carePlan.emptyBody}
          ctaLabel={strings.carePlan.skip}
          onCtaPress={goToPetHome}
          ctaTestID="care-plan-skip"
        />
      </SafeAreaView>
    );
  }

  return (
    <ScreenScaffold title={strings.carePlan.title} subtitle={strings.carePlan.subtitle} scrollTestID="care-plan-scroll">
      {isOffline ? (
        <Text testID="care-plan-offline-banner" className="text-center text-sm text-brand-700">
          {strings.carePlan.offlineBanner}
        </Text>
      ) : null}

      <View className="gap-3">
        {suggestions.items.map((item) => {
          const row = rows.get(item.templateKey);
          const startAt = row?.startAt ?? item.defaultStartAt ?? todayIso();

          return (
            <Card key={item.templateKey} testID={`care-plan-item-${item.templateKey}`} className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-base font-semibold text-brand-900">{item.title}</Text>
                <Switch
                  testID={`care-plan-toggle-${item.templateKey}`}
                  value={row?.enabled ?? false}
                  onValueChange={(enabled) => toggleRow(item.templateKey, enabled)}
                />
              </View>

              {item.emphasis ? (
                <Text
                  testID={`care-plan-emphasis-${item.templateKey}`}
                  className="text-xs font-semibold text-brand-700"
                >
                  {strings.carePlan.emphasisBadge}
                </Text>
              ) : null}

              {item.alreadyExists ? (
                <Text
                  testID={`care-plan-already-exists-${item.templateKey}`}
                  className="text-xs text-brand-700"
                >
                  {strings.carePlan.alreadyAddedBadge}
                </Text>
              ) : null}

              <Text testID={`care-plan-note-${item.templateKey}`} className="text-sm text-brand-700">
                {item.note}
              </Text>

              <View className="flex-row items-center gap-2">
                <Pressable
                  testID={`care-plan-stepper-${item.templateKey}-minus1w`}
                  onPress={() => shiftRow(item.templateKey, -7)}
                  hitSlop={STEPPER_HIT_SLOP}
                  className={STEPPER_CLASS}
                >
                  <Text className="text-sm text-brand-900">{strings.carePlan.dateEdit.earlier1w}</Text>
                </Pressable>
                <Pressable
                  testID={`care-plan-stepper-${item.templateKey}-minus1d`}
                  onPress={() => shiftRow(item.templateKey, -1)}
                  hitSlop={STEPPER_HIT_SLOP}
                  className={STEPPER_CLASS}
                >
                  <Text className="text-sm text-brand-900">{strings.carePlan.dateEdit.earlier1d}</Text>
                </Pressable>
                <Text testID={`care-plan-date-${item.templateKey}`} className="text-sm font-semibold text-brand-900">
                  {formatDate(startAt)}
                </Text>
                <Pressable
                  testID={`care-plan-stepper-${item.templateKey}-plus1d`}
                  onPress={() => shiftRow(item.templateKey, 1)}
                  hitSlop={STEPPER_HIT_SLOP}
                  className={STEPPER_CLASS}
                >
                  <Text className="text-sm text-brand-900">{strings.carePlan.dateEdit.later1d}</Text>
                </Pressable>
                <Pressable
                  testID={`care-plan-stepper-${item.templateKey}-plus1w`}
                  onPress={() => shiftRow(item.templateKey, 7)}
                  hitSlop={STEPPER_HIT_SLOP}
                  className={STEPPER_CLASS}
                >
                  <Text className="text-sm text-brand-900">{strings.carePlan.dateEdit.later1w}</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}
      </View>

      <PrimaryButton
        testID="care-plan-confirm"
        label={strings.carePlan.confirm}
        loading={instantiate.isPending}
        onPress={() => void handleConfirm()}
      />
      {confirmError ? (
        <Text testID="care-plan-confirm-error" className="text-center text-sm text-red-700">
          {strings.carePlan.confirmError}
        </Text>
      ) : null}
      <GhostButton testID="care-plan-skip" label={strings.carePlan.skip} onPress={goToPetHome} />
    </ScreenScaffold>
  );
}
