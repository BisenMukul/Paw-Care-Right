import { petIdSchema, type CategoryDef, type Pet } from "@bombaypetcompany/types";
import { render, screen } from "@testing-library/react-native";
import React from "react";

import WelcomeScreen from "../app/(auth)/welcome";
import PetHomeScreen from "../app/pets/[id]";
import ServicesAdoptScreen from "../app/services/adopt";
import ServicesBookScreen from "../app/services/book";
import ServicesSalonsScreen from "../app/services/salons";
import ServicesStoreScreen from "../app/services/store";
import ServicesVetsScreen from "../app/services/vets";
import { usePet } from "../src/api/pets-api";
import { AnimatedGradientBackground } from "../src/components/home/animated-gradient-background";
import { QuickActionsGrid } from "../src/components/home/quick-actions-grid";
import { PetHeaderCard } from "../src/components/pet-header-card";
import { TypingIndicator } from "../src/components/chat/typing-indicator";
import { IntakeForm } from "../src/components/intake/intake-form";
import { QuickActions } from "../src/components/quick-actions";

/**
 * SWEEP-1 plan AC2 (design-system.md §3.2): every existing animation is
 * reachable from `useReducedMotion()`. Mocks the single hook module (not
 * the underlying reanimated shim) so each gated component is exercised in
 * isolation, both ways.
 *
 * T093 plan D4/Phase 2 step 10: appends coverage for the sites the re-run
 * animation-site audit found gated-but-untested -- `TypingIndicator`,
 * `IntakeForm`'s `entering` prop, `app/(auth)/welcome.tsx`,
 * `app/pets/[id].tsx`, and the 5 `app/services/*` preview screens. Every
 * case below is additive; no existing `describe`/`it` above this point is
 * edited.
 */
jest.mock("../src/hooks/use-reduced-motion", () => ({
  useReducedMotion: jest.fn(),
}));

const mockedUseReducedMotion = jest.requireMock<{ useReducedMotion: jest.Mock }>(
  "../src/hooks/use-reduced-motion",
).useReducedMotion;

const mockRouterPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: "pet1" }),
}));

jest.mock("../src/api/pets-api", () => ({
  usePet: jest.fn(),
}));
const mockedUsePet = usePet as unknown as jest.Mock;

const PET: Pet = {
  id: petIdSchema.parse("11111111-1111-4111-8111-111111111111"),
  householdId: "22222222-2222-2222-2222-222222222222",
  species: "DOG",
  sex: "MALE",
  name: "Rex",
  neutered: true,
  breedSlug: "labrador-retriever",
  birthDate: null,
  ageEstimateMonths: null,
  weightGrams: null,
  photoKey: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("reduced-motion gating", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("AnimatedGradientBackground", () => {
    it("reduced: no overlay loop, base gradient still present", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<AnimatedGradientBackground />);

      expect(screen.getByTestId("home-gradient-background")).toBeTruthy();
      expect(screen.queryByTestId("home-gradient-overlay")).toBeNull();
    });

    it("not reduced: overlay loop present", async () => {
      mockedUseReducedMotion.mockReturnValue(false);

      await render(<AnimatedGradientBackground />);

      expect(screen.getByTestId("home-gradient-background")).toBeTruthy();
      expect(screen.getByTestId("home-gradient-overlay")).toBeTruthy();
    });
  });

  describe("QuickActionsGrid", () => {
    const props = {
      disabled: false,
      onCheckSymptoms: jest.fn(),
      onLogWeight: jest.fn(),
      onLogActivity: jest.fn(),
      onVetVisit: jest.fn(),
    };

    it("reduced: all four tiles render, entering is undefined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<QuickActionsGrid {...props} />);

      const tile = screen.getByTestId("home-quick-action-check");
      expect(tile).toBeTruthy();
      expect(screen.getByTestId("home-quick-action-weight")).toBeTruthy();
      expect(screen.getByTestId("home-quick-action-activity")).toBeTruthy();
      expect(screen.getByTestId("home-quick-action-vet-visit")).toBeTruthy();
      expect(tile.parent?.props.entering).toBeUndefined();
    });

    it("not reduced: entering is defined", async () => {
      mockedUseReducedMotion.mockReturnValue(false);

      await render(<QuickActionsGrid {...props} />);

      const tile = screen.getByTestId("home-quick-action-check");
      expect(tile.parent?.props.entering).toBeDefined();
    });
  });

  describe("QuickActions", () => {
    const props = {
      onLogWeight: jest.fn(),
      onReminders: jest.fn(),
      onLogActivity: jest.fn(),
      onLogVetVisit: jest.fn(),
    };

    it("reduced: all four tiles render, entering is undefined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<QuickActions {...props} />);

      const tile = screen.getByTestId("quick-action-log-weight");
      expect(tile).toBeTruthy();
      expect(screen.getByTestId("quick-action-log-activity")).toBeTruthy();
      expect(screen.getByTestId("quick-action-log-vet-visit")).toBeTruthy();
      expect(screen.getByTestId("quick-action-reminders")).toBeTruthy();
      expect(tile.parent?.props.entering).toBeUndefined();
    });

    it("not reduced: entering is defined", async () => {
      mockedUseReducedMotion.mockReturnValue(false);

      await render(<QuickActions {...props} />);

      const tile = screen.getByTestId("quick-action-log-weight");
      expect(tile.parent?.props.entering).toBeDefined();
    });
  });

  describe("PetHeaderCard", () => {
    it("reduced: content visible, entering is undefined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<PetHeaderCard pet={PET} />);

      expect(screen.getByTestId("pet-home-name")).toHaveTextContent("Rex");
      expect(screen.getByTestId("pet-home-header-card").props.entering).toBeUndefined();
    });

    it("not reduced: entering is defined", async () => {
      mockedUseReducedMotion.mockReturnValue(false);

      await render(<PetHeaderCard pet={PET} />);

      expect(screen.getByTestId("pet-home-header-card").props.entering).toBeDefined();
    });
  });

  // T093 append: TypingIndicator was gated but had zero reduced-motion
  // test coverage. Mirrors `skeleton.test.tsx`'s exact idiom -- the wrapper
  // hook (`../src/hooks/use-reduced-motion`, already mocked above) drives
  // the `reduced` boolean, and a `jest.spyOn` on the REAL globally-mocked
  // `react-native-reanimated` module's `withRepeat` (jest.setup.ts) proves
  // the repeating loop behaviorally never starts when reduced -- not just
  // that a prop is absent.
  describe("TypingIndicator", () => {
    const reanimatedMock = jest.requireMock<{ withRepeat: (...args: unknown[]) => unknown }>(
      "react-native-reanimated",
    );

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("reduced: renders 3 static dots and never starts the repeating pulse", async () => {
      mockedUseReducedMotion.mockReturnValue(true);
      const withRepeatSpy = jest.spyOn(reanimatedMock, "withRepeat");

      await render(<TypingIndicator />);

      expect(screen.getByTestId("chat-typing-indicator")).toBeTruthy();
      expect(withRepeatSpy).not.toHaveBeenCalled();
    });

    it("not reduced: starts the repeating pulse", async () => {
      mockedUseReducedMotion.mockReturnValue(false);
      const withRepeatSpy = jest.spyOn(reanimatedMock, "withRepeat");

      await render(<TypingIndicator />);

      expect(withRepeatSpy).toHaveBeenCalledTimes(1);
    });
  });

  // T093 append: `IntakeForm`'s `entering` prop pair -- the AUTO_ADVANCE_MS
  // timer branch (`scheduleAutoAdvance`'s `reduced` fork) already has its
  // own behavioral proof in `intake-form.test.tsx` ("advances instantly
  // under reduced motion"), not duplicated here. The `scrollTo({y:0,
  // animated: !reduced})` branch (also gated by this same `reduced` value)
  // has NO independent RNTL assertion anywhere in this codebase and none is
  // added here -- `ScrollView.scrollTo` is an imperative ref method with no
  // existing capture precedent in this workspace's test suite, and
  // simulating one would be a fragile, first-of-its-kind mock this plan does
  // not sanction inventing. Recorded as an honesty-section item in
  // `docs/qa/a11y-audit.md` §7, not silently skipped.
  describe("IntakeForm", () => {
    const categoryDef: CategoryDef = {
      id: "other",
      label: "Synthetic",
      questions: [
        {
          id: "s1",
          type: "single",
          prompt: "Synthetic single",
          required: true,
          options: [{ value: "a", label: "Option A" }],
        },
      ],
    };

    it("reduced: entering is undefined on the step's Animated.View", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<IntakeForm categoryDef={categoryDef} onExit={jest.fn()} onSubmit={jest.fn()} />);

      const step = screen.getByTestId("intake-question-prompt").parent?.parent;
      expect(step?.props.entering).toBeUndefined();
    });

    it("not reduced: entering is defined on the step's Animated.View", async () => {
      mockedUseReducedMotion.mockReturnValue(false);
      jest.useFakeTimers();

      await render(<IntakeForm categoryDef={categoryDef} onExit={jest.fn()} onSubmit={jest.fn()} />);

      const step = screen.getByTestId("intake-question-prompt").parent?.parent;
      expect(step?.props.entering).toBeDefined();

      jest.useRealTimers();
    });
  });

  // T093 append: `app/(auth)/welcome.tsx` had zero reduced-motion test
  // coverage (the screen's OWN behavioral suite,
  // `auth-onboarding-a11y.test.tsx`, never varies `useReducedMotion`).
  describe("welcome screen", () => {
    it("reduced: hero content renders, entering is undefined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<WelcomeScreen />);

      expect(screen.getByTestId("welcome-hero")).toBeTruthy();
      expect(screen.getByTestId("welcome-hero").props.entering).toBeUndefined();
    });

    it("not reduced: entering is defined", async () => {
      mockedUseReducedMotion.mockReturnValue(false);

      await render(<WelcomeScreen />);

      expect(screen.getByTestId("welcome-hero").props.entering).toBeDefined();
    });
  });

  // T093 append: `app/pets/[id].tsx` (the pet-home screen) had zero
  // reduced-motion test coverage (`pet-home-screen.test.tsx`/
  // `pet-home-snapshot.test.tsx` never vary `useReducedMotion`).
  describe("pet-home screen (app/pets/[id])", () => {
    beforeEach(() => {
      mockedUsePet.mockReturnValue({
        data: PET,
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch: jest.fn(),
      });
    });

    it("reduced: the 'Something wrong?' CTA renders, its wrapping entering is undefined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);

      await render(<PetHomeScreen />);

      const cta = screen.getByTestId("pet-home-cta");
      expect(cta).toBeTruthy();
      expect(cta.parent?.props.entering).toBeUndefined();
    });

    it("not reduced: entering is defined", async () => {
      mockedUseReducedMotion.mockReturnValue(false);

      await render(<PetHomeScreen />);

      expect(screen.getByTestId("pet-home-cta").parent?.props.entering).toBeDefined();
    });
  });

  // T093 append: the 5 `app/services/*` preview screens already have
  // crash-only reduced-motion coverage (`services-preview-flows.test.tsx`'s
  // "renders without error with reduced motion on" -- entrances-omitted
  // branch), but never the `entering`-defined/undefined PAIR check this
  // sweep's other sites all carry. Additive, not a replacement for that
  // existing crash-only suite.
  describe("services/* preview screens: entering prop pair", () => {
    it("salons: reduced -> entering undefined, not reduced -> entering defined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);
      await render(<ServicesSalonsScreen />);
      expect(screen.getByTestId("services-salon-card-salon-1").parent?.props.entering).toBeUndefined();

      mockedUseReducedMotion.mockReturnValue(false);
      await render(<ServicesSalonsScreen />);
      const notReducedNodes = screen.getAllByTestId("services-salon-card-salon-1");
      expect(notReducedNodes[notReducedNodes.length - 1]!.parent?.props.entering).toBeDefined();
    });

    it("vets: reduced -> entering undefined, not reduced -> entering defined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);
      await render(<ServicesVetsScreen />);
      expect(screen.getByTestId("services-vet-card-vet-1").parent?.props.entering).toBeUndefined();

      mockedUseReducedMotion.mockReturnValue(false);
      await render(<ServicesVetsScreen />);
      const notReducedNodes = screen.getAllByTestId("services-vet-card-vet-1");
      expect(notReducedNodes[notReducedNodes.length - 1]!.parent?.props.entering).toBeDefined();
    });

    it("store: reduced -> entering undefined, not reduced -> entering defined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);
      await render(<ServicesStoreScreen />);
      expect(screen.getByTestId("services-store-card-product-1").parent?.props.entering).toBeUndefined();

      mockedUseReducedMotion.mockReturnValue(false);
      await render(<ServicesStoreScreen />);
      const notReducedNodes = screen.getAllByTestId("services-store-card-product-1");
      expect(notReducedNodes[notReducedNodes.length - 1]!.parent?.props.entering).toBeDefined();
    });

    it("adopt: reduced -> entering undefined, not reduced -> entering defined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);
      await render(<ServicesAdoptScreen />);
      expect(screen.getByTestId("services-adopt-card-pet-1").parent?.props.entering).toBeUndefined();

      mockedUseReducedMotion.mockReturnValue(false);
      await render(<ServicesAdoptScreen />);
      const notReducedNodes = screen.getAllByTestId("services-adopt-card-pet-1");
      expect(notReducedNodes[notReducedNodes.length - 1]!.parent?.props.entering).toBeDefined();
    });

    it("book: reduced -> entering undefined, not reduced -> entering defined", async () => {
      mockedUseReducedMotion.mockReturnValue(true);
      await render(<ServicesBookScreen />);
      expect(screen.getByTestId("services-book-vet").parent?.props.entering).toBeUndefined();

      mockedUseReducedMotion.mockReturnValue(false);
      await render(<ServicesBookScreen />);
      const notReducedNodes = screen.getAllByTestId("services-book-vet");
      expect(notReducedNodes[notReducedNodes.length - 1]!.parent?.props.entering).toBeDefined();
    });
  });
});
