import { Ionicons } from "@expo/vector-icons";
import { CHAT_MESSAGE_MAX_CHARS } from "@bombaypetcompany/types";
import { Pressable, TextInput, View } from "react-native";

import { strings } from "../../strings";

export interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** Disabled while streaming, offline, or with no active pet. */
  disabled?: boolean;
}

/**
 * Input + send button (design-system §2.8/§7.4 thumb-zone: pinned to the
 * bottom via `ScreenScaffold`'s/the screen's fixed footer slot). Disabled
 * while streaming/offline/no-pet (`disabled`), and the SEND action is also
 * gated on a non-empty, within-limit draft (`CHAT_MESSAGE_MAX_CHARS`,
 * `packages/types` — never a hand-duplicated constant).
 */
export function ChatComposer({ value, onChangeText, onSend, disabled = false }: ChatComposerProps) {
  const overLimit = value.length > CHAT_MESSAGE_MAX_CHARS;
  const canSend = !disabled && value.trim().length > 0 && !overLimit;

  return (
    <View className="flex-row items-end gap-2">
      <TextInput
        testID="chat-composer-input"
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        multiline
        maxLength={CHAT_MESSAGE_MAX_CHARS + 1}
        placeholder={strings.chat.composer.placeholder}
        placeholderTextColor="#2f8f74"
        accessibilityLabel={strings.chat.composer.placeholder}
        className="max-h-32 flex-1 rounded-lg border border-brand-100 dark:border-hairline-dark bg-white dark:bg-surface-card-dark px-4 py-3 text-base text-brand-900 dark:text-ink-dark font-body"
      />
      <Pressable
        testID="chat-composer-send"
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={strings.chat.composer.sendA11y}
        accessibilityState={{ disabled: !canSend }}
        style={({ pressed }) => (pressed && canSend ? { opacity: 0.85 } : null)}
        className={
          canSend
            ? "h-11 w-11 items-center justify-center rounded-full bg-brand-700 dark:bg-accent-dark"
            : "h-11 w-11 items-center justify-center rounded-full bg-brand-300 dark:bg-surface-raised-dark"
        }
      >
        <Ionicons name="arrow-up" size={20} color="#ffffff" />
      </Pressable>
    </View>
  );
}
