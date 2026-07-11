import type { MMKV } from "react-native-mmkv";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

// The native module never loads in the node test env — this stands in for
// it so `./mmkv-persister` (which imports `createMMKV` from the real
// package) can be exercised headlessly.
jest.mock("react-native-mmkv", () => ({
  createMMKV: jest.fn(),
}));

import { createMmkvPersister } from "./mmkv-persister";

function createFakeMmkv(): MMKV {
  const store = new Map<string, string>();
  return {
    getString: jest.fn((key: string) => store.get(key)),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    remove: jest.fn((key: string) => {
      store.delete(key);
    }),
  } as unknown as MMKV;
}

function createFixture(): PersistedClient {
  return {
    timestamp: 1_700_000_000_000,
    buster: "v1",
    clientState: { mutations: [], queries: [] },
  };
}

describe("createMmkvPersister", () => {
  it("persists and restores a PersistedClient via injected mmkv", async () => {
    const mmkv = createFakeMmkv();
    const persister = createMmkvPersister({ mmkv });
    const client = createFixture();

    await persister.persistClient(client);
    const restored = await persister.restoreClient();

    expect(restored).toEqual(client);
  });

  it("restoreClient returns undefined when nothing has been persisted", async () => {
    const mmkv = createFakeMmkv();
    const persister = createMmkvPersister({ mmkv });

    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });

  it("removeClient clears the persisted entry", async () => {
    const mmkv = createFakeMmkv();
    const persister = createMmkvPersister({ mmkv });
    const client = createFixture();

    await persister.persistClient(client);
    await persister.removeClient();

    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });
});
