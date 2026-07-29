import emailjs from "@emailjs/browser";
import type { BookingDoc } from "./types";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string;

const TEMPLATE_APPROVAL_NEEDED = "tpl_approval_needed";
// EmailJS's free plan caps templates at 2, so the 3 user-facing notifications (payment
// instructions, confirmed, cancelled) share one generic template — differentiated by the
// subject/heading/details/link text built in JS below, not by separate template IDs.
const TEMPLATE_USER_NOTIFY = "tpl_payment_instr";
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
  const statusLink = `${window.location.origin}/hall/status?token=${booking.lookupToken}`;
  return safeSend(TEMPLATE_USER_NOTIFY, {
    to_email: booking.email,
    subject: `Payment Instructions: ${booking.bookingNumber}`,
    heading: "Your hall booking is approved. Please complete payment to confirm it. Payment must be completed within 15 minutes or this booking will expire.",
    details: [
      `Booking Number: ${booking.bookingNumber}`,
      `Amount: ₹${booking.amount}`,
      `Venue: ${booking.venue}`,
      `Date: ${booking.date}`,
      `Slot: ${booking.slot}`,
    ].join("\n"),
    link: `Submit your UTR here: ${statusLink}`,
  });
}

export function sendConfirmedEmail(booking: BookingDoc & { bookingId: string }): Promise<void> {
  return safeSend(TEMPLATE_USER_NOTIFY, {
    to_email: booking.email,
    subject: `Booking Confirmed: ${booking.bookingNumber}`,
    heading: "Your hall booking is confirmed! We look forward to seeing you.",
    details: [
      `Booking Number: ${booking.bookingNumber}`,
      `Venue: ${booking.venue}`,
      `Date: ${booking.date}`,
      `Slot: ${booking.slot}`,
    ].join("\n"),
    link: "",
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
  return safeSend(TEMPLATE_USER_NOTIFY, {
    to_email: booking.email,
    subject: `Booking Cancelled: ${booking.bookingNumber}`,
    heading: CANCELLATION_MESSAGES[reason],
    details: [
      `Booking Number: ${booking.bookingNumber}`,
      `Venue: ${booking.venue}`,
      `Date: ${booking.date}`,
      `Slot: ${booking.slot}`,
    ].join("\n"),
    link: "",
  });
}
