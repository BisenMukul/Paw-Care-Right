/**
 * Single source of truth for the account-export BullMQ queue name, job name,
 * and payload shape (T091 plan step 22). Mirrors `ai-audit-retention
 * .contract.ts`'s style. No logic here.
 */
export const ACCOUNT_EXPORT_QUEUE = "pawcareright-account-export";

export const ACCOUNT_EXPORT_JOB_NAME = "account-export-build";

export interface AccountExportJobData {
  exportId: string;
  userId: string;
}
