import { istDayKey } from "./time";

/** A single visit longer than this counts 0 and is treated as a missed check-out. */
export const MAX_VISIT_MINUTES = 180;
/** At most this many minutes count per member per IST day. */
export const DAILY_CAP_MINUTES = 240;
/** A scan this soon after the member's previous scan is ignored. */
export const DOUBLE_SCAN_MS = 120_000;
/** An open visit older than this is abandoned: the next scan starts a fresh check-in. */
export const STALE_VISIT_MINUTES = 360;

export type GymVisitStatus = "open" | "closed" | "no-logout";

export interface GymVisit {
  id: string;
  memberHash: string;
  displayName: string;
  inAt: Date;
  outAt: Date | null;
  status: GymVisitStatus;
}

export type ScanDecision =
  | { kind: "check-in"; staleOpen: GymVisit[] }
  | { kind: "check-out"; visit: GymVisit; overCap: boolean }
  | { kind: "ignore"; last: "check-in" | "check-out"; at: Date };

const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

export function effectiveStatus(v: GymVisit, now: Date): GymVisitStatus {
  if (v.status === "no-logout") return "no-logout";
  const end = v.status === "open" ? now : (v.outAt ?? now);
  return minutesBetween(v.inAt, end) > MAX_VISIT_MINUTES ? "no-logout" : v.status;
}

export function visitMinutes(v: GymVisit, now: Date): number {
  if (effectiveStatus(v, now) !== "closed" || !v.outAt) return 0;
  return Math.floor(minutesBetween(v.inAt, v.outAt));
}

export function memberDayTotals(visits: GymVisit[], now: Date): Map<string, number> {
  const totals = new Map<string, number>();
  for (const v of visits) {
    const minutes = visitMinutes(v, now);
    if (minutes === 0) continue;
    const day = istDayKey(v.inAt);
    totals.set(day, Math.min(DAILY_CAP_MINUTES, (totals.get(day) ?? 0) + minutes));
  }
  return totals;
}

export function memberTotal(visits: GymVisit[], now: Date): number {
  let sum = 0;
  for (const m of memberDayTotals(visits, now).values()) sum += m;
  return sum;
}

export function decideScanAction(memberVisits: GymVisit[], now: Date): ScanDecision {
  let last: { at: Date; kind: "check-in" | "check-out" } | null = null;
  for (const v of memberVisits) {
    const at = v.outAt ?? v.inAt;
    if (!last || at > last.at) last = { at, kind: v.outAt ? "check-out" : "check-in" };
  }
  if (last && now.getTime() - last.at.getTime() < DOUBLE_SCAN_MS) {
    return { kind: "ignore", last: last.kind, at: last.at };
  }

  const open = memberVisits
    .filter((v) => v.status === "open")
    .sort((a, b) => b.inAt.getTime() - a.inAt.getTime());
  const latest = open[0];
  if (latest) {
    const age = minutesBetween(latest.inAt, now);
    if (age <= STALE_VISIT_MINUTES) {
      return { kind: "check-out", visit: latest, overCap: age > MAX_VISIT_MINUTES };
    }
  }
  return {
    kind: "check-in",
    staleOpen: open.filter((v) => minutesBetween(v.inAt, now) > STALE_VISIT_MINUTES),
  };
}
