import type { Answer, QuestionDef } from "@pawcareright/types";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import type { PhotoUploadCapability } from "../../api/intake-photos-api";
import { strings } from "../../strings";
import { PhotoPromptQuestion } from "./photo-prompt-question";

export interface QuestionRendererProps {
  question: QuestionDef;
  answer: Answer | undefined;
  onChange: (answer: Answer | undefined) => void;
  /** T046: pet-scoped upload seam, threaded only into the `photoPrompt` case. */
  photoUpload?: PhotoUploadCapability | undefined;
}

type SingleQuestionDef = Extract<QuestionDef, { type: "single" }>;
type MultiQuestionDef = Extract<QuestionDef, { type: "multi" }>;
type ScaleQuestionDef = Extract<QuestionDef, { type: "scale" }>;
type DurationQuestionDef = Extract<QuestionDef, { type: "duration" }>;

type SingleAnswer = Extract<Answer, { type: "single" }>;
type MultiAnswer = Extract<Answer, { type: "multi" }>;
type ScaleAnswer = Extract<Answer, { type: "scale" }>;
type DurationAnswer = Extract<Answer, { type: "duration" }>;

export interface SingleQuestionProps {
  question: SingleQuestionDef;
  answer: SingleAnswer | undefined;
  onChange: (answer: SingleAnswer | undefined) => void;
}

/** Radio list (plan Renderer spec §1). Never emits `undefined` — no deselect. */
export function SingleQuestion({ question, answer, onChange }: SingleQuestionProps) {
  return (
    <View className="gap-2">
      {question.options.map((option) => {
        const selected = answer?.value === option.value;
        return (
          <Pressable
            key={option.value}
            testID={`intake-option-${question.id}-${option.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange({ type: "single", questionId: question.id, value: option.value })}
            style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
            className={
              selected
                ? "min-h-[44px] rounded-2xl border-2 border-brand-700 bg-brand-100 px-4 py-3 shadow-md dark:border-accent-bright dark:bg-surface-raised-dark"
                : "min-h-[44px] rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-md dark:border-hairline-dark dark:bg-surface-card-dark"
            }
          >
            <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark">{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface MultiQuestionProps {
  question: MultiQuestionDef;
  answer: MultiAnswer | undefined;
  onChange: (answer: MultiAnswer | undefined) => void;
}

/** Checkbox list with optional `maxSelections` enforcement (plan Renderer spec §2). */
export function MultiQuestion({ question, answer, onChange }: MultiQuestionProps) {
  const values = answer?.values ?? [];
  const atMax = question.maxSelections !== undefined && values.length === question.maxSelections;

  function toggle(value: string) {
    const isSelected = values.includes(value);
    if (!isSelected && atMax) {
      return;
    }
    const nextValues = isSelected ? values.filter((v) => v !== value) : [...values, value];
    if (nextValues.length === 0) {
      onChange(undefined);
      return;
    }
    onChange({ type: "multi", questionId: question.id, values: nextValues });
  }

  return (
    <View className="gap-2">
      {question.maxSelections !== undefined ? (
        <Text testID={`intake-multi-hint-${question.id}`} className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {strings.intake.maxSelectionsHint(question.maxSelections)}
        </Text>
      ) : null}
      {question.options.map((option) => {
        const selected = values.includes(option.value);
        const disabled = !selected && atMax;
        return (
          <Pressable
            key={option.value}
            testID={`intake-option-${question.id}-${option.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => toggle(option.value)}
            style={({ pressed }) => (pressed && !disabled ? { opacity: 0.85 } : null)}
            className={
              selected
                ? "min-h-[44px] rounded-2xl border-2 border-brand-700 bg-brand-100 px-4 py-3 shadow-md dark:border-accent-bright dark:bg-surface-raised-dark"
                : disabled
                  ? "min-h-[44px] rounded-2xl border border-brand-100 bg-white px-4 py-3 opacity-50 dark:border-hairline-dark dark:bg-surface-card-dark"
                  : "min-h-[44px] rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-md dark:border-hairline-dark dark:bg-surface-card-dark"
            }
          >
            <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark">{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface ScaleQuestionProps {
  question: ScaleQuestionDef;
  answer: ScaleAnswer | undefined;
  onChange: (answer: ScaleAnswer | undefined) => void;
}

/** Row of numeric buttons `min..max` inclusive (plan Renderer spec §3). */
export function ScaleQuestion({ question, answer, onChange }: ScaleQuestionProps) {
  const values: number[] = [];
  for (let n = question.min; n <= question.max; n += 1) {
    values.push(n);
  }

  return (
    <View className="gap-2">
      <View className="flex-row justify-between gap-2">
        {values.map((n) => {
          const selected = answer?.value === n;
          return (
            <Pressable
              key={n}
              testID={`intake-scale-${question.id}-${n}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange({ type: "scale", questionId: question.id, value: n })}
              style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
              className={
                selected
                  ? "min-h-[44px] flex-1 items-center justify-center rounded-full bg-brand-700 py-3 dark:bg-accent-dark"
                  : "min-h-[44px] flex-1 items-center justify-center rounded-full border border-brand-100 bg-white py-3 dark:border-hairline-dark dark:bg-surface-card-dark"
              }
            >
              <Text
                className={
                  selected ? "text-base font-semibold text-white" : "text-base text-brand-900 dark:text-ink-dark"
                }
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row justify-between">
        <Text testID={`intake-scale-minlabel-${question.id}`} className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {question.minLabel}
        </Text>
        <Text testID={`intake-scale-maxlabel-${question.id}`} className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {question.maxLabel}
        </Text>
      </View>
    </View>
  );
}

export interface DurationQuestionProps {
  question: DurationQuestionDef;
  answer: DurationAnswer | undefined;
  onChange: (answer: DurationAnswer | undefined) => void;
}

/**
 * Numeric value + unit picker (plan Renderer spec §4 / Risk R7). Keeps
 * minimal local state for the in-progress raw text + selected unit (a
 * half-typed value has no valid `Answer` representation), seeded from
 * `answer`. Emits a full `Answer` only when value > 0 and a unit are both
 * present, else `onChange(undefined)`.
 */
export function DurationQuestion({ question, answer, onChange }: DurationQuestionProps) {
  const [rawText, setRawText] = useState(answer !== undefined ? String(answer.value) : "");
  const [unit, setUnit] = useState(answer?.unit);

  function emit(nextRawText: string, nextUnit: DurationAnswer["unit"] | undefined) {
    const parsed = Number.parseFloat(nextRawText);
    if (Number.isFinite(parsed) && parsed > 0 && nextUnit !== undefined) {
      onChange({ type: "duration", questionId: question.id, value: parsed, unit: nextUnit });
    } else {
      onChange(undefined);
    }
  }

  function handleChangeText(text: string) {
    setRawText(text);
    emit(text, unit);
  }

  function handleSelectUnit(nextUnit: DurationAnswer["unit"]) {
    setUnit(nextUnit);
    emit(rawText, nextUnit);
  }

  return (
    <View className="gap-2">
      <TextInput
        testID={`intake-duration-value-${question.id}`}
        value={rawText}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        className="rounded-lg border border-brand-200 px-4 py-3 text-base text-brand-900"
      />
      <View className="flex-row gap-2">
        {question.units.map((candidateUnit) => {
          const selected = unit === candidateUnit;
          return (
            <Pressable
              key={candidateUnit}
              testID={`intake-duration-unit-${question.id}-${candidateUnit}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => handleSelectUnit(candidateUnit)}
              style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
              className={
                selected
                  ? "min-h-[44px] rounded-full bg-brand-700 px-4 py-2.5 dark:bg-accent-dark"
                  : "min-h-[44px] rounded-full border border-brand-100 bg-white px-4 py-2.5 dark:border-hairline-dark dark:bg-surface-card-dark"
              }
            >
              <Text
                className={
                  selected ? "text-sm font-semibold text-white" : "text-sm text-brand-900 dark:text-ink-dark"
                }
              >
                {candidateUnit}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Data-driven switch on `question.type` (plan Key decision 1). Renders the
 * shared prompt/helpText chrome once, then delegates to the matching
 * presentational sub-component. A defensive fallback returns `null` for a
 * malformed/unknown type — never throws.
 */
export function QuestionRenderer({ question, answer, onChange, photoUpload }: QuestionRendererProps) {
  return (
    <View className="gap-3">
      <Text testID="intake-question-prompt" className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold">
        {question.prompt}
      </Text>
      {question.helpText !== undefined ? (
        <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{question.helpText}</Text>
      ) : null}
      {renderByType(question, answer, onChange, photoUpload)}
    </View>
  );
}

function renderByType(
  question: QuestionDef,
  answer: Answer | undefined,
  onChange: (answer: Answer | undefined) => void,
  photoUpload: PhotoUploadCapability | undefined,
) {
  switch (question.type) {
    case "single":
      return (
        <SingleQuestion
          question={question}
          answer={answer?.type === "single" ? answer : undefined}
          onChange={onChange}
        />
      );
    case "multi":
      return (
        <MultiQuestion
          question={question}
          answer={answer?.type === "multi" ? answer : undefined}
          onChange={onChange}
        />
      );
    case "scale":
      return (
        <ScaleQuestion
          question={question}
          answer={answer?.type === "scale" ? answer : undefined}
          onChange={onChange}
        />
      );
    case "duration":
      return (
        <DurationQuestion
          question={question}
          answer={answer?.type === "duration" ? answer : undefined}
          onChange={onChange}
        />
      );
    case "photoPrompt":
      return (
        <PhotoPromptQuestion
          question={question}
          answer={answer?.type === "photoPrompt" ? answer : undefined}
          onChange={onChange}
          photoUpload={photoUpload}
        />
      );
    default:
      return null;
  }
}
