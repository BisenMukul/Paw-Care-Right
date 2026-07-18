import { fireEvent, render, screen } from "@testing-library/react-native";

import { EmptyState } from "../src/components/empty-state";

/**
 * SWEEP-4 plan (design-system.md §2.7). The CTA is OPTIONAL (plan Risk R1 --
 * several in-scope consumers have no single "create the missing thing"
 * action reachable without a new router target): it renders only when BOTH
 * `ctaLabel` and `onCtaPress` are supplied.
 */
describe("EmptyState", () => {
  it("renders the icon, title, and (no body/no CTA by default)", async () => {
    await render(<EmptyState testID="my-empty" icon="calendar-outline" title="Nothing here yet" />);

    const container = screen.getByTestId("my-empty");
    expect(container.props.className).toContain("rounded-2xl");
    expect(container.props.className).toContain("bg-white");
    expect(container.props.accessibilityRole).toBeUndefined();
    expect(screen.getByText("Nothing here yet")).toBeTruthy();
  });

  it("renders body text when supplied", async () => {
    await render(
      <EmptyState testID="my-empty" icon="calendar-outline" title="Nothing here yet" body="Check back later." />,
    );

    expect(screen.getByText("Check back later.")).toBeTruthy();
  });

  it("does NOT render a CTA when only ctaLabel is supplied (no onCtaPress)", async () => {
    await render(
      <EmptyState testID="my-empty" icon="calendar-outline" title="Nothing here yet" ctaLabel="Set up" />,
    );

    expect(screen.queryByText("Set up")).toBeNull();
  });

  it("does NOT render a CTA when only onCtaPress is supplied (no ctaLabel)", async () => {
    await render(
      <EmptyState testID="my-empty" icon="calendar-outline" title="Nothing here yet" onCtaPress={jest.fn()} />,
    );

    expect(screen.queryByTestId("my-empty-cta")).toBeNull();
  });

  it("renders and fires the CTA (a PrimaryButton) when both ctaLabel and onCtaPress are supplied", async () => {
    const onCtaPress = jest.fn();
    await render(
      <EmptyState
        testID="my-empty"
        icon="clipboard-outline"
        title="No suggestions yet"
        ctaLabel="Skip"
        ctaTestID="my-empty-cta"
        onCtaPress={onCtaPress}
      />,
    );

    const cta = screen.getByTestId("my-empty-cta");
    expect(cta.props.accessibilityRole).toBe("button");

    await fireEvent.press(cta);
    expect(onCtaPress).toHaveBeenCalledTimes(1);
  });
});
