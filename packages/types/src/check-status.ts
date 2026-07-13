import { z } from "zod";

/**
 * CheckStatus — the SymptomCheck lifecycle vocabulary (T041).
 *
 * This is the single cross-package source of the status values (CLAUDE §6:
 * enums live in packages/types). `apps/api/prisma/schema.prisma` mirrors
 * this exact order as `enum CheckStatus`; the server-side transition helper
 * in `apps/api/src/checks/check-status.ts` enforces the legal-edge contract
 * (QUEUED -> RUNNING -> DONE|FALLBACK only) and lives outside this package
 * because transition logic is a server concern, not a shared data shape.
 */

export const CHECK_STATUSES = ["QUEUED", "RUNNING", "DONE", "FALLBACK"] as const;
export const checkStatusSchema = z.enum(CHECK_STATUSES);
export type CheckStatus = z.infer<typeof checkStatusSchema>;
