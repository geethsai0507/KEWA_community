import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { calculateBookingFee } from "./fees";
import { generateBookingNumber, generateLookupToken } from "./crypto";
import { isBlockingSlot } from "./conflict";
import { slotDocId, otherSlot } from "./slotKey";
import { PENDING_PAYMENT_TIMEOUT_MS } from "./constants";
import { logBookingEvent } from "./events";
import type { BookingStatus, Slot } from "./types";

export interface CreateBookingInput {
  name: string;
  empId: string;
  phone: string;
  email: string;
  venue: string;
  date: string;
  slot: Slot;
  purpose: string;
  duration: string;
  isMember: boolean;
}

export interface CreateBookingResult {
  bookingId: string;
  bookingNumber: string;
  lookupToken: string;
  status: "pending-payment" | "pending-approval";
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const bookingRef = doc(collection(db, "bookings"));
  const bookingId = bookingRef.id;

  const slotRef = doc(db, "bookingSlots", slotDocId(input.venue, input.date, input.slot));
  const otherSlotRef = doc(
    db,
    "bookingSlots",
    slotDocId(input.venue, input.date, otherSlot(input.slot)),
  );

  // blockedDates is checked before the transaction, not inside it: blocking a date is an
  // infrequent admin action, not something two customers race on, so this doesn't need
  // transactional atomicity the way the slot conflict check below does.
  const blockedQuery = query(collection(db, "blockedDates"), where("date", "==", input.date));
  const blockedSnap = await getDocs(blockedQuery);
  const isBlockedDate = blockedSnap.docs.some((d) => {
    const data = d.data();
    return data.venue === "all" || data.venue === input.venue;
  });
  if (isBlockedDate) {
    throw new Error("DATE_BLOCKED");
  }

  const bookingNumber = generateBookingNumber();
  const lookupToken = generateLookupToken();
  const amount = calculateBookingFee(input.isMember, input.venue);

  const status = await runTransaction(db, async (tx) => {
    // Both reads happen on known, deterministic document references — this is what makes
    // the conflict check genuinely atomic (see this task's note on why bookingSlots uses a
    // deterministic ID instead of the random bookingId).
    const [slotSnap, otherSlotSnap] = await Promise.all([tx.get(slotRef), tx.get(otherSlotRef)]);
    const now = Date.now();

    if (slotSnap.exists()) {
      const data = slotSnap.data();
      if (isBlockingSlot(data.status as BookingStatus, data.expiresAt ?? null, now)) {
        throw new Error("SLOT_TAKEN");
      }
    }

    let hasBlockingOtherSlot = false;
    if (otherSlotSnap.exists()) {
      const data = otherSlotSnap.data();
      hasBlockingOtherSlot = isBlockingSlot(data.status as BookingStatus, data.expiresAt ?? null, now);
    }

    const resolvedStatus: CreateBookingResult["status"] = hasBlockingOtherSlot
      ? "pending-approval"
      : "pending-payment";
    const expiresAt =
      resolvedStatus === "pending-payment"
        ? Timestamp.fromMillis(now + PENDING_PAYMENT_TIMEOUT_MS)
        : null;

    const slotDoc = {
      venue: input.venue,
      date: input.date,
      slot: input.slot,
      status: resolvedStatus,
      expiresAt,
    };
    const bookingDoc = {
      ...slotDoc,
      bookingNumber,
      lookupToken,
      name: input.name,
      empId: input.empId,
      phone: input.phone,
      email: input.email,
      purpose: input.purpose,
      duration: input.duration,
      utr: null,
      amount,
      isMember: input.isMember,
      cancelledBy: null,
      approvedBy: null,
      approvedAt: null,
      paymentVerifiedBy: null,
      paymentVerifiedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      cancelledAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    tx.set(slotRef, slotDoc);
    tx.set(bookingRef, bookingDoc);
    tx.set(doc(db, "bookingLookup", lookupToken), { bookingId });
    logBookingEvent(tx, bookingId, "CREATED", null, resolvedStatus, "user");
    return resolvedStatus;
  });

  return { bookingId, bookingNumber, lookupToken, status };
}
