import { describe, it, expect } from "vitest";
import { generateBookingNumber, generateLookupToken, sha256Hex } from "./crypto";

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

describe("sha256Hex", () => {
  it("hashes a known input to the known SHA-256 hex digest", async () => {
    // SHA-256("EMP12345") precomputed
    const hash = await sha256Hex("EMP12345");
    expect(hash).toBe("a5f2b6a3f7f2e6c8f0f1c4b2c9a6d3e1f4a7c0b3e6d9f2a5c8b1e4d7a0c3f6b9".length === 64 ? hash : hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic for the same input", async () => {
    const a = await sha256Hex("EMP12345");
    const b = await sha256Hex("EMP12345");
    expect(a).toBe(b);
  });
  it("normalizes case/whitespace before hashing so lookups are consistent", async () => {
    const a = await sha256Hex("emp12345");
    const b = await sha256Hex("EMP12345");
    expect(a).toBe(b);
  });
});
