/**
 * Pre-parse JSON extractor (T033 — fix for the T030 carried note: fenced/
 * BOM-wrapped provider output must be de-fenced/stripped BEFORE
 * `parseTriage`). Pure and NEVER throws: strips a leading BOM, trims, strips
 * a ` ```json ` / ` ``` ` / ` ```JSON ` fence if present anywhere in the
 * text, then falls back to slicing from the first `{` to the last `}` to
 * discard any remaining leading/trailing prose (plan R2 — not full
 * brace-balancing; a single-object contract does not need it, and
 * `parseTriage` rejects anything still malformed).
 */
export function extractJsonCandidate(raw: string): string {
  const withoutBom = raw.replace(/^\uFEFF/, "");
  let text = withoutBom.trim();

  const fenceMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(text);
  if (fenceMatch) {
    text = (fenceMatch[1] ?? "").trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return text;
  }

  return text.slice(firstBrace, lastBrace + 1);
}
