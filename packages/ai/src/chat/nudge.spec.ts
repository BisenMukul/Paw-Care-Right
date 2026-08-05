import { detectSymptomNudge, NUDGE_CATEGORY_PRIORITY } from "./nudge";

describe("detectSymptomNudge — symptom fixtures map to their category", () => {
  it.each([
    ["breathing", "My dog is having trouble breathing tonight."],
    ["breathing", "She can't breathe properly and is wheezing."],
    ["urinary", "He can't pee at all today."],
    ["urinary", "There's blood in urine this morning."],
    ["injury", "My cat was hit by a car an hour ago."],
    ["injury", "He has an open wound on his leg."],
    ["vomiting", "My dog has been vomiting since last night."],
    ["vomiting", "She keeps throwing up her food."],
    ["diarrhea", "My puppy has diarrhea since this morning."],
    ["diarrhea", "He has loose stool for two days."],
    ["not-eating", "My cat is not eating anything today."],
    ["not-eating", "He won't eat his usual food."],
    ["limping", "My dog is limping on his front leg."],
    ["limping", "She is favoring a leg since the walk."],
    ["eyes", "His eye is red and watery."],
    ["eyes", "She keeps squinting one eye."],
    ["ears", "He has an ear infection I think."],
    ["ears", "She keeps shaking her head a lot."],
    ["skin-itch", "My dog has itchy skin all over."],
    ["skin-itch", "He has a hot spot on his back."],
    ["behavior", "My cat is acting strange today."],
    ["behavior", "He is hiding all day, not himself."],
  ] as const)("maps %s fixture to its category", (expectedCategory, message) => {
    expect(detectSymptomNudge(message)).toEqual({ category: expectedCategory });
  });
});

describe("detectSymptomNudge — benign questions do not nudge", () => {
  it.each(["Can dogs eat blueberries?", "When is his vaccine due?"])("returns null for %s", (message) => {
    expect(detectSymptomNudge(message)).toBeNull();
  });
});

describe("detectSymptomNudge — priority determinism", () => {
  it("resolves a multi-symptom sentence to the higher-priority category", () => {
    expect(detectSymptomNudge("He's vomiting and also limping badly.")).toEqual({ category: "vomiting" });
  });

  it("prefers breathing over every later category when both match", () => {
    expect(detectSymptomNudge("She is wheezing and also has diarrhea and is not eating.")).toEqual({
      category: "breathing",
    });
  });

  it("covers all 11 real categories in NUDGE_CATEGORY_PRIORITY (never 'other')", () => {
    expect(NUDGE_CATEGORY_PRIORITY).toHaveLength(11);
    expect(NUDGE_CATEGORY_PRIORITY).not.toContain("other");
  });
});

describe("detectSymptomNudge — case/punctuation insensitivity", () => {
  it("matches regardless of case", () => {
    expect(detectSymptomNudge("MY DOG IS VOMITING EVERYWHERE")).toEqual({ category: "vomiting" });
  });

  it("matches with surrounding punctuation", () => {
    expect(detectSymptomNudge("Vomiting!! What should I do??")).toEqual({ category: "vomiting" });
  });
});

describe("detectSymptomNudge — empty input", () => {
  it("returns null for an empty string", () => {
    expect(detectSymptomNudge("")).toBeNull();
  });
});
