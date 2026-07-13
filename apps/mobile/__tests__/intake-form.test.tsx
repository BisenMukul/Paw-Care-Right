import type { CategoryDef } from "@pawcareright/types";
import { getCategoryDef } from "@pawcareright/types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { IntakeForm } from "../src/components/intake/intake-form";
import { strings } from "../src/strings";

// Flow tests (T045 plan AC2 + supporting flow tests). RNTL v14, every
// render/interaction awaited.

const otherCategoryDef = getCategoryDef("other") as CategoryDef;

/** Global-divergent synthetic def: id is a real enum value ("other") but the
 * questions do not match `INTAKE_CATEGORIES`'s real "other" schema. Proves
 * the flow renders/collects data-driven questions it never hardcodes (plan
 * Risk R6), and doubles as the fail-closed test fixture. */
const syntheticCategoryDef: CategoryDef = {
  id: "other",
  label: "Synthetic",
  questions: [
    {
      id: "s1",
      type: "single",
      prompt: "Synthetic single",
      required: true,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    },
    {
      id: "m1",
      type: "multi",
      prompt: "Synthetic multi",
      required: false,
      maxSelections: 2,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ],
    },
    {
      id: "sc1",
      type: "scale",
      prompt: "Synthetic scale",
      required: true,
      min: 1,
      max: 3,
      minLabel: "Low",
      maxLabel: "High",
    },
    {
      id: "d1",
      type: "duration",
      prompt: "Synthetic duration",
      required: true,
      units: ["hours", "days"],
    },
    {
      id: "p1",
      type: "photoPrompt",
      prompt: "Synthetic photo",
      required: false,
      maxPhotos: 2,
    },
    {
      id: "synthetic-extra",
      type: "single",
      prompt: "Synthetic extra question",
      required: true,
      options: [
        { value: "x", label: "X" },
        { value: "y", label: "Y" },
      ],
    },
  ],
};

describe("IntakeForm — mutation-resistance (AC2)", () => {
  it("renders + collects every injected question type, including one no mobile code hardcodes", async () => {
    const onSubmit = jest.fn();
    const onExit = jest.fn();
    await render(
      <IntakeForm categoryDef={syntheticCategoryDef} onExit={onExit} onSubmit={onSubmit} />,
    );

    const total = syntheticCategoryDef.questions.length + 2;
    expect(screen.getByTestId("intake-progress")).toHaveTextContent(strings.intake.stepOf(1, total));

    // step 0: single s1
    expect(screen.getByTestId("intake-question-prompt")).toHaveTextContent("Synthetic single");
    await fireEvent.press(screen.getByTestId("intake-option-s1-a"));
    await fireEvent.press(screen.getByTestId("intake-next"));

    // step 1: multi m1 (optional — answer it anyway to prove collection)
    expect(screen.getByTestId("intake-question-prompt")).toHaveTextContent("Synthetic multi");
    await fireEvent.press(screen.getByTestId("intake-option-m1-a"));
    await fireEvent.press(screen.getByTestId("intake-option-m1-b"));
    await fireEvent.press(screen.getByTestId("intake-next"));

    // step 2: scale sc1
    expect(screen.getByTestId("intake-question-prompt")).toHaveTextContent("Synthetic scale");
    await fireEvent.press(screen.getByTestId("intake-scale-sc1-2"));
    await fireEvent.press(screen.getByTestId("intake-next"));

    // step 3: duration d1
    expect(screen.getByTestId("intake-question-prompt")).toHaveTextContent("Synthetic duration");
    await fireEvent.changeText(screen.getByTestId("intake-duration-value-d1"), "3");
    await fireEvent.press(screen.getByTestId("intake-duration-unit-d1-hours"));
    await fireEvent.press(screen.getByTestId("intake-next"));

    // step 4: photoPrompt p1 — no photoUpload capability passed to IntakeForm,
    // so it renders the disabled "unavailable" state and emits no answer.
    expect(screen.getByTestId("intake-photo-unavailable-p1")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("intake-next"));

    // step 5: the extra question no mobile code hardcodes
    expect(screen.getByTestId("intake-question-prompt")).toHaveTextContent(
      "Synthetic extra question",
    );
    await fireEvent.press(screen.getByTestId("intake-option-synthetic-extra-x"));
    await fireEvent.press(screen.getByTestId("intake-next"));

    // step 6: free-text — skip
    expect(screen.getByTestId("intake-freetext-input")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("intake-next"));

    // step 7: review
    expect(screen.getByTestId("intake-review-row-s1")).toBeTruthy();
    expect(screen.getByTestId("intake-review-row-m1")).toBeTruthy();
    expect(screen.getByTestId("intake-review-row-sc1")).toBeTruthy();
    expect(screen.getByTestId("intake-review-row-d1")).toBeTruthy();
    expect(screen.getByTestId("intake-review-row-synthetic-extra")).toBeTruthy();
    expect(screen.queryByTestId("intake-review-row-p1")).toBeNull();
  });
});

describe("IntakeForm — supporting flow tests (real category)", () => {
  it("shows the progress indicator for the real 'other' category", async () => {
    await render(
      <IntakeForm categoryDef={otherCategoryDef} onExit={jest.fn()} onSubmit={jest.fn()} />,
    );

    expect(screen.getByTestId("intake-progress")).toHaveTextContent("Step 1 of 4");
  });

  it("gates Next on a required question until answered", async () => {
    await render(
      <IntakeForm categoryDef={otherCategoryDef} onExit={jest.fn()} onSubmit={jest.fn()} />,
    );

    expect(screen.getByTestId("intake-next").props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByTestId("intake-duration-value-onset"), "2");
    await fireEvent.press(screen.getByTestId("intake-duration-unit-onset-hours"));

    expect(screen.getByTestId("intake-next").props.accessibilityState.disabled).toBe(false);
  });

  it("back on step 0 calls onExit; back on step 1 returns to step 0", async () => {
    const onExit = jest.fn();
    await render(
      <IntakeForm categoryDef={otherCategoryDef} onExit={onExit} onSubmit={jest.fn()} />,
    );

    await fireEvent.press(screen.getByTestId("intake-back"));
    expect(onExit).toHaveBeenCalledTimes(1);

    await fireEvent.changeText(screen.getByTestId("intake-duration-value-onset"), "2");
    await fireEvent.press(screen.getByTestId("intake-duration-unit-onset-hours"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    expect(screen.getByTestId("intake-progress")).toHaveTextContent("Step 2 of 4");

    await fireEvent.press(screen.getByTestId("intake-back"));
    expect(screen.getByTestId("intake-progress")).toHaveTextContent("Step 1 of 4");
  });

  it("free-text step is optional; typed text appears in the review row", async () => {
    await render(
      <IntakeForm categoryDef={otherCategoryDef} onExit={jest.fn()} onSubmit={jest.fn()} />,
    );

    await fireEvent.changeText(screen.getByTestId("intake-duration-value-onset"), "2");
    await fireEvent.press(screen.getByTestId("intake-duration-unit-onset-hours"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-scale-severity-3"));
    await fireEvent.press(screen.getByTestId("intake-next"));

    expect(screen.getByTestId("intake-freetext-input")).toBeTruthy();
    expect(screen.getByTestId("intake-next").props.accessibilityState.disabled).toBe(false);

    await fireEvent.changeText(screen.getByTestId("intake-freetext-input"), "extra notes");
    await fireEvent.press(screen.getByTestId("intake-next"));

    expect(screen.getByTestId("intake-review-freetext")).toHaveTextContent("extra notes", {
      exact: false,
    });
  });

  it("submits the exact valid CompletedIntake on the ok path", async () => {
    const onSubmit = jest.fn();
    await render(
      <IntakeForm categoryDef={otherCategoryDef} onExit={jest.fn()} onSubmit={onSubmit} />,
    );

    await fireEvent.changeText(screen.getByTestId("intake-duration-value-onset"), "2");
    await fireEvent.press(screen.getByTestId("intake-duration-unit-onset-hours"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-scale-severity-3"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-next")); // skip free-text

    expect(screen.getByTestId("intake-submit").props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByTestId("intake-submit"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      category: "other",
      answers: [
        { type: "duration", questionId: "onset", value: 2, unit: "hours" },
        { type: "scale", questionId: "severity", value: 3 },
      ],
    });
  });

  it("review edit jumps back to the edited question's step", async () => {
    await render(
      <IntakeForm categoryDef={otherCategoryDef} onExit={jest.fn()} onSubmit={jest.fn()} />,
    );

    await fireEvent.changeText(screen.getByTestId("intake-duration-value-onset"), "2");
    await fireEvent.press(screen.getByTestId("intake-duration-unit-onset-hours"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-scale-severity-3"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-next")); // skip free-text

    await fireEvent.press(screen.getByTestId("intake-review-edit-onset"));

    expect(screen.getByTestId("intake-progress")).toHaveTextContent("Step 1 of 4");
    expect(screen.getByTestId("intake-duration-value-onset")).toBeTruthy();
  });

  it("fails closed: a global-divergent categoryDef shows the validation error and disables submit", async () => {
    const onSubmit = jest.fn();
    await render(
      <IntakeForm categoryDef={syntheticCategoryDef} onExit={jest.fn()} onSubmit={onSubmit} />,
    );

    await fireEvent.press(screen.getByTestId("intake-option-s1-a"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-next")); // skip optional multi
    await fireEvent.press(screen.getByTestId("intake-scale-sc1-2"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.changeText(screen.getByTestId("intake-duration-value-d1"), "3");
    await fireEvent.press(screen.getByTestId("intake-duration-unit-d1-hours"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-next")); // skip optional photoPrompt
    await fireEvent.press(screen.getByTestId("intake-option-synthetic-extra-x"));
    await fireEvent.press(screen.getByTestId("intake-next"));
    await fireEvent.press(screen.getByTestId("intake-next")); // skip free-text

    expect(screen.getByTestId("intake-validation-error")).toBeTruthy();
    expect(screen.getByTestId("intake-submit").props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId("intake-submit"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
