import { fireEvent, render, screen } from "@testing-library/react-native";

import { usePhotoViewUrls } from "../src/api/pet-photos-api";
import { TimelinePhotoViewer } from "../src/components/timeline-photo-viewer";

// T069 plan "Tests to write" -> timeline-photo-viewer.test.tsx. AC "viewer
// accessible-label test": every page and the close control expose a
// meaningful accessibility label.
jest.mock("../src/api/pet-photos-api", () => ({
  usePhotoViewUrls: jest.fn(),
}));

const mockedUsePhotoViewUrls = usePhotoViewUrls as unknown as jest.Mock;

describe("TimelinePhotoViewer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("each page and the close control expose meaningful accessibility labels", async () => {
    const photoKeys = ["a.jpg", "b.jpg", "c.jpg"];
    mockedUsePhotoViewUrls.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          { key: "a.jpg", thumbUrl: "t-a", mainUrl: "m-a" },
          { key: "b.jpg", thumbUrl: "t-b", mainUrl: "m-b" },
          { key: "c.jpg", thumbUrl: "t-c", mainUrl: "m-c" },
        ],
      },
    });
    const onClose = jest.fn();

    await render(
      <TimelinePhotoViewer visible petId="pet1" photoKeys={photoKeys} initialIndex={0} onClose={onClose} />,
    );

    expect(screen.getByLabelText("Photo 1 of 3")).toBeTruthy();
    expect(screen.getByLabelText("Photo 2 of 3")).toBeTruthy();
    expect(screen.getByLabelText("Photo 3 of 3")).toBeTruthy();
    expect(screen.getByLabelText("Close photo viewer")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("timeline-photo-viewer-close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner while pending and nothing crashes with no items", async () => {
    mockedUsePhotoViewUrls.mockReturnValue({ isLoading: true, data: undefined });

    await render(
      <TimelinePhotoViewer visible petId="pet1" photoKeys={["a.jpg"]} initialIndex={0} onClose={jest.fn()} />,
    );

    expect(screen.getByTestId("timeline-photo-viewer-loading")).toBeTruthy();
  });

  it("not visible renders no pages", async () => {
    mockedUsePhotoViewUrls.mockReturnValue({
      isLoading: false,
      data: { items: [{ key: "a.jpg", thumbUrl: "t-a", mainUrl: "m-a" }] },
    });

    await render(
      <TimelinePhotoViewer visible={false} petId="pet1" photoKeys={["a.jpg"]} initialIndex={0} onClose={jest.fn()} />,
    );

    expect(screen.queryByTestId("timeline-photo-viewer-page-0")).toBeNull();
  });
});
