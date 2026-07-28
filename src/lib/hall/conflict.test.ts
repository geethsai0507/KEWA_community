import { describe, it, expect } from "vitest";
import { isBlockingSlot, isExpiredPendingPayment } from "./conflict";

function ts(ms: number) {
  return { toMillis: () => ms };
}

describe("isBlockingSlot", () => {
  const now = 1_000_000;

  it("blocks on confirmed", () => {
    expect(isBlockingSlot("confirmed", null, now)).toBe(true);
  });
  it("blocks on pending-approval", () => {
    expect(isBlockingSlot("pending-approval", null, now)).toBe(true);
  });
  it("blocks on pending-verification", () => {
    expect(isBlockingSlot("pending-verification", null, now)).toBe(true);
  });
  it("blocks on pending-payment when not yet expired", () => {
    expect(isBlockingSlot("pending-payment", ts(now + 1000), now)).toBe(true);
  });
  it("does not block on pending-payment once expired", () => {
    expect(isBlockingSlot("pending-payment", ts(now - 1000), now)).toBe(false);
  });
  it("does not block on cancelled", () => {
    expect(isBlockingSlot("cancelled", null, now)).toBe(false);
  });
  it("does not block on expired", () => {
    expect(isBlockingSlot("expired", null, now)).toBe(false);
  });
});

describe("isExpiredPendingPayment", () => {
  const now = 1_000_000;

  it("is true when status is pending-payment and expiresAt is in the past", () => {
    expect(isExpiredPendingPayment("pending-payment", ts(now - 1), now)).toBe(true);
  });
  it("is false when status is pending-payment and expiresAt is in the future", () => {
    expect(isExpiredPendingPayment("pending-payment", ts(now + 1), now)).toBe(false);
  });
  it("is false for any other status regardless of expiresAt", () => {
    expect(isExpiredPendingPayment("confirmed", ts(now - 1), now)).toBe(false);
  });
  it("is false when expiresAt is null", () => {
    expect(isExpiredPendingPayment("pending-payment", null, now)).toBe(false);
  });
});
