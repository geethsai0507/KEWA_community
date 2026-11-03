import { describe, it, expect } from "vitest";
import { deviceLinkState, getOrCreateDeviceId, GYM_DEVICE_ID_KEY } from "./device";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("getOrCreateDeviceId", () => {
  it("creates and stores a 32-hex-character id on first use", () => {
    const storage = memoryStorage();
    const id = getOrCreateDeviceId(storage);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(storage.data.get(GYM_DEVICE_ID_KEY)).toBe(id);
  });
  it("returns the same id on later calls", () => {
    const storage = memoryStorage();
    expect(getOrCreateDeviceId(storage)).toBe(getOrCreateDeviceId(storage));
  });
});

describe("deviceLinkState", () => {
  it("is unlinked when the member has no phone yet", () => {
    expect(deviceLinkState(null, "abc")).toBe("unlinked");
  });
  it("is ok on the member's linked phone", () => {
    expect(deviceLinkState("abc", "abc")).toBe("ok");
  });
  it("is a mismatch on any other phone", () => {
    expect(deviceLinkState("abc", "xyz")).toBe("mismatch");
  });
});
