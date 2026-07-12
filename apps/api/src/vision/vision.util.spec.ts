import type { CompletedIntake } from "@pawcareright/types";

import { collectPhotoKeys } from "./vision.util";

describe("collectPhotoKeys", () => {
  it("collects photoKeys across photoPrompt answers in intake order", () => {
    const intake: CompletedIntake = {
      category: "skin-itch",
      answers: [
        { questionId: "onset", type: "duration", value: 3, unit: "days" },
        { questionId: "photo-a", type: "photoPrompt", photoKeys: ["a", "b"] },
        { questionId: "signs", type: "multi", values: ["redness"] },
        { questionId: "photo-b", type: "photoPrompt", photoKeys: ["c"] },
      ],
    };

    expect(collectPhotoKeys(intake)).toEqual(["a", "b", "c"]);
  });

  it("returns [] when no photoPrompt answers", () => {
    const intake: CompletedIntake = {
      category: "vomiting",
      answers: [{ questionId: "onset", type: "duration", value: 2, unit: "hours" }],
    };

    expect(collectPhotoKeys(intake)).toEqual([]);
  });
});
