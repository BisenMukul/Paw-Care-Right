import { collectLeafPaths, collectOverridePaths, resolveStrings } from "./resolve";

const sample = {
  tabs: { home: "Home", care: "Care" },
  nav: { back: "Back" },
  greet: (name: string) => `Hi ${name}`,
  list: ["a", "b", "c"] as readonly string[],
} as const;

describe("resolveStrings", () => {
  it("returns `en` BY IDENTITY when overrides is undefined", () => {
    expect(resolveStrings(sample, undefined)).toBe(sample);
  });

  it("returns `en` BY IDENTITY when overrides is an empty object", () => {
    expect(resolveStrings(sample, {})).toBe(sample);
  });

  it("deep-merges a partial override without mutating the English tree", () => {
    const before = JSON.parse(JSON.stringify({ tabs: sample.tabs, nav: sample.nav }));
    const merged = resolveStrings(sample, { tabs: { home: "Inicio" } });
    expect(merged.tabs.home).toBe("Inicio");
    expect(merged.tabs.care).toBe("Care"); // English fallback for omitted key
    expect(merged.nav.back).toBe("Back");
    expect(merged).not.toBe(sample);
    // English tree itself is untouched
    expect(sample.tabs).toEqual(before.tabs);
    expect(sample.nav).toEqual(before.nav);
  });

  it("replaces function leaves wholesale, never merging into them", () => {
    const merged = resolveStrings(sample, { greet: (name: string) => `Hola ${name}` });
    expect(merged.greet("Ana")).toBe("Hola Ana");
  });

  it("replaces array leaves wholesale, never merging element-wise", () => {
    const merged = resolveStrings(sample, { list: ["x"] });
    expect(merged.list).toEqual(["x"]);
  });

  it("keeps English for an override value of undefined at a given key", () => {
    const merged = resolveStrings(sample, { tabs: { home: undefined } });
    expect(merged.tabs.home).toBe("Home");
  });

  it("never mutates the override object either", () => {
    const overrides = { tabs: { home: "Inicio" } };
    const before = JSON.parse(JSON.stringify(overrides));
    resolveStrings(sample, overrides);
    expect(overrides).toEqual(before);
  });
});

describe("collectLeafPaths / collectOverridePaths", () => {
  it("collects every dotted leaf path across object, function and array leaves", () => {
    const paths = collectLeafPaths(sample);
    expect(paths).toEqual(
      expect.arrayContaining([
        "tabs.home",
        "tabs.care",
        "nav.back",
        "greet",
        "list[0]",
        "list[1]",
        "list[2]",
      ]),
    );
    expect(paths).toHaveLength(7);
  });

  it("collectOverridePaths reports only the paths an override tree actually supplies", () => {
    const overridePaths = collectOverridePaths({ tabs: { home: "Inicio" } });
    expect(overridePaths).toEqual(["tabs.home"]);
  });
});
