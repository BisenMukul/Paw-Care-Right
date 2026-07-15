import { render, screen } from "@testing-library/react-native";

import { WeightChart } from "../src/components/weight-chart";
import type { WeightBand } from "../src/weight/breed-weight-band";

// T065 plan AC "snapshot for empty / 1-point / many (+ band)". `WeightChart`
// is presentational (props in, SVG out) -- no mocks needed beyond the
// global `react-native-svg` passthrough from `jest.setup.ts`.
const MANY_POINTS = [
  { t: 1000, grams: 24000 },
  { t: 2000, grams: 24500 },
  { t: 3000, grams: 25000 },
  { t: 4000, grams: 25500 },
  { t: 5000, grams: 26000 },
];

const BAND: WeightBand = { minGrams: 25000, maxGrams: 36000, breedName: "Labrador Retriever" };

describe("WeightChart snapshots", () => {
  it("empty: renders the placeholder, not the svg", async () => {
    const { toJSON } = await render(<WeightChart points={[]} band={null} unit="kg" />);

    expect(screen.getByTestId("weight-chart-empty")).toBeTruthy();
    expect(screen.queryByTestId("weight-chart-svg")).toBeNull();
    expect(toJSON()).toMatchSnapshot();
  });

  it("one point", async () => {
    const { toJSON } = await render(
      <WeightChart points={[{ t: 1000, grams: 25000 }]} band={null} unit="kg" />,
    );

    expect(screen.getByTestId("weight-chart-svg")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });

  it("many points", async () => {
    const { toJSON } = await render(<WeightChart points={MANY_POINTS} band={null} unit="kg" />);

    expect(screen.getByTestId("weight-chart-svg")).toBeTruthy();
    expect(screen.queryByTestId("weight-chart-band-caption")).toBeNull();
    expect(toJSON()).toMatchSnapshot();
  });

  it("many points + band", async () => {
    const { toJSON } = await render(<WeightChart points={MANY_POINTS} band={BAND} unit="kg" />);

    expect(screen.getByTestId("weight-chart-band-caption")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });
});
