import type { BookingStatus } from "./types";

type TimestampLike = { toMillis(): number } | null;

export function isExpiredPendingPayment(
  status: BookingStatus,
  expiresAt: TimestampLike,
  nowMs: number,
): boolean {
  if (status !== "pending-payment" || !expiresAt) return false;
  return expiresAt.toMillis() < nowMs;
}

export function isBlockingSlot(
  status: BookingStatus,
  expiresAt: TimestampLike,
  nowMs: number,
): boolean {
  if (status === "confirmed" || status === "pending-approval" || status === "pending-verification") {
    return true;
  }
  if (status === "pending-payment") {
    return !isExpiredPendingPayment(status, expiresAt, nowMs);
  }
  return false; // cancelled, expired
}
