import { PrismaClient } from "@prisma/client";

/**
 * Introspective assertions that the T041 migration applied with the
 * intended enum + indexes + constraint shape (CI runs this against a fresh,
 * empty postgres via the existing jest `global-setup.ts` `migrate deploy`).
 * No row inserts — this only reads `pg_enum`/`pg_indexes`/
 * `information_schema`, so no FK-chain fixture setup is needed.
 */
describe("SymptomCheck / TriageResult schema (e2e)", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("has a CheckStatus enum with exactly the 4 documented labels", async () => {
    const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'CheckStatus'
      ORDER BY e.enumsortorder
    `;

    expect(rows.map((row) => row.enumlabel)).toEqual(["QUEUED", "RUNNING", "DONE", "FALLBACK"]);
  });

  it("has the SymptomCheck(petId, createdAt DESC) index", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'SymptomCheck'
    `;

    const petIdCreatedAtIndex = rows.find((row) => row.indexname === "SymptomCheck_petId_createdAt_idx");
    expect(petIdCreatedAtIndex).toBeDefined();
    expect(petIdCreatedAtIndex?.indexdef).toContain("petId");
    expect(petIdCreatedAtIndex?.indexdef).toContain("createdAt");
    expect(petIdCreatedAtIndex?.indexdef).toContain("DESC");
  });

  it("has an index on SymptomCheck(createdById)", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'SymptomCheck'
    `;

    const createdByIdIndex = rows.some(
      (row) => row.indexname === "SymptomCheck_createdById_idx" && row.indexdef.includes("createdById"),
    );
    expect(createdByIdIndex).toBe(true);
  });

  it("has a UNIQUE index on SymptomCheck(createdById, idempotencyKey)", async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'SymptomCheck'
    `;

    const uniqueIndex = rows.find(
      (row) => row.indexname === "SymptomCheck_createdById_idempotencyKey_key",
    );
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex?.indexdef).toContain("UNIQUE");
    expect(uniqueIndex?.indexdef).toContain("createdById");
    expect(uniqueIndex?.indexdef).toContain("idempotencyKey");
  });

  it("has the TriageResult primary key on checkId", async () => {
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'TriageResult' AND tc.constraint_type = 'PRIMARY KEY'
    `;

    expect(rows.map((row) => row.column_name)).toEqual(["checkId"]);
  });
});
