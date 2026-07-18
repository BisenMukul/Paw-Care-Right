import { fireEvent, render, screen } from "@testing-library/react-native";

import { ActivityQuantitySheet } from "../src/components/activity-quantity-sheet";
import { strings } from "../src/strings";

describe("ActivityQuantitySheet", () => {
  it("renders nothing (Modal invisible) when activityType is null", async () => {
    await render(
      <ActivityQuantitySheet
        visible={false}
        activityType={null}
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );
    expect(screen.queryByTestId("activity-sheet")).toBeNull();
  });

  it("FOOD: pre-fills the default (1 meals); Save with zero further taps saves the default", async () => {
    const onSave = jest.fn();
    await render(
      <ActivityQuantitySheet
        visible
        activityType="FOOD"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={onSave}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );

    expect(screen.getByTestId("activity-quantity-value")).toHaveTextContent("1");
    expect(screen.getByTestId("activity-unit-meals").props.accessibilityState?.selected).toBe(true);

    await fireEvent.press(screen.getByTestId("activity-sheet-save"));

    expect(onSave).toHaveBeenCalledWith({ quantity: 1, unit: "meals" });
  });

  it("FOOD: the +/- stepper adjusts quantity within its range", async () => {
    const onSave = jest.fn();
    await render(
      <ActivityQuantitySheet
        visible
        activityType="FOOD"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={onSave}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByTestId("activity-quantity-increase"));
    expect(screen.getByTestId("activity-quantity-value")).toHaveTextContent("2");

    await fireEvent.press(screen.getByTestId("activity-sheet-save"));
    expect(onSave).toHaveBeenCalledWith({ quantity: 2, unit: "meals" });
  });

  it("FOOD: toggling the unit to grams switches the range and resets quantity to the grams minimum", async () => {
    const onSave = jest.fn();
    await render(
      <ActivityQuantitySheet
        visible
        activityType="FOOD"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={onSave}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByTestId("activity-unit-grams"));

    expect(screen.getByTestId("activity-quantity-value")).toHaveTextContent("10");

    await fireEvent.press(screen.getByTestId("activity-sheet-save"));
    expect(onSave).toHaveBeenCalledWith({ quantity: 10, unit: "grams" });
  });

  it("POTTY: pre-fills 1 · pee; a type chip switches the unit", async () => {
    const onSave = jest.fn();
    await render(
      <ActivityQuantitySheet
        visible
        activityType="POTTY"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={onSave}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );

    expect(screen.getByTestId("activity-quantity-value")).toHaveTextContent("1");
    expect(screen.getByTestId("activity-option-pee").props.accessibilityState?.selected).toBe(true);

    await fireEvent.press(screen.getByTestId("activity-option-both"));
    await fireEvent.press(screen.getByTestId("activity-sheet-save"));

    expect(onSave).toHaveBeenCalledWith({ quantity: 1, unit: "both" });
  });

  it("SLEEP: duration-only stepper, no unit chip row", async () => {
    const onSave = jest.fn();
    await render(
      <ActivityQuantitySheet
        visible
        activityType="SLEEP"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={onSave}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );

    expect(screen.getByTestId("activity-quantity-value")).toHaveTextContent("60");
    expect(screen.queryByTestId("activity-unit-min")).toBeNull();

    await fireEvent.press(screen.getByTestId("activity-sheet-save"));
    expect(onSave).toHaveBeenCalledWith({ quantity: 60, unit: "min" });
  });

  it("GROOMING: chips-only, no stepper; defaults to brush", async () => {
    const onSave = jest.fn();
    await render(
      <ActivityQuantitySheet
        visible
        activityType="GROOMING"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={onSave}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );

    expect(screen.queryByTestId("activity-quantity-value")).toBeNull();
    expect(screen.getByTestId("activity-option-brush").props.accessibilityState?.selected).toBe(true);

    await fireEvent.press(screen.getByTestId("activity-sheet-save"));
    expect(onSave).toHaveBeenCalledWith({ unit: "brush" });
  });

  it("uses initialQuantity/initialUnit (last-used) over the config default when supplied", async () => {
    const onSave = jest.fn();
    await render(
      <ActivityQuantitySheet
        visible
        activityType="WALK"
        initialQuantity={45}
        initialUnit="min"
        submitting={false}
        onSave={onSave}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );

    expect(screen.getByTestId("activity-quantity-value")).toHaveTextContent("45");
  });

  it("an optional note is trimmed and included only when non-empty", async () => {
    const onSave = jest.fn();
    await render(
      <ActivityQuantitySheet
        visible
        activityType="FOOD"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={onSave}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );

    await fireEvent.changeText(screen.getByTestId("activity-note-input"), "  Extra hungry  ");
    await fireEvent.press(screen.getByTestId("activity-sheet-save"));

    expect(onSave).toHaveBeenCalledWith({ quantity: 1, unit: "meals", note: "Extra hungry" });
  });

  it("the written-note link calls onWrittenNote", async () => {
    const onWrittenNote = jest.fn();
    await render(
      <ActivityQuantitySheet
        visible
        activityType="FOOD"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onWrittenNote={onWrittenNote}
      />,
    );

    expect(screen.getByTestId("activity-sheet-written-note")).toHaveTextContent(strings.activity.writtenNoteLink);
    await fireEvent.press(screen.getByTestId("activity-sheet-written-note"));
    expect(onWrittenNote).toHaveBeenCalledTimes(1);
  });

  it("Cancel calls onClose without calling onSave", async () => {
    const onClose = jest.fn();
    const onSave = jest.fn();
    await render(
      <ActivityQuantitySheet
        visible
        activityType="FOOD"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={onSave}
        onClose={onClose}
        onWrittenNote={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByTestId("activity-sheet-cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Save shows a loading spinner while submitting", async () => {
    await render(
      <ActivityQuantitySheet
        visible
        activityType="FOOD"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting
        onSave={jest.fn()}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );

    expect(screen.getByTestId("activity-sheet-save-spinner")).toBeTruthy();
  });

  it("PAWSAATHI-2: sheet carries dark:bg-surface-card-dark, stepper pill carries dark:bg-surface-raised-dark", async () => {
    await render(
      <ActivityQuantitySheet
        visible
        activityType="FOOD"
        initialQuantity={undefined}
        initialUnit={undefined}
        submitting={false}
        onSave={jest.fn()}
        onClose={jest.fn()}
        onWrittenNote={jest.fn()}
      />,
    );

    expect(screen.getByTestId("activity-sheet").props.className).toContain("dark:bg-surface-card-dark");
    expect(screen.getByTestId("activity-quantity-increase").props.className).toContain("dark:bg-surface-raised-dark");
  });
});
