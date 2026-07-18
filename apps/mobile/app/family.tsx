import { useState } from "react";
import { RefreshControl, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useEntitlement } from "../src/api/billing-api";
import { useCreateInvite, useHouseholdMe, useLeaveHousehold } from "../src/api/households-api";
import { useAuthStore } from "../src/auth/auth-store";
import { Card } from "../src/components/card";
import { EmptyState } from "../src/components/empty-state";
import { GhostButton } from "../src/components/ghost-button";
import { ListRow } from "../src/components/list-row";
import { PrimaryButton } from "../src/components/primary-button";
import { ScreenScaffold } from "../src/components/screen-scaffold";
import { Skeleton } from "../src/components/skeleton";
import { strings } from "../src/strings";

/**
 * Settings → Family (T026 plan): members list with role badges, and an
 * owner-gated "Invite someone" button that mints a fresh invite and opens
 * the native share sheet with the deep link. The invite/join deep link
 * itself comes from the API response only — nothing here hardcodes the
 * `pawcareright://` scheme (CLAUDE.md §1a).
 *
 * T077: a non-owner (MEMBER) caller instead sees a "Leave household"
 * button. Pressing it opens a confirmation with a grace warning shown only
 * when the caller's entitlement is currently sourced from this household's
 * family plan (`useEntitlement().data?.source === "family"`) — leaving
 * drops that access immediately (server-side, `useLeaveHousehold`).
 */
export default function FamilyScreen() {
  const { data: household, isLoading, isError, isRefetching, refetch } = useHouseholdMe();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const createInvite = useCreateInvite();
  const { data: entitlement } = useEntitlement();
  const leaveHousehold = useLeaveHousehold();
  const [inviteError, setInviteError] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveError, setLeaveError] = useState(false);

  const isOwner = household?.members.some(
    (member) => member.userId === currentUserId && member.role === "OWNER",
  );

  async function handleInvite() {
    setInviteError(false);
    try {
      const invite = await createInvite.mutateAsync();
      await Share.share({ message: invite.deepLink });
    } catch {
      setInviteError(true);
    }
  }

  async function handleLeave() {
    setLeaveError(false);
    try {
      await leaveHousehold.mutateAsync();
    } catch {
      setLeaveError(true);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 dark:bg-surface-page-dark px-6">
        <Card testID="family-loading">
          <Skeleton lines={3} />
        </Card>
        <Text className="text-center text-base text-brand-900 dark:text-ink-dark font-body">{strings.family.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 dark:bg-surface-page-dark px-6">
        <Text testID="family-error" className="text-center text-base text-red-700 dark:text-red-400">
          {strings.family.error}
        </Text>
        <PrimaryButton testID="family-retry" label={strings.family.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!household) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 dark:bg-surface-page-dark px-6">
        <EmptyState testID="family-empty" icon="home-outline" title={strings.family.empty} />
      </SafeAreaView>
    );
  }

  return (
    <ScreenScaffold
      title={strings.family.title}
      scrollTestID="family-scroll"
      refreshControl={<RefreshControl tintColor="#1f6350" refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <Card>
        <View testID="family-members" className="gap-1">
          {household.members.map((member) => (
            <ListRow
              key={member.userId}
              testID={`family-member-${member.userId}`}
              title={member.email}
              trailing={
                <Text
                  testID={`family-member-role-${member.userId}`}
                  className="text-sm font-semibold text-brand-700 dark:text-ink-muted-dark font-body-semibold"
                >
                  {member.role === "OWNER" ? strings.family.owner : strings.family.member}
                </Text>
              }
            />
          ))}
        </View>
      </Card>
      {isOwner ? (
        <View className="gap-2">
          <PrimaryButton
            testID="family-invite-button"
            label={strings.family.invite}
            loading={createInvite.isPending}
            onPress={() => void handleInvite()}
          />
          {inviteError ? (
            <Text testID="family-invite-error" className="text-center text-sm text-red-700 dark:text-red-400">
              {strings.family.inviteError}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="gap-2">
          {showLeaveConfirm ? (
            <View testID="family-leave-confirm" className="gap-3">
              <Text className="text-center text-sm text-brand-900 dark:text-ink-dark font-body">
                {strings.family.leaveConfirmBody}
              </Text>
              {entitlement?.source === "family" ? (
                <Text testID="family-leave-grace" className="text-center text-sm text-red-700 dark:text-red-400">
                  {strings.family.leaveGrace}
                </Text>
              ) : null}
              <PrimaryButton
                testID="family-leave-confirm-button"
                label={strings.family.leaveConfirm}
                loading={leaveHousehold.isPending}
                onPress={() => void handleLeave()}
              />
              <GhostButton
                testID="family-leave-cancel"
                label={strings.family.leaveCancel}
                onPress={() => setShowLeaveConfirm(false)}
              />
              {leaveError ? (
                <Text testID="family-leave-error" className="text-center text-sm text-red-700 dark:text-red-400">
                  {strings.family.leaveError}
                </Text>
              ) : null}
            </View>
          ) : (
            <PrimaryButton
              testID="family-leave-button"
              label={strings.family.leave}
              onPress={() => setShowLeaveConfirm(true)}
            />
          )}
        </View>
      )}
    </ScreenScaffold>
  );
}
