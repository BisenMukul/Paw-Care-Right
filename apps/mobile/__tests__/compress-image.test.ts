import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { compressImage } from "../src/pets/compress-image";

// `expo-image-manipulator` is mocked globally in `jest.setup.ts` to the new
// contextual `manipulate(...).resize().renderAsync().saveAsync()` shape
// (SDK 57 has no legacy `manipulateAsync`). This asserts `compressImage`'s
// long-edge resize decision, no-enlargement guarantee, and JPEG output.
const mockedManipulate = ImageManipulator.manipulate as unknown as jest.Mock;

describe("compressImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resizes the long edge down to 1600 on the width axis (landscape, over the limit)", async () => {
    const result = await compressImage({ uri: "file:///in.jpg", width: 2000, height: 1500 });

    expect(mockedManipulate).toHaveBeenCalledWith("file:///in.jpg");
    const context = mockedManipulate.mock.results[0]?.value as {
      resize: jest.Mock;
      renderAsync: jest.Mock;
    };
    expect(context.resize).toHaveBeenCalledWith({ width: 1600 });
    expect(context.renderAsync).toHaveBeenCalledTimes(1);

    const rendered = (await context.renderAsync.mock.results[0]?.value) as {
      saveAsync: jest.Mock;
    };
    expect(rendered.saveAsync).toHaveBeenCalledWith({ compress: 0.7, format: SaveFormat.JPEG });

    expect(result).toEqual({ uri: "file:///out.jpg", width: 1600, height: 1200 });
  });

  it("resizes the long edge down to 1600 on the height axis (portrait, over the limit)", async () => {
    await compressImage({ uri: "file:///in.jpg", width: 1200, height: 2400 });

    const context = mockedManipulate.mock.results[0]?.value as { resize: jest.Mock };
    expect(context.resize).toHaveBeenCalledWith({ height: 1600 });
  });

  it("does not enlarge or resize an image already at the 1600 long edge", async () => {
    await compressImage({ uri: "file:///in.jpg", width: 1600, height: 1200 });

    const context = mockedManipulate.mock.results[0]?.value as { resize: jest.Mock };
    expect(context.resize).not.toHaveBeenCalled();
  });

  it("does not enlarge or resize an image below the 1600 long edge", async () => {
    await compressImage({ uri: "file:///in.jpg", width: 800, height: 600 });

    const context = mockedManipulate.mock.results[0]?.value as {
      resize: jest.Mock;
      renderAsync: jest.Mock;
    };
    expect(context.resize).not.toHaveBeenCalled();
    expect(context.renderAsync).toHaveBeenCalledTimes(1);
  });

  it("always saves as JPEG at quality 0.7, regardless of the resize path", async () => {
    await compressImage({ uri: "file:///in.jpg", width: 800, height: 600 });

    const context = mockedManipulate.mock.results[0]?.value as { renderAsync: jest.Mock };
    const rendered = (await context.renderAsync.mock.results[0]?.value) as {
      saveAsync: jest.Mock;
    };
    expect(rendered.saveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: SaveFormat.JPEG, compress: 0.7 }),
    );
  });
});
