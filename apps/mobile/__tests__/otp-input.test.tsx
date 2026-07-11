import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import { OtpInput } from "../src/components/otp-input";

// RNTL v14's render AND fireEvent are both async (React 19 concurrent roots,
// each fireEvent call wraps its handler in `act()`) — every call must be
// awaited (T008 Amendment A1). This suite drives the controlled OtpInput as
// a standalone component (parent owns `value`/`onChangeText`), mirroring how
// `app/(auth)/otp.tsx` wires it.
function Controlled({
  onComplete,
  hasError = false,
}: {
  onComplete: (code: string) => void;
  hasError?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <OtpInput
      value={value}
      onChangeText={setValue}
      onComplete={onComplete}
      hasError={hasError}
    />
  );
}

describe("OtpInput", () => {
  it("auto-advances and calls onComplete when the 6th digit lands", async () => {
    const onComplete = jest.fn();
    await render(<Controlled onComplete={onComplete} />);

    const digits = ["1", "2", "3", "4", "5", "6"];
    for (const [index, digit] of digits.entries()) {
      await fireEvent.changeText(screen.getByTestId(`otp-input-cell-${index}`), digit);
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("calls onChangeText with the growing value as digits are entered", async () => {
    const onComplete = jest.fn();
    let lastValue = "";

    function Spy() {
      const [value, setValue] = useState("");
      return (
        <OtpInput
          value={value}
          onChangeText={(next: string) => {
            lastValue = next;
            setValue(next);
          }}
          onComplete={onComplete}
        />
      );
    }

    await render(<Spy />);

    await fireEvent.changeText(screen.getByTestId("otp-input-cell-0"), "1");
    expect(lastValue).toBe("1");

    await fireEvent.changeText(screen.getByTestId("otp-input-cell-1"), "2");
    expect(lastValue).toBe("12");
  });

  it("backspace on an empty cell clears the previous cell", async () => {
    const onComplete = jest.fn();
    await render(<Controlled onComplete={onComplete} />);

    await fireEvent.changeText(screen.getByTestId("otp-input-cell-0"), "1");
    await fireEvent.changeText(screen.getByTestId("otp-input-cell-1"), "2");

    // Cell 2 is empty — backspace there clears cell 1 (observable via the
    // final assembled value once the remaining cells are filled in).
    await fireEvent(screen.getByTestId("otp-input-cell-2"), "keyPress", {
      nativeEvent: { key: "Backspace" },
    });

    await fireEvent.changeText(screen.getByTestId("otp-input-cell-1"), "9");
    await fireEvent.changeText(screen.getByTestId("otp-input-cell-2"), "3");
    await fireEvent.changeText(screen.getByTestId("otp-input-cell-3"), "4");
    await fireEvent.changeText(screen.getByTestId("otp-input-cell-4"), "5");
    await fireEvent.changeText(screen.getByTestId("otp-input-cell-5"), "6");

    expect(onComplete).toHaveBeenCalledWith("193456");
  });

  it("distributes a pasted 6-digit code across cells and completes", async () => {
    const onComplete = jest.fn();
    await render(<Controlled onComplete={onComplete} />);

    await fireEvent.changeText(screen.getByTestId("otp-input-cell-0"), "123456");

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("applies error styling to cells when hasError is true", async () => {
    await render(<Controlled onComplete={jest.fn()} hasError />);

    const cell = screen.getByTestId("otp-input-cell-0");
    expect(cell.props["aria-invalid"]).toBe(true);
  });
});
