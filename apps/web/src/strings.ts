// Centralized user-facing copy for apps/web (CLAUDE.md §6).
// The product display name is never hardcoded here — it is injected at
// render time from the shared `APP_DISPLAY_NAME` constant.
export const strings = {
  layout: {
    description:
      "Peace of mind between vet visits — AI-powered guidance, reminders, and a health timeline for your dog or cat.",
  },
  landing: {
    tagline: "Your pocket vet + pet life manager.",
    body: "Symptom guidance, food and toxin safety answers, care reminders, and a shared health timeline for your whole family — all in one place.",
    cta: "Coming soon",
  },
  privacy: {
    title: "Privacy Policy",
    body: "This is a placeholder privacy policy page. Full legal copy will be published before launch.",
  },
  terms: {
    title: "Terms of Service",
    body: "This is a placeholder terms of service page. Full legal copy will be published before launch.",
  },
} as const;
