import { INTAKE_CATEGORIES, type CategoryDef } from "@pawcareright/types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { CategoryGrid } from "../src/components/category-grid";

// Component tests for the schema-driven category grid (T044 plan AC1/AC2).
// RNTL v14 — every render is awaited.

describe("CategoryGrid — schema-driven (AC1a)", () => {
  it("renders one cell per INTAKE_CATEGORIES entry, with its label, and no more/no fewer", async () => {
    await render(<CategoryGrid onSelect={jest.fn()} />);

    for (const category of INTAKE_CATEGORIES) {
      const cell = screen.getByTestId(`check-category-${category.id}`);
      expect(cell).toBeTruthy();
      expect(cell).toHaveTextContent(category.label, { exact: false });
    }

    const grid = screen.getByTestId("check-category-grid");
    expect(grid.children.length).toBe(INTAKE_CATEGORIES.length);
  });

  it("PAWSAATHI-3: tile carries bg-white + dark:bg-surface-card-dark, label carries dark:text-ink-dark", async () => {
    await render(<CategoryGrid onSelect={jest.fn()} />);

    const [firstCategory] = INTAKE_CATEGORIES;
    const cell = screen.getByTestId(`check-category-${firstCategory!.id}`);
    expect(cell.props.className).toContain("bg-white");
    expect(cell.props.className).toContain("dark:bg-surface-card-dark");

    const label = screen.getByText(firstCategory!.label);
    expect(label.props.className).toContain("dark:text-ink-dark");
  });
});

describe("CategoryGrid — injected schema (AC1b, mutation-resistance)", () => {
  const SYNTHETIC_CATEGORIES: CategoryDef[] = [
    {
      id: "vomiting",
      label: "Custom Vomiting",
      questions: [{ id: "q1", type: "single", prompt: "?", required: true, options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }],
    },
    {
      id: "injury",
      label: "Custom Injury",
      questions: [{ id: "q1", type: "single", prompt: "?", required: true, options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }],
    },
    {
      id: "other",
      label: "Custom Other",
      questions: [{ id: "q1", type: "single", prompt: "?", required: true, options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }],
    },
  ];

  it("renders exactly the injected 3 categories, not the internal default list", async () => {
    await render(<CategoryGrid categories={SYNTHETIC_CATEGORIES} onSelect={jest.fn()} />);

    expect(screen.getByTestId("check-category-vomiting")).toHaveTextContent("Custom Vomiting", { exact: false });
    expect(screen.getByTestId("check-category-injury")).toHaveTextContent("Custom Injury", { exact: false });
    expect(screen.getByTestId("check-category-other")).toHaveTextContent("Custom Other", { exact: false });
    expect(screen.queryByTestId("check-category-diarrhea")).toBeNull();

    const grid = screen.getByTestId("check-category-grid");
    expect(grid.children.length).toBe(3);
  });
});

describe("CategoryGrid — onSelect (AC2)", () => {
  it("calls onSelect with the pressed category's id", async () => {
    const onSelect = jest.fn();
    await render(<CategoryGrid onSelect={onSelect} />);

    await fireEvent.press(screen.getByTestId("check-category-limping"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("limping");
  });
});
