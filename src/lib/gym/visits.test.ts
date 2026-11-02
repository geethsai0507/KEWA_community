import { describe, it, expect } from "vitest";
import {
  decideScanAction,
  effectiveStatus,
  memberDayTotals,
  memberTotal,
  visitMinutes,
  type GymVisit,
} from "./visits";

const ist = (local: string) => new Date(`${local}:00+05:30`);
const minsAfter = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

let seq = 0;
function visit(inAt: Date, outAt: Date | null, status?: GymVisit["status"]): GymVisit {
  return {
    id: `v${++seq}`,
    memberHash: "h1",
    displayName: "Ramesh K.",
    inAt,
    outAt,
    status: status ?? (outAt ? "closed" : "open"),
  };
}

const now = ist("2026-11-02T12:00");

describe("visitMinutes / effectiveStatus", () => {
  it("counts a closed 48-minute visit", () => {
    const v = visit(ist("2026-11-02T07:00"), ist("2026-11-02T07:48"));
    expect(visitMinutes(v, now)).toBe(48);
    expect(effectiveStatus(v, now)).toBe("closed");
  });
  it("treats a closed visit over 3 hours as no-logout worth 0", () => {
    const start = ist("2026-11-02T06:00");
    const v = visit(start, minsAfter(start, 181));
    expect(visitMinutes(v, now)).toBe(0);
    expect(effectiveStatus(v, now)).toBe("no-logout");
  });
  it("counts an open visit as 0 while it is still open", () => {
    const v = visit(minsAfter(now, -30), null);
    expect(visitMinutes(v, now)).toBe(0);
    expect(effectiveStatus(v, now)).toBe("open");
  });
  it("treats an open visit older than 3 hours as no-logout", () => {
    expect(effectiveStatus(visit(minsAfter(now, -181), null), now)).toBe("no-logout");
  });
  it("counts a stored no-logout visit as 0", () => {
    const start = ist("2026-11-02T07:00");
    expect(visitMinutes(visit(start, minsAfter(start, 30), "no-logout"), now)).toBe(0);
  });
});

describe("memberDayTotals / memberTotal", () => {
  it("caps a day at 4 hours", () => {
    const visits = ["06:00", "09:00", "17:00"].map((t) => {
      const start = ist(`2026-11-01T${t}`);
      return visit(start, minsAfter(start, 100));
    });
    expect(memberDayTotals(visits, now).get("2026-11-01")).toBe(240);
  });
  it("ignores a no-logout visit but keeps the rest of the day", () => {
    const a = ist("2026-11-01T06:00");
    const b = ist("2026-11-01T18:00");
    const visits = [visit(a, minsAfter(a, 200)), visit(b, minsAfter(b, 40))];
    expect(memberDayTotals(visits, now).get("2026-11-01")).toBe(40);
  });
  it("credits a visit crossing midnight to the day it started", () => {
    const start = ist("2026-11-01T23:50");
    const totals = memberDayTotals([visit(start, ist("2026-11-02T00:20"))], now);
    expect(totals.get("2026-11-01")).toBe(30);
    expect(totals.get("2026-11-02")).toBeUndefined();
  });
  it("sums capped days", () => {
    const a = ist("2026-11-01T07:00");
    const b = ist("2026-11-02T07:00");
    expect(memberTotal([visit(a, minsAfter(a, 60)), visit(b, minsAfter(b, 45))], now)).toBe(105);
  });
});

describe("decideScanAction", () => {
  it("checks in when there are no visits", () => {
    expect(decideScanAction([], now)).toEqual({ kind: "check-in", staleOpen: [] });
  });
  it("checks out a late-night visit after midnight", () => {
    const open = visit(ist("2026-11-01T23:50"), null);
    const decision = decideScanAction([open], ist("2026-11-02T00:20"));
    expect(decision).toEqual({ kind: "check-out", visit: open, overCap: false });
  });
  it("starts a fresh check-in when yesterday's visit was never closed", () => {
    const stale = visit(ist("2026-11-01T07:00"), null);
    expect(decideScanAction([stale], ist("2026-11-02T07:00"))).toEqual({ kind: "check-in", staleOpen: [stale] });
  });
  it("checks out a 190-minute visit as over the cap", () => {
    const open = visit(minsAfter(now, -190), null);
    expect(decideScanAction([open], now)).toEqual({ kind: "check-out", visit: open, overCap: true });
  });
  it("checks out a 59-minute visit normally", () => {
    const open = visit(minsAfter(now, -59), null);
    expect(decideScanAction([open], now)).toEqual({ kind: "check-out", visit: open, overCap: false });
  });
  it("checks in when the open visit is over 6 hours old", () => {
    const open = visit(minsAfter(now, -361), null);
    expect(decideScanAction([open], now)).toEqual({ kind: "check-in", staleOpen: [open] });
  });
  it("ignores a scan 60 seconds after checking in", () => {
    const inAt = new Date(now.getTime() - 60_000);
    expect(decideScanAction([visit(inAt, null)], now)).toEqual({ kind: "ignore", last: "check-in", at: inAt });
  });
  it("ignores a scan 30 seconds after checking out", () => {
    const outAt = new Date(now.getTime() - 30_000);
    expect(decideScanAction([visit(minsAfter(now, -40), outAt)], now)).toEqual({
      kind: "ignore",
      last: "check-out",
      at: outAt,
    });
  });
  it("checks in again 3 minutes after checking out", () => {
    const v = visit(minsAfter(now, -40), minsAfter(now, -3));
    expect(decideScanAction([v], now)).toEqual({ kind: "check-in", staleOpen: [] });
  });
});
