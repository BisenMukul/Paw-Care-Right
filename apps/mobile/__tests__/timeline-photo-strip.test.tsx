import { fireEvent, render, screen } from "@testing-library/react-native";

import { usePhotoViewUrls } from "../src/api/pet-photos-api";
import { TimelinePhotoStrip } from "../src/components/timeline-photo-strip";

// T069 plan "Tests to write" -> timeline-photo-strip.test.tsx. The shared
// query hook is mocked at the data boundary (mirrors the codebase's
// `useHealthTimeline`/`usePet` mocking convention).
jest.mock("../src/api/pet-photos-api", () => ({
  usePhotoViewUrls: jest.fn(),
}));

const mockedUsePhotoViewUrls = usePhotoViewUrls as unknown as jest.Mock;

describe("TimelinePhotoStrip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders a labelled thumbnail per key and opens the viewer at the tapped index", async () => {
    const photoKeys = ["pets/pet1/original/a.jpg", "pets/pet1/original/b.jpg"];
    mockedUsePhotoViewUrls.mockReturnValue({
      data: {
        items: [
          { key: photoKeys[0], thumbUrl: "https://signed.example/thumb-a", mainUrl: "https://signed.example/main-a" },
          { key: photoKeys[1], thumbUrl: "https://signed.example/thumb-b", mainUrl: "https://signed.example/main-b" },
        ],
      },
    });
    const onOpenPhoto = jest.fn();

    await render(
      <TimelinePhotoStrip
        petId="pet1"
        entryId="n1"
        photoKeys={photoKeys}
        kindLabel="Note"
        date="2026-07-15"
        onOpenPhoto={onOpenPhoto}
      />,
    );

    expect(screen.getByLabelText("Photo 1 of 2 for Note on 2026-07-15")).toBeTruthy();
    expect(screen.getByLabelText("Photo 2 of 2 for Note on 2026-07-15")).toBeTruthy();
    expect(screen.getByTestId("timeline-photo-thumb-image-n1-0")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("timeline-photo-thumb-n1-1"));

    expect(onOpenPhoto).toHaveBeenCalledWith({ petId: "pet1", photoKeys, index: 1 });
  });

  it("renders a placeholder without crashing while pending / on error", async () => {
    const photoKeys = ["pets/pet1/original/a.jpg"];
    mockedUsePhotoViewUrls.mockReturnValue({ data: undefined });

    await render(
      <TimelinePhotoStrip
        petId="pet1"
        entryId="n2"
        photoKeys={photoKeys}
        kindLabel="Note"
        date="2026-07-15"
        onOpenPhoto={jest.fn()}
      />,
    );

    expect(screen.getByTestId("timeline-photo-thumb-placeholder-n2-0")).toBeTruthy();
    expect(screen.queryByTestId("timeline-photo-thumb-image-n2-0")).toBeNull();
  });
});
