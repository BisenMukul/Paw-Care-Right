import { createRef } from "react";
import { render, screen } from "@testing-library/react-native";
import type { TextInput } from "react-native";

import { TextField } from "../src/components/text-field";

/**
 * SWEEP-2 plan (design-system.md §2.8): label + input + inline `alert`
 * error, one component. The error node renders ONLY when `error` is
 * truthy; `ref` forwards to the underlying `TextInput` so a failed submit
 * can focus it.
 */
describe("TextField", () => {
  it("renders the label and input, with no error node when error is unset", async () => {
    await render(
      <TextField
        testID="my-field"
        label="Email address"
        value=""
        onChangeText={jest.fn()}
      />,
    );

    expect(screen.getByText("Email address")).toBeTruthy();
    expect(screen.getByTestId("my-field")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders an accessibilityRole=alert error node only when error is truthy", async () => {
    await render(
      <TextField
        testID="my-field"
        errorTestID="my-field-error"
        label="Email address"
        value=""
        onChangeText={jest.fn()}
        error="Enter a valid email address."
      />,
    );

    const error = screen.getByTestId("my-field-error");
    expect(error.props.accessibilityRole).toBe("alert");
    expect(error.props.children).toBe("Enter a valid email address.");

    const input = screen.getByTestId("my-field");
    expect(input.props.className).toContain("border-red-600");
  });

  it("forwards the ref to the underlying TextInput so screens can focus it", async () => {
    const ref = createRef<TextInput>();
    await render(
      <TextField ref={ref} testID="my-field" label="Email address" value="" onChangeText={jest.fn()} />,
    );

    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.focus).toBe("function");
  });
});
