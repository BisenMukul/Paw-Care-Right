import { CHAT_RELEASE_BOUNDARY_CHARS, CHAT_SCAN_OVERLAP_CHARS, ChatOutputGate, type GateStep } from "./output-gate";

const PINNED_INCIDENT_KEYS = ["reason", "codes", "phase", "charsScanned", "releasedChars", "releasedBeforeFlag"].sort();

function releasedText(step: GateStep): string {
  if (step.kind !== "release") {
    throw new Error(`expected a release step, got ${step.kind}`);
  }
  return step.text;
}

describe("ChatOutputGate", () => {
  it("CHAT_SCAN_OVERLAP_CHARS is >= 96 (D2 lower bound — a future reduction must break this test)", () => {
    expect(CHAT_SCAN_OVERLAP_CHARS).toBeGreaterThanOrEqual(96);
  });

  it("flags a dosing completion and discards the pending buffer (one incident only)", () => {
    const gate = new ChatOutputGate();

    const step = gate.push("Sure — give 5 mg/kg of ibuprofen every 8 hours. ");
    expect(step.kind).toBe("flag");
    if (step.kind === "flag") {
      expect(step.incident.codes).toContain("DOSING");
    }
    expect(gate.flagged).toBe(true);

    // The defensive latch: further pushes/finish never resume release.
    expect(gate.push("more text after the flag")).toEqual({ kind: "hold" });
    expect(gate.finish()).toEqual({ kind: "hold" });
  });

  it("the incident object carries no text field", () => {
    const gate = new ChatOutputGate();
    const step = gate.push("Just give him ibuprofen for the pain. ");

    expect(step.kind).toBe("flag");
    if (step.kind !== "flag") return;

    expect(Object.keys(step.incident).sort()).toEqual(PINNED_INCIDENT_KEYS);
    expect(JSON.stringify(step.incident)).not.toContain("ibuprofen");
    expect(JSON.stringify(step.incident)).not.toContain("Just give him");
  });

  it("an unsafe pattern straddling the forced 160-char release is flagged", () => {
    const gate = new ChatOutputGate();

    const filler = "x".repeat(150);
    const chunk1 = `${filler} you could give 5 m`;
    const chunk2 = "g/kg of ibuprofen every 8 hours. ";

    expect(chunk1.length).toBeGreaterThan(CHAT_RELEASE_BOUNDARY_CHARS);

    const step1 = gate.push(chunk1);
    expect(step1.kind).toBe("release");
    expect(releasedText(step1)).toBe(chunk1);

    const step2 = gate.push(chunk2);
    expect(step2.kind).toBe("flag");
    if (step2.kind !== "flag") return;

    expect(step2.incident.codes).toContain("DOSING");
    expect(step2.incident.releasedBeforeFlag).toBe(true);
    expect(step2.incident.releasedChars).toBe(chunk1.length);

    // The un-released buffer is discarded — a subsequent finish() yields nothing.
    expect(gate.finish()).toEqual({ kind: "hold" });
  });

  it("a straddling harm pattern at the widest window is flagged", () => {
    const gate = new ChatOutputGate();

    const filler = "x".repeat(140);
    const proc = "put your pet to sleep"; // PROC_SRC literal (T038 pattern set)
    const gap = ` ${"z".repeat(38)} `; // 40-char bridge — the widest the detector's {0,40} allows
    const diy = "without a veterinarian"; // DIY_SRC literal

    const splitIndex = 20; // splits the bridge itself across the forced-release boundary
    const chunk1 = `${filler} ${proc}${gap.slice(0, splitIndex)}`;
    const chunk2 = gap.slice(splitIndex) + diy + ". ";

    expect(chunk1.length).toBeGreaterThan(CHAT_RELEASE_BOUNDARY_CHARS);

    const step1 = gate.push(chunk1);
    expect(step1.kind).toBe("release");

    const step2 = gate.push(chunk2);
    expect(step2.kind).toBe("flag");
    if (step2.kind !== "flag") return;

    expect(step2.incident.codes).toContain("HARM_ENABLING");
    expect(step2.incident.releasedBeforeFlag).toBe(true);
  });

  it("released text is never re-flagged (many forced releases over a long clean stream, zero incidents)", () => {
    const gate = new ChatOutputGate();

    const phrase = "the quick brown fox jumps over the lazy dog and rests by the pond ";
    const fullText = phrase.repeat(12); // ~816 clean chars, no sentence-boundary punctuation
    const chunkSize = 41;

    const released: string[] = [];
    let incidentCount = 0;

    for (let i = 0; i < fullText.length; i += chunkSize) {
      const delta = fullText.slice(i, i + chunkSize);
      const step = gate.push(delta);
      if (step.kind === "release") {
        released.push(step.text);
      } else if (step.kind === "flag") {
        incidentCount += 1;
      }
    }

    const finalStep = gate.finish();
    if (finalStep.kind === "release") {
      released.push(finalStep.text);
    } else if (finalStep.kind === "flag") {
      incidentCount += 1;
    }

    expect(incidentCount).toBe(0);
    expect(released.length).toBeGreaterThan(1);
    expect(released.join("")).toBe(fullText);
  });
});
