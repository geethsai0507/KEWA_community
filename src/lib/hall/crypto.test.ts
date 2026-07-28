import { describe, it, expect } from "vitest";
import { generateBookingNumber, generateLookupToken, hashEmployeeId } from "./crypto";

describe("generateBookingNumber", () => {
  it("matches the EC-XXXXXX format", () => {
    expect(generateBookingNumber()).toMatch(/^EC-[0-9A-F]{6}$/);
  });
  it("produces different values across calls", () => {
    const a = generateBookingNumber();
    const b = generateBookingNumber();
    expect(a).not.toBe(b);
  });
});

describe("generateLookupToken", () => {
  it("produces a 32-character hex string (128 bits)", () => {
    expect(generateLookupToken()).toMatch(/^[0-9a-f]{32}$/);
  });
  it("produces different values across calls", () => {
    const a = generateLookupToken();
    const b = generateLookupToken();
    expect(a).not.toBe(b);
  });
});

describe("hashEmployeeId", () => {
  it("produces a 64-character hex digest (256 bits)", async () => {
    const hash = await hashEmployeeId("EMP12345");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic for the same input", async () => {
    const a = await hashEmployeeId("EMP12345");
    const b = await hashEmployeeId("EMP12345");
    expect(a).toBe(b);
  });
  it("normalizes case/whitespace before hashing so lookups are consistent", async () => {
    const a = await hashEmployeeId("emp12345");
    const b = await hashEmployeeId("EMP12345");
    expect(a).toBe(b);
  });
  it("produces different hashes for different employee IDs", async () => {
    const a = await hashEmployeeId("EMP12345");
    const b = await hashEmployeeId("EMP99999");
    expect(a).not.toBe(b);
  });
});
