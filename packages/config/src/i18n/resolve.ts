// T110: generic, typed override-merge for a strings tree. Read docs/I18N.md
// before editing. See plan §2.3 for the binding contract.

/**
 * Structural pin: an override may omit keys, but may never add one or change
 * a leaf's kind. Plain-object leaves recurse; string / function / array
 * leaves are typed as themselves (replace-wholesale at merge time).
 */
export type LocaleOverrides<T> = {
  readonly [K in keyof T]?:
    | (T[K] extends string
        ? string
        : T[K] extends (...args: infer A) => string
          ? (...args: A) => string
          : T[K] extends readonly (infer U)[]
            ? readonly U[]
            : LocaleOverrides<T[K]>)
    | undefined;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Deep merge. Returns `en` BY IDENTITY when `overrides` is undefined/empty.
 * Never mutates `en` or `overrides`. Merge rules: plain object -> recurse;
 * everything else (string / function / array) -> replace wholesale.
 * `undefined` override value -> keep English. Arrays are never merged
 * element-wise.
 */
export function resolveStrings<T>(en: T, overrides?: LocaleOverrides<T>): T {
  if (!overrides || Object.keys(overrides).length === 0) {
    return en;
  }
  if (!isPlainObject(en)) {
    // en is a string/function/array leaf, but an override object was passed
    // down to it -- this only happens via recursion below, where the override
    // for a non-object leaf always terminates the recursion, so this branch
    // is unreachable in practice; kept for type-safety fallback.
    return en;
  }
  const overrideRecord = overrides as Record<string, unknown>;
  const result: Record<string, unknown> = { ...(en as Record<string, unknown>) };
  for (const key of Object.keys(overrideRecord)) {
    const overrideValue = overrideRecord[key];
    if (overrideValue === undefined) continue;
    const englishValue = (en as Record<string, unknown>)[key];
    if (isPlainObject(englishValue) && isPlainObject(overrideValue)) {
      result[key] = resolveStrings(englishValue, overrideValue as LocaleOverrides<unknown>);
    } else {
      result[key] = overrideValue;
    }
  }
  return result as T;
}

/** Every dotted leaf path of a tree (strings, fns, array items, nested objects). */
export function collectLeafPaths(tree: unknown): string[] {
  const paths: string[] = [];
  function walk(node: unknown, prefix: string): void {
    if (isPlainObject(node)) {
      for (const key of Object.keys(node)) {
        walk(node[key], prefix ? `${prefix}.${key}` : key);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${prefix}[${index}]`));
      return;
    }
    // string / function / number / etc. leaf
    paths.push(prefix);
  }
  walk(tree, "");
  return paths;
}

/** Leaf paths actually provided by an override tree. */
export function collectOverridePaths(overrides: unknown): string[] {
  return collectLeafPaths(overrides);
}
