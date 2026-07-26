// Centralized user-facing copy for apps/web (CLAUDE.md §6).
// The product display name is never hardcoded here — it is injected at
// render time from the shared `APP_DISPLAY_NAME` constant, threaded through
// as an `appName` parameter wherever copy needs to name the product.
import { ACCOUNT_DELETION_GRACE_DAYS, vetDisclaimerLine } from "@pawcareright/types";

import { LEGAL_REVIEW_MARKER } from "./legal/legal-document";

// --- T086: pinned legal placeholder tokens & contact addresses -------------
// H1 (CLAUDE §7 / plan safety statement): never invent a company entity,
// address, registration number or governing jurisdiction. These bracketed
// placeholders are the only sanctioned stand-ins, each rendered inside a
// visible `LEGAL-REVIEW`-marked section so a human reviewer cannot miss them
// at checkpoint C3.
const COMPANY_ENTITY_PLACEHOLDER = "[COMPANY ENTITY — TO CONFIRM AT C3]";
const REGISTERED_ADDRESS_PLACEHOLDER = "[REGISTERED ADDRESS — TO CONFIRM AT C3]";
const JURISDICTION_PLACEHOLDER = "[GOVERNING LAW AND JURISDICTION — TO CONFIRM AT C3]";
const EFFECTIVE_DATE_PLACEHOLDER = "[EFFECTIVE DATE — TO CONFIRM AT LAUNCH]";
const PRIVACY_CONTACT_EMAIL = "privacy@pawcareright.app";
const TERMS_CONTACT_EMAIL = "legal@pawcareright.app";

export const strings = {
  // T097 plan D2: delegates to the `@pawcareright/types` SSOT so this
  // sentence cannot drift from `apps/mobile/src/strings.ts`'s copy. Byte-
  // identical to the pre-T097 literal (see `vet-disclaimer-copy.ts`).
  disclaimer: vetDisclaimerLine,
  layout: {
    description:
      "Peace of mind between vet visits — AI-powered guidance, reminders, and a health timeline for your dog or cat.",
  },
  landing: {
    hero: {
      tagline: "Peace of mind between vet visits.",
      body: (appName: string) =>
        `${appName} gives you calm, plain-language guidance when something seems wrong with your dog or cat, food and toxin answers in seconds, care reminders that never slip, and one shared health timeline for the whole family.`,
    },
    emergencyNote:
      "If something is seriously wrong right now, do not wait for an app — contact your vet or your nearest emergency veterinary clinic.",
    howItWorksHeading: "How it works",
    steps: [
      {
        id: "add-your-pet",
        heading: "1. Add your pet",
        body: "Species, breed, age and weight take about a minute. Everything else is optional.",
      },
      {
        id: "ask-anything",
        heading: "2. Ask what is going on",
        body: "Answer a few structured questions, add photos if you have them, and get guidance on how urgent it looks, what to watch for, and what to ask your vet.",
      },
      {
        id: "stay-on-track",
        heading: "3. Stay on track",
        body: "Vaccine, parasite and medication reminders, a shared health timeline, and a vet-visit summary you can hand over at the clinic.",
      },
    ],
    pricing: {
      heading: "Planned pricing",
      notice:
        "These are our planned launch prices in US dollars. Nothing is on sale yet — subscriptions open when the app launches, and prices differ by country.",
      trialNote: "Every plan starts with a 7-day free trial.",
      freeTierNote:
        "There is always a free tier: one pet, one symptom check, five food and toxin lookups a day, and basic reminders.",
      plans: [
        {
          id: "monthly" as const,
          name: "Monthly",
          price: "$5.99",
          cadence: "per month",
          note: "Cancel anytime from the app store.",
          highlighted: false,
        },
        {
          id: "annual" as const,
          name: "Annual",
          price: "$39.99",
          cadence: "per year",
          note: "Around 44% less than monthly.",
          highlighted: true,
        },
        {
          id: "family" as const,
          name: "Family",
          price: "$59.99",
          cadence: "per year",
          note: "Household sharing: unlimited members and pets.",
          highlighted: false,
        },
      ],
    },
    faqHeading: "Frequently asked questions",
    faq: [
      {
        question: "Is this a replacement for a vet?",
        answer:
          "No. It gives general guidance and tells you when something looks urgent enough to contact a vet. It never examines, treats or prescribes, and it always fails towards seeing a vet when the picture is unclear.",
      },
      {
        question: "What happens in an emergency?",
        answer:
          "Known emergency patterns are matched by fixed safety rules before any AI runs. When one matches, the app shows emergency guidance first, with local emergency and pet poison helpline numbers.",
      },
      {
        question: "Will it tell me what medicine to give?",
        answer:
          "Never. It does not give dosages or recommend medicines. The medication tracker only records what your vet has already prescribed, exactly as you enter it.",
      },
      {
        question: "Which pets does it support?",
        answer: "Dogs and cats at launch.",
      },
      {
        question: "Can my family use it too?",
        answer:
          "Yes. A household can share pets, reminders and the health timeline, so everyone sees the same information.",
      },
      {
        question: "What happens to my pet's health data?",
        answer:
          "It is treated as sensitive information. We do not sell it. Our privacy policy explains what we collect, how long we keep it, and how to ask for deletion.",
      },
    ],
    getTheApp: {
      heading: "Get the app",
      body: (appName: string) => `${appName} is coming to iOS and Android.`,
      badges: ["Coming soon on iOS", "Coming soon on Android"],
      openInApp: "Already have the app? Open it",
      notInstalledNote: "That link only works if the app is already installed on this device.",
    },
    popularAnswers: {
      heading: "Popular food and toxin answers",
    },
  },
  legal: {
    shared: {
      reviewNotice: (topicLabel: string) =>
        `${LEGAL_REVIEW_MARKER} — ${topicLabel}: this section is template text and must be reviewed and completed by a qualified lawyer before launch (checkpoint C3).`,
      companyEntityPlaceholder: COMPANY_ENTITY_PLACEHOLDER,
      registeredAddressPlaceholder: REGISTERED_ADDRESS_PLACEHOLDER,
      jurisdictionPlaceholder: JURISDICTION_PLACEHOLDER,
      effectiveDatePlaceholder: EFFECTIVE_DATE_PLACEHOLDER,
      privacyContactEmail: PRIVACY_CONTACT_EMAIL,
      termsContactEmail: TERMS_CONTACT_EMAIL,
    },
    privacy: {
      title: "Privacy Policy",
      intro: [
        (appName: string) =>
          `This policy describes how ${appName} collects, uses, shares and protects your information, and your pet's information, when you use the service.`,
      ],
      whoWeAre: {
        heading: "Who we are",
        paragraphs: [
          (appName: string) =>
            `${appName} is provided by ${COMPANY_ENTITY_PLACEHOLDER}, registered at ${REGISTERED_ADDRESS_PLACEHOLDER}. This privacy policy explains what personal information we collect from you and your household when you use ${appName}, why we collect it, how long we keep it, and the rights you have over it. This document was last reviewed as a template on ${EFFECTIVE_DATE_PLACEHOLDER} and will be completed by a qualified lawyer before launch.`,
        ],
      },
      whatWeCollect: {
        heading: "What we collect",
        paragraphs: [
          (appName: string) =>
            `When you create an account and use ${appName}, we collect account details such as your name, email address and household membership, along with information about your pets, including species, breed, age and weight. We also collect the content you choose to add, such as photos, notes and reminders, and technical information such as device type, app version and crash reports that help us keep the service reliable.`,
        ],
      },
      petHealthData: {
        heading: "Pet health data",
        paragraphs: [
          (appName: string) =>
            `Symptom descriptions, photos of your pet, and health-log entries are sensitive information. We process this data specifically to produce the general guidance, reminders and health timeline that ${appName} provides, and we give it extra protection: it is used only to serve you and your household, it is never sold, and it is never used to build advertising profiles.`,
        ],
      },
      aiGuidance: {
        heading: "How AI guidance is generated",
        paragraphs: [
          (appName: string) =>
            `To generate guidance, the text you enter and any photos you attach are sent to third-party AI providers for processing. The guidance returned is general information only, is not veterinary care, and is described throughout ${appName} as guidance rather than a determination of what is wrong with your pet. Photo EXIF metadata, including embedded location data, is stripped from your images before upload, so it is never sent to us or to our AI providers.`,
        ],
      },
      howWeUse: {
        heading: "How we use information",
        paragraphs: [
          (appName: string) =>
            `We use the information described above to operate ${appName}'s core features: symptom guidance, food and toxin lookups, care reminders, the shared health timeline, household sharing and customer support, and to maintain, secure and improve the service. We do not use your pet's health data to train shared AI models on other users' behalf.`,
        ],
      },
      sharingAndProcessors: {
        heading: "Sharing and service providers",
        paragraphs: [
          (appName: string) =>
            `We share information with a limited set of service-provider categories that help us run ${appName}, each acting under contract on our instructions: AI providers to generate guidance, analytics providers to understand product usage, error-reporting providers to identify and fix crashes, subscription and payment providers to handle billing, push-notification providers to deliver reminders, and object-storage providers to host photos you upload. We do not sell personal information to advertisers or data brokers.`,
        ],
      },
      retention: {
        heading: "How long we keep information",
        paragraphs: [
          () =>
            `We keep your account and pet data for as long as your account is active, so your health timeline and reminders stay useful over time. You can delete your account yourself at any time in Settings — doing so schedules erasure of your account, your pets, your symptom checks, your health timeline, your reminders and your chat history after a ${ACCOUNT_DELETION_GRACE_DAYS}-day grace window, and signing back in during that window cancels the deletion. If you are the only person in your household, the whole household is erased with it; if you share it, the household and its shared data stay with the other members. Beyond that, we retain limited records only where we must, to meet legal, security or billing obligations. You can also reach us at ${PRIVACY_CONTACT_EMAIL} to ask us to delete your data, including situations our in-app flow does not cover, such as a shared household you own.`,
        ],
      },
      householdSharing: {
        heading: "Household sharing",
        paragraphs: [
          (appName: string) =>
            `${appName} lets a household share pets, care reminders and health-timeline entries with the people you invite. Every member of a household can see the shared pets' information, including health entries added by other members, so only invite people you are comfortable sharing that information with.`,
        ],
      },
      yourChoices: {
        heading: "Your choices",
        paragraphs: [
          (appName: string) =>
            `You can review and update most of your account and pet information directly in ${appName}. In Settings, you can also turn off analytics sharing, request a full export of your data, and delete your account (see "How long we keep information" above for exactly what that does and the grace window). For anything else — including access, correction, or limiting certain uses — contact us using the details in the "Contact us" section below.`,
        ],
      },
      gdpr: {
        heading: "Your rights under GDPR (EEA, EU and UK)",
        paragraphs: [
          () =>
            `If you are in the European Economic Area, the European Union or the United Kingdom, you have rights over your personal data, including the right to access, rectify, erase, restrict or object to our processing of it, and the right to data portability. You also have the right to lodge a complaint with your local supervisory authority. Our legal basis for each type of processing, and details of any EU/UK representative, will be completed here before launch.`,
        ],
      },
      ccpa: {
        heading: "Your rights under CCPA (California)",
        paragraphs: [
          () =>
            `If you are a California resident, you have rights under the California Consumer Privacy Act, including the right to know what personal information we collect, the right to delete it, the right to correct it, and the right to opt out of the sale or sharing of personal information. We do not sell or share personal information for cross-context behavioural advertising.`,
        ],
      },
      internationalTransfers: {
        heading: "International transfers",
        paragraphs: [
          () =>
            `Because our service providers operate internationally, your information may be processed in countries other than the one where you live, including the United States. Where required, we rely on appropriate safeguards, such as standard contractual clauses, to protect information transferred internationally, and the specific safeguards used for each transfer will be confirmed here before launch.`,
        ],
      },
      security: {
        heading: "Security",
        paragraphs: [
          () =>
            `We use industry-standard technical and organisational measures, including encryption in transit, access controls and regular review of our service providers' security practices, to protect your information. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.`,
        ],
      },
      children: {
        heading: "Children",
        paragraphs: [
          (appName: string) =>
            `${appName} is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, contact us so we can delete it.`,
        ],
      },
      changes: {
        heading: "Changes to this policy",
        paragraphs: [
          () =>
            `We may update this privacy policy from time to time. If we make a material change, we will notify you in the app or by email before the change takes effect, and update the effective date above.`,
        ],
      },
      contact: {
        heading: "Contact us",
        paragraphs: [
          () =>
            `If you have questions about this privacy policy, or want to exercise your privacy rights, including requesting deletion of your data, contact us at ${PRIVACY_CONTACT_EMAIL}.`,
        ],
      },
    },
    terms: {
      title: "Terms of Service",
      intro: [
        (appName: string) =>
          `These terms govern your use of ${appName}. By creating an account or using the service, you agree to them.`,
      ],
      acceptance: {
        heading: "Acceptance of these terms",
        paragraphs: [
          (appName: string) =>
            `${appName} is provided by ${COMPANY_ENTITY_PLACEHOLDER}, registered at ${REGISTERED_ADDRESS_PLACEHOLDER}. By creating an account or using ${appName}, you agree to these terms. This document was last reviewed as a template on ${EFFECTIVE_DATE_PLACEHOLDER} and will be completed by a qualified lawyer before launch.`,
        ],
      },
      notVeterinaryCare: {
        heading: "Not veterinary care",
        paragraphs: [
          (appName: string) =>
            `NOT VETERINARY CARE. ${appName} provides general pet-care information and guidance only. It is not veterinary care, treatment or advice, and it is not a substitute for examination by a licensed veterinarian. If your pet is unwell or injured, or you are unsure, contact a licensed veterinarian. If your pet may be in a life-threatening situation, contact your nearest emergency veterinary clinic or a pet poison helpline immediately.`,
        ],
      },
      noMedicationGuidance: {
        heading: "No medication guidance",
        paragraphs: [
          (appName: string) =>
            `${appName} never provides medication dosages and never recommends medicines for animals. The medication tracker only records what a veterinarian has already prescribed, as entered by you. Never give an animal human medication, or any medicine, without instructions from a veterinarian.`,
        ],
      },
      emergencies: {
        heading: "Emergencies",
        paragraphs: [
          (appName: string) =>
            `Known emergency patterns are matched using fixed safety rules before any AI-generated content is shown, and the app displays emergency guidance and local emergency or pet-poison-helpline numbers first. ${appName} cannot call emergency services for you and is not a substitute for contacting one directly in a genuine emergency.`,
        ],
      },
      eligibility: {
        heading: "Eligibility",
        paragraphs: [
          (appName: string) =>
            `You must be at least 18 years old, or the age of majority in your jurisdiction, to create an account. By using ${appName} you confirm that you meet this requirement and that the information you provide is accurate.`,
        ],
      },
      accountsAndHouseholds: {
        heading: "Accounts and households",
        paragraphs: [
          () =>
            `You are responsible for keeping your account credentials secure and for activity that happens under your account. If you create or join a household, every member of that household can see pets, reminders and health-timeline entries shared within it.`,
        ],
      },
      subscriptionsAndBilling: {
        heading: "Subscriptions and billing",
        paragraphs: [
          () =>
            `Paid subscriptions are billed through the relevant app store (the App Store or Google Play), and prices differ by country and region. Every plan starts with a 7-day free trial; unless you cancel before the trial ends, it converts automatically into a paid subscription at the price shown when you subscribed. Cancellations, refunds and billing disputes are handled by the app store you subscribed through, under its own policies.`,
        ],
      },
      acceptableUse: {
        heading: "Acceptable use",
        paragraphs: [
          (appName: string) =>
            `You agree not to use ${appName} to harm animals in any way, including animal fighting, cruelty, do-it-yourself sedation, do-it-yourself surgery, or breeding malpractice, and not to use the service for any unlawful purpose. We may suspend or terminate accounts that violate this section.`,
        ],
      },
      yourContent: {
        heading: "Your content",
        paragraphs: [
          (appName: string) =>
            `You retain ownership of the photos, notes and other content you add to ${appName}. You grant us a limited licence to store, process and display that content as needed to provide the service to you and your household, including sending it to AI providers to generate guidance, as described in our privacy policy.`,
        ],
      },
      thirdPartyServices: {
        heading: "Third-party services",
        paragraphs: [
          (appName: string) =>
            `${appName} depends on third-party AI providers to generate guidance, and on other providers for analytics, error reporting, push notifications and payments. Their availability and performance can affect ${appName}, and their own terms may apply to how they process data on our behalf.`,
        ],
      },
      availabilityAndChanges: {
        heading: "Availability and changes",
        paragraphs: [
          (appName: string) =>
            `We may change, suspend or discontinue features of ${appName}, or these terms, from time to time. We will provide notice of material changes where required, and continued use after a change takes effect means you accept the updated terms.`,
        ],
      },
      disclaimers: {
        heading: "Disclaimers",
        paragraphs: [
          (appName: string) =>
            `${appName} is provided "as is" and "as available". To the fullest extent permitted by law, we disclaim all warranties, express or implied, including fitness for a particular purpose and non-infringement, and we do not warrant that the service will be uninterrupted, error-free, or that any guidance will be accurate for your pet's specific situation.`,
        ],
      },
      limitationOfLiability: {
        heading: "Limitation of liability",
        paragraphs: [
          (appName: string) =>
            `To the fullest extent permitted by law, ${appName} and its operator will not be liable for indirect, incidental, special or consequential damages arising from your use of the service, including any outcome related to your pet's health. Nothing in these terms limits liability that cannot be limited under applicable law.`,
        ],
      },
      indemnity: {
        heading: "Indemnity",
        paragraphs: [
          (appName: string) =>
            `You agree to indemnify and hold harmless ${appName}'s operator from claims arising out of your misuse of the service or your violation of these terms, to the extent permitted by applicable law.`,
        ],
      },
      governingLaw: {
        heading: "Governing law",
        paragraphs: [
          () =>
            `These terms are governed by ${JURISDICTION_PLACEHOLDER}, without regard to conflict-of-law principles, and any disputes will be resolved in the courts or forum specified there once confirmed.`,
        ],
      },
      contact: {
        heading: "Contact us",
        paragraphs: [
          () =>
            `If you have any questions about these terms, or about your subscription, account or household, contact us at ${TERMS_CONTACT_EMAIL} and we will get back to you.`,
        ],
      },
    },
  },
  footer: {
    homeLabel: "Home",
    privacyLabel: "Privacy",
    termsLabel: "Terms",
    notice: (appName: string) =>
      `${appName} provides general guidance only and is not a substitute for veterinary care.`,
  },
  // T089: App Router global error boundary copy (apps/web/app/global-error.tsx).
  // Generic, calm site-error copy only — no §5 surface (no health/AI-result
  // content ever reaches this boundary).
  globalError: {
    heading: "Something went wrong",
    body: "This page ran into an unexpected error. Please try again.",
    retry: "Try again",
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
