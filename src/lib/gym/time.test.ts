import { describe, it, expect } from "vitest";
import { istDayKey, istMonthKey, istMonthRange, formatMinutes, formatIstTime } from "./time";

const ist = (local: string) => new Date(`${local}:00+05:30`);

describe("istDayKey", () => {
  it("returns the IST calendar day", () => {
    expect(istDayKey(ist("2026-11-02T00:10"))).toBe("2026-11-02");
  });
  it("rolls to the next day when UTC is still on the previous day", () => {
    expect(istDayKey(new Date("2026-11-01T19:00:00Z"))).toBe("2026-11-02");
  });
});

describe("istMonthKey", () => {
  it("uses the IST month", () => {
    expect(istMonthKey(new Date("2026-10-31T19:00:00Z"))).toBe("2026-11");
  });
});

describe("istMonthRange", () => {
  it("spans IST midnights", () => {
    const { start, end } = istMonthRange("2026-11");
    expect(start.toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-11-30T18:30:00.000Z");
  });
  it("rolls December into the next year", () => {
    expect(istMonthRange("2026-12").end.toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });
});

describe("formatMinutes", () => {
  it("formats minutes and hours", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(48)).toBe("48 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(80)).toBe("1 h 20 min");
  });
});

describe("formatIstTime", () => {
  it("formats a 12-hour IST clock time", () => {
    expect(formatIstTime(ist("2026-11-02T18:05"))).toBe("6:05 PM");
    expect(formatIstTime(ist("2026-11-02T06:42"))).toBe("6:42 AM");
    expect(formatIstTime(ist("2026-11-02T00:15"))).toBe("12:15 AM");
  });
});
