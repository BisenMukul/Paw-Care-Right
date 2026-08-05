import { Text, View } from "react-native";

import type { ChatUiMessage } from "../../chat/chat-store";
import { strings } from "../../strings";

export interface ChatBubbleProps {
  message: ChatUiMessage;
}

/**
 * One transcript bubble (design-system §1.1a tokens only, both themes).
 * User bubbles are right-aligned/filled; assistant bubbles are
 * left-aligned/tinted. A `SAFE_FALLBACK` assistant message renders its text
 * AS the answer (Safety statement 3 — it is not withheld) plus a
 * non-retryable notice underneath.
 */
export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <View
      testID={`chat-bubble-${message.id}`}
      className={
        isUser
          ? "max-w-[80%] self-end rounded-2xl bg-brand-700 dark:bg-accent-dark px-4 py-3"
          : "max-w-[80%] self-start rounded-2xl bg-brand-50 dark:bg-surface-raised-dark px-4 py-3"
      }
    >
      <Text className={isUser ? "text-base text-white font-body" : "text-base text-brand-900 dark:text-ink-dark font-body"}>
        {message.text}
      </Text>
      {!isUser && message.status === "safeFallback" ? (
        <View
          testID="chat-safe-fallback"
          className="mt-2 border-t border-brand-100 dark:border-hairline-dark pt-2"
        >
          <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{strings.chat.safeFallback}</Text>
        </View>
      ) : null}
    </View>
  );
}
