import { isApiError, useIsOffline } from "@pawcareright/api-client";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@pawcareright/types";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePrivacySettings, useRequestExport, useDeleteAccount } from "../../src/api/privacy-api";
import { useAuthStore } from "../../src/auth/auth-store";
import { Card } from "../../src/components/card";
import { GhostButton } from "../../src/components/ghost-button";
import { PrimaryButton } from "../../src/components/primary-button";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { Skeleton } from "../../src/components/skeleton";
import { useNavBack } from "../../src/hooks/use-nav-back";
import { strings } from "../../src/strings";

type ExportNotice = "none" | "pending" | "error";
type DeleteNotice = "none" | "conflict" | "error";

/**
 * Settings -> Privacy & data (T091 plan): a self-serve data export request
 * plus a two-step destructive account-deletion confirmation (tap ->
 * consequences panel -> a SEPARATE destructive confirm button; the first
 * tap sends NO request). No AI output, no disclaimer/emergency surface --
 * this screen only manages the caller's own consent/export/deletion
 * (plan Safety statement).
 */
export default function PrivacyScreen() {
  const onBack = useNavBack("/(tabs)/settings");
  const { data: settings, isLoading, isError, refetch } = usePrivacySettings();
  const isOffline = useIsOffline();
  const requestExport = useRequestExport();
  const deleteAccount = useDeleteAccount();

  const [exportNotice, setExportNotice] = useState<ExportNotice>("none");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<DeleteNotice>("none");

  async function handleExport() {
    setExportNotice("none");
    try {
      await requestExport.mutateAsync();
      setExportNotice("pending");
    } catch {
      setExportNotice("error");
    }
  }

  async function handleDeleteConfirm() {
    setDeleteNotice("none");
    try {
      await deleteAccount.mutateAsync();
      await useAuthStore.getState().signOut();
    } catch (err) {
      setDeleteNotice(isApiError(err) && err.code === "CONFLICT" ? "conflict" : "error");
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Card testID="privacy-loading">
          <Skeleton lines={4} />
        </Card>
        <Text className="text-center text-base text-brand-900 dark:text-ink-dark font-body">{strings.privacy.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isOffline && !settings) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="privacy-offline" className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
          {strings.privacy.offline}
        </Text>
        <PrimaryButton testID="privacy-retry" label={strings.privacy.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="privacy-error" className="text-center text-base text-red-700 dark:text-red-400">
          {strings.privacy.error}
        </Text>
        <PrimaryButton testID="privacy-retry" label={strings.privacy.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!settings) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="privacy-empty" className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
          {strings.privacy.empty}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <ScreenScaffold title={strings.privacy.title} scrollTestID="privacy-scroll" onBack={onBack}>
      {isOffline ? (
        <Text
          testID="privacy-offline-banner"
          accessibilityRole="alert"
          className="text-center text-sm text-brand-700 dark:text-ink-muted-dark font-body"
        >
          {strings.privacy.offlineBanner}
        </Text>
      ) : null}

      <Card className="gap-3">
        <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
          {strings.privacy.exportHeading}
        </Text>
        <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{strings.privacy.exportBody}</Text>
        <PrimaryButton
          testID="privacy-export-button"
          label={strings.privacy.exportButton}
          loading={requestExport.isPending}
          disabled={isOffline}
          onPress={() => void handleExport()}
        />
        {exportNotice === "pending" ? (
          <Text testID="privacy-export-pending" className="text-center text-sm text-brand-900 dark:text-ink-dark font-body">
            {strings.privacy.exportPending}
          </Text>
        ) : null}
        {exportNotice === "error" ? (
          <Text testID="privacy-export-error" className="text-center text-sm text-red-700 dark:text-red-400">
            {strings.privacy.exportError}
          </Text>
        ) : null}
      </Card>

      <Card className="gap-3">
        <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
          {strings.privacy.deleteHeading}
        </Text>

        {showDeleteConfirm ? (
          <View testID="privacy-delete-confirm-panel" className="gap-3">
            <Text testID="privacy-delete-consequences" className="text-sm text-brand-900 dark:text-ink-dark font-body">
              {strings.privacy.deleteConsequences}
            </Text>
            <Text testID="privacy-delete-grace" className="text-sm text-brand-900 dark:text-ink-dark font-body">
              {strings.privacy.deleteGrace(ACCOUNT_DELETION_GRACE_DAYS)}
            </Text>
            <PrimaryButton
              testID="privacy-delete-confirm-button"
              label={strings.privacy.deleteConfirm}
              loading={deleteAccount.isPending}
              disabled={isOffline}
              onPress={() => void handleDeleteConfirm()}
            />
            <GhostButton
              testID="privacy-delete-cancel"
              label={strings.privacy.deleteCancel}
              onPress={() => setShowDeleteConfirm(false)}
            />
            {deleteNotice === "conflict" ? (
              <Text testID="privacy-delete-conflict" className="text-center text-sm text-red-700 dark:text-red-400">
                {strings.privacy.deleteConflict}
              </Text>
            ) : null}
            {deleteNotice === "error" ? (
              <Text testID="privacy-delete-error" className="text-center text-sm text-red-700 dark:text-red-400">
                {strings.privacy.deleteError}
              </Text>
            ) : null}
          </View>
        ) : (
          <PrimaryButton
            testID="privacy-delete-button"
            label={strings.privacy.deleteButton}
            onPress={() => setShowDeleteConfirm(true)}
          />
        )}
      </Card>
    </ScreenScaffold>
  );
}
