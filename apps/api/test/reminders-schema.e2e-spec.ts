import { PrismaClient } from "@prisma/client";

import { REMINDER_EVENT_STATUSES } from "@pawcareright/types";

/**
 * Introspective assertions that the T053 `add_reminders` migration applied
 * with the intended enum + indexes + FK shape (mirrors
 * `checks-schema.e2e-spec.ts`; CI runs this against a fresh, empty postgres
 * via `global-setup.ts`'s `migrate deploy`). No row inserts — this only
 * reads `pg_enum`/`pg_indexes`/`information_schema`, so no FK-chain fixture
 * setup is needed.
 *
 * The enum-label assertion imports `REMINDER_EVENT_STATUSES` from
 * `@pawcareright/types` (rather than re-hardcoding the array) so this test
 * also proves Prisma-enum/shared-types parity (T053 fidelity point 5) — if
 * either side drifts, this fails.
 */
describe("Reminder / ReminderEvent schema (e2e)", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("has a ReminderEventStatus enum matching REMINDER_EVENT_STATUSES exactly, in order", async () => {
    const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'ReminderEventStatus'
      ORDER BY e.enumsortorder
    `;

    expect(rows.map((row) => row.enumlabel)).toEqual([...REMINDER_EVENT_STATUSES]);
  });

  it("has the ReminderEvent(dueAt, status) composite index", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ReminderEvent'
    `;

    const dueAtStatusIndex = rows.find((row) => row.indexname === "ReminderEvent_dueAt_status_idx");
    expect(dueAtStatusIndex).toBeDefined();
    expect(dueAtStatusIndex?.indexdef).toContain("dueAt");
    expect(dueAtStatusIndex?.indexdef).toContain("status");
  });

  it("has a UNIQUE index on ReminderEvent(reminderId, dueAt)", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ReminderEvent'
    `;

    const uniqueIndex = rows.find((row) => row.indexname === "ReminderEvent_reminderId_dueAt_key");
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.indexdef).toContain("UNIQUE");
    expect(uniqueIndex?.indexdef).toContain("reminderId");
    expect(uniqueIndex?.indexdef).toContain("dueAt");
  });

  it("has an index on ReminderEvent(reminderId)", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ReminderEvent'
    `;

    const reminderIdIndex = rows.some(
      (row) => row.indexname === "ReminderEvent_reminderId_idx" && row.indexdef.includes("reminderId"),
    );
    expect(reminderIdIndex).toBe(true);
  });

  it("has an index on Reminder(petId)", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Reminder'
    `;

    const petIdIndex = rows.some(
      (row) => row.indexname === "Reminder_petId_idx" && row.indexdef.includes("petId"),
    );
    expect(petIdIndex).toBe(true);
  });

  it("has ON DELETE CASCADE on both Reminder.petId and ReminderEvent.reminderId foreign keys", async () => {
    const rows = await prisma.$queryRaw<Array<{ constraint_name: string; delete_rule: string }>>`
      SELECT tc.constraint_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
      WHERE tc.table_name IN ('Reminder', 'ReminderEvent') AND tc.constraint_type = 'FOREIGN KEY'
    `;

    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.delete_rule).toBe("CASCADE");
    }
  });

  it("has the Reminder primary key on id", async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'Reminder' AND tc.constraint_type = 'PRIMARY KEY'
    `;

    expect(rows.map((row) => row.column_name)).toEqual(["id"]);
  });

  it("has the ReminderEvent primary key on id", async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'ReminderEvent' AND tc.constraint_type = 'PRIMARY KEY'
    `;

    expect(rows.map((row) => row.column_name)).toEqual(["id"]);
  });
});
