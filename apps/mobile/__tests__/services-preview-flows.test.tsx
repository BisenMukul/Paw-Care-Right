import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentType } from "react";

import ServicesIndexScreen from "../app/services";
import ServicesAdoptScreen from "../app/services/adopt";
import ServicesAdoptDetailScreen from "../app/services/adopt-detail";
import ServicesBookScreen from "../app/services/book";
import ServicesInsuranceScreen from "../app/services/insurance";
import ServicesSalonsScreen from "../app/services/salons";
import ServicesSlotsScreen from "../app/services/slots";
import ServicesStoreScreen from "../app/services/store";
import ServicesVetsScreen from "../app/services/vets";
import { strings } from "../src/strings";

/**
 * PREVIEW-1 plan: the hub-to-flow and flow-to-flow routing chains (D1-D3),
 * `useReducedMotion` gating across all 9 flow screens, and the book
 * screen's §5 escalation affordance to the REAL Symptom Check flow.
 */
const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../src/hooks/use-reduced-motion", () => ({
  useReducedMotion: jest.fn(() => false),
}));

const mockedUseReducedMotion = jest.requireMock<{ useReducedMotion: jest.Mock }>(
  "../src/hooks/use-reduced-motion",
).useReducedMotion;

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseReducedMotion.mockReturnValue(false);
  mockParams = {};
});

describe("services preview flows: hub routes into each flow", () => {
  it("vet and salon cards both route to /services/book", async () => {
    await render(<ServicesIndexScreen />);

    await fireEvent.press(screen.getByTestId("services-card-vet"));
    expect(mockPush).toHaveBeenCalledWith("/services/book");

    await fireEvent.press(screen.getByTestId("services-card-salon"));
    expect(mockPush).toHaveBeenCalledWith("/services/book");
  });

  it("store card routes to /services/store", async () => {
    await render(<ServicesIndexScreen />);
    await fireEvent.press(screen.getByTestId("services-card-store"));
    expect(mockPush).toHaveBeenCalledWith("/services/store");
  });

  it("adoption card routes to /services/adopt", async () => {
    await render(<ServicesIndexScreen />);
    await fireEvent.press(screen.getByTestId("services-card-adoption"));
    expect(mockPush).toHaveBeenCalledWith("/services/adopt");
  });

  it("insurance card routes to /services/insurance", async () => {
    await render(<ServicesIndexScreen />);
    await fireEvent.press(screen.getByTestId("services-card-insurance"));
    expect(mockPush).toHaveBeenCalledWith("/services/insurance");
  });
});

describe("services preview flows: vet/salon/slots/adopt chains", () => {
  it("book screen's vet card routes to /services/vets", async () => {
    await render(<ServicesBookScreen />);
    await fireEvent.press(screen.getByTestId("services-book-vet"));
    expect(mockPush).toHaveBeenCalledWith("/services/vets");
  });

  it("book screen's salon card routes to /services/salons", async () => {
    await render(<ServicesBookScreen />);
    await fireEvent.press(screen.getByTestId("services-book-salon"));
    expect(mockPush).toHaveBeenCalledWith("/services/salons");
  });

  it("a vet card's 'Preview booking' routes to /services/slots with kind=vet", async () => {
    const VetsScreen = ServicesVetsScreen;
    await render(<VetsScreen />);
    await fireEvent.press(screen.getByTestId("services-vet-book-vet-1"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/services/slots",
      params: { kind: "vet", id: "vet-1" },
    });
  });

  it("a salon card routes to /services/slots with kind=salon", async () => {
    await render(<ServicesSalonsScreen />);
    await fireEvent.press(screen.getByTestId("services-salon-card-salon-1"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/services/slots",
      params: { kind: "salon", id: "salon-1" },
    });
  });

  it("slots confirm routes to /services/preview-end with the resolved service", async () => {
    mockParams = { kind: "vet", id: "vet-1" };
    await render(<ServicesSlotsScreen />);
    await fireEvent.press(screen.getByTestId("services-slots-confirm"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/services/preview-end",
      params: { service: "vet" },
    });
  });

  it("store '+' routes to /services/preview-end with service=store", async () => {
    await render(<ServicesStoreScreen />);
    await fireEvent.press(screen.getByTestId("services-store-add-product-1"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/services/preview-end",
      params: { service: "store" },
    });
  });

  it("adopt card routes to /services/adopt-detail", async () => {
    await render(<ServicesAdoptScreen />);
    await fireEvent.press(screen.getByTestId("services-adopt-card-pet-1"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/services/adopt-detail",
      params: { petId: "pet-1" },
    });
  });

  it("adopt-detail apply routes to /services/preview-end with service=adopt", async () => {
    mockParams = { petId: "pet-1" };
    await render(<ServicesAdoptDetailScreen />);
    await fireEvent.press(screen.getByTestId("services-adopt-apply"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/services/preview-end",
      params: { service: "adopt" },
    });
  });
});

describe("services preview flows: reduced motion", () => {
  const SCREENS: Array<{ name: string; Component: ComponentType; params: Record<string, string> }> = [
    { name: "hub", Component: ServicesIndexScreen, params: {} },
    { name: "book", Component: ServicesBookScreen, params: {} },
    { name: "vets", Component: ServicesVetsScreen, params: {} },
    { name: "salons", Component: ServicesSalonsScreen, params: {} },
    { name: "slots", Component: ServicesSlotsScreen, params: { kind: "vet", id: "vet-1" } },
    { name: "store", Component: ServicesStoreScreen, params: {} },
    { name: "adopt", Component: ServicesAdoptScreen, params: {} },
    { name: "adopt-detail", Component: ServicesAdoptDetailScreen, params: { petId: "pet-1" } },
    { name: "insurance", Component: ServicesInsuranceScreen, params: {} },
  ];

  it.each(SCREENS.map((s): [string, (typeof SCREENS)[number]] => [s.name, s]))(
    "%s renders without error with reduced motion on (entrances-omitted branch)",
    async (_name, s) => {
      mockedUseReducedMotion.mockReturnValue(true);
      mockParams = s.params;
      const Component = s.Component;

      await render(<Component />);
    },
  );
});

describe("services preview flows: emergency affordance (§5)", () => {
  it("book screen's emergency row shows the note and routes to the real Symptom Check flow", async () => {
    await render(<ServicesBookScreen />);

    const row = screen.getByTestId("services-book-emergency");
    expect(row).toHaveTextContent(strings.servicesPreview.book.emergencyNote, { exact: false });

    await fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith("/check");
  });
});
