import { fireEvent, render, screen, type RenderResult } from "@testing-library/react-native";

import DoneScreen from "../app/(auth)/done";
import EmailScreen from "../app/(auth)/email";
import OtpScreen from "../app/(auth)/otp";
import WelcomeScreen from "../app/(auth)/welcome";
import BreedScreen from "../app/add-pet/breed";
import DetailsScreen from "../app/add-pet/details";
import PhotoScreen from "../app/add-pet/photo";
import SpeciesScreen from "../app/add-pet/species";
import JoinScreen from "../app/join/[code]";
import PushRationaleScreen from "../app/push-rationale";
import { useBreedSearch } from "../src/api/breeds-api";
import { useAcceptInvite } from "../src/api/households-api";
import { useAddPetStore } from "../src/pets/add-pet-store";

/**
 * SWEEP-2 plan — cross-screen design-system.md §6 coverage for the auth +
 * onboarding surface: page-contract (solid `bg-brand-50`, no gradient),
 * header canon, token pairs (no `gray-`, error nodes `text-red-700` +
 * `alert` role), button hierarchy (one `PrimaryButton` region, social/
 * skip/back/resend as Secondary/Ghost), and 44pt touch targets on the
 * wizard's selectable rows. `expo-router` and the relevant API/store hooks
 * are mocked per-screen, mirroring `auth-flow.test.tsx`/`add-pet-wizard.
 * test.tsx`/`join-route.test.tsx`.
 */
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../src/auth/auth-store", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("../src/push/use-push-registration", () => ({
  usePushRegistration: () => ({ register: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock("../src/api/breeds-api", () => ({
  useBreedSearch: jest.fn(),
}));

jest.mock("../src/api/households-api", () => ({
  useAcceptInvite: jest.fn(),
}));

const mockedUseAuthStore = jest.requireMock<{ useAuthStore: jest.Mock }>(
  "../src/auth/auth-store",
).useAuthStore;
const mockedUseBreedSearch = useBreedSearch as unknown as jest.Mock;
const mockedUseAcceptInvite = useAcceptInvite as unknown as jest.Mock;

type JsonNode = ReturnType<RenderResult["toJSON"]>;

/** Recursively searches a rendered JSON tree for a node whose `className`
 * (string prop, as NativeWind passes it through unresolved under this
 * workspace's jest setup) matches `predicate`. */
function findClassName(
  node: JsonNode | JsonNode[] | string | null | undefined,
  predicate: (className: string) => boolean,
): boolean {
  if (node == null || typeof node === "string") {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some((child) => findClassName(child, predicate));
  }
  const className = (node.props as { className?: unknown } | undefined)?.className;
  if (typeof className === "string" && predicate(className)) {
    return true;
  }
  return findClassName(node.children as JsonNode[] | null, predicate);
}

describe("auth + onboarding a11y/design-system sweep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    useAddPetStore.getState().reset();
  });

  describe("welcome screen", () => {
    it("page is a solid bg-brand-50 (no gradient), AppTitle is a header, and button hierarchy is one primary + secondary social", async () => {
      const { toJSON } = await render(<WelcomeScreen />);

      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      expect(screen.queryByTestId("home-gradient-background")).toBeNull();

      const title = screen.getByTestId("app-title");
      expect(title.props.accessibilityRole).toBe("header");

      const primary = screen.getByTestId("welcome-continue-email");
      expect(primary.props.className).toContain("bg-brand-700");

      const social = screen.getByTestId("social-google-button");
      expect(social.props.className).toContain("border-brand-700");
      expect(social.props.className).toContain("bg-white");
      expect(social.props.className).not.toContain("bg-brand-700");
    });
  });

  describe("email screen", () => {
    it("is bg-brand-50, has no gray- classes, and shows an alert-role red-700 error on invalid submit", async () => {
      mockedUseAuthStore.mockImplementation(
        (selector: (state: { requestOtp: unknown }) => unknown) =>
          selector({ requestOtp: jest.fn() }),
      );

      const { toJSON } = await render(<EmailScreen />);
      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      expect(findClassName(toJSON(), (c) => c.includes("gray-"))).toBe(false);

      await fireEvent.changeText(screen.getByTestId("email-input"), "not-an-email");
      await fireEvent.press(screen.getByTestId("email-submit"));

      const error = screen.getByTestId("email-error");
      expect(error.props.accessibilityRole).toBe("alert");
      expect(error.props.className).toContain("text-red-700");
    });
  });

  describe("otp screen", () => {
    it("prompt is a header, resend is a GhostButton, no gray- classes", async () => {
      mockedUseAuthStore.mockImplementation(
        (selector: (state: { verifyOtp: unknown; requestOtp: unknown }) => unknown) =>
          selector({ verifyOtp: jest.fn(), requestOtp: jest.fn() }),
      );
      mockParams = { email: "a@b.com" };

      const { toJSON } = await render(<OtpScreen />);
      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);
      expect(findClassName(toJSON(), (c) => c.includes("gray-"))).toBe(false);

      const prompt = screen.getByText(/Enter the 6-digit code/);
      expect(prompt.props.accessibilityRole).toBe("header");

      const resend = screen.getByTestId("otp-resend");
      expect(resend.props.accessibilityRole).toBe("button");
      // GhostButton has no border/fill class, unlike PrimaryButton/SecondaryButton.
      expect(resend.props.className).not.toContain("border");
      expect(resend.props.className).not.toContain("bg-");
    });
  });

  describe("done screen (auth)", () => {
    it("is bg-brand-50 with a header-role title", async () => {
      const { toJSON } = await render(<DoneScreen />);
      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);

      const title = screen.getByText("You're all set");
      expect(title.props.accessibilityRole).toBe("header");
    });
  });

  describe("push-rationale screen", () => {
    it("title is a header and Not-now is a GhostButton", async () => {
      mockedUseAuthStore.mockImplementation(
        (selector: (state: { markPushAsked: unknown }) => unknown) =>
          selector({ markPushAsked: jest.fn() }),
      );

      await render(<PushRationaleScreen />);

      const title = screen.getByText("Stay on top of care");
      expect(title.props.accessibilityRole).toBe("header");

      const skip = screen.getByTestId("push-rationale-skip");
      expect(skip.props.accessibilityRole).toBe("button");
      expect(skip.props.className).not.toContain("border");
      expect(skip.props.className).not.toContain("bg-");
    });
  });

  describe("add-pet/species screen", () => {
    it("step title is a header and Start-over is a GhostButton", async () => {
      await render(<SpeciesScreen />);

      const title = screen.getByText("What kind of pet is this?");
      expect(title.props.accessibilityRole).toBe("header");

      const startOver = screen.getByTestId("add-pet-start-over");
      expect(startOver.props.accessibilityRole).toBe("button");
      expect(startOver.props.className).not.toContain("border");
      expect(startOver.props.className).not.toContain("bg-");

      const dogCard = screen.getByTestId("species-card-dog");
      expect(dogCard.props.accessibilityState).toEqual({ selected: false });
      await fireEvent.press(dogCard);
      expect(screen.getByTestId("species-card-dog").props.accessibilityState).toEqual({
        selected: true,
      });
    });
  });

  describe("add-pet/breed screen", () => {
    it("step title is a header and breed rows reach the 44pt touch target", async () => {
      mockedUseBreedSearch.mockReturnValue({
        data: [{ slug: "labrador", name: "Labrador" }],
        isLoading: false,
        isError: false,
      });
      useAddPetStore.getState().setField("species", "DOG");

      await render(<BreedScreen />);

      const title = screen.getByText("What breed?");
      expect(title.props.accessibilityRole).toBe("header");

      const row = screen.getByTestId("breed-row-labrador");
      expect(row.props.accessibilityRole).toBe("button");
      expect(row.props.className).toContain("min-h-[44px]");
    });
  });

  describe("add-pet/details screen", () => {
    it("sex chips carry role/state/44pt and the neutered switch has an accessibility label", async () => {
      await render(<DetailsScreen />);

      const maleChip = screen.getByTestId("details-sex-male");
      expect(maleChip.props.accessibilityRole).toBe("button");
      expect(maleChip.props.accessibilityState).toEqual({ selected: false });
      expect(maleChip.props.className).toContain("min-h-[44px]");

      await fireEvent.press(maleChip);
      expect(screen.getByTestId("details-sex-male").props.accessibilityState).toEqual({
        selected: true,
      });

      const toggle = screen.getByTestId("details-neutered-toggle");
      expect(toggle.props.accessibilityLabel).toBe("Neutered or spayed");
    });
  });

  describe("add-pet/photo screen", () => {
    it("Choose photo is a SecondaryButton and the preview image carries an accessibility label", async () => {
      await render(<PhotoScreen />);

      const choosePhoto = screen.getByTestId("add-pet-choose-photo");
      expect(choosePhoto.props.accessibilityRole).toBe("button");
      expect(choosePhoto.props.className).toContain("border-brand-700");
      expect(choosePhoto.props.className).toContain("bg-white");

      await fireEvent.press(choosePhoto);

      const preview = await screen.findByTestId("add-pet-photo-preview");
      expect(preview.props.accessibilityLabel).toBe("Your pet's photo");
    });
  });

  describe("join screen", () => {
    it("title is a header on a bg-brand-50 page and the error is alert-role red-700", async () => {
      mockedUseAcceptInvite.mockReturnValue({
        mutateAsync: jest.fn().mockRejectedValue(new Error("nope")),
        isPending: false,
      });
      mockParams = { code: "ABCD2345" };

      const { toJSON } = await render(<JoinScreen />);
      expect(findClassName(toJSON(), (c) => c.includes("bg-brand-50"))).toBe(true);

      const title = screen.getByTestId("join-title");
      expect(title.props.accessibilityRole).toBe("header");

      await fireEvent.press(screen.getByTestId("join-accept"));

      const error = await screen.findByTestId("join-error");
      expect(error.props.accessibilityRole).toBe("alert");
      expect(error.props.className).toContain("text-red-700");
    });
  });
});
