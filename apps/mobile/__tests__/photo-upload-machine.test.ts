import {
  collectUploadedKeys,
  createPendingSlot,
  createUploadedSlotFromKey,
  photoUploadReducer,
  type PhotoSlot,
} from "../src/checks/photo-upload-machine";

// Pure reducer unit tests (T046 plan AC2): every legal transition in the
// spec table, every illegal transition asserted as a same-reference no-op,
// plus the two seeding helpers and `collectUploadedKeys`.

describe("photoUploadReducer", () => {
  it("pending --START--> uploading (progress reset, key cleared)", () => {
    const slot = createPendingSlot("s1", "file:///a.jpg");
    const next = photoUploadReducer(slot, { type: "START" });
    expect(next).toEqual({ id: "s1", uri: "file:///a.jpg", status: "uploading", progress: 0, key: undefined });
  });

  it("failed --RETRY--> uploading (progress reset, key cleared)", () => {
    const slot: PhotoSlot = { id: "s1", status: "failed", progress: 0.4 };
    const next = photoUploadReducer(slot, { type: "RETRY" });
    expect(next).toEqual({ id: "s1", status: "uploading", progress: 0, key: undefined });
  });

  it("uploading --PROGRESS(p)--> uploading, progress clamped to [0,1]", () => {
    const slot: PhotoSlot = { id: "s1", status: "uploading", progress: 0 };
    expect(photoUploadReducer(slot, { type: "PROGRESS", progress: 0.5 }).progress).toBe(0.5);
    expect(photoUploadReducer(slot, { type: "PROGRESS", progress: -1 }).progress).toBe(0);
    expect(photoUploadReducer(slot, { type: "PROGRESS", progress: 2 }).progress).toBe(1);
  });

  it("uploading --SUCCEED(key)--> uploaded (progress=1, key set)", () => {
    const slot: PhotoSlot = { id: "s1", status: "uploading", progress: 0.6 };
    const next = photoUploadReducer(slot, { type: "SUCCEED", key: "k1" });
    expect(next).toEqual({ id: "s1", status: "uploaded", progress: 1, key: "k1" });
  });

  it("uploading --FAIL--> failed (progress unchanged)", () => {
    const slot: PhotoSlot = { id: "s1", status: "uploading", progress: 0.6 };
    const next = photoUploadReducer(slot, { type: "FAIL" });
    expect(next).toEqual({ id: "s1", status: "failed", progress: 0.6 });
  });

  it("PROGRESS is a no-op from pending/uploaded/failed", () => {
    const pending = createPendingSlot("s1", "file:///a.jpg");
    const uploaded = createUploadedSlotFromKey("s2", "k1");
    const failed: PhotoSlot = { id: "s3", status: "failed", progress: 0 };

    expect(photoUploadReducer(pending, { type: "PROGRESS", progress: 0.5 })).toBe(pending);
    expect(photoUploadReducer(uploaded, { type: "PROGRESS", progress: 0.5 })).toBe(uploaded);
    expect(photoUploadReducer(failed, { type: "PROGRESS", progress: 0.5 })).toBe(failed);
  });

  it("START is a no-op from uploading/uploaded/failed", () => {
    const uploading: PhotoSlot = { id: "s1", status: "uploading", progress: 0.2 };
    const uploaded = createUploadedSlotFromKey("s2", "k1");
    const failed: PhotoSlot = { id: "s3", status: "failed", progress: 0 };

    expect(photoUploadReducer(uploading, { type: "START" })).toBe(uploading);
    expect(photoUploadReducer(uploaded, { type: "START" })).toBe(uploaded);
    expect(photoUploadReducer(failed, { type: "START" })).toBe(failed);
  });

  it("RETRY is a no-op from pending/uploading/uploaded", () => {
    const pending = createPendingSlot("s1", "file:///a.jpg");
    const uploading: PhotoSlot = { id: "s2", status: "uploading", progress: 0.2 };
    const uploaded = createUploadedSlotFromKey("s3", "k1");

    expect(photoUploadReducer(pending, { type: "RETRY" })).toBe(pending);
    expect(photoUploadReducer(uploading, { type: "RETRY" })).toBe(uploading);
    expect(photoUploadReducer(uploaded, { type: "RETRY" })).toBe(uploaded);
  });

  it("SUCCEED is a no-op from pending/uploaded/failed", () => {
    const pending = createPendingSlot("s1", "file:///a.jpg");
    const uploaded = createUploadedSlotFromKey("s2", "k1");
    const failed: PhotoSlot = { id: "s3", status: "failed", progress: 0 };

    expect(photoUploadReducer(pending, { type: "SUCCEED", key: "k2" })).toBe(pending);
    expect(photoUploadReducer(uploaded, { type: "SUCCEED", key: "k2" })).toBe(uploaded);
    expect(photoUploadReducer(failed, { type: "SUCCEED", key: "k2" })).toBe(failed);
  });

  it("FAIL is a no-op from pending/uploaded/failed", () => {
    const pending = createPendingSlot("s1", "file:///a.jpg");
    const uploaded = createUploadedSlotFromKey("s2", "k1");
    const failed: PhotoSlot = { id: "s3", status: "failed", progress: 0 };

    expect(photoUploadReducer(pending, { type: "FAIL" })).toBe(pending);
    expect(photoUploadReducer(uploaded, { type: "FAIL" })).toBe(uploaded);
    expect(photoUploadReducer(failed, { type: "FAIL" })).toBe(failed);
  });

  it("an unknown event type is a no-op", () => {
    const slot = createPendingSlot("s1", "file:///a.jpg");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately malformed event to prove the default no-op branch
    const next = photoUploadReducer(slot, { type: "BOGUS" } as any);
    expect(next).toBe(slot);
  });
});

describe("createPendingSlot / createUploadedSlotFromKey", () => {
  it("createPendingSlot seeds a pending slot with a local uri and zero progress", () => {
    expect(createPendingSlot("s1", "file:///a.jpg")).toEqual({
      id: "s1",
      uri: "file:///a.jpg",
      status: "pending",
      progress: 0,
    });
  });

  it("createUploadedSlotFromKey seeds an uploaded slot with no local uri", () => {
    expect(createUploadedSlotFromKey("s1", "k1")).toEqual({
      id: "s1",
      status: "uploaded",
      progress: 1,
      key: "k1",
    });
  });
});

describe("collectUploadedKeys", () => {
  it("returns only uploaded keys, in array order", () => {
    const slots: PhotoSlot[] = [
      createUploadedSlotFromKey("s1", "k1"),
      createPendingSlot("s2", "file:///b.jpg"),
      { id: "s3", status: "uploading", progress: 0.4 },
      { id: "s4", status: "failed", progress: 0 },
      createUploadedSlotFromKey("s5", "k5"),
    ];

    expect(collectUploadedKeys(slots)).toEqual(["k1", "k5"]);
  });

  it("returns an empty array when no slots are uploaded", () => {
    expect(collectUploadedKeys([createPendingSlot("s1", "file:///a.jpg")])).toEqual([]);
  });
});
