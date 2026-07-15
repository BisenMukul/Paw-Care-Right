import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { useCreateMedicationCourse } from "../src/api/reminders-api";
import { MedicationCourseForm } from "../src/components/medication-course-form";

/**
 * `MedicationCourseForm` (T061 plan "Tests to write"). `reminders-api`'s
 * `useCreateMedicationCourse` is mocked (mirrors `reminder-edit.test.tsx`'s
 * hook-mocking convention). RNTL v14 -- every render/press/changeText is
 * awaited, and every assertion depending on the awaited `mutateAsync`
 * resolving lives INSIDE `waitFor` (T060 race-discipline lesson).
 */
jest.mock("../src/api/reminders-api", () => ({
  useCreateMedicationCourse: jest.fn(),
}));

const mockedUseCreateMedicationCourse = useCreateMedicationCourse as unknown as jest.Mock;
const mockMutateAsync = jest.fn();
const mockOnSaved = jest.fn();

describe("MedicationCourseForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseCreateMedicationCourse.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    mockMutateAsync.mockResolvedValue({ courseId: "course-1", reminderCount: 2 });
  });

  it("renders free-text name + dose inputs and the always-visible disclaimer", async () => {
    await render(<MedicationCourseForm petId="pet-a" onSaved={mockOnSaved} />);

    expect(screen.getByTestId("med-name-input")).toBeTruthy();
    expect(screen.getByTestId("med-dose-input")).toBeTruthy();
    expect(screen.getByTestId("med-disclaimer")).toBeTruthy();
  });

  it("no dose-preset/autocomplete affordances: the dose input is a plain free-text field with a neutral (no-digit) placeholder", async () => {
    await render(<MedicationCourseForm petId="pet-a" onSaved={mockOnSaved} />);

    const doseInput = screen.getByTestId("med-dose-input");
    const nameInput = screen.getByTestId("med-name-input");
    expect(doseInput.props.placeholder).not.toMatch(/\d/);
    expect(nameInput.props.placeholder).not.toMatch(/\d/);
    expect(screen.queryByTestId("med-dose-preset")).toBeNull();
    expect(screen.queryByTestId("med-name-autocomplete")).toBeNull();
  });

  it("submitting builds doseStartAts from the selected time(s) and calls useCreateMedicationCourse with the expected payload, then onSaved", async () => {
    await render(<MedicationCourseForm petId="pet-a" onSaved={mockOnSaved} />);

    await fireEvent.changeText(screen.getByTestId("med-name-input"), "As prescribed");
    await fireEvent.changeText(screen.getByTestId("med-dose-input"), "As instructed");
    await fireEvent.press(screen.getByTestId("med-course-length-plus"));
    await fireEvent.press(screen.getByTestId("med-course-save"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          medNameAsEntered: "As prescribed",
          medDoseAsEntered: "As instructed",
          courseLengthDays: 2,
          doseStartAts: expect.arrayContaining([expect.any(String)]),
        }),
      );
      expect(mockOnSaved).toHaveBeenCalledTimes(1);
    });
  });

  it("an empty dose is omitted from the payload (medDoseAsEntered stays optional, never defaulted)", async () => {
    await render(<MedicationCourseForm petId="pet-a" onSaved={mockOnSaved} />);

    await fireEvent.changeText(screen.getByTestId("med-name-input"), "As prescribed");
    await fireEvent.press(screen.getByTestId("med-course-save"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.not.objectContaining({ medDoseAsEntered: expect.anything() }),
      );
    });
  });

  it("a mutation rejection surfaces med-course-save-error without calling onSaved", async () => {
    mockMutateAsync.mockRejectedValue(new Error("network down"));
    await render(<MedicationCourseForm petId="pet-a" onSaved={mockOnSaved} />);

    await fireEvent.changeText(screen.getByTestId("med-name-input"), "As prescribed");
    await fireEvent.press(screen.getByTestId("med-course-save"));

    await waitFor(() => {
      expect(screen.getByTestId("med-course-save-error")).toBeTruthy();
    });
    expect(mockOnSaved).not.toHaveBeenCalled();
  });

  it("adding a time appends a new dose-time row (Add time control)", async () => {
    await render(<MedicationCourseForm petId="pet-a" onSaved={mockOnSaved} />);

    expect(screen.getByTestId("med-time-row-0")).toBeTruthy();
    expect(screen.queryByTestId("med-time-row-1")).toBeNull();

    await fireEvent.press(screen.getByTestId("med-add-time"));

    expect(screen.getByTestId("med-time-row-1")).toBeTruthy();
  });

  it("the course-length stepper never goes below 1 day", async () => {
    await render(<MedicationCourseForm petId="pet-a" onSaved={mockOnSaved} />);

    await fireEvent.press(screen.getByTestId("med-course-length-minus"));

    expect(screen.getByTestId("med-course-length").props.children).toBe(1);
  });
});
