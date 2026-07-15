import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";

import { uploadIntakePhoto } from "../src/api/intake-photos-api";
import { HealthLogPhotoPicker } from "../src/components/health-log-photo-picker";
import { strings } from "../src/strings";

// Component tests (T066 plan §"Tests to write" — AC photo attach flow,
// mocked at the upload boundary). `expo-image-picker`/`expo-image-manipulator`
// are globally mocked in `jest.setup.ts` (mirrors `photo-prompt-question.test.tsx`);
// only the real upload boundary, `uploadIntakePhoto`, is mocked here.
jest.mock("../src/api/intake-photos-api", () => ({
  uploadIntakePhoto: jest.fn(),
}));

const mockedUpload = uploadIntakePhoto as jest.Mock;

describe("HealthLogPhotoPicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("picks from the library, uploads, and reports the key via onKeysChange", async () => {
    mockedUpload.mockImplementation(async (_petId: string, _uri: string, onProgress: (p: number) => void) => {
      onProgress(1);
      return { key: "pets/pet1/original/x.jpg" };
    });
    const onKeysChange = jest.fn();

    await render(<HealthLogPhotoPicker petId="pet1" onKeysChange={onKeysChange} />);

    await fireEvent.press(screen.getByTestId("health-log-photo-library"));

    await waitFor(() => {
      expect(onKeysChange).toHaveBeenLastCalledWith(["pets/pet1/original/x.jpg"]);
    });
    expect(mockedUpload).toHaveBeenCalledWith("pet1", expect.any(String), expect.any(Function));
    expect(screen.getByTestId("health-log-photo-thumb-p1")).toBeTruthy();
  });

  it("a failed upload shows the failed state with a working retry", async () => {
    let attempt = 0;
    mockedUpload.mockImplementation(async (_petId: string, _uri: string, onProgress: (p: number) => void) => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("network down");
      }
      onProgress(1);
      return { key: "pets/pet1/original/x.jpg" };
    });
    const onKeysChange = jest.fn();

    await render(<HealthLogPhotoPicker petId="pet1" onKeysChange={onKeysChange} />);

    await fireEvent.press(screen.getByTestId("health-log-photo-library"));

    await waitFor(() => {
      expect(screen.getByTestId("health-log-photo-failed-p1")).toBeTruthy();
    });
    expect(onKeysChange).not.toHaveBeenCalledWith(["pets/pet1/original/x.jpg"]);

    await fireEvent.press(screen.getByTestId("health-log-photo-retry-p1"));

    await waitFor(() => {
      expect(onKeysChange).toHaveBeenLastCalledWith(["pets/pet1/original/x.jpg"]);
    });
    expect(screen.queryByTestId("health-log-photo-failed-p1")).toBeNull();
    expect(mockedUpload).toHaveBeenCalledTimes(2);
  });

  it("disables add buttons and shows the limit hint at maxPhotos", async () => {
    let uploadCount = 0;
    mockedUpload.mockImplementation(async (_petId: string, _uri: string, onProgress: (p: number) => void) => {
      uploadCount += 1;
      onProgress(1);
      return { key: `pets/pet1/original/${uploadCount}.jpg` };
    });
    const onKeysChange = jest.fn();

    await render(<HealthLogPhotoPicker petId="pet1" maxPhotos={2} onKeysChange={onKeysChange} />);

    await fireEvent.press(screen.getByTestId("health-log-photo-library"));
    await waitFor(() => {
      expect(screen.getByTestId("health-log-photo-tile-p1")).toBeTruthy();
    });
    await fireEvent.press(screen.getByTestId("health-log-photo-library"));
    await waitFor(() => {
      expect(screen.getByTestId("health-log-photo-tile-p2")).toBeTruthy();
    });

    expect(screen.getByTestId("health-log-photo-limit")).toHaveTextContent(strings.healthLogPhoto.limitHint(2));
    expect(screen.getByTestId("health-log-photo-camera").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId("health-log-photo-library").props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId("health-log-photo-library"));
    expect(mockedUpload).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("health-log-photo-tile-p3")).toBeNull();
  });

  it("removing a slot drops its key from onKeysChange", async () => {
    mockedUpload.mockImplementation(async (_petId: string, _uri: string, onProgress: (p: number) => void) => {
      onProgress(1);
      return { key: "pets/pet1/original/x.jpg" };
    });
    const onKeysChange = jest.fn();

    await render(<HealthLogPhotoPicker petId="pet1" onKeysChange={onKeysChange} />);

    await fireEvent.press(screen.getByTestId("health-log-photo-library"));
    await waitFor(() => {
      expect(screen.getByTestId("health-log-photo-tile-p1")).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId("health-log-photo-remove-p1"));

    expect(screen.queryByTestId("health-log-photo-tile-p1")).toBeNull();
    expect(onKeysChange).toHaveBeenLastCalledWith([]);
  });

  it("camera permission denied shows an error and adds no slot", async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValueOnce({
      status: "denied",
      expires: "never",
      granted: false,
      canAskAgain: true,
    } as Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>);

    const onKeysChange = jest.fn();

    await render(<HealthLogPhotoPicker petId="pet1" onKeysChange={onKeysChange} />);

    await fireEvent.press(screen.getByTestId("health-log-photo-camera"));

    await waitFor(() => {
      expect(screen.getByTestId("health-log-photo-error")).toHaveTextContent(strings.healthLogPhoto.permissionError);
    });
    expect(screen.queryByTestId("health-log-photo-tile-p1")).toBeNull();
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});
