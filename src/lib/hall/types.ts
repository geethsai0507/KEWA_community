import type { Timestamp } from "firebase/firestore";

export type BookingStatus =
  | "pending-approval"
  | "pending-payment"
  | "pending-verification"
  | "confirmed"
  | "cancelled"
  | "expired";

export type Slot = "Morning" | "Evening";

export interface BookingSlotDoc {
  bookingId: string;
  venue: string;
  date: string;
  slot: Slot;
  status: BookingStatus;
  bookingNumber: string;
  lookupToken: string;
  expiresAt: Timestamp | null;
}

export interface BookingDoc extends BookingSlotDoc {
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

export interface BlockedDateDoc {
  date: string;
  venue: string;
  reason: string;
  createdAt: Timestamp;
}
