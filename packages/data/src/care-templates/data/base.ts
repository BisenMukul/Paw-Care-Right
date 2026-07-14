import type { Species } from "@pawcareright/types";

import { VET_CONFIRM_SENTENCE, type CareTemplateItemInput, type LifeStage } from "../schema";

/**
 * Region-agnostic base care schedule (Decision R1). Sources consulted
 * (names only — no copied prose, no URLs; mirrors T035 R9): WSAVA
 * vaccination guidelines, AAHA canine vaccination and life-stage
 * guidelines, AAHA/AAFP feline vaccination and life-stage guidelines,
 * ESCCAP European parasite control guidelines, TROCCAP tropical
 * companion-animal parasite guidelines. Every item below is written in
 * our own words, qualitative and category-level only — no dosing amounts,
 * no brand/product names (Decision R5 / CLAUDE.md §7). Region-varying
 * vaccines (rabies +/- leptospirosis) live in `./vaccine-overlays`, not
 * here.
 */

export const BASE_SCHEDULES: Record<Species, Record<LifeStage, CareTemplateItemInput[]>> = {
  DOG: {
    PUPPY_KITTEN: [
      {
        id: "core-vaccine-series",
        category: "vaccine",
        title: "Core puppy vaccination series (DHPP)",
        note:
          "Puppies typically receive a series of core vaccine doses spaced a few weeks apart, starting at around six weeks old, to build reliable protection against distemper, canine hepatitis, parvovirus, and parainfluenza. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=WEEKLY;INTERVAL=3;COUNT=3",
        anchor: "PET_AGE",
        startOffsetDays: 42,
      },
      {
        id: "deworming-juvenile",
        category: "deworming",
        title: "Juvenile deworming course",
        note:
          "Puppies commonly follow a more frequent early deworming schedule than adult dogs, since intestinal parasites pass easily from a mother to her litter. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6",
        anchor: "PET_AGE",
        startOffsetDays: 14,
      },
      {
        id: "flea-tick-preventive",
        category: "flea-tick",
        title: "Flea and tick preventive treatment",
        note:
          "A monthly preventive routine is a common starting point for puppies, though how often it's truly needed can vary with your local climate, season, and lifestyle. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "dental-check",
        category: "dental",
        title: "Dental health check",
        note:
          "A yearly look at teeth and gums, alongside daily home care, helps young dogs start off with healthy dental habits. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=YEARLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "grooming-routine",
        category: "grooming",
        title: "Routine grooming and coat/nail check",
        note:
          "A regular grooming routine, including a coat and nail check, helps you get your puppy comfortable with handling and spot skin issues or overgrown nails early. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
    ],
    ADULT: [
      {
        id: "core-vaccine-booster",
        category: "vaccine",
        title: "Core vaccine booster (DHPP)",
        note:
          "Adult dogs typically need periodic core vaccine boosters to maintain protection; some clinics use a yearly schedule and others a longer interval depending on the vaccine type and local guidance. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=YEARLY;INTERVAL=3",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "deworming-routine",
        category: "deworming",
        title: "Routine deworming",
        note:
          "Adult dogs commonly follow a periodic deworming routine every few months, though household risk factors, such as raw feeding, hunting, or frequent dog-park visits, can change how often is right. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY;INTERVAL=3",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "flea-tick-preventive",
        category: "flea-tick",
        title: "Flea and tick preventive treatment",
        note:
          "A monthly preventive routine is a common approach for adult dogs, though how often it's truly needed can vary with your local climate, season, and lifestyle. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "dental-check",
        category: "dental",
        title: "Dental health check",
        note:
          "A yearly dental check helps catch tartar buildup, gum disease, and other dental problems before they become painful. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=YEARLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "grooming-routine",
        category: "grooming",
        title: "Routine grooming and coat/nail check",
        note:
          "A regular grooming routine, including a coat and nail check, helps you spot skin issues, lumps, or overgrown nails early. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
    ],
    SENIOR: [
      {
        id: "core-vaccine-booster",
        category: "vaccine",
        title: "Core vaccine booster (DHPP)",
        note:
          "Senior dogs typically continue periodic core vaccine boosters; your vet may also weigh overall health and any ongoing conditions when timing them. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=YEARLY;INTERVAL=3",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "deworming-routine",
        category: "deworming",
        title: "Routine deworming",
        note:
          "Senior dogs commonly continue a periodic deworming routine every few months, though your vet may adjust the schedule based on your dog's health and lifestyle. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY;INTERVAL=3",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "flea-tick-preventive",
        category: "flea-tick",
        title: "Flea and tick preventive treatment",
        note:
          "A monthly preventive routine remains a common approach for senior dogs, though how often it's truly needed can vary with your local climate, season, and lifestyle. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "dental-check",
        category: "dental",
        title: "Dental health check",
        note:
          "Older dogs often benefit from more frequent dental attention than a single yearly check, since dental disease tends to progress with age. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=YEARLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "grooming-routine",
        category: "grooming",
        title: "Routine grooming and coat/nail check",
        note:
          "A regular grooming routine, including a coat, nail, and skin check, becomes especially useful in senior dogs for catching new lumps, bumps, or mobility changes early. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
    ],
  },
  CAT: {
    PUPPY_KITTEN: [
      {
        id: "core-vaccine-series",
        category: "vaccine",
        title: "Core kitten vaccination series (FVRCP)",
        note:
          "Kittens typically receive a series of core vaccine doses spaced a few weeks apart, starting at around six weeks old, to build reliable protection against feline viral rhinotracheitis, calicivirus, and panleukopenia. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=WEEKLY;INTERVAL=3;COUNT=3",
        anchor: "PET_AGE",
        startOffsetDays: 42,
      },
      {
        id: "deworming-juvenile",
        category: "deworming",
        title: "Juvenile deworming course",
        note:
          "Kittens commonly follow a more frequent early deworming schedule than adult cats, since intestinal parasites pass easily from a mother to her litter. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=6",
        anchor: "PET_AGE",
        startOffsetDays: 14,
      },
      {
        id: "flea-tick-preventive",
        category: "flea-tick",
        title: "Flea and tick preventive treatment",
        note:
          "A monthly preventive routine is a common starting point for kittens, though how often it's truly needed can vary with your local climate, season, and whether your cat goes outdoors. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "dental-check",
        category: "dental",
        title: "Dental health check",
        note:
          "A yearly look at teeth and gums helps young cats start off with healthy dental habits. " + VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=YEARLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "grooming-routine",
        category: "grooming",
        title: "Routine grooming and coat/nail check",
        note:
          "A regular grooming routine, including a coat and nail check, helps you get your kitten comfortable with handling and spot skin issues or overgrown nails early. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
    ],
    ADULT: [
      {
        id: "core-vaccine-booster",
        category: "vaccine",
        title: "Core vaccine booster (FVRCP)",
        note:
          "Adult cats typically need periodic core vaccine boosters to maintain protection; some clinics use a yearly schedule and others a longer interval depending on the vaccine type, lifestyle, and local guidance. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=YEARLY;INTERVAL=3",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "deworming-routine",
        category: "deworming",
        title: "Routine deworming",
        note:
          "Adult cats commonly follow a periodic deworming routine every few months, though whether your cat goes outdoors or hunts can change how often is right. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY;INTERVAL=3",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "flea-tick-preventive",
        category: "flea-tick",
        title: "Flea and tick preventive treatment",
        note:
          "A monthly preventive routine is a common approach for adult cats, though how often it's truly needed can vary with your local climate, season, and whether your cat goes outdoors. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "dental-check",
        category: "dental",
        title: "Dental health check",
        note:
          "A yearly dental check helps catch tartar buildup, gum disease, and other dental problems before they become painful. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=YEARLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "grooming-routine",
        category: "grooming",
        title: "Routine grooming and coat/nail check",
        note:
          "A regular grooming routine, including a coat and nail check, helps you spot skin issues, lumps, or overgrown nails early, especially in longer-haired cats. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
    ],
    SENIOR: [
      {
        id: "core-vaccine-booster",
        category: "vaccine",
        title: "Core vaccine booster (FVRCP)",
        note:
          "Senior cats typically continue periodic core vaccine boosters; your vet may also weigh overall health and any ongoing conditions when timing them. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=YEARLY;INTERVAL=3",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "deworming-routine",
        category: "deworming",
        title: "Routine deworming",
        note:
          "Senior cats commonly continue a periodic deworming routine every few months, though your vet may adjust the schedule based on your cat's health and lifestyle. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY;INTERVAL=3",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "flea-tick-preventive",
        category: "flea-tick",
        title: "Flea and tick preventive treatment",
        note:
          "A monthly preventive routine remains a common approach for senior cats, though how often it's truly needed can vary with your local climate, season, and whether your cat goes outdoors. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "dental-check",
        category: "dental",
        title: "Dental health check",
        note:
          "Older cats often benefit from more frequent dental attention than a single yearly check, since dental disease tends to progress with age. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=YEARLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
      {
        id: "grooming-routine",
        category: "grooming",
        title: "Routine grooming and coat/nail check",
        note:
          "A regular grooming routine, including a coat, nail, and skin check, becomes especially useful in senior cats for catching new lumps, bumps, or mobility changes early. " +
          VET_CONFIRM_SENTENCE,
        rrule: "RRULE:FREQ=MONTHLY",
        anchor: "PLAN_START",
        startOffsetDays: 0,
      },
    ],
  },
};
