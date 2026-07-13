import { isApiError, useIsOffline } from "@pawcareright/api-client";
import type { CompletedIntake } from "@pawcareright/types";
import * as Crypto from "expo-crypto";
import { useCallback, useRef, useState } from "react";

import { useCreateCheck } from "../api/checks-api";
import { extractPhotoKeys } from "./intake";

export type CheckSubmissionState = "idle" | "submitting" | "offline" | "quota" | "error";

export interface UseCheckSubmissionArgs {
  petId: string | undefined;
  onEmergency: (checkId: string) => void;
  onPolling: (checkId: string) => void;
}

export interface UseCheckSubmission {
  state: CheckSubmissionState;
  submit: (intake: CompletedIntake) => void;
  retry: () => void;
}

/**
 * Submit -> branch orchestration hook (T047 plan "Hook & helper specs").
 * Offline guard blocks the mutation entirely (no network call, D-safety);
 * a successful `201` branches on `redFlag` (§7 rule 4: red-flag bypasses
 * polling); `402` maps to the quota state; any other error is a plain,
 * non-fabricating retry affordance (§7 rule 5).
 */
export function useCheckSubmission({ petId, onEmergency, onPolling }: UseCheckSubmissionArgs): UseCheckSubmission {
  const [state, setState] = useState<CheckSubmissionState>("idle");
  const isOffline = useIsOffline();
  const createCheck = useCreateCheck(petId ?? "");

  // D5 — one UUID per submission attempt, reused across retries of the same
  // attempt (offline-block / error), regenerated for a brand-new submission
  // (cleared only after a successful branch navigation).
  const idempotencyKeyRef = useRef<string | null>(null);
  const pendingIntakeRef = useRef<CompletedIntake | null>(null);

  const submit = useCallback(
    (intake: CompletedIntake) => {
      pendingIntakeRef.current = intake;

      if (petId === undefined) {
        setState("error");
        return;
      }

      if (isOffline) {
        // No mutate — offline submit is blocked, not attempted-then-failed.
        setState("offline");
        return;
      }

      if (idempotencyKeyRef.current === null) {
        idempotencyKeyRef.current = Crypto.randomUUID();
      }
      const idempotencyKey = idempotencyKeyRef.current;

      setState("submitting");

      void createCheck
        .mutateAsync({ intake, photoKeys: extractPhotoKeys(intake), idempotencyKey })
        .then((check) => {
          idempotencyKeyRef.current = null;
          if (check.redFlag !== undefined) {
            onEmergency(check.id);
          } else {
            onPolling(check.id);
          }
        })
        .catch((err: unknown) => {
          if (isApiError(err) && err.code === "PAYMENT_REQUIRED") {
            setState("quota");
          } else {
            setState("error");
          }
        });
    },
    [petId, isOffline, createCheck, onEmergency, onPolling],
  );

  const retry = useCallback(() => {
    if (pendingIntakeRef.current !== null) {
      submit(pendingIntakeRef.current);
    }
  }, [submit]);

  return { state, submit, retry };
}
