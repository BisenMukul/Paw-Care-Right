// Centralized user-facing copy for apps/mobile (CLAUDE.md §6).
// The product display name is never hardcoded here — it is injected at
// render time from the shared `APP_DISPLAY_NAME` constant.
export const strings = {
  tabs: {
    home: "Home",
    care: "Care",
    timeline: "Timeline",
    settings: "Settings",
  },
  home: {
    body: "Peace of mind between vet visits — your pet's care, all in one place.",
  },
  care: {
    body: "Care reminders and templates will live here.",
  },
  timeline: {
    body: "Your pet's health timeline will live here.",
  },
  settings: {
    body: "Account and household settings will live here.",
  },
} as const;
