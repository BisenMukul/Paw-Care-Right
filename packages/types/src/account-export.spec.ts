import { ACCOUNT_EXPORT_SCHEMA_VERSION, accountExportSchema } from "./account-export";

const NOW = "2026-07-25T00:00:00.000Z";

function buildValidBundle(): Record<string, unknown> {
  return {
    schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
    generatedAt: NOW,
    linkExpiresAt: "2026-08-01T00:00:00.000Z",
    user: {
      id: "user-1",
      email: "owner@bombaypetcompany.local",
      locale: "en-US",
      region: "US",
      createdAt: NOW,
    },
    household: { id: "household-1", name: "My Household", yourRole: "OWNER" },
    pets: [
      {
        id: "pet-1",
        species: "DOG",
        breedSlug: null,
        name: "Rex",
        sex: "MALE",
        neutered: true,
        birthDate: null,
        ageEstimateMonths: 24,
        weightGrams: 20000,
        photoKey: null,
        createdAt: NOW,
      },
    ],
    checks: [
      {
        id: "check-1",
        petId: "pet-1",
        status: "DONE",
        category: "vomiting",
        intakeJson: { category: "vomiting", answers: [] },
        photoKeys: [],
        redFlagHit: false,
        createdAt: NOW,
        result: {
          urgency: "MONITOR",
          confidence: "medium",
          summary: "Keep an eye on your pet and watch for changes.",
          possibleCauses: [],
          redFlagsToWatch: [],
          homeCare: ["Offer small amounts of water."],
          doNot: [],
          vetQuestions: [],
          followUpHours: 24,
        },
        followUp: { response: "better" },
      },
    ],
    healthLogs: [
      {
        id: "log-1",
        petId: "pet-1",
        kind: "NOTE",
        valueJson: { text: "Ate well today." },
        photoKeys: [],
        occurredAt: NOW,
      },
    ],
    reminders: [
      {
        id: "reminder-1",
        petId: "pet-1",
        type: "VACCINE",
        title: "Rabies booster",
        rrule: "FREQ=YEARLY",
        timezone: "UTC",
        active: true,
        events: [
          {
            id: "event-1",
            dueAt: NOW,
            status: "PENDING",
            completedAt: null,
            snoozedUntil: null,
          },
        ],
      },
    ],
    chatThreads: [
      {
        id: "thread-1",
        petId: "pet-1",
        createdAt: NOW,
        messages: [
          { role: "USER", content: "Is chocolate bad for dogs?", status: "OK", createdAt: NOW },
          { role: "ASSISTANT", content: "Yes, keep chocolate away from dogs.", status: "OK", createdAt: NOW },
        ],
      },
    ],
    notificationPrefs: { disabledTypes: [], quietHours: null },
    subscription: { entitlement: "PREMIUM", plan: "bombaypetcompany_monthly", status: "active", expiresAt: null },
    devices: [{ platform: "ios", lastSeenAt: NOW, createdAt: NOW }],
    photos: [{ key: "pets/pet-1/main/x.jpg", downloadUrl: "https://minio.example/pets/pet-1/main/x.jpg" }],
  };
}

describe("accountExportSchema (AC2)", () => {
  it("a complete bundle parses", () => {
    const bundle = buildValidBundle();
    expect(accountExportSchema.parse(bundle)).toEqual(bundle);
  });

  it("an unknown schemaVersion is rejected", () => {
    const bundle = { ...buildValidBundle(), schemaVersion: 2 };
    expect(accountExportSchema.safeParse(bundle).success).toBe(false);
  });

  it("a missing required section is rejected", () => {
    const bundle: Record<string, unknown> = buildValidBundle();
    delete bundle.pets;
    expect(accountExportSchema.safeParse(bundle).success).toBe(false);
  });

  it("an extra top-level key is rejected (.strict())", () => {
    const bundle = { ...buildValidBundle(), extraTopLevelKey: "should not be here" };
    expect(accountExportSchema.safeParse(bundle).success).toBe(false);
  });

  it("null-able sections accept null", () => {
    const bundle = { ...buildValidBundle(), notificationPrefs: null, subscription: null };
    expect(accountExportSchema.parse(bundle).notificationPrefs).toBeNull();
    expect(accountExportSchema.parse(bundle).subscription).toBeNull();
  });

  it("rejects an expoPushToken-shaped extra key on a device entry", () => {
    const bundle = buildValidBundle();
    (bundle.devices as Array<Record<string, unknown>>)[0]!.expoPushToken = "ExponentPushToken[xxx]";
    expect(accountExportSchema.safeParse(bundle).success).toBe(false);
  });

  it("rejects a rawEventJson-shaped extra key on the subscription", () => {
    const bundle = buildValidBundle();
    (bundle.subscription as Record<string, unknown>).rawEventJson = { foo: "bar" };
    expect(accountExportSchema.safeParse(bundle).success).toBe(false);
  });
});
