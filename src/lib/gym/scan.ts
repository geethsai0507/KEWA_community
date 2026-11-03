import { hashEmployeeId } from "@/lib/hall/crypto";
import {
  checkIn,
  closeVisit,
  getLinkedDeviceId,
  linkDevice,
  fetchMemberVisitsForScan,
  getMemberDisplayName,
} from "./store";
import { deviceLinkState } from "./device";
import { istDayKey } from "./time";
import { decideScanAction, memberDayTotals, type GymVisit } from "./visits";

export type ScanOutcome =
  | { kind: "checked-in"; at: Date; todayMinutes: number }
  | { kind: "checked-out"; minutes: number; overCap: boolean; todayMinutes: number }
  | { kind: "ignored"; last: "check-in" | "check-out"; at: Date; todayMinutes: number }
  | { kind: "device-mismatch" }
  | { kind: "confirm-link" };

export type ScanResult = ScanOutcome & { displayName: string };

const todayMinutes = (visits: GymVisit[], now: Date) =>
  memberDayTotals(visits, now).get(istDayKey(now)) ?? 0;

/** Records one QR scan for this member on this phone: check-in, check-out, or ignore a double scan. */
// confirmLink: the member has confirmed it's them. Required only for the first scan that links a
// member to this phone, so a login left on a shared phone can't silently claim someone's link.
export async function performScan(
  empId: string,
  deviceId: string,
  confirmLink = false,
): Promise<ScanResult> {
  const memberHash = await hashEmployeeId(empId);
  const displayName = await getMemberDisplayName(memberHash);

  const link = deviceLinkState(await getLinkedDeviceId(memberHash), deviceId);
  if (link === "mismatch") return { kind: "device-mismatch", displayName };
  if (link === "unlinked") {
    if (!confirmLink) return { kind: "confirm-link", displayName };
    await linkDevice(memberHash, deviceId);
  }

  const now = new Date();
  const decision = decideScanAction(await fetchMemberVisitsForScan(memberHash, now), now);

  if (decision.kind === "ignore") {
    const visits = await fetchMemberVisitsForScan(memberHash, now);
    return {
      kind: "ignored",
      last: decision.last,
      at: decision.at,
      todayMinutes: todayMinutes(visits, now),
      displayName,
    };
  }

  if (decision.kind === "check-out") {
    await closeVisit(decision.visit.id, decision.overCap ? "no-logout" : "closed");
    const after = new Date();
    const visits = await fetchMemberVisitsForScan(memberHash, after);
    const closed = visits.find((v) => v.id === decision.visit.id);
    const minutes =
      decision.overCap || !closed?.outAt
        ? 0
        : Math.floor((closed.outAt.getTime() - closed.inAt.getTime()) / 60_000);
    return {
      kind: "checked-out",
      minutes,
      overCap: decision.overCap,
      todayMinutes: todayMinutes(visits, after),
      displayName,
    };
  }

  for (const stale of decision.staleOpen) await closeVisit(stale.id, "no-logout");
  await checkIn(memberHash, displayName);
  const after = new Date();
  const visits = await fetchMemberVisitsForScan(memberHash, after);
  const open = visits
    .filter((v) => v.status === "open")
    .sort((a, b) => b.inAt.getTime() - a.inAt.getTime())[0];
  return {
    kind: "checked-in",
    at: open?.inAt ?? after,
    todayMinutes: todayMinutes(visits, after),
    displayName,
  };
}
