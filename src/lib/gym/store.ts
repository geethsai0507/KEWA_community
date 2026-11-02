import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/hall/firebase";
import { istMonthRange } from "./time";
import type { GymVisit, GymVisitStatus } from "./visits";

const VISITS = "gymVisits";
const DEVICES = "gymDevices";

function toVisit(snap: DocumentSnapshot): GymVisit {
  const d = snap.data()!;
  return {
    id: snap.id,
    memberHash: d.memberHash,
    displayName: d.displayName ?? "Member",
    // A just-written serverTimestamp can read back as null from the local cache; fall back to now.
    inAt: d.inAt instanceof Timestamp ? d.inAt.toDate() : new Date(),
    outAt: d.outAt instanceof Timestamp ? d.outAt.toDate() : null,
    status: d.status as GymVisitStatus,
  };
}

export async function getMemberDisplayName(memberHash: string): Promise<string> {
  const snap = await getDoc(doc(db, "membersPublic", memberHash));
  return (snap.exists() && (snap.data().displayName as string | undefined)) || "Member";
}

export async function ensureDeviceLink(memberHash: string, deviceId: string): Promise<"ok" | "mismatch"> {
  const ref = doc(db, DEVICES, memberHash);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { deviceId, linkedAt: serverTimestamp() });
    return "ok";
  }
  return snap.data().deviceId === deviceId ? "ok" : "mismatch";
}

async function runVisitQuery(...constraints: Parameters<typeof query>[1][]): Promise<GymVisit[]> {
  const snap = await getDocs(query(collection(db, VISITS), ...constraints));
  return snap.docs.map(toVisit);
}

/** The member's open visits plus everything they started in the last 24 hours. */
export async function fetchMemberVisitsForScan(memberHash: string, now: Date): Promise<GymVisit[]> {
  const since = Timestamp.fromDate(new Date(now.getTime() - 24 * 60 * 60_000));
  const [open, recent] = await Promise.all([
    runVisitQuery(where("memberHash", "==", memberHash), where("status", "==", "open")),
    runVisitQuery(where("memberHash", "==", memberHash), where("inAt", ">=", since)),
  ]);
  const byId = new Map<string, GymVisit>();
  for (const v of [...open, ...recent]) byId.set(v.id, v);
  return [...byId.values()];
}

export function fetchMemberMonthVisits(memberHash: string, monthKey: string): Promise<GymVisit[]> {
  const { start, end } = istMonthRange(monthKey);
  return runVisitQuery(
    where("memberHash", "==", memberHash),
    where("inAt", ">=", Timestamp.fromDate(start)),
    where("inAt", "<", Timestamp.fromDate(end)),
  );
}

export function fetchMonthVisits(monthKey: string): Promise<GymVisit[]> {
  const { start, end } = istMonthRange(monthKey);
  return runVisitQuery(where("inAt", ">=", Timestamp.fromDate(start)), where("inAt", "<", Timestamp.fromDate(end)));
}

export async function checkIn(memberHash: string, displayName: string): Promise<void> {
  await addDoc(collection(db, VISITS), {
    memberHash,
    displayName,
    inAt: serverTimestamp(),
    outAt: null,
    status: "open",
  });
}

export async function closeVisit(visitId: string, status: "closed" | "no-logout"): Promise<void> {
  await updateDoc(doc(db, VISITS, visitId), { status, outAt: serverTimestamp() });
}

// Admin-only (enforced by Firestore rules).
export async function deleteVisit(visitId: string): Promise<void> {
  await deleteDoc(doc(db, VISITS, visitId));
}

export async function resetDeviceLink(memberHash: string): Promise<void> {
  await deleteDoc(doc(db, DEVICES, memberHash));
}
