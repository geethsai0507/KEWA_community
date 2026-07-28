import emailjs from "@emailjs/browser";
import type { BookingDoc } from "./types";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string;

const TEMPLATE_APPROVAL_NEEDED = "template_approval_needed";
const TEMPLATE_PAYMENT_INSTRUCTIONS = "template_payment_instructions";
const TEMPLATE_CONFIRMED = "template_confirmed";
const TEMPLATE_CANCELLED = "template_cancelled";
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;

async function safeSend(templateId: string, params: Record<string, unknown>): Promise<void> {
  try {
    await emailjs.send(SERVICE_ID, templateId, params, { publicKey: PUBLIC_KEY });
  } catch (err) {
    console.error(`EmailJS send failed for template ${templateId}:`, err);
  }
}

export function sendApprovalNeededEmail(booking: BookingDoc & { bookingId: string }): Promise<void> {
  return safeSend(TEMPLATE_APPROVAL_NEEDED, {
    admin_email: ADMIN_EMAIL,
    booking_number: booking.bookingNumber,
    name: booking.name,
    venue: booking.venue,
    date: booking.date,
    slot: booking.slot,
  });
}

export function sendPaymentInstructionsEmail(booking: BookingDoc & { bookingId: string }): Promise<void> {
  return safeSend(TEMPLATE_PAYMENT_INSTRUCTIONS, {
    to_email: booking.email,
    booking_number: booking.bookingNumber,
    amount: booking.amount,
    venue: booking.venue,
    date: booking.date,
    slot: booking.slot,
    status_link: `${window.location.origin}/hall/status?token=${booking.lookupToken}`,
  });
}

export function sendConfirmedEmail(booking: BookingDoc & { bookingId: string }): Promise<void> {
  return safeSend(TEMPLATE_CONFIRMED, {
    to_email: booking.email,
    booking_number: booking.bookingNumber,
    venue: booking.venue,
    date: booking.date,
    slot: booking.slot,
  });
}

export type CancellationReason =
  | "admin-rejected-approval"
  | "admin-rejected-payment"
  | "self-cancelled"
  | "expired";

const CANCELLATION_MESSAGES: Record<CancellationReason, string> = {
  "admin-rejected-approval": "Your booking request was not approved.",
  "admin-rejected-payment": "Your payment could not be verified, so the booking was cancelled.",
  "self-cancelled": "Your booking was cancelled as requested.",
  expired: "Your booking expired because payment wasn't received in time.",
};

export function sendCancelledEmail(
  booking: BookingDoc & { bookingId: string },
  reason: CancellationReason,
): Promise<void> {
  return safeSend(TEMPLATE_CANCELLED, {
    to_email: booking.email,
    booking_number: booking.bookingNumber,
    reason: CANCELLATION_MESSAGES[reason],
  });
}
