import { ScrollView } from "react-native";

import { Chip } from "../chip";
import { strings } from "../../strings";

export interface QuickPromptsProps {
  onSelect: (text: string) => void;
}

const PROMPT_KEYS = ["symptom", "food", "routine"] as const;

/**
 * Horizontal row of starter prompts (T083 plan decision D10). Tapping a
 * chip PREFILLS the composer — it never sends and never deep-links. F3
 * (Food & Toxin Safety) has no mobile/API surface in this repo (verified:
 * no `apps/api/src/**\/food*`, no `toxin` match, no mobile F3 screen, no
 * PHASES mobile-F3 card), so "Is this food safe?" is answered by chat
 * itself rather than dead-ending on a route that doesn't exist
 * (design-system §7.5 "no flow dead-ends") — flagged as plan Risk R1.
 */
export function QuickPrompts({ onSelect }: QuickPromptsProps) {
  return (
    <ScrollView
      testID="chat-quick-prompts"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-2 px-4"
    >
      {PROMPT_KEYS.map((key) => {
        const label = strings.chat.quickPrompts[key];
        return (
          <Chip
            key={key}
            testID={`chat-quick-prompt-${key}`}
            label={label}
            selected={false}
            onPress={() => onSelect(label)}
          />
        );
      })}
    </ScrollView>
  );
}
