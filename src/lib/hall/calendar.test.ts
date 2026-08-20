import { describe, it, expect } from "vitest";
import { dayColorFor, dayStatusLabel, type DayStatus } from "./calendar";

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

describe("dayStatusLabel", () => {
  it("labels available as Free", () => {
    expect(dayStatusLabel("available")).toBe("Free");
  });
  it("labels pending as Pending Approval", () => {
    expect(dayStatusLabel("pending")).toBe("Pending Approval");
  });
  it("labels confirmed as Booked", () => {
    expect(dayStatusLabel("confirmed")).toBe("Booked");
  });
  it("labels held as Payment in Progress", () => {
    expect(dayStatusLabel("held")).toBe("Payment in Progress");
  });
  it("labels blocked as Blocked", () => {
    expect(dayStatusLabel("blocked")).toBe("Blocked");
  });
  it("covers every DayStatus value with a non-empty label", () => {
    const statuses: DayStatus[] = ["available", "confirmed", "pending", "held", "blocked"];
    for (const s of statuses) {
      expect(dayStatusLabel(s).length).toBeGreaterThan(0);
    }
  });
});
