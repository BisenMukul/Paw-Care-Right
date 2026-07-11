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
    family: "Family",
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
    reminders: "Reminders",
    retry: "Retry",
    offlineBanner: "You're offline — showing your last saved info.",
    offline: "You're offline. Reconnect to load this pet.",
    age: { yr: "yr", mo: "mo", approx: "~", unknown: "Age unknown" },
  },
  comingSoon: {
    title: "Coming soon",
    body: "This part of the app isn't ready yet. Check back soon.",
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
} as const;
