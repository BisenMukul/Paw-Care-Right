import { CHECK_STATUSES, type CheckStatus } from "@pawcareright/types";
import { CheckStatus as PrismaCheckStatus } from "@prisma/client";

import {
  assertTransition,
  canTransition,
  CHECK_STATUS_TRANSITIONS,
  isTerminalCheckStatus,
  TERMINAL_CHECK_STATUSES,
} from "./check-status";

const LEGAL_EDGES: ReadonlyArray<[CheckStatus, CheckStatus]> = [
  ["QUEUED", "RUNNING"],
  ["RUNNING", "DONE"],
  ["RUNNING", "FALLBACK"],
];

function isLegalEdge(from: CheckStatus, to: CheckStatus): boolean {
  return LEGAL_EDGES.some(([legalFrom, legalTo]) => legalFrom === from && legalTo === to);
}

describe("CHECK_STATUS_TRANSITIONS", () => {
  it("matches the acceptance-critical transition table", () => {
    expect(CHECK_STATUS_TRANSITIONS).toEqual({
      QUEUED: ["RUNNING"],
      RUNNING: ["DONE", "FALLBACK"],
      DONE: [],
      FALLBACK: [],
    });
  });
});

describe("canTransition drives the full 4x4 matrix", () => {
  for (const from of CHECK_STATUSES) {
    for (const to of CHECK_STATUSES) {
      const expected = isLegalEdge(from, to);
      it(`${from} -> ${to} is ${expected ? "legal" : "illegal"}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }

  it("has exactly 3 legal edges out of the 16 ordered pairs", () => {
    const legalCount = CHECK_STATUSES.flatMap((from) =>
      CHECK_STATUSES.filter((to) => canTransition(from, to)),
    ).length;
    expect(legalCount).toBe(3);
  });
});

describe("assertTransition", () => {
  it.each(LEGAL_EDGES)("does not throw on the legal edge %s -> %s", (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  for (const from of CHECK_STATUSES) {
    for (const to of CHECK_STATUSES) {
      if (isLegalEdge(from, to)) continue;
      it(`throws a clear Error on the illegal edge ${from} -> ${to}`, () => {
        expect(() => assertTransition(from, to)).toThrow(
          `illegal SymptomCheck status transition: ${from} -> ${to}`,
        );
      });
    }
  }
});

describe("TERMINAL_CHECK_STATUSES / isTerminalCheckStatus", () => {
  it("terminal states are exactly DONE and FALLBACK", () => {
    expect(TERMINAL_CHECK_STATUSES).toEqual(["DONE", "FALLBACK"]);
  });

  it.each(["DONE", "FALLBACK"] as const)("isTerminalCheckStatus(%s) is true", (status) => {
    expect(isTerminalCheckStatus(status)).toBe(true);
  });

  it.each(["QUEUED", "RUNNING"] as const)("isTerminalCheckStatus(%s) is false", (status) => {
    expect(isTerminalCheckStatus(status)).toBe(false);
  });
});

describe("Prisma CheckStatus <-> @pawcareright/types CHECK_STATUSES parity", () => {
  it("has the same member set (order-independent) so the enum can't silently drift", () => {
    const prismaValues = Object.values(PrismaCheckStatus).sort();
    const typesValues = [...CHECK_STATUSES].sort();
    expect(prismaValues).toEqual(typesValues);
  });
});
