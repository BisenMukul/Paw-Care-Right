import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ReminderEditScreen from "../app/reminders/edit";
import { useCreateReminder, useReminder, useUpdateReminder, type Reminder } from "../src/api/reminders-api";

/**
 * Create/edit custom reminder screen (T060 plan "Tests to write" /
 * "reminder-edit.test.tsx"). `reminders-api` hooks are mocked (mirrors
 * `care-plan-wizard.test.tsx`'s hook-mocking convention) -- the real
 * `ScheduleBuilder`/`buildRRule` run unmocked so the built rrule reflects
 * actual UI interaction. `expo-router` is mocked.
 */
const mockBack = jest.fn();
let mockParams: { reminderId?: string; petId?: string } = { petId: "pet-a" };

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../src/api/reminders-api", () => ({
  useReminder: jest.fn(),
  useCreateReminder: jest.fn(),
  useUpdateReminder: jest.fn(),
}));

const mockedUseReminder = useReminder as unknown as jest.Mock;
const mockedUseCreateReminder = useCreateReminder as unknown as jest.Mock;
const mockedUseUpdateReminder = useUpdateReminder as unknown as jest.Mock;
const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();
const mockRefetch = jest.fn();

const EXISTING_REMINDER: Reminder = {
  id: "reminder-1",
  petId: "pet-a",
  type: "DENTAL",
  title: "Teeth check",
  rrule: "FREQ=MONTHLY;BYMONTHDAY=10",
  timezone: "UTC",
  startAt: "2026-01-10T09:00:00.000Z",
  nextFireAt: "2026-01-10T09:00:00.000Z",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("reminder create/edit screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { petId: "pet-a" };
    mockedUseReminder.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: mockRefetch });
    mockedUseCreateReminder.mockReturnValue({ mutateAsync: mockCreateMutateAsync, isPending: false });
    mockedUseUpdateReminder.mockReturnValue({ mutateAsync: mockUpdateMutateAsync, isPending: false });
    mockCreateMutateAsync.mockResolvedValue(EXISTING_REMINDER);
    mockUpdateMutateAsync.mockResolvedValue(EXISTING_REMINDER);
  });

  it("create mode: choosing weekly + MO,WE + title + type builds the expected rrule and calls create", async () => {
    await render(<ReminderEditScreen />);

    await fireEvent.press(screen.getByTestId("reminder-type-VACCINE"));
    await fireEvent.changeText(screen.getByTestId("reminder-title-input"), "Flea treatment");
    await fireEvent.press(screen.getByTestId("schedule-freq-WEEKLY"));
    await fireEvent.press(screen.getByTestId("schedule-day-MO"));
    await fireEvent.press(screen.getByTestId("schedule-day-WE"));

    await fireEvent.press(screen.getByTestId("reminder-save"));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "VACCINE",
          title: "Flea treatment",
          rrule: "FREQ=WEEKLY;BYDAY=MO,WE",
        }),
      );
      // `router.back()` only runs after the awaited `mutateAsync` resolves
      // (a later microtask than the call itself being recorded) -- asserted
      // in the SAME waitFor so this can never race ahead of it.
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  it("create mode: every-3-days interval stepper builds an INTERVAL rrule", async () => {
    await render(<ReminderEditScreen />);

    await fireEvent.changeText(screen.getByTestId("reminder-title-input"), "Pain meds");
    await fireEvent.press(screen.getByTestId("schedule-interval-increment"));
    await fireEvent.press(screen.getByTestId("schedule-interval-increment"));

    await fireEvent.press(screen.getByTestId("reminder-save"));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ rrule: "FREQ=DAILY;INTERVAL=3" }),
      );
    });
  });

  it("edit mode: loads an existing reminder, seeds the form, and calls update (PATCH) on save", async () => {
    mockParams = { reminderId: "reminder-1" };
    mockedUseReminder.mockReturnValue({
      data: EXISTING_REMINDER,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    await render(<ReminderEditScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Teeth check")).toBeTruthy();
    });
    expect(screen.getByTestId("schedule-monthday").props.children).toBe(10);

    await fireEvent.press(screen.getByTestId("reminder-save"));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "DENTAL",
          title: "Teeth check",
          rrule: "FREQ=MONTHLY;BYMONTHDAY=10",
          startAt: "2026-01-10T09:00:00.000Z",
        }),
      );
      // Same reasoning as the create-mode test above -- `router.back()` fires
      // on a later microtask than the mutation call itself.
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it("a save rejection surfaces reminder-save-error without crashing or navigating back", async () => {
    mockCreateMutateAsync.mockRejectedValue(new Error("network down"));

    await render(<ReminderEditScreen />);
    await fireEvent.changeText(screen.getByTestId("reminder-title-input"), "Vet visit");
    await fireEvent.press(screen.getByTestId("reminder-save"));

    await waitFor(() => {
      expect(screen.getByTestId("reminder-save-error")).toBeTruthy();
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("renders no medication name/dose field (safety statement) regardless of the selected type", async () => {
    await render(<ReminderEditScreen />);

    await fireEvent.press(screen.getByTestId("reminder-type-MEDICATION"));

    expect(screen.queryByTestId("reminder-med-name")).toBeNull();
    expect(screen.queryByTestId("reminder-dose")).toBeNull();
    expect(screen.queryByPlaceholderText(/dose/i)).toBeNull();
  });

  it("edit mode loading: shows reminder-form-loading", async () => {
    mockParams = { reminderId: "reminder-1" };
    mockedUseReminder.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: mockRefetch });

    await render(<ReminderEditScreen />);

    expect(screen.getByTestId("reminder-form-loading")).toBeTruthy();
  });

  it("edit mode error: shows reminder-form-error; retry calls refetch", async () => {
    mockParams = { reminderId: "reminder-1" };
    mockedUseReminder.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mockRefetch });

    await render(<ReminderEditScreen />);

    expect(screen.getByTestId("reminder-form-error")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("reminder-form-retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
