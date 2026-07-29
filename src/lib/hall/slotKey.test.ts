import { describe, it, expect } from "vitest";
import { slotDocId, otherSlot } from "./slotKey";

describe("slotDocId", () => {
  it("produces the same key for the same venue/date/slot", () => {
    expect(slotDocId("Multi Purpose Room", "2026-08-15", "Morning")).toBe(
      slotDocId("Multi Purpose Room", "2026-08-15", "Morning"),
    );
  });
  it("produces different keys for different slots on the same day", () => {
    expect(slotDocId("Multi Purpose Room", "2026-08-15", "Morning")).not.toBe(
      slotDocId("Multi Purpose Room", "2026-08-15", "Evening"),
    );
  });
  it("produces different keys for different dates", () => {
    expect(slotDocId("Multi Purpose Room", "2026-08-15", "Morning")).not.toBe(
      slotDocId("Multi Purpose Room", "2026-08-16", "Morning"),
    );
  });
  it("produces different keys for different venues", () => {
    expect(slotDocId("Multi Purpose Room", "2026-08-15", "Morning")).not.toBe(
      slotDocId("Shopping Complex Room", "2026-08-15", "Morning"),
    );
  });
  it("never contains a forward slash (invalid in a single Firestore path segment)", () => {
    expect(slotDocId("Multi Purpose Room", "2026-08-15", "Morning")).not.toContain("/");
  });
});

describe("otherSlot", () => {
  it("maps Morning to Evening", () => {
    expect(otherSlot("Morning")).toBe("Evening");
  });
  it("maps Evening to Morning", () => {
    expect(otherSlot("Evening")).toBe("Morning");
  });
});
