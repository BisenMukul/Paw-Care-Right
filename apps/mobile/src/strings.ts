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
  type ActivityType,
  type ActivityUnit,
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
  ACTIVITY: "Activity",
};

// Founder-directed tap-first activity log (design-system §5): plain
// record-keeping nouns only, no "diagnosis"/interpretive language anywhere
// below (CLAUDE §7).
const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  FOOD: "Food",
  WATER: "Water",
  POTTY: "Potty",
  SLEEP: "Sleep",
  WALK: "Walk",
  PLAY: "Play",
  GROOMING: "Grooming",
};

const ACTIVITY_SUMMARY_VERB: Record<ActivityType, string> = {
  FOOD: "Fed",
  WATER: "Watered",
  POTTY: "Potty",
  SLEEP: "Slept",
  WALK: "Walked",
  PLAY: "Played",
  GROOMING: "Groomed",
};

const ACTIVITY_UNIT_LABELS: Record<ActivityUnit, string> = {
  meals: "meals",
  grams: "g",
  bowls: "bowls",
  ml: "ml",
  pee: "pee",
  poop: "poop",
  both: "pee & poop",
  min: "min",
  brush: "Brush",
  bath: "Bath",
  nails: "Nails",
  teeth: "Teeth",
  ears: "Ears",
};

const ACTIVITY_UNIT_LABELS_SINGULAR: Partial<Record<ActivityUnit, string>> = {
  meals: "meal",
  bowls: "bowl",
};

export const strings = {
  tabs: {
    home: "Home",
    care: "Care",
    timeline: "Timeline",
    settings: "Settings",
  },
  // Home tab (founder UI overhaul): greeting/quick-actions/today-preview/
  // empty-state copy only -- labels and record-keeping nouns, no
  // "diagnosis"/dosing language anywhere below (CLAUDE §7).
  home: {
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    settingsA11y: "Settings",
    quickActionsTitle: "Quick actions",
    quickActions: {
      symptomCheck: "Symptom check",
    },
    todayTitle: "Today",
    todayEmpty: "Nothing due today.",
    todayError: "We couldn't load today's agenda.",
    todayRetry: "Retry",
    todayOffline: "You're offline. Reconnect to see today's agenda.",
    todayOfflineBanner: "You're offline — showing your last saved agenda.",
    seeAll: "See all",
    welcomeTitle: "Let's get started",
    welcomeBody: "Peace of mind between vet visits — your pet's care, all in one place.",
  },
  // Care Score card (FIDELITY-1 plan): a routine-completeness RECORD, never
  // a health/wellbeing verdict -- the §7 vocabulary test
  // (`fidelity1-strings-tone.test.ts`) scans every string below (CLAUDE §7).
  careScore: {
    label: "Care score",
    explainer: (petName: string) => `How complete ${petName}'s care routine is`,
    bucketOnTrack: "Records up to date",
    bucketSomeToLog: "A few things to log",
    bucketCatchUp: "A few things to catch up on",
    bucketInsufficient: "Start logging to build a record",
    scorePlaceholder: "—",
    a11yRing: (petName: string) => `Care score for ${petName}`,
    // FIDELITY-2 plan §D: the deep-green hero's CTA -- record-only,
    // imperative, no health claim (routes to the existing /check entry).
    runCheckCta: "Run a check",
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
    emptyBody: "Once you log weight, notes, or visits, they'll appear here as a running history.",
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
    title: "Settings",
    body: "Account and household settings will live here.",
    family: "Family",
    notifications: "Notifications",
    premium: (appName: string) => `Upgrade to ${appName} Plus`,
    manage: "Manage subscription",
    services: "Services",
    familyManagedNote: "Your Premium comes from your household's family plan. Only the plan owner can manage billing.",
    restore: "Restore purchases",
    restoreSuccess: "Your purchases were restored.",
    restoreNone: "No active purchases were found to restore.",
    restoreError: "We couldn't restore your purchases. Please try again.",
    billingIssue: {
      body: "There's a billing issue with your subscription. Update your payment method to keep Premium.",
      fix: "Update payment method",
      dismiss: "Dismiss",
    },
    analyticsLabel: "Share anonymous usage data",
    analyticsHint: "Helps us improve the app. Never includes your pet's symptoms, photos, or health details.",
    signOut: "Sign out",
    signOutHint: "You can sign back in with your email any time.",
  },
  auth: {
    welcome: {
      tagline: "Peace of mind between vet visits — sign in to get started.",
      continueWithEmail: "Continue with email",
    },
    email: {
      title: "What's your email?",
      subtitle: "We'll send you a 6-digit code to sign in.",
      label: "Email address",
      placeholder: "you@example.com",
      invalidEmail: "Enter a valid email address.",
      submit: "Send code",
      genericError: "Something went wrong. Please try again.",
    },
    otp: {
      title: "Check your email",
      prompt: "Enter the 6-digit code we sent you.",
      resend: "Resend code",
      verifying: "Verifying...",
      wrongCode: "That code didn't work. Please try again.",
      genericError: "Something went wrong. Please try again.",
      cellLabel: (index: number) => `Code digit ${index + 1}`,
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
      neuteredA11y: "Neutered or spayed",
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
      previewA11y: "Your pet's photo",
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
    // Founder UI pass: friendlier copy split by cause (new keys) — the
    // generic `error` string above is kept as-is for the fallback/unknown
    // case (a non-network API error). Neither adds urgency/diagnosis
    // language (CLAUDE §7).
    serverUnreachable: "We can't reach our servers right now. Please try again in a moment.",
    offlineNoCache: "You're offline. Reconnect to load this pet's profile.",
    empty: "This pet couldn't be found.",
    done: "Done",
    somethingWrong: "Something wrong?",
    somethingWrongSubtitle: "Get guidance on symptoms",
    quickActionsTitle: "Quick actions",
    logWeight: "Log weight",
    logActivity: "Log activity",
    logVetVisit: "Vet visit",
    reminders: "Reminders",
    retry: "Retry",
    offlineBanner: "You're offline — showing your last saved info.",
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
    savedConfirmation: "Weight saved.",
    savedNudge: "It's on the chart.",
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
    savedConfirmation: "Note saved.",
    savedNudge: "It's on the timeline.",
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
    savedConfirmation: "Visit saved.",
    savedNudge: "It's on the timeline.",
  },
  // Founder-directed tap-first activity log (design-system §5): "click-click
  // buttons, less writing" -- plain record-keeping copy only, no
  // "diagnosis"/interpretive language, no medication/dose fields anywhere
  // below (CLAUDE §7).
  activity: {
    title: "Log activity",
    loading: "Loading…",
    error: "We couldn't load this pet.",
    empty: "This pet couldn't be found.",
    retry: "Retry",
    offline: "You're offline. Reconnect to log an activity.",
    offlineBanner: "You're offline — showing your last saved info.",
    typeLabel: ACTIVITY_TYPE_LABELS,
    summaryVerb: ACTIVITY_SUMMARY_VERB,
    unitLabel: ACTIVITY_UNIT_LABELS,
    unitLabelSingular: ACTIVITY_UNIT_LABELS_SINGULAR,
    typeChipA11y: (label: string) => `Log ${label}`,
    quantityDecreaseA11y: "Decrease amount",
    quantityIncreaseA11y: "Increase amount",
    unitToggleA11y: (label: string) => `Switch unit to ${label}`,
    notePlaceholder: "Add a short note (optional)",
    save: "Save",
    cancel: "Cancel",
    writtenNoteLink: "Add a written note instead",
    recentsTitle: "Recents",
    recentChipA11y: (label: string) => `Log again: ${label}`,
    loggedConfirmation: (label: string) => `Logged: ${label}`,
    undo: "Undo",
    undoneConfirmation: "Undone",
    savedNudge: "It's on the timeline.",
    // Today intake strip (FIDELITY-1 plan): a plain log summary, no total/
    // goal/kcal (plan R5) -- the §7 vocabulary test scans every string below.
    today: {
      title: "Today",
      meals: (n: number) => `${n} ${n === 1 ? "meal" : "meals"}`,
      water: (n: number) => `${n} water`,
      walks: (n: number) => `${n} ${n === 1 ? "walk" : "walks"}`,
      potty: (n: number) => `${n} potty`,
      empty: "Nothing logged yet today.",
    },
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
      emptyBody: "Past checks stay here, so you can look back or bring them to your vet.",
      error: "We couldn't load your check history.",
      retry: "Retry",
      loadMore: "Load more",
      loadingMore: "Loading more…",
      inProgress: "In progress",
      offlineBanner: "You're offline — showing your saved checks.",
      dateA11y: (date: string) => `Checked on ${date}`,
    },
  },
  upsell: {
    // Global 402 upsell sheet copy (T075 plan decision 7) — generic, no
    // health/medical/dosing/"diagnos*" tokens (CLAUDE.md §7).
    title: "Upgrade to Premium",
    body: "This is a premium feature. Upgrade to unlock it for your whole family.",
    seePlans: "See plans",
    dismiss: "Not now",
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
  updateGate: {
    // Launch-time "please update" screen (T079 plan). Factual copy only --
    // no medical/"diagnos*"/dosing tokens (CLAUDE.md §7). The display name
    // is injected from `APP_DISPLAY_NAME` at render, never hardcoded.
    title: (appName: string) => `Update ${appName}`,
    body: "A newer version is required to keep using the app. Please update from the store to continue.",
    cta: "Update now",
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
    leave: "Leave household",
    leaveConfirmBody: "Leaving will move you into your own new household, separate from this one.",
    leaveGrace: "You'll lose access to this household's Premium plan as soon as you leave.",
    leaveConfirm: "Leave household",
    leaveCancel: "Cancel",
    leaveError: "We couldn't process this. Please try again.",
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
    emptyBody: "When suggestions are ready, you'll be able to add them to your reminders here.",
  },
  intake: {
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    back: "Back",
    next: "Next",
    skip: "Skip",
    maxSelectionsHint: (n: number) => `Choose up to ${n}`,
    quickPick: {
      title: "What are you noticing?",
      hint: "Tap anything you've seen — pick as many as apply. This step is optional.",
      addDetail: "Add more detail",
    },
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
    emptyBody: "Reminders you add will show up here so nothing slips by.",
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
  // Services hub (PAWSAATHI-4 plan, decisions 1-3; upgraded by PREVIEW-1):
  // `items`/`comingSoon`/`cardA11y`/`note` stay the informational base copy
  // (insurance keeps this exact "coming soon" framing). `preview`/
  // `cardA11yPreview` are PREVIEW-1's additions for the four cards that now
  // route into a tap-through, PREVIEW-labeled flow (`servicesPreview` below)
  // -- still no "notify me"/waitlist capture, no price or launch-date copy
  // anywhere below (HONESTY RULE + CLAUDE §7).
  services: {
    title: "Services",
    subtitle: "Extra ways to care for your pet",
    comingSoon: "Coming soon",
    preview: "Preview",
    note: "These features aren't available yet.",
    items: {
      vet: { title: "Vet consultation", description: "Book a vet by video, at a clinic, or at home." },
      salon: { title: "Pet salon", description: "Grooming, bath and spa for your pet." },
      store: { title: "Pet store", description: "Food, treats and everyday essentials." },
      adoption: { title: "Adoption", description: "Find a pet looking for a home." },
      insurance: { title: "Pet insurance", description: "Health cover for accidents and illness." },
    },
    cardA11y: (title: string) => `${title}, coming soon`,
    cardA11yPreview: (title: string) => `${title}, preview`,
  },
  // PREVIEW-1 plan: the tap-through, PREVIEW-labeled service flows (vet
  // booking, salon, store, adoption, insurance) reached from the services
  // hub above. Every string below is enumerated VERBATIM in the plan
  // (tone-scan surface) -- static local-fixture copy only, no numeric
  // prices/currency, no "notify"/waitlist capture, and the honesty-critical
  // vocabulary boundary: "book/booking" (feature nouns) are fine, but the
  // shared terminal (`end`) never uses a success lexeme (confirmed/booked/
  // purchased/approved) -- it always frames itself as a preview, never a
  // real transaction (CLAUDE §7 + this plan's HONESTY ARCHITECTURE).
  servicesPreview: {
    banner: {
      label: "Preview",
      text: "A sneak peek of what's coming. Nothing here is a real booking, order, or application.",
      a11y: "Preview mode. Nothing on this screen is a real service.",
    },
    book: {
      title: "Book a service",
      subtitle: "See how booking will work",
      vetTitle: "Vet consultation",
      vetDesc: "Video call, clinic visit, or home visit.",
      salonTitle: "Pet salon",
      salonDesc: "Grooming, bath, and spa.",
      emergencyNote: "In a real emergency, this preview can't reach a vet. Use Symptom Check for urgent help.",
      emergencyCta: "Open Symptom Check",
    },
    vets: {
      title: "Vet consultation",
      subtitle: "Sample vets — preview only",
      perConsult: "per consult",
      sampleTag: "Sample",
      book: "Preview booking",
      ratingA11y: (n: number) => `Rated ${n} out of 5`,
    },
    salons: {
      title: "Pet salon",
      subtitle: "Sample salons — preview only",
      sampleTag: "Sample",
    },
    slots: {
      title: "Pick a slot",
      selectDay: "Select day",
      availableTimes: "Sample times",
      cta: "Preview this booking",
      sampleTag: "Sample",
      summaryA11y: "Sample service, preview only",
    },
    store: {
      title: "Pet store",
      subtitle: "Sample products — preview only",
      sampleTag: "Sample",
      addA11y: (name: string) => `Preview ${name}`,
    },
    adopt: {
      title: "Adopt",
      subtitle: "Sample listings — preview only",
      speciesAll: "All",
      speciesDog: "Dogs",
      speciesCat: "Cats",
      empty: "No sample pets match these filters.",
      vaccinated: "Vaccinated",
      listedBy: "Listed by",
      aboutTitle: (name: string) => `About ${name}`,
      apply: (name: string) => `Preview adoption for ${name}`,
    },
    insurance: {
      title: "Pet insurance",
      heroTitle: "Cover the unexpected",
      heroBody: "Accident and illness cover, cashless vet visits, and wellness add-ons.",
      comingSoon: "Coming soon",
      benefit1: "Cashless visits at partner clinics",
      benefit2: "Covers accidents, surgery, and illness",
      benefit3: "Flexible wellness add-ons",
      note: "This isn't available yet. There's nothing to sign up for.",
    },
    end: {
      title: "This is a preview",
      body: (service: string) => `${service} isn't available yet — this was just a preview. Nothing here is real.`,
      adoptAsk: "When adoption launches, you'll be asked for:",
      adoptFields: [
        "Your name and contact",
        "Where you live and your home type",
        "Other pets in your home",
        "Your experience caring for pets",
      ],
      done: "Back to services",
      browseMore: "Back to adoption",
      serviceVet: "Vet booking",
      serviceSalon: "Salon booking",
      serviceStore: "The pet store",
      serviceAdopt: "Adoption",
    },
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
