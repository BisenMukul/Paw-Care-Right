// Centralized user-facing copy for apps/web (CLAUDE.md §6).
// The product display name is never hardcoded here — it is injected at
// render time from the shared `APP_DISPLAY_NAME` constant.
export const strings = {
  disclaimer: (appName: string) =>
    `${appName} offers general pet-care guidance, not veterinary care or treatment. Always consult a licensed veterinarian.`,
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
  foodPage: {
    verdictLabel: {
      safe: "Usually fine",
      caution: "Use caution",
      toxic: "Not safe",
      emergency: "Emergency",
    },
    verdictHeadline: {
      safe: (plural: "dogs" | "cats") => `Usually not a concern for ${plural}`,
      caution: (plural: "dogs" | "cats") => `Not recommended for ${plural}`,
      toxic: (plural: "dogs" | "cats") => `Not safe for ${plural}`,
      emergency: (plural: "dogs" | "cats") => `Dangerous for ${plural} — treat this as an emergency`,
    },
    whatToDo: {
      safe: "If your pet ate a large amount, or seems unwell afterwards, contact your vet.",
      caution:
        "Contact your vet for advice — especially if your pet ate a large amount or seems unwell.",
      toxic:
        "Contact your vet or a pet poison helpline straight away, even if your pet seems fine. Do not wait for symptoms, do not try to treat this at home, and do not try to make your pet vomit unless a vet tells you to.",
      emergency:
        "Contact your nearest emergency vet or a pet poison helpline right now. Do not wait for symptoms, do not try to treat this at home, and do not try to make your pet vomit unless a vet tells you to.",
    },
    noteHeading: "What to know",
    quantityHeading: "Does the amount matter?",
    faqHeading: "Common questions",
    faq: {
      q1: (plural: "dogs" | "cats", item: string) => `Can ${plural} eat ${item}?`,
      q2: (plural: "dogs" | "cats", item: string) => `Does the amount of ${item} matter for ${plural}?`,
      q3: (singular: "dog" | "cat", item: string) => `What should I do if my ${singular} ate ${item}?`,
    },
    emergency: {
      heading: "If your pet has eaten this, act now",
      body: "Contact your nearest emergency vet. If you cannot reach one, these pet poison helplines can advise:",
      feePrefix: "Note: ",
      fallback: "If your region is not listed, contact your nearest emergency vet clinic right away.",
    },
    // R4 (orchestrator decision): always-on, non-alarmist informational
    // hotline section rendered on every page — reuses the same
    // REGION_HOTLINES-driven component as `emergency`, with calmer copy.
    hotlineInfo: {
      heading: "If your pet ate this and seems unwell",
      body: "Contact your vet, or one of these pet poison helplines can advise:",
    },
    crossLinks: {
      otherSpecies: "Same question, other pet",
      related: "Related items",
    },
    otherSpeciesLabel: (Plural: "Dogs" | "Cats", item: string) => `${Plural}: can they eat ${item}?`,
    appCta: {
      heading: "Check any food in seconds",
      body: (appName: string) =>
        `${appName} gives species-specific food and toxin answers, care reminders, and a shared health timeline for your whole family.`,
      badge: "Coming soon on iOS and Android",
    },
  },
} as const;
