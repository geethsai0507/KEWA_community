import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/hall/firebase";
import { cancelBookingSelf } from "@/lib/hall/transactions";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import type { BookingDoc, BookingLookupDoc } from "@/lib/hall/types";

export const Route = createFileRoute("/hall/status")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: StatusPage,
});

function StatusPage() {
  const { token } = Route.useSearch();
  const [booking, setBooking] = useState<(BookingDoc & { bookingId: string }) | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setError("No status token provided.");
        setLoading(false);
        return;
      }
      // bookingLookup's doc ID is the token itself — a get() by a value the caller must
      // already know, never a list(), which is what keeps bookingId non-enumerable (see
      // Task 6's design note and firestore.rules).
      const lookupSnap = await getDoc(doc(db, "bookingLookup", token));
      if (!lookupSnap.exists()) {
        if (!cancelled) {
          setError("No booking found for this link.");
          setLoading(false);
        }
        return;
      }
      const bookingId = (lookupSnap.data() as BookingLookupDoc).bookingId;
      const bookingSnap = await getDoc(doc(db, "bookings", bookingId));
      if (!cancelled) {
        if (bookingSnap.exists()) {
          setBooking({ ...(bookingSnap.data() as BookingDoc), bookingId });
        } else {
          setError("No booking found for this link.");
        }
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canSelfCancel = booking && (booking.status === "confirmed" || booking.status === "pending-payment");

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <SiteHeader active="gatherings" />
      <main className="pt-32 pb-s-xl px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto">
        <h1 className="font-headline text-headline-lg text-primary mb-s-lg">Booking Status</h1>
        {loading && <p>Loading…</p>}
        {error && <p className="text-error">{error}</p>}
        {booking && (
          <div className="brutalist-card p-6 bg-surface space-y-3">
            <p><strong>Booking Number:</strong> {booking.bookingNumber}</p>
            <p><strong>Venue:</strong> {booking.venue}</p>
            <p><strong>Date:</strong> {booking.date}</p>
            <p><strong>Slot:</strong> {booking.slot}</p>
            <p><strong>Status:</strong> {booking.status}</p>
            {canSelfCancel && (
              <button
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true);
                  try {
                    await cancelBookingSelf(booking.bookingId);
                    setBooking({ ...booking, status: "cancelled" });
                  } finally {
                    setCancelling(false);
                  }
                }}
                className="px-6 py-2 border-2 border-primary text-primary font-ui-button hover:bg-surface-variant"
              >
                {cancelling ? "Cancelling…" : "Cancel this booking"}
              </button>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
