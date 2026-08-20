import { describe, it, expect } from "vitest";
import { dayColorFor, type DayStatus } from "./calendar";

describe("dayColorFor", () => {
  it("shows green for available", () => {
    expect(dayColorFor("available")).toBe("green");
  });
  it("shows yellow for pending", () => {
    expect(dayColorFor("pending")).toBe("yellow");
  });
  it("shows red for confirmed", () => {
    expect(dayColorFor("confirmed")).toBe("red");
  });
  it("shows red for held (payment window)", () => {
    expect(dayColorFor("held")).toBe("red");
  });
  it("shows red for admin-blocked", () => {
    expect(dayColorFor("blocked")).toBe("red");
  });
  it("covers every DayStatus value with no fallthrough", () => {
    const statuses: DayStatus[] = ["available", "confirmed", "pending", "held", "blocked"];
    for (const s of statuses) {
      expect(["red", "yellow", "green"]).toContain(dayColorFor(s));
    }
  });
});
