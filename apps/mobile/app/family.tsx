import { useState } from "react";
import { ActivityIndicator, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCreateInvite, useHouseholdMe } from "../src/api/households-api";
import { useAuthStore } from "../src/auth/auth-store";
import { PrimaryButton } from "../src/components/primary-button";
import { strings } from "../src/strings";

/**
 * Settings → Family (T026 plan): members list with role badges, and an
 * owner-gated "Invite someone" button that mints a fresh invite and opens
 * the native share sheet with the deep link. The invite/join deep link
 * itself comes from the API response only — nothing here hardcodes the
 * `pawcareright://` scheme (CLAUDE.md §1a).
 */
export default function FamilyScreen() {
  const { data: household, isLoading, isError, refetch } = useHouseholdMe();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const createInvite = useCreateInvite();
  const [inviteError, setInviteError] = useState(false);

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

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <ActivityIndicator testID="family-loading" />
        <Text className="text-center text-base text-brand-900">{strings.family.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="family-error" className="text-center text-base text-red-600">
          {strings.family.error}
        </Text>
        <PrimaryButton testID="family-retry" label={strings.family.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!household) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="family-empty" className="text-center text-base text-brand-900">
          {strings.family.empty}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView testID="family-scroll" className="flex-1">
        <View className="gap-4 px-6 pb-8 pt-4">
          <Text className="text-xl font-semibold text-brand-900">{strings.family.title}</Text>
          <View testID="family-members" className="gap-2">
            {household.members.map((member) => (
              <View
                key={member.userId}
                testID={`family-member-${member.userId}`}
                className="flex-row items-center justify-between rounded-lg border border-brand-100 px-4 py-3"
              >
                <Text className="text-base text-brand-900">{member.email}</Text>
                <Text
                  testID={`family-member-role-${member.userId}`}
                  className="text-sm font-semibold text-brand-700"
                >
                  {member.role === "OWNER" ? strings.family.owner : strings.family.member}
                </Text>
              </View>
            ))}
          </View>
          {isOwner ? (
            <View className="gap-2">
              <PrimaryButton
                testID="family-invite-button"
                label={strings.family.invite}
                loading={createInvite.isPending}
                onPress={() => void handleInvite()}
              />
              {inviteError ? (
                <Text testID="family-invite-error" className="text-center text-sm text-red-600">
                  {strings.family.inviteError}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
