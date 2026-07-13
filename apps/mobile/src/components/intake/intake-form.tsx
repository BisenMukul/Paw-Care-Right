import type { Answer, CategoryDef, CompletedIntake, QuestionDef } from "@pawcareright/types";
import { parseIntake } from "@pawcareright/types";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { PhotoUploadCapability } from "../../api/intake-photos-api";
import { strings } from "../../strings";
import { buildIntakeCandidate, describeAnswer } from "../../checks/intake";
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
  const questions = categoryDef.questions;
  const total = questions.length + 2;
  const freeTextStepIndex = questions.length;
  const reviewStepIndex = questions.length + 1;

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [freeText, setFreeText] = useState("");

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

  const isQuestionStep = stepIndex < questions.length;
  const isFreeTextStep = stepIndex === freeTextStepIndex;
  const isReviewStep = stepIndex === reviewStepIndex;

  const currentQuestion = isQuestionStep ? questions[stepIndex] : undefined;
  const nextDisabled = currentQuestion !== undefined && currentQuestion.required && answers[currentQuestion.id] === undefined;

  const candidate = buildIntakeCandidate(categoryDef, answers, freeText);
  const validation = parseIntake(candidate);

  return (
    <SafeAreaView testID="intake-form" className="flex-1 bg-white">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="flex-1 px-6 py-4">
          <Text testID="intake-progress" className="text-center text-sm text-brand-700">
            {strings.intake.stepOf(stepIndex + 1, total)}
          </Text>

          <ScrollView className="flex-1">
            <View className="gap-4 pt-4 pb-4">
              {currentQuestion !== undefined ? (
                <QuestionRenderer
                  question={currentQuestion}
                  answer={answers[currentQuestion.id]}
                  onChange={(answer) => handleAnswerChange(currentQuestion, answer)}
                  photoUpload={photoUpload}
                />
              ) : null}

              {isFreeTextStep ? (
                <View className="gap-2">
                  <Text className="text-lg font-semibold text-brand-900">
                    {strings.intake.freeText.title}
                  </Text>
                  <TextInput
                    testID="intake-freetext-input"
                    value={freeText}
                    onChangeText={setFreeText}
                    placeholder={strings.intake.freeText.placeholder}
                    multiline
                    maxLength={2000}
                    className="min-h-[120px] rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900"
                  />
                  <Text className="text-sm text-brand-700">{strings.intake.freeText.optional}</Text>
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
                        className="flex-row items-center justify-between gap-2 border-b border-gray-200 pb-2"
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
                      className="flex-row items-center justify-between gap-2 border-b border-gray-200 pb-2"
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
            </View>
          </ScrollView>

          <View className="flex-row items-center justify-between gap-4 pt-4">
            <Pressable testID="intake-back" onPress={handleBack}>
              <Text className="text-base font-medium text-brand-700">{strings.intake.back}</Text>
            </Pressable>
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
