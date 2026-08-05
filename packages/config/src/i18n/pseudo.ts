// T110: pseudolocale generation. Pseudolocale dictionaries are GENERATED at
// runtime from the English tree, never authored -- see plan §2.4. This is
// what makes the leak test (AC1) possible: after `pseudoTree` runs, every
// byte of copy that came from the strings tree is visibly marked, so
// anything unmarked on screen is a hardcoded literal.

export const PSEUDO_OPEN = "⟦"; // ⟦
export const PSEUDO_CLOSE = "⟧"; // ⟧
export const RTL_MARK = "‏"; // RLM

const ACCENT_MAP: Readonly<Record<string, string>> = {
  a: "ä",
  b: "ḃ",
  c: "ċ",
  d: "ḋ",
  e: "é",
  f: "ḟ",
  g: "ġ",
  h: "ĥ",
  i: "î",
  j: "ĵ",
  k: "ķ",
  l: "ŀ",
  m: "ṁ",
  n: "ñ",
  o: "ö",
  p: "ṗ",
  q: "q̈",
  r: "ŕ",
  s: "ś",
  t: "ţ",
  u: "ü",
  v: "ṽ",
  w: "ŵ",
  x: "x̂",
  y: "ý",
  z: "ź",
  A: "Ä",
  B: "Ḃ",
  C: "Ċ",
  D: "Ḋ",
  E: "É",
  F: "Ḟ",
  G: "Ġ",
  H: "Ĥ",
  I: "Î",
  J: "Ĵ",
  K: "Ķ",
  L: "Ŀ",
  M: "Ṁ",
  N: "Ñ",
  O: "Ö",
  P: "Ṗ",
  Q: "Q̈",
  R: "Ŕ",
  S: "Ś",
  T: "Ţ",
  U: "Ü",
  V: "Ṽ",
  W: "Ŵ",
  X: "X̂",
  Y: "Ý",
  Z: "Ź",
};

function accent(value: string): string {
  let out = "";
  for (const char of value) {
    out += ACCENT_MAP[char] ?? char;
  }
  return out;
}

/** "Home" -> "⟦Ĥöṁé⟧" — accented + bracketed, length-expanded ~30%. */
export function pseudoString(value: string): string {
  return `${PSEUDO_OPEN}${accent(value)}${PSEUDO_CLOSE}`;
}

/** "Home" -> RLM + "⟦Ĥöṁé⟧" + RLM. */
export function rtlPseudoString(value: string): string {
  return `${RTL_MARK}${pseudoString(value)}${RTL_MARK}`;
}

/** True iff the value carries the pseudo markers. */
export function isPseudoTransformed(value: string): boolean {
  return value.includes(PSEUDO_OPEN) && value.includes(PSEUDO_CLOSE);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Wraps a function leaf so its RESULT is transformed, preserving the
 * original function's `length` (arity) -- the T097 detector-lint collector
 * builds its call args from `fn.length`, so a wrapper with the wrong arity
 * would silently break that collector.
 */
function wrapFunctionLeaf<A extends unknown[]>(
  fn: (...args: A) => string,
  transform: (value: string) => string,
): (...args: A) => string {
  const wrapped = (...args: A): string => transform(fn(...args));
  Object.defineProperty(wrapped, "length", { value: fn.length, configurable: true });
  Object.defineProperty(wrapped, "name", { value: fn.name, configurable: true });
  return wrapped;
}

/**
 * Walks a whole tree; string leaves transformed, function leaves WRAPPED so
 * their RESULT is transformed (arity preserved), arrays walked element-wise,
 * plain objects recursed. Never mutates the input.
 */
export function pseudoTree<T>(tree: T, transform: (value: string) => string): T {
  if (typeof tree === "string") {
    return transform(tree) as unknown as T;
  }
  if (typeof tree === "function") {
    return wrapFunctionLeaf(tree as (...args: unknown[]) => string, transform) as unknown as T;
  }
  if (Array.isArray(tree)) {
    return tree.map((item) => pseudoTree(item, transform)) as unknown as T;
  }
  if (isPlainObject(tree)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(tree)) {
      result[key] = pseudoTree(tree[key], transform);
    }
    return result as unknown as T;
  }
  return tree;
}
