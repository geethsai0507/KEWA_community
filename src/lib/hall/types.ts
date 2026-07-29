import type { Timestamp } from "firebase/firestore";

export type BookingStatus =
  | "pending-approval"
  | "pending-payment"
  | "pending-verification"
  | "confirmed"
  | "cancelled"
  | "expired";

export type Slot = "Morning" | "Evening";

// Public availability layer only (see firestore.rules) — deliberately carries no pointer to
// the private bookings record, since this collection is publicly listable for the calendar.
// occupiedSince is NOT a pointer to PII — it's a plain timestamp (matching the current
// occupant's own createdAt, set atomically in the same transaction) used only so the admin
// sweep (Task 20) can verify it's still syncing the SAME occupancy episode it thinks it is,
// rather than stomping a newer booking that has since legitimately reclaimed this slot.
export interface BookingSlotDoc {
  venue: string;
  date: string;
  slot: Slot;
  status: BookingStatus;
  expiresAt: Timestamp | null;
  occupiedSince: Timestamp;
}

export interface BookingDoc extends BookingSlotDoc {
  bookingNumber: string;
  lookupToken: string;
  name: string;
  empId: string;
  phone: string;
  email: string;
  purpose: string;
  duration: string;
  utr: string | null;
  amount: number;
  isMember: boolean;
  cancelledBy: "user" | "admin" | null;
  approvedBy: string | null;
  approvedAt: Timestamp | null;
  paymentVerifiedBy: string | null;
  paymentVerifiedAt: Timestamp | null;
  rejectedBy: string | null;
  rejectedAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MemberPublicDoc {
  empIdHash: string;
  isMember: boolean;
}

// Document ID is the lookupToken itself — the only public channel from "I hold this token"
// to "here is the bookingId" (see firestore.rules for why this must be a get(), not list()).
export interface BookingLookupDoc {
  bookingId: string;
}

export interface BlockedDateDoc {
  date: string;
  venue: string;
  reason: string;
  createdAt: Timestamp;
}
