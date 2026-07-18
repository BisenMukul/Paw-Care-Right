import { Ionicons } from "@expo/vector-icons";
import type { ActivityType, ActivityUnit } from "@pawcareright/types";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ACTIVITY_TYPE_CONFIG, clampQuantity, type StepRange } from "../health-logs/activity-config";
import { strings } from "../strings";
import { PrimaryButton } from "./primary-button";

export interface ActivityQuantitySheetSaveInput {
  quantity?: number;
  unit?: ActivityUnit;
  note?: string;
}

export interface ActivityQuantitySheetProps {
  visible: boolean;
  activityType: ActivityType | null;
  /** Smart default (design-system §5.1 "last-used value, else the default below"). Required (but nullable) rather than optional -- see the executor's exactOptionalPropertyTypes report note. */
  initialQuantity: number | undefined;
  initialUnit: ActivityUnit | undefined;
  submitting: boolean;
  onSave: (input: ActivityQuantitySheetSaveInput) => void;
  onClose: () => void;
  onWrittenNote: () => void;
}

function unitLabel(unit: ActivityUnit): string {
  return strings.activity.unitLabel[unit];
}

function QuantityStepper({
  value,
  range,
  onChange,
}: {
  value: number;
  range: StepRange;
  onChange: (next: number) => void;
}) {
  return (
    <View className="flex-row items-center justify-center gap-4">
      <Pressable
        testID="activity-quantity-decrease"
        accessibilityRole="button"
        accessibilityLabel={strings.activity.quantityDecreaseA11y}
        hitSlop={8}
        onPress={() => onChange(clampQuantity(value - range.step, range))}
        className="h-11 w-11 items-center justify-center rounded-full bg-brand-100"
      >
        <Ionicons name="remove" size={20} color="#1f6350" />
      </Pressable>
      <Text testID="activity-quantity-value" className="min-w-[56px] text-center text-2xl font-bold text-brand-900">
        {value}
      </Text>
      <Pressable
        testID="activity-quantity-increase"
        accessibilityRole="button"
        accessibilityLabel={strings.activity.quantityIncreaseA11y}
        hitSlop={8}
        onPress={() => onChange(clampQuantity(value + range.step, range))}
        className="h-11 w-11 items-center justify-center rounded-full bg-brand-100"
      >
        <Ionicons name="add" size={20} color="#1f6350" />
      </Pressable>
    </View>
  );
}

function UnitChipRow({
  testIDPrefix,
  options,
  selected,
  onSelect,
}: {
  testIDPrefix: string;
  options: readonly ActivityUnit[];
  selected: ActivityUnit | undefined;
  onSelect: (unit: ActivityUnit) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <Pressable
            key={option}
            testID={`${testIDPrefix}-${option}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={strings.activity.unitToggleA11y(unitLabel(option))}
            onPress={() => onSelect(option)}
            className={
              isSelected
                ? "rounded-full bg-brand-700 px-4 py-2.5"
                : "rounded-full border border-brand-100 bg-white px-4 py-2.5"
            }
          >
            <Text className={isSelected ? "text-sm font-semibold text-white" : "text-sm text-brand-900"}>
              {unitLabel(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Tap 2 of the tap-first activity logger (design-system §5.1): a
 * bottom-sheet-style modal, pre-filled with the selected type's smart
 * default so the `PrimaryButton` alone (no other interaction) is a valid
 * save -- the ≤2-tap contract this component exists to protect (executor
 * non-vacuity mutation-proof #3 targets exactly that path).
 */
export function ActivityQuantitySheet({
  visible,
  activityType,
  initialQuantity,
  initialUnit,
  submitting,
  onSave,
  onClose,
  onWrittenNote,
}: ActivityQuantitySheetProps) {
  const [quantity, setQuantity] = useState<number | undefined>(undefined);
  const [unit, setUnit] = useState<ActivityUnit | undefined>(undefined);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible || activityType === null) {
      return;
    }
    const config = ACTIVITY_TYPE_CONFIG[activityType];
    setQuantity(initialQuantity ?? config.defaultQuantity);
    setUnit(initialUnit ?? config.defaultUnit);
    setNote("");
    // Intentionally re-initializes only when the sheet (re)opens for a
    // (possibly new) type -- NOT on every `initialQuantity`/`initialUnit`
    // change, so a parent re-render mid-sheet never clobbers the user's
    // in-progress edits (this repo has no react-hooks/exhaustive-deps rule
    // enabled, so no disable directive is needed here).
  }, [visible, activityType]);

  if (activityType === null) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View />
      </Modal>
    );
  }

  const config = ACTIVITY_TYPE_CONFIG[activityType];

  function handleClose() {
    setNote("");
    onClose();
  }

  function handleSave() {
    const trimmedNote = note.trim();
    onSave({
      ...(quantity !== undefined ? { quantity } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
    });
  }

  function handleUnitToggle(nextUnit: ActivityUnit) {
    if (nextUnit === unit) {
      return;
    }
    setUnit(nextUnit);
    const nextRange = nextUnit === config.altUnit ? (config.altRange ?? config.defaultRange) : config.defaultRange;
    setQuantity(nextRange.min);
  }

  const activeRange = unit === config.altUnit && config.altRange ? config.altRange : config.defaultRange;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <SafeAreaView testID="activity-sheet" className="rounded-t-2xl bg-white">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View className="gap-4 p-6">
              <View className="self-center h-1 w-10 rounded-full bg-brand-200" />
              <Text className="text-lg font-semibold text-brand-900">
                {strings.activity.typeLabel[activityType]}
              </Text>

              {config.control === "stepperWithUnit" && config.altUnit !== undefined ? (
                <>
                  <UnitChipRow
                    testIDPrefix="activity-unit"
                    options={[config.defaultUnit, config.altUnit]}
                    selected={unit}
                    onSelect={handleUnitToggle}
                  />
                  <QuantityStepper value={quantity ?? activeRange.min} range={activeRange} onChange={setQuantity} />
                </>
              ) : null}

              {config.control === "countWithChips" && config.chipUnits !== undefined ? (
                <>
                  <QuantityStepper
                    value={quantity ?? config.defaultRange.min}
                    range={config.defaultRange}
                    onChange={setQuantity}
                  />
                  <UnitChipRow
                    testIDPrefix="activity-option"
                    options={config.chipUnits}
                    selected={unit}
                    onSelect={setUnit}
                  />
                </>
              ) : null}

              {config.control === "duration" ? (
                <QuantityStepper
                  value={quantity ?? config.defaultRange.min}
                  range={config.defaultRange}
                  onChange={setQuantity}
                />
              ) : null}

              {config.control === "chipsOnly" && config.chipUnits !== undefined ? (
                <UnitChipRow
                  testIDPrefix="activity-option"
                  options={config.chipUnits}
                  selected={unit}
                  onSelect={setUnit}
                />
              ) : null}

              <TextInput
                testID="activity-note-input"
                value={note}
                onChangeText={setNote}
                placeholder={strings.activity.notePlaceholder}
                maxLength={280}
                className="rounded-lg border border-brand-100 px-4 py-3 text-base text-brand-900"
              />

              <Pressable testID="activity-sheet-written-note" accessibilityRole="button" onPress={onWrittenNote}>
                <Text className="text-sm font-semibold text-brand-700">{strings.activity.writtenNoteLink}</Text>
              </Pressable>

              <View className="flex-row justify-end gap-4">
                <Pressable testID="activity-sheet-cancel" onPress={handleClose} accessibilityRole="button">
                  <Text className="text-base font-semibold text-brand-700">{strings.activity.cancel}</Text>
                </Pressable>
                <PrimaryButton
                  testID="activity-sheet-save"
                  label={strings.activity.save}
                  onPress={handleSave}
                  loading={submitting}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
