import {
  careTemplateSuggestionsSchema,
  instantiateFromTemplateInputSchema,
  templateSelectionSchema,
} from "./care-plan";

const VALID_ITEM = {
  templateKey: "rabies-core",
  title: "Rabies vaccination",
  note: "Confirm the right timing and products for your pet with your veterinarian.",
  reminderType: "VACCINE",
  defaultStartAt: "2026-08-01T09:00:00.000Z",
  emphasis: false,
  alreadyExists: false,
};

const VALID_SUGGESTIONS = {
  species: "DOG",
  lifeStage: "PUPPY_KITTEN",
  group: "IN",
  items: [VALID_ITEM],
};

describe("careTemplateSuggestionsSchema", () => {
  it("parses a valid suggestions payload", () => {
    expect(careTemplateSuggestionsSchema.parse(VALID_SUGGESTIONS)).toEqual(VALID_SUGGESTIONS);
  });

  it("rejects an item missing note", () => {
    const { note, ...withoutNote } = VALID_ITEM;
    void note;
    const payload = { ...VALID_SUGGESTIONS, items: [withoutNote] };
    expect(careTemplateSuggestionsSchema.safeParse(payload).success).toBe(false);
  });

  it("accepts defaultStartAt: null (unanchorable item)", () => {
    const payload = { ...VALID_SUGGESTIONS, items: [{ ...VALID_ITEM, defaultStartAt: null }] };
    expect(careTemplateSuggestionsSchema.parse(payload).items[0]?.defaultStartAt).toBeNull();
  });
});

describe("templateSelectionSchema", () => {
  it("accepts a selection with startAt", () => {
    const payload = { templateKey: "rabies-core", startAt: "2026-08-01T09:00:00.000Z" };
    expect(templateSelectionSchema.parse(payload)).toEqual(payload);
  });

  it("accepts a selection without startAt", () => {
    const payload = { templateKey: "rabies-core" };
    expect(templateSelectionSchema.parse(payload)).toEqual(payload);
  });

  it("rejects a selection with an empty templateKey", () => {
    expect(templateSelectionSchema.safeParse({ templateKey: "" }).success).toBe(false);
  });
});

describe("instantiateFromTemplateInputSchema", () => {
  it("accepts input with selections omitted", () => {
    const payload = { timezone: "UTC" };
    expect(instantiateFromTemplateInputSchema.parse(payload)).toEqual(payload);
  });

  it("accepts input with selections present", () => {
    const payload = { timezone: "UTC", selections: [{ templateKey: "rabies-core" }] };
    expect(instantiateFromTemplateInputSchema.parse(payload)).toEqual(payload);
  });
});
