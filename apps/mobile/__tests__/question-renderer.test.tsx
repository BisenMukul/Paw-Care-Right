import type { Answer, QuestionDef } from "@pawcareright/types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import { QuestionRenderer } from "../src/components/intake/question-renderer";
import { strings } from "../src/strings";

// Per-type renderer unit tests (T045 plan AC1). Synthetic `QuestionDef`s —
// never real category data — so these tests are agnostic to
// `packages/types` content changes.

const singleQuestion: QuestionDef = {
  id: "q-single",
  type: "single",
  prompt: "Single prompt",
  required: true,
  options: [
    { value: "a", label: "Option A" },
    { value: "b", label: "Option B" },
  ],
};

const multiQuestion: QuestionDef = {
  id: "q-multi",
  type: "multi",
  prompt: "Multi prompt",
  required: false,
  maxSelections: 2,
  options: [
    { value: "a", label: "Option A" },
    { value: "b", label: "Option B" },
    { value: "c", label: "Option C" },
  ],
};

const scaleQuestion: QuestionDef = {
  id: "q-scale",
  type: "scale",
  prompt: "Scale prompt",
  required: true,
  min: 1,
  max: 5,
  minLabel: "Low end",
  maxLabel: "High end",
};

const durationQuestion: QuestionDef = {
  id: "q-duration",
  type: "duration",
  prompt: "Duration prompt",
  required: true,
  units: ["hours", "days"],
};

const photoPromptQuestion: QuestionDef = {
  id: "q-photo",
  type: "photoPrompt",
  prompt: "Photo prompt",
  required: false,
  maxPhotos: 3,
};

/** Stateful harness so controlled sub-components (multi) reflect answer changes. */
function Harness({
  question,
  initial,
  onChangeSpy,
}: {
  question: QuestionDef;
  initial?: Answer;
  onChangeSpy: (answer: Answer | undefined) => void;
}) {
  const [answer, setAnswer] = useState<Answer | undefined>(initial);
  return (
    <QuestionRenderer
      question={question}
      answer={answer}
      onChange={(next) => {
        setAnswer(next);
        onChangeSpy(next);
      }}
    />
  );
}

describe("QuestionRenderer", () => {
  it("single: renders prompt, press option calls onChange, reflects selection on re-render", async () => {
    const onChange = jest.fn();
    const { rerender } = await render(
      <QuestionRenderer question={singleQuestion} answer={undefined} onChange={onChange} />,
    );

    expect(screen.getByTestId("intake-question-prompt")).toHaveTextContent("Single prompt");

    await fireEvent.press(screen.getByTestId("intake-option-q-single-a"));
    expect(onChange).toHaveBeenCalledWith({ type: "single", questionId: "q-single", value: "a" });

    await rerender(
      <QuestionRenderer
        question={singleQuestion}
        answer={{ type: "single", questionId: "q-single", value: "a" }}
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId("intake-option-q-single-a").props.accessibilityState.selected).toBe(
      true,
    );
  });

  it("multi: press two options collects values; maxSelections blocks a third; deselecting to empty emits undefined", async () => {
    const onChange = jest.fn();
    await render(<Harness question={multiQuestion} onChangeSpy={onChange} />);

    expect(
      screen.getByTestId(`intake-multi-hint-${"q-multi"}`),
    ).toHaveTextContent(strings.intake.maxSelectionsHint(2));

    await fireEvent.press(screen.getByTestId("intake-option-q-multi-a"));
    expect(onChange).toHaveBeenLastCalledWith({
      type: "multi",
      questionId: "q-multi",
      values: ["a"],
    });

    await fireEvent.press(screen.getByTestId("intake-option-q-multi-b"));
    expect(onChange).toHaveBeenLastCalledWith({
      type: "multi",
      questionId: "q-multi",
      values: ["a", "b"],
    });

    const callsBeforeThird = onChange.mock.calls.length;
    await fireEvent.press(screen.getByTestId("intake-option-q-multi-c"));
    expect(onChange.mock.calls.length).toBe(callsBeforeThird);

    await fireEvent.press(screen.getByTestId("intake-option-q-multi-a"));
    await fireEvent.press(screen.getByTestId("intake-option-q-multi-b"));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("scale: renders min..max buttons + labels; press emits scale answer", async () => {
    const onChange = jest.fn();
    await render(<QuestionRenderer question={scaleQuestion} answer={undefined} onChange={onChange} />);

    for (let n = 1; n <= 5; n += 1) {
      expect(screen.getByTestId(`intake-scale-q-scale-${n}`)).toBeTruthy();
    }
    expect(screen.getByTestId("intake-scale-minlabel-q-scale")).toHaveTextContent("Low end");
    expect(screen.getByTestId("intake-scale-maxlabel-q-scale")).toHaveTextContent("High end");

    await fireEvent.press(screen.getByTestId("intake-scale-q-scale-3"));
    expect(onChange).toHaveBeenCalledWith({ type: "scale", questionId: "q-scale", value: 3 });
  });

  it("duration: renders only the offered unit pills; value+unit emits answer; clearing emits undefined", async () => {
    const onChange = jest.fn();
    await render(
      <QuestionRenderer question={durationQuestion} answer={undefined} onChange={onChange} />,
    );

    expect(screen.getByTestId("intake-duration-unit-q-duration-hours")).toBeTruthy();
    expect(screen.getByTestId("intake-duration-unit-q-duration-days")).toBeTruthy();
    expect(screen.queryByTestId("intake-duration-unit-q-duration-weeks")).toBeNull();
    expect(screen.queryByTestId("intake-duration-unit-q-duration-minutes")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("intake-duration-value-q-duration"), "2");
    await fireEvent.press(screen.getByTestId("intake-duration-unit-q-duration-days"));
    expect(onChange).toHaveBeenLastCalledWith({
      type: "duration",
      questionId: "q-duration",
      value: 2,
      unit: "days",
    });

    await fireEvent.changeText(screen.getByTestId("intake-duration-value-q-duration"), "");
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("photoPrompt: with no photoUpload capability, renders the unavailable note + prompt, never calls onChange", async () => {
    const onChange = jest.fn();
    await render(
      <QuestionRenderer question={photoPromptQuestion} answer={undefined} onChange={onChange} />,
    );

    expect(screen.getByTestId("intake-photo-unavailable-q-photo")).toBeTruthy();
    expect(screen.getByTestId("intake-question-prompt")).toHaveTextContent("Photo prompt");
    expect(screen.getByText(strings.intake.photo.unavailable)).toBeTruthy();
    expect(screen.getByTestId("intake-photo-camera-q-photo").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId("intake-photo-library-q-photo").props.accessibilityState.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
