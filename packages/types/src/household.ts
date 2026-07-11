import { z } from "zod";

export const ROLES = ["OWNER", "MEMBER"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/** Response body for `POST /v1/households/invites`. */
export const createInviteResponseSchema = z.object({
  code: z.string(),
  deepLink: z.string(),
  expiresAt: z.iso.datetime(),
});
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;

/** Request body for `POST /v1/households/invites/accept`. */
export const acceptInviteInputSchema = z.object({
  code: z.string(),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteInputSchema>;

/** Response body for `POST /v1/households/invites/accept`. */
export const acceptInviteResponseSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string(),
});
export type AcceptInviteResponse = z.infer<typeof acceptInviteResponseSchema>;

export const householdMemberSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: roleSchema,
});
export type HouseholdMember = z.infer<typeof householdMemberSchema>;

/** Response body for `GET /v1/households/me`. */
export const householdMeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  members: z.array(householdMemberSchema),
});
export type HouseholdMe = z.infer<typeof householdMeSchema>;
