import { ActivityIndicator, Pressable, Text } from "react-native";

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

/** Small reusable CTA shared by the welcome/email/otp/done/push-rationale screens. */
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  testID,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      className={
        isDisabled
          ? "items-center rounded-lg bg-brand-300 px-6 py-3"
          : "items-center rounded-lg bg-brand-700 px-6 py-3"
      }
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" testID={testID ? `${testID}-spinner` : undefined} />
      ) : (
        <Text className="text-base font-semibold text-white">{label}</Text>
      )}
    </Pressable>
  );
}
