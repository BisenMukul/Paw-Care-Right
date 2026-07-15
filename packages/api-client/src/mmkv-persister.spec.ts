import type { MMKV } from "react-native-mmkv";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

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
    const { createMmkvPersister } = await import("./mmkv-persister");
    const mmkv = createFakeMmkv();
    const persister = createMmkvPersister({ mmkv });
    const client = createFixture();

    await persister.persistClient(client);
    const restored = await persister.restoreClient();

    expect(restored).toEqual(client);
  });

  it("restoreClient returns undefined when nothing has been persisted", async () => {
    const { createMmkvPersister } = await import("./mmkv-persister");
    const mmkv = createFakeMmkv();
    const persister = createMmkvPersister({ mmkv });

    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });

  it("removeClient clears the persisted entry", async () => {
    const { createMmkvPersister } = await import("./mmkv-persister");
    const mmkv = createFakeMmkv();
    const persister = createMmkvPersister({ mmkv });
    const client = createFixture();

    await persister.persistClient(client);
    await persister.removeClient();

    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });

  it("falls back to in-memory storage when the native module is unavailable", async () => {
    jest.resetModules();
    jest.doMock("react-native-mmkv", () => {
      throw new Error("native module unavailable");
    }, { virtual: true });

    const { createMmkvPersister } = await import("./mmkv-persister");
    const persister = createMmkvPersister();
    const client = createFixture();

    await persister.persistClient(client);

    await expect(persister.restoreClient()).resolves.toEqual(client);
  });
});
