import { fireEvent, render, screen } from "@testing-library/react-native";

import { ActivityRecentsRow, recentEntryLabel } from "../src/components/activity-recents-row";
import type { ActivityRecentEntry } from "../src/health-logs/activity-recents-store";

describe("recentEntryLabel", () => {
  it("formats a quantity+unit combo as 'Verb · N unit'", () => {
    expect(recentEntryLabel({ activityType: "FOOD", quantity: 2, unit: "meals" })).toBe("Fed · 2 meals");
  });

  it("singularizes at quantity 1", () => {
    expect(recentEntryLabel({ activityType: "FOOD", quantity: 1, unit: "meals" })).toBe("Fed · 1 meal");
  });

  it("formats a chips-only combo (no quantity) as 'Verb · Unit'", () => {
    expect(recentEntryLabel({ activityType: "GROOMING", unit: "brush" })).toBe("Groomed · Brush");
  });
});

describe("ActivityRecentsRow", () => {
  it("renders nothing when there are no recents", async () => {
    await render(<ActivityRecentsRow recents={[]} onPress={jest.fn()} />);
    expect(screen.queryByTestId("activity-recents-row")).toBeNull();
  });

  it("renders a chip per recent, and reports the pressed entry via onPress", async () => {
    const onPress = jest.fn();
    const recents: ActivityRecentEntry[] = [
      { activityType: "FOOD", quantity: 2, unit: "meals" },
      { activityType: "WALK", quantity: 20, unit: "min" },
    ];

    await render(<ActivityRecentsRow recents={recents} onPress={onPress} />);

    expect(screen.getByTestId("activity-recent-chip-0")).toHaveTextContent("Fed · 2 meals");
    expect(screen.getByTestId("activity-recent-chip-1")).toHaveTextContent("Walked · 20 min");

    await fireEvent.press(screen.getByTestId("activity-recent-chip-1"));
    expect(onPress).toHaveBeenCalledWith(recents[1]);
  });

  it("PAWSAATHI-2: a recent chip carries dark:bg-surface-card-dark; recentEntryLabel output is unchanged", async () => {
    const recents: ActivityRecentEntry[] = [{ activityType: "FOOD", quantity: 2, unit: "meals" }];
    await render(<ActivityRecentsRow recents={recents} onPress={jest.fn()} />);

    const chip = screen.getByTestId("activity-recent-chip-0");
    expect(chip.props.className).toContain("dark:bg-surface-card-dark");
    expect(chip).toHaveTextContent("Fed · 2 meals");
  });
});
