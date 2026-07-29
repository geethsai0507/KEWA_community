import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { hashEmployeeId } from "./crypto";

export async function verifyMembership(empId: string): Promise<boolean> {
  const hash = await hashEmployeeId(empId);
  const snap = await getDoc(doc(db, "membersPublic", hash));
  return snap.exists() && snap.data().isMember === true;
}

export interface MemberRow {
  empId: string;
  name: string;
  phone: string;
}

export async function uploadMembers(rows: MemberRow[]): Promise<void> {
  const batch = writeBatch(db);
  for (const row of rows) {
    const hash = await hashEmployeeId(row.empId);
    // Keyed by the same hash as membersPublic (rather than a random ID) so re-uploading the
    // same or an updated list overwrites the existing record instead of creating a duplicate.
    const memberRef = doc(db, "members", hash);
    const publicRef = doc(db, "membersPublic", hash);
    batch.set(memberRef, { empId: row.empId, name: row.name, phone: row.phone });
    batch.set(publicRef, { empIdHash: hash, isMember: true });
  }
  await batch.commit();
}
