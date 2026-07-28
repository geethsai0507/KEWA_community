import { describe, it, expect } from "vitest";
import { calculateBookingFee } from "./fees";

describe("calculateBookingFee", () => {
  it("charges member rate for Executives Club Community Hall", () => {
    expect(calculateBookingFee(true, "Executives Club Community Hall")).toBe(500);
  });
  it("charges non-member rate for Executives Club Community Hall", () => {
    expect(calculateBookingFee(false, "Executives Club Community Hall")).toBe(1000);
  });
  it("charges member rate for Multi Purpose Room", () => {
    expect(calculateBookingFee(true, "Multi Purpose Room")).toBe(500);
  });
  it("charges lower member rate for Shopping Complex Room", () => {
    expect(calculateBookingFee(true, "Shopping Complex Room")).toBe(200);
  });
  it("charges lower non-member rate for an unrecognized/Other venue", () => {
    expect(calculateBookingFee(false, "Some Custom Venue")).toBe(500);
  });
});
