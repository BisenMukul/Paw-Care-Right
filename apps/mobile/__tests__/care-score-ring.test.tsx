import { render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { CareScoreRing } from "../src/components/home/care-score-ring";
import { strings } from "../src/strings";

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

describe("CareScoreRing — geometry + colors + honest null state", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("light scheme: progress circle stroke is the documented light accent", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    await render(<CareScoreRing value={70} testID="ring" />);

    expect(screen.getByTestId("ring-progress").props.stroke).toBe("#1f6350");
  });

  it("dark scheme: progress circle stroke is the documented dark accent-bright", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");

    await render(<CareScoreRing value={70} testID="ring" />);

    expect(screen.getByTestId("ring-progress").props.stroke).toBe("#2EA57C");
  });

  it("value=100 -> strokeDashoffset is ~0 (full ring)", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    await render(<CareScoreRing value={100} testID="ring" />);

    expect(screen.getByTestId("ring-progress").props.strokeDashoffset).toBeCloseTo(0);
  });

  it("value=0 -> strokeDashoffset is ~the full circumference (empty ring)", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    await render(<CareScoreRing value={0} testID="ring" />);

    expect(screen.getByTestId("ring-progress").props.strokeDashoffset).toBeCloseTo(CIRCUMFERENCE);
  });

  it("value=null -> no progress circle, track only, honest scorePlaceholder glyph", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    await render(<CareScoreRing value={null} testID="ring" />);

    expect(screen.queryByTestId("ring-progress")).toBeNull();
    expect(screen.getByTestId("ring-track")).toBeTruthy();
    expect(screen.getByTestId("ring-value")).toHaveTextContent(strings.careScore.scorePlaceholder);
  });

  it("value=72 -> the numeric value glyph is shown, not the placeholder", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    await render(<CareScoreRing value={72} testID="ring" />);

    expect(screen.getByTestId("ring-value")).toHaveTextContent("72");
  });
});
