import { HEALTH_LOG_PHOTO_KEYS_MAX } from "@pawcareright/types";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { uploadIntakePhoto } from "../api/intake-photos-api";
import {
  collectUploadedKeys,
  createPendingSlot,
  photoUploadReducer,
  type PhotoSlot,
  type PhotoUploadEvent,
} from "../checks/photo-upload-machine";
import { compressImage } from "../pets/compress-image";
import { strings } from "../strings";

export interface HealthLogPhotoPickerProps {
  petId: string;
  maxPhotos?: number;
  onKeysChange: (keys: string[]) => void;
}

/**
 * Reusable multi-photo picker for health-log forms (T066 plan), decoupled
 * from the intake schema/answer plumbing. Behavior mirrors
 * `PhotoPromptQuestion` minus the schema/answer types: camera/library
 * buttons (just-in-time permission), pick -> compress -> upload via the
 * pet-scoped `uploadIntakePhoto` (plan decision 1), retry on failure, remove
 * a slot, and a `maxPhotos` limit that disables the add buttons. No
 * medical/interpretive copy anywhere here (CLAUDE §7).
 */
export function HealthLogPhotoPicker({
  petId,
  maxPhotos = HEALTH_LOG_PHOTO_KEYS_MAX,
  onKeysChange,
}: HealthLogPhotoPickerProps) {
  const [slots, setSlots] = useState<PhotoSlot[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const nextIdRef = useRef(0);

  const uploadedKeys = collectUploadedKeys(slots);
  const joinedKeys = uploadedKeys.join(",");

  // Keyed on the joined-keys string (not array identity) so this never
  // loops — same guard as `PhotoPromptQuestion`.
  useEffect(() => {
    onKeysChange(uploadedKeys);
  }, [joinedKeys]);

  function dispatch(id: string, event: PhotoUploadEvent) {
    setSlots((prev) => prev.map((slot) => (slot.id === id ? photoUploadReducer(slot, event) : slot)));
  }

  function nextId(): string {
    nextIdRef.current += 1;
    return `p${nextIdRef.current}`;
  }

  async function performUpload(id: string, uri: string) {
    try {
      const { key } = await uploadIntakePhoto(petId, uri, (progress) => dispatch(id, { type: "PROGRESS", progress }));
      dispatch(id, { type: "SUCCEED", key });
    } catch {
      dispatch(id, { type: "FAIL" });
    }
  }

  async function pickAndUpload(source: "camera" | "library") {
    if (slots.length >= maxPhotos) {
      return;
    }
    setError(undefined);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        setError(strings.healthLogPhoto.permissionError);
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
      setError(strings.healthLogPhoto.permissionError);
    }
  }

  function retry(id: string) {
    const slot = slots.find((candidate) => candidate.id === id);
    if (slot === undefined || slot.uri === undefined) {
      return;
    }
    dispatch(id, { type: "RETRY" });
    void performUpload(id, slot.uri);
  }

  function removeSlot(id: string) {
    setSlots((prev) => prev.filter((slot) => slot.id !== id));
  }

  const atLimit = slots.length >= maxPhotos;
  const ctaTextClassName = atLimit ? "text-base font-medium text-gray-400" : "text-base font-medium text-brand-700";

  return (
    <View className="gap-3">
      <Text className="text-sm text-brand-700">{strings.healthLogPhoto.rationale}</Text>

      <View className="flex-row gap-3">
        <Pressable
          testID="health-log-photo-camera"
          accessibilityRole="button"
          accessibilityState={{ disabled: atLimit }}
          disabled={atLimit}
          onPress={() => void pickAndUpload("camera")}
        >
          <Text className={ctaTextClassName}>{strings.healthLogPhoto.takePhoto}</Text>
        </Pressable>
        <Pressable
          testID="health-log-photo-library"
          accessibilityRole="button"
          accessibilityState={{ disabled: atLimit }}
          disabled={atLimit}
          onPress={() => void pickAndUpload("library")}
        >
          <Text className={ctaTextClassName}>{strings.healthLogPhoto.chooseLibrary}</Text>
        </Pressable>
      </View>

      {atLimit ? (
        <Text testID="health-log-photo-limit" className="text-sm text-brand-700">
          {strings.healthLogPhoto.limitHint(maxPhotos)}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        {slots.map((slot) => (
          <View key={slot.id} testID={`health-log-photo-tile-${slot.id}`} className="gap-1">
            {slot.uri !== undefined ? (
              <Image
                testID={`health-log-photo-thumb-${slot.id}`}
                source={{ uri: slot.uri }}
                className="h-20 w-20 rounded-lg"
              />
            ) : null}

            {slot.status === "uploading" ? (
              <Text testID={`health-log-photo-progress-${slot.id}`} className="text-xs text-brand-700">
                {strings.healthLogPhoto.uploading(Math.round(slot.progress * 100))}
              </Text>
            ) : null}

            {slot.status === "failed" ? (
              <View testID={`health-log-photo-failed-${slot.id}`} className="gap-1">
                <Text className="text-xs text-red-600 dark:text-red-400">{strings.healthLogPhoto.failed}</Text>
                <Pressable
                  testID={`health-log-photo-retry-${slot.id}`}
                  accessibilityRole="button"
                  onPress={() => retry(slot.id)}
                >
                  <Text className="text-xs font-medium text-brand-700">{strings.healthLogPhoto.retry}</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              testID={`health-log-photo-remove-${slot.id}`}
              accessibilityRole="button"
              onPress={() => removeSlot(slot.id)}
            >
              <Text className="text-xs font-medium text-brand-700">{strings.healthLogPhoto.remove}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {error !== undefined ? (
        <Text testID="health-log-photo-error" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
