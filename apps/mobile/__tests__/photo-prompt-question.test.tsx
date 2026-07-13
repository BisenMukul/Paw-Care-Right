import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";

import type { PhotoUploadCapability } from "../src/api/intake-photos-api";
import {
  PhotoPromptQuestion,
  type PhotoPromptQuestionDef,
} from "../src/components/intake/photo-prompt-question";
import { strings } from "../src/strings";

// Component tests (T046 plan §"Acceptance-criteria → test mapping"): add /
// remove / limit (AC1), failed→retry, and camera-permission-denied. A mock
// `photoUpload` capability stands in for the real presign/PUT/confirm flow
// (the global `expo-image-picker`/`expo-image-manipulator` mocks in
// `jest.setup.ts` cover pick + compress).

const photoQuestion: PhotoPromptQuestionDef = {
  id: "q-photo",
  type: "photoPrompt",
  prompt: "Photo prompt",
  required: false,
  maxPhotos: 3,
};

function twoPhotoLimitQuestion(): PhotoPromptQuestionDef {
  return { ...photoQuestion, maxPhotos: 2 };
}

describe("PhotoPromptQuestion", () => {
  it("adds a photo via library: compress+upload, tile appears, onChange gets [key]", async () => {
    const onChange = jest.fn();
    const photoUpload: PhotoUploadCapability = {
      upload: jest.fn(async (_localUri: string, onProgress: (progress: number) => void) => {
        onProgress(1);
        return { key: "k1" };
      }),
    };

    await render(
      <PhotoPromptQuestion
        question={photoQuestion}
        answer={undefined}
        onChange={onChange}
        photoUpload={photoUpload}
      />,
    );

    await fireEvent.press(screen.getByTestId("intake-photo-library-q-photo"));

    await waitFor(() => {
      expect(screen.getByTestId("intake-photo-tile-q-photo-p1")).toBeTruthy();
    });
    expect(onChange).toHaveBeenLastCalledWith({
      type: "photoPrompt",
      questionId: "q-photo",
      photoKeys: ["k1"],
    });
    expect(photoUpload.upload).toHaveBeenCalledTimes(1);
  });

  it("removes an uploaded photo: tile gone, onChange gets undefined", async () => {
    const onChange = jest.fn();
    const photoUpload: PhotoUploadCapability = {
      upload: jest.fn(async (_localUri: string, onProgress: (progress: number) => void) => {
        onProgress(1);
        return { key: "k1" };
      }),
    };

    await render(
      <PhotoPromptQuestion
        question={photoQuestion}
        answer={undefined}
        onChange={onChange}
        photoUpload={photoUpload}
      />,
    );

    await fireEvent.press(screen.getByTestId("intake-photo-library-q-photo"));
    await waitFor(() => {
      expect(screen.getByTestId("intake-photo-tile-q-photo-p1")).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId("intake-photo-remove-q-photo-p1"));

    expect(screen.queryByTestId("intake-photo-tile-q-photo-p1")).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("at maxPhotos the CTAs are disabled and the limit hint shows; further add blocked", async () => {
    const onChange = jest.fn();
    let uploadCount = 0;
    const photoUpload: PhotoUploadCapability = {
      upload: jest.fn(async (_localUri: string, onProgress: (progress: number) => void) => {
        uploadCount += 1;
        onProgress(1);
        return { key: `k${uploadCount}` };
      }),
    };
    const question = twoPhotoLimitQuestion();

    await render(
      <PhotoPromptQuestion question={question} answer={undefined} onChange={onChange} photoUpload={photoUpload} />,
    );

    await fireEvent.press(screen.getByTestId("intake-photo-library-q-photo"));
    await waitFor(() => {
      expect(screen.getByTestId("intake-photo-tile-q-photo-p1")).toBeTruthy();
    });
    await fireEvent.press(screen.getByTestId("intake-photo-library-q-photo"));
    await waitFor(() => {
      expect(screen.getByTestId("intake-photo-tile-q-photo-p2")).toBeTruthy();
    });

    expect(screen.getByTestId("intake-photo-limit-q-photo")).toHaveTextContent(strings.intake.photo.limitHint(2));
    expect(screen.getByTestId("intake-photo-camera-q-photo").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId("intake-photo-library-q-photo").props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId("intake-photo-library-q-photo"));
    expect(photoUpload.upload).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("intake-photo-tile-q-photo-p3")).toBeNull();
  });

  it("failed upload shows retry; retry re-uploads to uploaded", async () => {
    const onChange = jest.fn();
    let attempt = 0;
    const photoUpload: PhotoUploadCapability = {
      upload: jest.fn(async (_localUri: string, onProgress: (progress: number) => void) => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error("network down");
        }
        onProgress(1);
        return { key: "k1" };
      }),
    };

    await render(
      <PhotoPromptQuestion
        question={photoQuestion}
        answer={undefined}
        onChange={onChange}
        photoUpload={photoUpload}
      />,
    );

    await fireEvent.press(screen.getByTestId("intake-photo-library-q-photo"));

    await waitFor(() => {
      expect(screen.getByTestId("intake-photo-retry-q-photo-p1")).toBeTruthy();
    });
    expect(screen.getByText(strings.intake.photo.failed)).toBeTruthy();
    expect(onChange).not.toHaveBeenLastCalledWith({
      type: "photoPrompt",
      questionId: "q-photo",
      photoKeys: ["k1"],
    });

    await fireEvent.press(screen.getByTestId("intake-photo-retry-q-photo-p1"));

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        type: "photoPrompt",
        questionId: "q-photo",
        photoKeys: ["k1"],
      });
    });
    expect(screen.queryByTestId("intake-photo-retry-q-photo-p1")).toBeNull();
    expect(photoUpload.upload).toHaveBeenCalledTimes(2);
  });

  it("camera permission denied shows error, adds no slot", async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValueOnce({
      status: "denied",
      expires: "never",
      granted: false,
      canAskAgain: true,
    } as Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>);

    const onChange = jest.fn();
    const photoUpload: PhotoUploadCapability = {
      upload: jest.fn(async () => ({ key: "k1" })),
    };

    await render(
      <PhotoPromptQuestion
        question={photoQuestion}
        answer={undefined}
        onChange={onChange}
        photoUpload={photoUpload}
      />,
    );

    await fireEvent.press(screen.getByTestId("intake-photo-camera-q-photo"));

    await waitFor(() => {
      expect(screen.getByTestId("intake-photo-error-q-photo")).toHaveTextContent(
        strings.intake.photo.permissionError,
      );
    });
    expect(screen.queryByTestId("intake-photo-tile-q-photo-p1")).toBeNull();
    expect(photoUpload.upload).not.toHaveBeenCalled();
  });
});
