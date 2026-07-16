import {
  MEDICATION_ADD_TIME_LABEL,
  MEDICATION_AGENDA_DOSE_LABEL,
  MEDICATION_COURSE_LENGTH_LABEL,
  MEDICATION_DISCLAIMER,
  MEDICATION_DOSE_LABEL,
  MEDICATION_DOSE_PLACEHOLDER,
  MEDICATION_DOSE_TIMES_LABEL,
  MEDICATION_FORM_HEADING,
  MEDICATION_NAME_LABEL,
  MEDICATION_NAME_PLACEHOLDER,
  MEDICATION_SAVE_LABEL,
  type HealthLogKind,
  type ReminderType,
} from "@pawcareright/types";

import type { ScheduleFrequency } from "./reminders/schedule-builder";

// Centralized user-facing copy for apps/mobile (CLAUDE.md §6).
// The product display name is never hardcoded here — it is injected at
// render time from the shared `APP_DISPLAY_NAME` constant.

// Care-scheduling labels only (T058 plan Safety statement) -- no medical
// advice, no diagnosis language.
const NOTIFICATION_TYPE_LABELS: Record<ReminderType, string> = {
  VACCINE: "Vaccines",
  PARASITE: "Parasite prevention",
  MEDICATION: "Medications",
  GROOMING: "Grooming",
  DENTAL: "Dental care",
  VET_VISIT: "Vet visits",
  CUSTOM: "Custom reminders",
};

/** `Reminder.type` is an open String vocabulary (T060 plan/`reminder.ts` header) -- an unrecognized value falls back to itself rather than throwing. */
function agendaTypeLabel(type: string): string {
  return type in NOTIFICATION_TYPE_LABELS ? NOTIFICATION_TYPE_LABELS[type as ReminderType] : type;
}

const SCHEDULE_FREQ_LABELS: Record<ScheduleFrequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

// T067 timeline: plain record-keeping nouns only -- no "diagnosis"/
// interpretive language anywhere below (CLAUDE §7).
const TIMELINE_KIND_LABELS: Record<HealthLogKind, string> = {
  WEIGHT: "Weight",
  MEAL: "Meal",
  NOTE: "Note",
  VET_VISIT: "Vet visit",
  MED_GIVEN: "Medication",
  CHECK_REF: "Symptom check",
};

export const strings = {
  tabs: {
    home: "Home",
    care: "Care",
    timeline: "Timeline",
    settings: "Settings",
  },
  home: {
    body: "Peace of mind between vet visits — your pet's care, all in one place.",
    openActivePet: "Open pet home",
  },
  switcher: {
    heading: "Your pets",
    switchA11y: "Switch active pet",
  },
  care: {
    body: "Care reminders and templates will live here.",
    setupCta: "Set up a care plan",
    noPet: "Add a pet to set up a care plan.",
  },
  // T067 timeline tab: entries render recorded facts verbatim (date, kind,
  // note/reason/weight); MED_GIVEN shows the name/dose exactly as entered
  // (or the neutral fallback below) -- CLAUDE §7 rule 2, no dose is ever
  // computed or suggested here.
  timeline: {
    title: "Timeline",
    loading: "Loading…",
    error: "We couldn't load this pet's timeline.",
    retry: "Retry",
    offline: "You're offline. Reconnect to load the timeline.",
    offlineBanner: "You're offline — showing your last saved timeline.",
    empty: "No timeline entries yet.",
    noPet: "Add a pet to see their timeline.",
    filterAll: "All",
    kindLabel: TIMELINE_KIND_LABELS,
    medGivenFallback: "Medication given",
    dateA11y: (date: string) => `Entry on ${date}`,
    vetSummary: "Prepare vet summary",
    vetSummaryError: "We couldn't prepare the summary. Please try again.",
    photoThumbA11y: (index: number, count: number, kindLabel: string, date: string) =>
      `Photo ${index} of ${count} for ${kindLabel} on ${date}`,
    photoViewerPageA11y: (index: number, count: number) => `Photo ${index} of ${count}`,
    photoViewerClose: "Close photo viewer",
  },
  settings: {
    body: "Account and household settings will live here.",
    family: "Family",
    notifications: "Notifications",
    premium: (appName: string) => `Upgrade to ${appName} Plus`,
  },
  auth: {
    welcome: {
      tagline: "Peace of mind between vet visits — sign in to get started.",
      continueWithEmail: "Continue with email",
    },
    email: {
      label: "Email address",
      placeholder: "you@example.com",
      invalidEmail: "Enter a valid email address.",
      submit: "Send code",
      genericError: "Something went wrong. Please try again.",
    },
    otp: {
      prompt: "Enter the 6-digit code we sent you.",
      resend: "Resend code",
      verifying: "Verifying...",
      wrongCode: "That code didn't work. Please try again.",
      genericError: "Something went wrong. Please try again.",
    },
    done: {
      title: "You're all set",
      body: "Your account is ready.",
      continue: "Continue",
    },
    pushRationale: {
      title: "Stay on top of care",
      body: "Turn on notifications so we can remind you about vaccines, meds, and other care reminders.",
      enable: "Enable notifications",
      skip: "Not now",
    },
    social: {
      apple: "Continue with Apple",
      google: "Continue with Google",
      genericError: "Something went wrong. Please try again.",
    },
  },
  addPet: {
    homeCta: "Add a pet",
    common: {
      back: "Back",
      next: "Next",
      skip: "Skip",
      startOver: "Start over",
      stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    },
    species: {
      title: "What kind of pet is this?",
      dog: "Dog",
      cat: "Cat",
    },
    breed: {
      title: "What breed?",
      searchPlaceholder: "Search breeds",
      skip: "Skip — I don't know",
      loading: "Searching breeds…",
      error: "We couldn't load breeds right now.",
      empty: "No matching breeds.",
    },
    details: {
      title: "Tell us about them",
      nameLabel: "Name",
      namePlaceholder: "Your pet's name",
      nameRequired: "Name is required.",
      sexLabel: "Sex",
      male: "Male",
      female: "Female",
      unknown: "Unknown",
      neuteredLabel: "Neutered / spayed",
      birthDateLabel: "Birth date (YYYY-MM-DD)",
      birthDatePlaceholder: "2022-05-01",
      ageEstimateLabel: "Estimated age (months)",
      weightLabel: "Weight (grams)",
      xorError: "Enter either a birth date or an estimated age, not both.",
    },
    photo: {
      title: "Add a photo",
      rationale: "Add a photo so you can recognize your pet at a glance. This is optional.",
      choosePhoto: "Choose photo",
      permissionError: "We couldn't access your photos. You can skip this step.",
      finish: "Finish",
    },
    done: {
      submitting: "Adding your pet…",
      createError: "We couldn't add your pet. Please try again.",
      retry: "Retry",
    },
  },
  petHome: {
    loading: "Loading…",
    error: "We couldn't load this pet.",
    empty: "This pet couldn't be found.",
    done: "Done",
    somethingWrong: "Something wrong?",
    logWeight: "Log weight",
    logNote: "Log note",
    logVetVisit: "Vet visit",
    reminders: "Reminders",
    retry: "Retry",
    offlineBanner: "You're offline — showing your last saved info.",
    offline: "You're offline. Reconnect to load this pet.",
    age: { yr: "yr", mo: "mo", approx: "~", unknown: "Age unknown" },
  },
  // T065 weight chart: the typical-range band caption is strictly factual
  // reference information (CLAUDE §7 / plan Safety statement) -- no
  // "overweight"/"underweight"/interpretive copy anywhere below.
  weight: {
    title: "Weight",
    loading: "Loading…",
    error: "We couldn't load this pet's weight history.",
    empty: "No weight entries yet — add one to start the chart.",
    retry: "Retry",
    offline: "You're offline. Reconnect to load weight history.",
    offlineBanner: "You're offline — showing your last saved weight history.",
    addWeight: "Add weight",
    unitToggleA11y: "Switch weight unit",
    save: "Save",
    cancel: "Cancel",
    inputPlaceholder: "Enter weight",
    errorEmpty: "Enter a weight.",
    errorInvalid: "Enter a valid number.",
    errorRange: "Enter a weight within a realistic range.",
    typicalRange: (breed: string) => `Typical adult range for ${breed}`,
    unitLabel: { kg: "kg", lb: "lb" },
  },
  // T066 quick-log actions: plain record-keeping copy only -- no
  // "diagnosis"/interpretive language, no medication/dose fields or copy
  // anywhere below (CLAUDE §7).
  note: {
    title: "Add note",
    loading: "Loading…",
    error: "We couldn't load this pet.",
    empty: "This pet couldn't be found.",
    retry: "Retry",
    offline: "You're offline. Reconnect to add a note.",
    offlineBanner: "You're offline — showing your last saved info.",
    inputPlaceholder: "What happened?",
    save: "Save",
    errorEmpty: "Enter a note.",
    errorTooLong: "That note is too long.",
  },
  vetVisit: {
    title: "Vet visit",
    loading: "Loading…",
    error: "We couldn't load this pet.",
    empty: "This pet couldn't be found.",
    retry: "Retry",
    offline: "You're offline. Reconnect to log a vet visit.",
    offlineBanner: "You're offline — showing your last saved info.",
    reasonPlaceholder: "Reason for visit",
    clinicPlaceholder: "Clinic name (optional)",
    notesPlaceholder: "Notes (optional)",
    save: "Save",
    errorReasonEmpty: "Enter a reason.",
    errorTooLong: "That entry is too long.",
  },
  healthLogPhoto: {
    rationale: "Add photos to this entry. Optional.",
    takePhoto: "Take photo",
    chooseLibrary: "Choose from library",
    uploading: (pct: number) => `Uploading ${pct}%`,
    failed: "Upload failed",
    retry: "Retry",
    remove: "Remove",
    limitHint: (n: number) => `Up to ${n} photos.`,
    permissionError: "We couldn't access your photos.",
  },
  comingSoon: {
    title: "Coming soon",
    body: "This part of the app isn't ready yet. Check back soon.",
  },
  check: {
    title: "What's going on?",
    subtitle: "Pick what you've noticed and we'll ask a few quick questions.",
    recentTitle: "Recent checks",
    recentEmpty: "Your recent checks will show up here.",
    recentSeeAll: "See all",
    offlineBanner: "You're offline — you can still start a check.",
    waiting: {
      title: "Looking into it…",
      body: "We're reviewing what you shared. This usually takes a few moments.",
      cancel: "Cancel",
    },
    submit: {
      submitting: "Sending your answers…",
      offlineBlocked: "You're offline. Reconnect to send this check.",
      offlineRetry: "Retry",
      quotaTitle: "You've used your free checks",
      quotaBody:
        "You've reached this month's free symptom checks. You can still reach a vet anytime.",
      quotaUpgrade: "See plans",
      error: "We couldn't send this right now. Please try again.",
      errorRetry: "Retry",
    },
    result: {
      disclaimer: (appName: string) =>
        `${appName} offers general pet-care guidance, not veterinary care or treatment. Always consult a licensed veterinarian.`,
      tierLabel: {
        EMERGENCY_NOW: "Emergency — see a vet now",
        VET_24H: "See a vet within 24 hours",
        VET_SOON: "See a vet soon",
        MONITOR: "Monitor closely at home",
        REASSURE: "Likely not urgent",
      },
      sections: {
        possibleCauses: "What this could be",
        redFlagsToWatch: "When to get help fast",
        homeCare: "Caring for them at home",
        doNot: "What not to do",
        vetQuestions: "Questions to ask your vet",
      },
      fallbackNotice:
        "We couldn't fully assess this from what you shared. When in doubt, it's safest to have a vet take a look.",
      emergencyNoticeTitle: "This may be an emergency",
      emergencyNoticeBody: "Based on what you shared, your pet may need urgent care right away.",
      emergencyNoticeCta: "See emergency steps",
      findVet: "Find a vet nearby",
      share: "Share as text",
      done: "Done",
      loading: "Loading your result…",
      error: "We couldn't load this result.",
      errorHint: "If you're worried about your pet, contact a vet.",
      retry: "Retry",
    },
    emergency: {
      goNowBadge: "Emergency",
      detectedHeading: "What we noticed",
      guidanceHeading: "What to do now",
      hotlineHeading: "Pet poison helpline",
      callHotline: "Call the poison helpline",
      hotlineFallback:
        "We don't have a pet poison helpline listed for your area. If poisoning is possible, contact your nearest emergency vet right away.",
      findVet: "Find an emergency vet",
      acknowledge: "I understand — continue",
    },
    history: {
      title: "Check history",
      empty: "No checks yet. When you run a symptom check, it'll show up here.",
      error: "We couldn't load your check history.",
      retry: "Retry",
      loadMore: "Load more",
      loadingMore: "Loading more…",
      inProgress: "In progress",
      offlineBanner: "You're offline — showing your saved checks.",
      dateA11y: (date: string) => `Checked on ${date}`,
    },
  },
  paywall: {
    // A/B copy variants (T074 plan decision 5): the server only ever sends
    // the variant ID, never prose (§7 review + i18n-ready). NO health/
    // medical claims, no "diagnos*"/drug/dose tokens in either variant.
    variants: {
      A: {
        headline: (appName: string) => `Get more from ${appName}`,
        subcopy:
          "Unlock unlimited symptom checks, faster answers, and sharing across your whole family.",
      },
      B: {
        headline: (appName: string) => `${appName} Plus`,
        subcopy:
          "Go further with unlimited symptom checks, priority guidance, and a plan the whole family can share.",
      },
    },
    planNames: {
      monthly: "Monthly",
      annual: "Annual",
      family: "Family",
    },
    familyExplainer: "Share one subscription across everyone who cares for your pets.",
    annualBadge: "Best value",
    trialCta: "7-day free trial",
    trialCtaWithPrice: (price: string) => `Start your 7-day free trial — then ${price}`,
    subscribeCta: (price: string) => `Subscribe — ${price}`,
    restore: "Restore purchases",
    restoreNone: "We couldn't find any previous purchases.",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    maybeLater: "Maybe later",
    unavailable: "Plans aren't available right now. Please try again later.",
    pending: "Your purchase is pending approval — we'll unlock your plan as soon as it's confirmed.",
    error: "Something went wrong. Please try again.",
    success: "You're all set!",
  },
  family: {
    title: "Family",
    loading: "Loading…",
    error: "We couldn't load your household.",
    empty: "We couldn't find your household.",
    retry: "Retry",
    owner: "Owner",
    member: "Member",
    invite: "Invite someone",
    inviteError: "We couldn't create an invite. Please try again.",
  },
  join: {
    title: "Join this household?",
    body: "Accepting will move you into this household and leave your current one.",
    accept: "Join household",
    invalidError: "This invite link is invalid or has expired.",
    petsPresentError:
      "You have pets in your current household. Remove or rehome them before joining another household.",
  },
  notifications: {
    title: "Notifications",
    loading: "Loading…",
    error: "We couldn't load your notification settings.",
    empty: "We couldn't find your notification settings.",
    retry: "Retry",
    offlineBanner: "You're offline — showing your last saved settings.",
    offline: "You're offline. Reconnect to change notification settings.",
    typesHeading: "Care reminder types",
    typeLabel: (type: ReminderType): string => NOTIFICATION_TYPE_LABELS[type],
    quietHours: {
      heading: "Quiet hours",
      enable: "Enable quiet hours",
      body: "We'll hold care reminders during this window and deliver them right after it ends.",
      start: "Start",
      end: "End",
    },
    save: "Save",
    saveError: "We couldn't save your changes. Please try again.",
  },
  carePlan: {
    title: "Set up a care plan",
    subtitle:
      "We've put together a suggested schedule based on your pet's age, species, and region. Review it and adjust anything you like before adding it to your reminders.",
    loading: "Loading…",
    error: "We couldn't load your care plan suggestions.",
    retry: "Retry",
    empty: "No suggestions are available for this pet yet.",
    offline: "You're offline. Reconnect to load care plan suggestions.",
    offlineBanner: "You're offline — showing your last saved suggestions.",
    // The item note itself is rendered verbatim from the resolved
    // care-template data, not from a string here (CLAUDE §7 / plan Safety
    // statement) -- these are labels around it.
    emphasisBadge: "Especially recommended in your region",
    alreadyAddedBadge: "Already added",
    dateEdit: {
      earlier1w: "-1w",
      earlier1d: "-1d",
      later1d: "+1d",
      later1w: "+1w",
    },
    confirm: "Confirm plan",
    skip: "Not now",
    confirmError: "We couldn't save your care plan. Please try again.",
  },
  intake: {
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    back: "Back",
    next: "Next",
    skip: "Skip",
    maxSelectionsHint: (n: number) => `Choose up to ${n}`,
    freeText: {
      title: "Anything else you'd like to add?",
      placeholder: "Add any other details in your own words.",
      optional: "This step is optional.",
    },
    photoStub: "You'll be able to add photos in the next step.",
    photo: {
      title: "Add a photo",
      rationale: "A photo can help us understand what's going on. This step is optional.",
      takePhoto: "Take photo",
      chooseLibrary: "Choose from library",
      permissionError: "We couldn't access your camera or photos. You can skip this step.",
      limitHint: (n: number) => `You can add up to ${n} photos.`,
      retry: "Retry",
      remove: "Remove",
      uploading: (percent: number) => `Uploading ${percent}%`,
      failed: "This photo didn't upload.",
      unavailable: "Photos aren't available right now. You can skip this step.",
    },
    review: { title: "Review your answers", edit: "Edit" },
    submit: "Continue",
    validationError: "Some answers need attention before continuing.",
    invalidCategory: "We couldn't find that category. Go back and pick again.",
    offlineBanner: "You're offline — you can still fill this in.",
  },
  agenda: {
    title: "Care agenda",
    today: "Today",
    upcoming: "Upcoming",
    empty: "No care reminders in this window yet.",
    loading: "Loading…",
    error: "We couldn't load your care agenda.",
    retry: "Retry",
    offline: "You're offline. Reconnect to load your care agenda.",
    offlineBanner: "You're offline — showing your last saved agenda.",
    filterAll: "All",
    markDone: "Mark done",
    snooze: "Snooze",
    newReminder: "+ New reminder",
    carePlanLink: "Set up a care plan",
    statusDone: "Done",
    statusSnoozed: "Snoozed",
    completeError: "We couldn't save that. Please try again.",
    snoozeError: "We couldn't snooze that. Please try again.",
    typeLabel: (type: string): string => agendaTypeLabel(type),
    // T061: the dose-as-entered label shown on a MEDICATION agenda row --
    // sourced from the same `MEDICATION_STATIC_COPY` SSOT the detector spec
    // scans, so the tested string is byte-identical to the rendered one.
    medDoseLabel: MEDICATION_AGENDA_DOSE_LABEL,
  },
  reminderForm: {
    createTitle: "New reminder",
    editTitle: "Edit reminder",
    typeHeading: "Type",
    titleLabel: "Title",
    titlePlaceholder: "e.g. Rabies booster",
    scheduleHeading: "Schedule",
    freqLabel: (freq: ScheduleFrequency): string => SCHEDULE_FREQ_LABELS[freq],
    intervalLabel: "Every",
    weekdaysLabel: "On these days",
    monthDayLabel: "Day of month",
    startDateLabel: "Start date",
    timeLabel: "Time",
    save: "Save",
    saveError: "We couldn't save this reminder. Please try again.",
    loading: "Loading…",
    error: "We couldn't load this reminder.",
    retry: "Retry",
  },
  // T061 medication tracker: every value below comes from the
  // `MEDICATION_STATIC_COPY` SSOT (`@pawcareright/types`) -- CLAUDE §7 rule
  // 2, the med tracker RECORDS what a vet prescribed, it never suggests. Do
  // not hardcode medication copy here; add to the SSOT instead so the T038
  // detector lint test keeps scanning the exact rendered string.
  medForm: {
    heading: MEDICATION_FORM_HEADING,
    nameLabel: MEDICATION_NAME_LABEL,
    namePlaceholder: MEDICATION_NAME_PLACEHOLDER,
    doseLabel: MEDICATION_DOSE_LABEL,
    dosePlaceholder: MEDICATION_DOSE_PLACEHOLDER,
    doseTimesLabel: MEDICATION_DOSE_TIMES_LABEL,
    addTimeLabel: MEDICATION_ADD_TIME_LABEL,
    courseLengthLabel: MEDICATION_COURSE_LENGTH_LABEL,
    disclaimer: MEDICATION_DISCLAIMER,
    save: MEDICATION_SAVE_LABEL,
  },
} as const;
