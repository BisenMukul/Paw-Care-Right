import { execSync } from "node:child_process";
import path from "node:path";

const DEFAULT_DATABASE_URL =
  "postgresql://pawcareright:pawcareright@localhost:5432/pawcareright?schema=public";

/**
 * Jest globalSetup: applies committed Prisma migrations before the suite
 * runs. `prisma migrate deploy` only applies pending migrations, so this is
 * a no-op locally (already migrated) and a full apply against CI's fresh,
 * empty postgres container.
 */
export default async function globalSetup(): Promise<void> {
  const apiRoot = path.resolve(__dirname, "..");

  // Some task runners (e.g. Turborepo's default strict env mode) do not
  // forward arbitrary shell/CI environment variables into task subprocesses
  // unless declared. Backfilling `process.env.DATABASE_URL` here — before
  // Jest forks its test-file worker processes — ensures every test file's
  // own `PrismaClient` (which reads `DATABASE_URL` directly, with no Zod
  // fallback) can still connect, without requiring changes outside this
  // task's file list.
  process.env.DATABASE_URL ??= DEFAULT_DATABASE_URL;

  execSync("pnpm exec prisma migrate deploy", {
    cwd: apiRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
    },
  });
}
