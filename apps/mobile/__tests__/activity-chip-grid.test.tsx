import { fireEvent, render, screen } from "@testing-library/react-native";

import { ActivityChipGrid } from "../src/components/activity-chip-grid";
import { strings } from "../src/strings";

describe("ActivityChipGrid", () => {
  it("renders all 7 activity-type chips with their labels", async () => {
    await render(<ActivityChipGrid onSelect={jest.fn()} />);

    for (const type of ["FOOD", "WATER", "POTTY", "SLEEP", "WALK", "PLAY", "GROOMING"] as const) {
      expect(screen.getByTestId(`activity-chip-${type}`)).toHaveTextContent(strings.activity.typeLabel[type], {
        exact: false,
      });
    }
  });

  it("tapping a chip reports that activityType via onSelect", async () => {
    const onSelect = jest.fn();
    await render(<ActivityChipGrid onSelect={onSelect} />);

    await fireEvent.press(screen.getByTestId("activity-chip-WALK"));

    expect(onSelect).toHaveBeenCalledWith("WALK");
  });
});
