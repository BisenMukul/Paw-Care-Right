import { allBreeds, emergencyPayloadByKey } from "@pawcareright/data";
import {
  ACTIVITY_TYPES,
  isValidRRule,
  parseHealthLogValue,
  parseIntake,
  parseTriage,
  URGENCY_TIERS,
} from "@pawcareright/types";

import { startOfUtcDay } from "../../prisma/seed/clock";
import { BUDDY_PET_ID, LUNA_PET_ID } from "../../prisma/seed/constants";
import {
  MEDICATION_DOSE_AS_ENTERED,
  TRIAGE_EMERGENCY,
  TRIAGE_FALLBACK,
  TRIAGE_MONITOR,
  TRIAGE_REASSURE,
  TRIAGE_VET_24H,
  TRIAGE_VET_SOON,
} from "../../prisma/seed/content";
import { buildDemo } from "../../prisma/seed/persist";

/**
 * Pure unit tests (no DB) for the demo-seed builders — mirrors the plan's
 * AC1-AC7 + the §7 content scan, all computable from `buildDemo`'s plain
 * output. A fixed `NOW` makes every assertion below reproducible.
 */
const NOW = new Date("2026-07-19T18:30:00.000Z");
const demo = buildDemo(NOW);

describe("demo seed builders — pets (AC2)", () => {
  it("builds exactly 3 pets with at least one dog and one cat", () => {
    expect(demo.pets).toHaveLength(3);
    expect(demo.pets.filter((pet) => pet.species === "DOG")).toHaveLength(1);
    expect(demo.pets.filter((pet) => pet.species === "CAT")).toHaveLength(2);
  });

  it("every pet breedSlug resolves in the packages/data breeds dataset", () => {
    const slugs = new Set(allBreeds.map((breed) => breed.slug));
    for (const pet of demo.pets) {
      expect(slugs.has(pet.breedSlug)).toBe(true);
    }
  });

  it("Buddy (rich) has a far larger built health-log count than Luna (sparse)", () => {
    const buddyLogCount = demo.healthLogs.filter((log) => log.petId === BUDDY_PET_ID).length;
    const lunaLogCount = demo.healthLogs.filter((log) => log.petId === LUNA_PET_ID).length;
    expect(lunaLogCount).toBeGreaterThan(0);
    expect(buddyLogCount).toBeGreaterThan(lunaLogCount * 3);
  });
});

describe("demo seed builders — health logs (AC3)", () => {
  const buddyWeights = demo.healthLogs.filter((log) => log.petId === BUDDY_PET_ID && log.kind === "WEIGHT");

  it("Buddy's weight series has >= 8 points spanning ~60 days", () => {
    expect(buddyWeights.length).toBeGreaterThanOrEqual(8);
    const times = buddyWeights.map((log) => log.occurredAt.getTime()).sort((a, b) => a - b);
    const spanDays = (times[times.length - 1] - times[0]) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThanOrEqual(55);
  });

  it("every built ACTIVITY entry passes parseHealthLogValue", () => {
    const activities = demo.healthLogs.filter((log) => log.kind === "ACTIVITY");
    expect(activities.length).toBeGreaterThan(0);
    for (const activity of activities) {
      expect(parseHealthLogValue("ACTIVITY", activity.valueJson).ok).toBe(true);
    }
  });

  it("all 7 ACTIVITY_TYPES appear somewhere across the demo", () => {
    const seen = new Set(
      demo.healthLogs
        .filter((log) => log.kind === "ACTIVITY")
        .map((log) => (log.valueJson as { activityType: string }).activityType),
    );
    for (const type of ACTIVITY_TYPES) {
      expect(seen.has(type)).toBe(true);
    }
  });

  it("at least one activity is logged today", () => {
    const today = startOfUtcDay(NOW).getTime();
    const hasToday = demo.healthLogs.some(
      (log) => log.kind === "ACTIVITY" && startOfUtcDay(log.occurredAt).getTime() === today,
    );
    expect(hasToday).toBe(true);
  });

  it("never builds MED_GIVEN or CHECK_REF rows (read-time projections only)", () => {
    const kinds = new Set(demo.healthLogs.map((log) => log.kind));
    expect(kinds.has("MED_GIVEN" as never)).toBe(false);
    expect(kinds.has("CHECK_REF" as never)).toBe(false);
  });
});

describe("demo seed builders — reminders (AC4)", () => {
  it("every reminder rrule is a valid RRULE", () => {
    for (const reminder of demo.reminders) {
      expect(isValidRRule(reminder.rrule)).toBe(true);
    }
  });

  it("includes due-today PENDING, future PENDING, and past DONE (with completedAt) events", () => {
    const today = startOfUtcDay(NOW).getTime();
    const allEvents = demo.reminders.flatMap((reminder) => reminder.events);

    expect(allEvents.some((event) => event.status === "PENDING" && startOfUtcDay(event.dueAt).getTime() === today)).toBe(
      true,
    );
    expect(allEvents.some((event) => event.status === "PENDING" && event.dueAt.getTime() > NOW.getTime())).toBe(true);
    expect(
      allEvents.some((event) => event.status === "DONE" && event.completedAt !== undefined && event.dueAt.getTime() < NOW.getTime()),
    ).toBe(true);
  });

  it("includes at least one MEDICATION reminder", () => {
    expect(demo.reminders.some((reminder) => reminder.type === "MEDICATION")).toBe(true);
  });

  it("includes at least one VACCINE reminder with a past DONE event", () => {
    const vaccineReminders = demo.reminders.filter((reminder) => reminder.type === "VACCINE");
    expect(vaccineReminders.length).toBeGreaterThan(0);
    expect(vaccineReminders.some((reminder) => reminder.events.some((event) => event.status === "DONE"))).toBe(true);
  });

  it("Luna has reminders but zero DONE events", () => {
    const lunaReminders = demo.reminders.filter((reminder) => reminder.petId === LUNA_PET_ID);
    expect(lunaReminders.length).toBeGreaterThan(0);
    const lunaEvents = lunaReminders.flatMap((reminder) => reminder.events);
    expect(lunaEvents.length).toBeGreaterThan(0);
    expect(lunaEvents.every((event) => event.status !== "DONE")).toBe(true);
  });
});

describe("demo seed builders — checks (AC5)", () => {
  it("every intakeJson is a valid CompletedIntake", () => {
    for (const check of demo.checks) {
      expect(parseIntake(check.intake).ok).toBe(true);
    }
  });

  it("every resultJson is a valid TriageResult", () => {
    for (const check of demo.checks) {
      expect(parseTriage(check.result.resultJson).ok).toBe(true);
    }
  });

  it("covers all five urgency tiers", () => {
    const urgencies = new Set(demo.checks.map((check) => check.result.urgency));
    for (const tier of URGENCY_TIERS) {
      expect(urgencies.has(tier)).toBe(true);
    }
  });

  it("has exactly one FALLBACK-status check", () => {
    expect(demo.checks.filter((check) => check.status === "FALLBACK")).toHaveLength(1);
  });

  it("has exactly one red-flag check, with ruleId === payloadKey present in the pinned emergency payloads", () => {
    const redFlagChecks = demo.checks.filter((check) => check.redFlagHit);
    expect(redFlagChecks).toHaveLength(1);
    const [check] = redFlagChecks;
    expect(check.redFlagRuleId).toBe(check.redFlagPayloadKey);
    expect(emergencyPayloadByKey.has(check.redFlagPayloadKey as string)).toBe(true);
  });

  it("TriageResult column urgency/confidence equal the resultJson fields", () => {
    for (const check of demo.checks) {
      expect(check.result.resultJson.urgency).toBe(check.result.urgency);
      expect(check.result.resultJson.confidence).toBe(check.result.confidence);
    }
  });
});

describe("demo seed — §7 safety copy (content scan)", () => {
  const DIAGNOSIS_PATTERN = /diagnos/i;

  function allFreeText(): string[] {
    const strings: string[] = [];

    for (const triage of [TRIAGE_REASSURE, TRIAGE_MONITOR, TRIAGE_VET_SOON, TRIAGE_VET_24H, TRIAGE_EMERGENCY, TRIAGE_FALLBACK]) {
      strings.push(triage.summary, ...triage.redFlagsToWatch, ...triage.homeCare, ...triage.doNot, ...triage.vetQuestions);
      triage.possibleCauses.forEach((cause) => strings.push(cause.name, cause.whyItFits));
    }

    for (const log of demo.healthLogs) {
      for (const value of Object.values(log.valueJson)) {
        if (typeof value === "string") {
          strings.push(value);
        }
      }
    }

    for (const reminder of demo.reminders) {
      strings.push(reminder.title);
      if (reminder.medNameAsEntered !== undefined) strings.push(reminder.medNameAsEntered);
      if (reminder.medDoseAsEntered !== undefined) strings.push(reminder.medDoseAsEntered);
    }

    return strings;
  }

  it("no seeded free text contains diagnosis/diagnose language (CLAUDE §7 rule 1)", () => {
    for (const text of allFreeText()) {
      expect(DIAGNOSIS_PATTERN.test(text)).toBe(false);
    }
  });

  it("medDoseAsEntered never contains an invented numeric dosage (CLAUDE §7 rule 2)", () => {
    expect(/\d/.test(MEDICATION_DOSE_AS_ENTERED)).toBe(false);
  });

  it("every triage resultJson re-parses via parseTriage (mechanical §7 gate)", () => {
    for (const check of demo.checks) {
      expect(parseTriage(check.result.resultJson).ok).toBe(true);
    }
  });

  it("EMERGENCY_NOW and VET_24H results have empty homeCare", () => {
    const emergencyOrVet24h = demo.checks.filter(
      (check) => check.result.urgency === "EMERGENCY_NOW" || check.result.urgency === "VET_24H",
    );
    expect(emergencyOrVet24h.length).toBeGreaterThan(0);
    for (const check of emergencyOrVet24h) {
      expect((check.result.resultJson as { homeCare: string[] }).homeCare).toEqual([]);
    }
  });
});
