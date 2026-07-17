import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";

import { strings } from "../strings";

export interface OtpInputProps {
  value: string;
  onChangeText: (next: string) => void;
  onComplete: (code: string) => void;
  length?: number;
  hasError?: boolean;
  testID?: string;
}

function toCells(value: string, length: number): string[] {
  const chars = value.split("").slice(0, length);
  return Array.from({ length }, (_, i) => chars[i] ?? "");
}

/**
 * Controlled 6-cell OTP entry. Manages its own per-cell display state
 * (kept in sync with the `value` prop so a parent can clear/reset it, e.g.
 * after a wrong-code error) while notifying the parent of every change via
 * `onChangeText`/`onComplete`. Focus movement is best-effort via refs — it
 * cannot be meaningfully asserted from RNTL, so tests target the observable
 * callback contract instead (see plan AC1).
 */
export function OtpInput({
  value,
  onChangeText,
  onComplete,
  length = 6,
  hasError = false,
  testID = "otp-input",
}: OtpInputProps) {
  const [cells, setCells] = useState<string[]>(() => toCells(value, length));
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    setCells((current) => {
      if (current.join("") === value) {
        return current;
      }
      return toCells(value, length);
    });
  }, [value, length]);

  function commit(nextCells: string[]) {
    setCells(nextCells);
    const next = nextCells.join("");
    onChangeText(next);
    // NOTE: checking `!next.includes("")` on the *joined* string would be a
    // bug — every string "includes" the empty string, so that check is
    // always false and would silently prevent `onComplete` from ever
    // firing. Check the per-cell array instead: no cell may be empty.
    if (next.length === length && !nextCells.includes("")) {
      onComplete(next);
    }
  }

  function handleChangeText(index: number, text: string) {
    if (text.length > 1) {
      const pasted = text.split("").slice(0, length - index);
      const nextCells = [...cells];
      pasted.forEach((char, offset) => {
        nextCells[index + offset] = char;
      });
      commit(nextCells);
      const nextEmptyIndex = index + pasted.length;
      if (nextEmptyIndex < length) {
        inputRefs.current[nextEmptyIndex]?.focus();
      }
      return;
    }

    const nextCells = [...cells];
    nextCells[index] = text;
    commit(nextCells);

    if (text.length === 1 && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === "Backspace" && cells[index] === "" && index > 0) {
      const nextCells = [...cells];
      nextCells[index - 1] = "";
      commit(nextCells);
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <View testID={testID} className="flex-row justify-between gap-2">
      {cells.map((cell, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            inputRefs.current[index] = ref;
          }}
          testID={`${testID}-cell-${index}`}
          aria-invalid={hasError}
          accessibilityLabel={strings.auth.otp.cellLabel(index)}
          value={cell}
          onChangeText={(text) => handleChangeText(index, text)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
          keyboardType="number-pad"
          maxLength={1}
          textContentType={index === 0 ? "oneTimeCode" : undefined}
          className={
            hasError
              ? "h-14 w-12 rounded-lg border-2 border-red-600 text-center text-xl text-red-700"
              : "h-14 w-12 rounded-lg border border-brand-100 text-center text-xl text-brand-900"
          }
        />
      ))}
    </View>
  );
}
