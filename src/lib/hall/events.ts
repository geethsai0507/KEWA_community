import { collection, doc, serverTimestamp, type Transaction } from "firebase/firestore";
import { db } from "./firebase";
import type { BookingStatus } from "./types";

export function logBookingEvent(
  tx: Transaction,
  bookingId: string,
  action: string,
  oldStatus: BookingStatus | null,
  newStatus: BookingStatus,
  performedBy: string,
): void {
  const eventRef = doc(collection(db, "bookingEvents"));
  tx.set(eventRef, {
    bookingId,
    action,
    oldStatus,
    newStatus,
    performedBy,
    timestamp: serverTimestamp(),
  });
}
