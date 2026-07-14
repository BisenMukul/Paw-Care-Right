import type {
  CareTemplateSuggestions,
  InstantiateFromTemplateInput,
  InstantiateFromTemplateResult,
} from "@pawcareright/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

export const carePlanKeys = {
  suggestions: (petId: string) => ["care-plan", "suggestions", petId] as const,
};

/**
 * GET `/v1/pets/:petId/reminders/template-suggestions?countryCode=` (T059
 * plan): the wizard's reviewable suggestion list. Mirrors
 * `checks-api.ts`'s `URLSearchParams` pattern -- only defined params are
 * included in the query string.
 */
export function useTemplateSuggestions(petId: string, params: { countryCode?: string }) {
  return useQuery({
    queryKey: [...carePlanKeys.suggestions(petId), params.countryCode ?? null],
    queryFn: () => {
      const query = new URLSearchParams();
      if (params.countryCode !== undefined) {
        query.set("countryCode", params.countryCode);
      }
      const qs = query.toString();
      return apiClient.get<CareTemplateSuggestions>(
        `/v1/pets/${petId}/reminders/template-suggestions${qs.length > 0 ? `?${qs}` : ""}`,
      );
    },
    enabled: petId.length > 0,
  });
}

/** POST `/v1/pets/:petId/reminders/from-template` (T059 plan decision 2). */
export function useInstantiateTemplate(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InstantiateFromTemplateInput) =>
      apiClient.post<InstantiateFromTemplateResult>(`/v1/pets/${petId}/reminders/from-template`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: carePlanKeys.suggestions(petId) });
    },
  });
}
