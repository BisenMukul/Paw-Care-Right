import { getIsOfflineSnapshot, setOnline, subscribe } from "./online";

describe("online store", () => {
  afterEach(() => {
    // Module-level state persists across tests in this file; restore the
    // documented default (online) so tests stay order-independent.
    setOnline(true);
  });

  it("defaults to online (offline snapshot is false)", () => {
    expect(getIsOfflineSnapshot()).toBe(false);
  });

  it("setOnline(false) makes the offline snapshot true, and setOnline(true) flips it back", () => {
    setOnline(false);
    expect(getIsOfflineSnapshot()).toBe(true);

    setOnline(true);
    expect(getIsOfflineSnapshot()).toBe(false);
  });

  it("notifies subscribers only when the value actually changes", () => {
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);

    setOnline(true); // already online: no notification
    expect(listener).not.toHaveBeenCalled();

    setOnline(false);
    expect(listener).toHaveBeenCalledTimes(1);

    setOnline(false); // unchanged: no additional notification
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setOnline(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
