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
} as const;
