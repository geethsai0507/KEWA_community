import { describe, it, expect } from "vitest";
import { calculateBookingFee } from "./fees";

describe("calculateBookingFee", () => {
  it("charges the member rate for Executives Club Community Hall", () => {
    expect(calculateBookingFee("Executives Club Community Hall")).toBe(500);
  });
  it("charges the member rate for Multi Purpose Room", () => {
    expect(calculateBookingFee("Multi Purpose Room")).toBe(500);
  });
  it("charges the lower member rate for Shopping Complex Room", () => {
    expect(calculateBookingFee("Shopping Complex Room")).toBe(200);
  });
  it("charges the lower member rate for an unrecognized/Other venue", () => {
    expect(calculateBookingFee("Some Custom Venue")).toBe(200);
  });
});
