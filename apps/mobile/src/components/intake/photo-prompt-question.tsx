import type { Answer, QuestionDef } from "@pawcareright/types";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { PhotoUploadCapability } from "../../api/intake-photos-api";
import {
  collectUploadedKeys,
  createPendingSlot,
  createUploadedSlotFromKey,
  photoUploadReducer,
  type PhotoSlot,
  type PhotoUploadEvent,
} from "../../checks/photo-upload-machine";
import { compressImage } from "../../pets/compress-image";
import { strings } from "../../strings";

export type PhotoPromptQuestionDef = Extract<QuestionDef, { type: "photoPrompt" }>;
export type PhotoPromptAnswer = Extract<Answer, { type: "photoPrompt" }>;

export interface PhotoPromptQuestionProps {
  question: PhotoPromptQuestionDef;
  answer: PhotoPromptAnswer | undefined;
  onChange: (answer: Answer | undefined) => void;
  photoUpload?: PhotoUploadCapability | undefined;
}

/**
 * Real multi-photo capture/pick step (T046 plan §"Component spec"),
 * replacing the T045 stub. The schema-driven renderer never learns `petId`
 * — it only threads the optional `photoUpload` capability (plan §"petId /
 * capability seam design"); absent it, this degrades to a disabled
 * "unavailable" render that emits no answer.
 */
export function PhotoPromptQuestion({ question, answer, onChange, photoUpload }: PhotoPromptQuestionProps) {
  const [slots, setSlots] = useState<PhotoSlot[]>(() =>
    (answer?.photoKeys ?? []).map((key, index) => createUploadedSlotFromKey(`seed-${index}`, key)),
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const nextIdRef = useRef(0);

  const uploadedKeys = collectUploadedKeys(slots);
  const joinedKeys = uploadedKeys.join(",");

  // Emit only when there is a capability to collect real uploads with (plan
  // §"Component spec": no `photoUpload` → emit nothing). Keyed on the joined
  // keys string (not the array identity) so this never loops.
  useEffect(() => {
    if (photoUpload === undefined) {
      return;
    }
    onChange(
      uploadedKeys.length > 0
        ? { type: "photoPrompt", questionId: question.id, photoKeys: uploadedKeys }
        : undefined,
    );
  }, [joinedKeys, photoUpload]);

  function dispatch(id: string, event: PhotoUploadEvent) {
    setSlots((prev) => prev.map((slot) => (slot.id === id ? photoUploadReducer(slot, event) : slot)));
  }

  function nextId(): string {
    nextIdRef.current += 1;
    return `p${nextIdRef.current}`;
  }

  async function performUpload(id: string, uri: string) {
    if (photoUpload === undefined) {
      return;
    }
    try {
      const { key } = await photoUpload.upload(uri, (progress) => dispatch(id, { type: "PROGRESS", progress }));
      dispatch(id, { type: "SUCCEED", key });
    } catch {
      dispatch(id, { type: "FAIL" });
    }
  }

  async function pickAndUpload(source: "camera" | "library") {
    if (photoUpload === undefined || slots.length >= question.maxPhotos) {
      return;
    }
    setError(undefined);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        setError(strings.intake.photo.permissionError);
        return;
      }

      const result =
        source === "camera" ? await ImagePicker.launchCameraAsync() : await ImagePicker.launchImageLibraryAsync();
      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0]!;
      const compressed = await compressImage({ uri: asset.uri, width: asset.width, height: asset.height });

      const id = nextId();
      setSlots((prev) => [...prev, createPendingSlot(id, compressed.uri)]);
      dispatch(id, { type: "START" });
      await performUpload(id, compressed.uri);
    } catch {
      setError(strings.intake.photo.permissionError);
    }
  }

  function retry(id: string) {
    const slot = slots.find((candidate) => candidate.id === id);
    if (slot === undefined || photoUpload === undefined || slot.uri === undefined) {
      return;
    }
    dispatch(id, { type: "RETRY" });
    void performUpload(id, slot.uri);
  }

  function removeSlot(id: string) {
    setSlots((prev) => prev.filter((slot) => slot.id !== id));
  }

  const atLimit = slots.length >= question.maxPhotos;
  // Muted-copy rule (design-system.md §1.1): the disabled affordance already
  // conveys state via the limit-hint copy + `opacity-50` sibling pattern, so
  // the CTA label itself no longer needs a distinct disabled color.
  const ctaTextClassName = "text-base font-medium text-brand-700 dark:text-accent-bright";

  if (photoUpload === undefined) {
    return (
      <View className="gap-3">
        <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{strings.intake.photo.rationale}</Text>
        <View className="flex-row gap-3">
          <Pressable
            testID={`intake-photo-camera-${question.id}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            disabled
          >
            <Text className="text-base font-medium text-brand-700 dark:text-accent-bright">{strings.intake.photo.takePhoto}</Text>
          </Pressable>
          <Pressable
            testID={`intake-photo-library-${question.id}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            disabled
          >
            <Text className="text-base font-medium text-brand-700 dark:text-accent-bright">{strings.intake.photo.chooseLibrary}</Text>
          </Pressable>
        </View>
        <Text testID={`intake-photo-unavailable-${question.id}`} className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {strings.intake.photo.unavailable}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{strings.intake.photo.rationale}</Text>

      <View className="flex-row gap-3">
        <Pressable
          testID={`intake-photo-camera-${question.id}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: atLimit }}
          disabled={atLimit}
          onPress={() => void pickAndUpload("camera")}
        >
          <Text className={ctaTextClassName}>{strings.intake.photo.takePhoto}</Text>
        </Pressable>
        <Pressable
          testID={`intake-photo-library-${question.id}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: atLimit }}
          disabled={atLimit}
          onPress={() => void pickAndUpload("library")}
        >
          <Text className={ctaTextClassName}>{strings.intake.photo.chooseLibrary}</Text>
        </Pressable>
      </View>

      {atLimit ? (
        <Text testID={`intake-photo-limit-${question.id}`} className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {strings.intake.photo.limitHint(question.maxPhotos)}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        {slots.map((slot) => (
          <View key={slot.id} testID={`intake-photo-tile-${question.id}-${slot.id}`} className="gap-1">
            {slot.uri !== undefined ? (
              <Image
                testID={`intake-photo-thumb-${question.id}-${slot.id}`}
                source={{ uri: slot.uri }}
                className="h-20 w-20 rounded-lg"
              />
            ) : (
              <View
                testID={`intake-photo-placeholder-${question.id}-${slot.id}`}
                className="h-20 w-20 rounded-lg bg-brand-100 dark:bg-surface-raised-dark"
              />
            )}

            {slot.status === "uploading" ? (
              <Text testID={`intake-photo-progress-${question.id}-${slot.id}`} className="text-xs text-brand-700 dark:text-ink-muted-dark font-body">
                {strings.intake.photo.uploading(Math.round(slot.progress * 100))}
              </Text>
            ) : null}

            {slot.status === "failed" ? (
              <View className="gap-1">
                <Text className="text-xs text-red-600 dark:text-red-400">{strings.intake.photo.failed}</Text>
                <Pressable
                  testID={`intake-photo-retry-${question.id}-${slot.id}`}
                  accessibilityRole="button"
                  onPress={() => retry(slot.id)}
                >
                  <Text className="text-xs font-medium text-brand-700 dark:text-accent-bright">{strings.intake.photo.retry}</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              testID={`intake-photo-remove-${question.id}-${slot.id}`}
              accessibilityRole="button"
              onPress={() => removeSlot(slot.id)}
            >
              <Text className="text-xs font-medium text-brand-700 dark:text-accent-bright">{strings.intake.photo.remove}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {error !== undefined ? (
        <Text testID={`intake-photo-error-${question.id}`} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
