import type { Answer, CategoryDef, CompletedIntake, QuestionDef } from "@pawcareright/types";
import { parseIntake } from "@pawcareright/types";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import type { PhotoUploadCapability } from "../../api/intake-photos-api";
import { buildDescriptorFreeText, buildIntakeCandidate, describeAnswer } from "../../checks/intake";
import { getDescriptors } from "../../checks/intake-descriptors";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { strings } from "../../strings";
import { GhostButton } from "../ghost-button";
import { PrimaryButton } from "../primary-button";
import { QuestionRenderer } from "./question-renderer";

export interface IntakeFormProps {
  categoryDef: CategoryDef;
  onExit: () => void;
  onSubmit: (intake: CompletedIntake) => void;
  /** T046: pet-scoped photo upload seam, passed through to `QuestionRenderer`. */
  photoUpload?: PhotoUploadCapability | undefined;
}

function omitKey(record: Record<string, Answer>, key: string): Record<string, Answer> {
  const next = { ...record };
  delete next[key];
  return next;
}

/**
 * Stepped, schema-driven symptom-intake flow (T045 plan §"Flow & state
 * spec"). Steps are `[...categoryDef.questions, freeText, review]`; every
 * question step renders via `QuestionRenderer` — ZERO per-category logic.
 * Ephemeral local state only (plan Risk R2): no store, no persistence.
 */
export function IntakeForm({ categoryDef, onExit, onSubmit, photoUpload }: IntakeFormProps) {
  const reduced = useReducedMotion();
  const questions = categoryDef.questions;
  const total = questions.length + 2;
  const freeTextStepIndex = questions.length;
  const reviewStepIndex = questions.length + 1;

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [selectedDescriptors, setSelectedDescriptors] = useState<string[]>([]);
  const [extraDetail, setExtraDetail] = useState("");
  const [showFreeTextInput, setShowFreeTextInput] = useState(false);

  function handleBack() {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    } else {
      onExit();
    }
  }

  function handleAnswerChange(question: QuestionDef, answer: Answer | undefined) {
    setAnswers((prev) => (answer !== undefined ? { ...prev, [question.id]: answer } : omitKey(prev, question.id)));
  }

  function toggleDescriptor(descriptor: string) {
    setSelectedDescriptors((prev) =>
      prev.includes(descriptor) ? prev.filter((value) => value !== descriptor) : [...prev, descriptor],
    );
  }

  const isQuestionStep = stepIndex < questions.length;
  const isFreeTextStep = stepIndex === freeTextStepIndex;
  const isReviewStep = stepIndex === reviewStepIndex;

  const currentQuestion = isQuestionStep ? questions[stepIndex] : undefined;
  const nextDisabled = currentQuestion !== undefined && currentQuestion.required && answers[currentQuestion.id] === undefined;

  const freeText = buildDescriptorFreeText(selectedDescriptors, extraDetail);
  const candidate = buildIntakeCandidate(categoryDef, answers, freeText);
  const validation = parseIntake(candidate);
  const descriptors = getDescriptors(categoryDef.id);

  return (
    <SafeAreaView testID="intake-form" className="flex-1 bg-brand-50">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="flex-1 px-6 py-4">
          <View testID="intake-progress" className="gap-2">
            <View className="flex-row gap-1">
              {Array.from({ length: total }, (_, index) => (
                <View
                  key={index}
                  className={index <= stepIndex ? "h-1.5 flex-1 rounded-full bg-brand-500" : "h-1.5 flex-1 rounded-full bg-brand-100"}
                />
              ))}
            </View>
            <Text className="text-center text-sm text-brand-700">
              {strings.intake.stepOf(stepIndex + 1, total)}
            </Text>
          </View>

          <ScrollView className="flex-1">
            <Animated.View
              key={stepIndex}
              className="gap-4 pt-4 pb-4"
              {...(reduced ? {} : { entering: FadeInDown.duration(320) })}
            >
              {currentQuestion !== undefined ? (
                <QuestionRenderer
                  question={currentQuestion}
                  answer={answers[currentQuestion.id]}
                  onChange={(answer) => handleAnswerChange(currentQuestion, answer)}
                  photoUpload={photoUpload}
                />
              ) : null}

              {isFreeTextStep ? (
                <View className="gap-3">
                  <Text className="text-lg font-semibold text-brand-900">
                    {strings.intake.quickPick.title}
                  </Text>
                  <Text className="text-sm text-brand-700">{strings.intake.quickPick.hint}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {descriptors.map((descriptor, index) => {
                      const selected = selectedDescriptors.includes(descriptor);
                      return (
                        <Pressable
                          key={descriptor}
                          testID={`intake-descriptor-${categoryDef.id}-${index}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => toggleDescriptor(descriptor)}
                          style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
                          className={
                            selected
                              ? "min-h-[44px] items-center justify-center rounded-full bg-brand-700 px-4 py-2.5"
                              : "min-h-[44px] items-center justify-center rounded-full border border-brand-100 bg-white px-4 py-2.5"
                          }
                        >
                          <Text
                            className={
                              selected
                                ? "text-sm font-semibold text-white"
                                : "text-sm text-brand-900"
                            }
                          >
                            {descriptor}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <GhostButton
                    testID="intake-freetext-toggle"
                    label={strings.intake.quickPick.addDetail}
                    onPress={() => setShowFreeTextInput((prev) => !prev)}
                  />

                  {showFreeTextInput ? (
                    <View className="gap-2">
                      <Text className="text-lg font-semibold text-brand-900">
                        {strings.intake.freeText.title}
                      </Text>
                      <TextInput
                        testID="intake-freetext-input"
                        value={extraDetail}
                        onChangeText={setExtraDetail}
                        placeholder={strings.intake.freeText.placeholder}
                        placeholderTextColor="#2f8f74"
                        multiline
                        maxLength={2000}
                        className="min-h-[120px] rounded-lg border border-brand-100 px-4 py-3 text-base text-brand-900"
                      />
                      <Text className="text-sm text-brand-700">{strings.intake.freeText.optional}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {isReviewStep ? (
                <View className="gap-3">
                  <Text className="text-lg font-semibold text-brand-900">
                    {strings.intake.review.title}
                  </Text>
                  {questions
                    .filter((question) => answers[question.id] !== undefined)
                    .map((question) => (
                      <View
                        key={question.id}
                        testID={`intake-review-row-${question.id}`}
                        className="flex-row items-center justify-between gap-2 rounded-2xl bg-white p-4 shadow-md"
                      >
                        <View className="flex-1 gap-1">
                          <Text className="text-sm font-medium text-brand-900">{question.prompt}</Text>
                          <Text className="text-sm text-brand-700">
                            {describeAnswer(question, answers[question.id]!)}
                          </Text>
                        </View>
                        <Pressable
                          testID={`intake-review-edit-${question.id}`}
                          onPress={() =>
                            setStepIndex(questions.findIndex((candidateQuestion) => candidateQuestion.id === question.id))
                          }
                        >
                          <Text className="text-sm font-medium text-brand-700">
                            {strings.intake.review.edit}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  {freeText.trim().length > 0 ? (
                    <View
                      testID="intake-review-freetext"
                      className="flex-row items-center justify-between gap-2 rounded-2xl bg-white p-4 shadow-md"
                    >
                      <View className="flex-1 gap-1">
                        <Text className="text-sm font-medium text-brand-900">
                          {strings.intake.freeText.title}
                        </Text>
                        <Text className="text-sm text-brand-700">{freeText.trim()}</Text>
                      </View>
                      <Pressable
                        testID="intake-review-edit-freetext"
                        onPress={() => setStepIndex(freeTextStepIndex)}
                      >
                        <Text className="text-sm font-medium text-brand-700">
                          {strings.intake.review.edit}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {!validation.ok ? (
                    <Text testID="intake-validation-error" className="text-sm text-red-600">
                      {strings.intake.validationError}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </Animated.View>
          </ScrollView>

          <View className="flex-row items-center justify-between gap-4 pt-4">
            <GhostButton testID="intake-back" label={strings.intake.back} onPress={handleBack} />
            {isReviewStep ? (
              <PrimaryButton
                testID="intake-submit"
                label={strings.intake.submit}
                disabled={!validation.ok}
                onPress={() => {
                  if (validation.ok) {
                    onSubmit(validation.value);
                  }
                }}
              />
            ) : (
              <PrimaryButton
                testID="intake-next"
                label={strings.intake.next}
                disabled={nextDisabled}
                onPress={() => setStepIndex(stepIndex + 1)}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
