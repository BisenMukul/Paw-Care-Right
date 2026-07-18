import { forwardRef } from "react";
import type { TextInputProps } from "react-native";
import { Text, TextInput, View } from "react-native";

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  testID?: string;
  errorTestID?: string;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  labelNativeID?: string;
}

/**
 * Design-system §2.8 canon: label above, input, inline `alert` error below —
 * one component. The error node renders ONLY when `error` is truthy, so a
 * screen with a single shared error region can drive at most one field's
 * inline slot at a time (see add-pet/details.tsx for the cross-field case).
 * `ref` forwards to the underlying `TextInput` so a failed submit can
 * `.focus()` it and/or drive `AccessibilityInfo.setAccessibilityFocus`.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    value,
    onChangeText,
    error = null,
    testID,
    errorTestID,
    placeholder,
    keyboardType,
    autoCapitalize,
    autoCorrect,
    labelNativeID,
  },
  ref,
) {
  const hasError = Boolean(error);
  const nativeID = labelNativeID ?? (testID ? `${testID}-label` : undefined);

  return (
    <View className="gap-1.5">
      <Text nativeID={nativeID} className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
        {label}
      </Text>
      <TextInput
        ref={ref}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#2f8f74"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        accessibilityLabel={label}
        accessibilityLabelledBy={nativeID}
        className={
          hasError
            ? "rounded-lg border border-red-600 bg-white dark:bg-surface-card-dark px-4 py-3 text-base text-brand-900 dark:text-ink-dark font-body"
            : "rounded-lg border border-brand-100 dark:border-hairline-dark bg-white dark:bg-surface-card-dark px-4 py-3 text-base text-brand-900 dark:text-ink-dark font-body"
        }
      />
      {hasError ? (
        <Text testID={errorTestID} accessibilityRole="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
