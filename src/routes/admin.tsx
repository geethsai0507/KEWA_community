import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/hall/firebase";
import { approveBooking, rejectApproval, verifyPayment, rejectPayment } from "@/lib/hall/transactions";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import type { BookingDoc } from "@/lib/hall/types";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type AdminTab = "pending-approval" | "pending-verification" | "all-bookings" | "blocked-dates" | "members" | "email-settings";

function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<AdminTab>("pending-approval");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="bg-background text-on-surface min-h-screen">
        <SiteHeader active="gatherings" />
        <main className="pt-32 pb-xl px-margin-mobile md:px-margin-desktop max-w-md mx-auto space-y-4">
          <h1 className="font-headline text-headline-lg text-primary">Admin Sign In</h1>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 border-2 border-primary bg-surface" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-4 border-2 border-primary bg-surface" />
          {loginError && <p className="text-error text-sm">{loginError}</p>}
          <button
            onClick={async () => {
              setLoginError("");
              try {
                await signInWithEmailAndPassword(auth, email, password);
              } catch {
                setLoginError("Invalid email or password.");
              }
            }}
            className="w-full px-8 py-4 bg-primary text-on-primary font-ui-button"
          >
            Sign In
          </button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const TABS: { id: AdminTab; label: string }[] = [
    { id: "pending-approval", label: "Pending Approval" },
    { id: "pending-verification", label: "Pending Verification" },
    { id: "all-bookings", label: "All Bookings" },
    { id: "blocked-dates", label: "Blocked Dates" },
    { id: "members", label: "Members" },
    { id: "email-settings", label: "Email Settings" },
  ];

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <SiteHeader active="gatherings" />
      <main className="pt-32 pb-xl px-margin-mobile md:px-margin-desktop max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-lg">
          <h1 className="font-headline text-headline-lg text-primary">Admin: Hall Booking</h1>
          <button onClick={() => signOut(auth)} className="px-4 py-2 border-2 border-primary font-ui-button">Sign Out</button>
        </div>
        <div role="tablist" className="flex flex-wrap gap-2 mb-lg border-b-2 border-primary">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 font-ui-button text-sm ${tab === t.id ? "bg-primary text-on-primary" : "text-primary hover:bg-primary-container hover:text-on-primary"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "pending-approval" && <PendingApprovalTab />}
        {tab === "pending-verification" && <PendingVerificationTab />}
        {tab === "all-bookings" && <AllBookingsTab />}
        {tab === "blocked-dates" && <BlockedDatesTab />}
        {tab === "members" && <MembersTab />}
        {tab === "email-settings" && <EmailSettingsTab />}
      </main>
      <SiteFooter />
    </div>
  );
}

function useBookingsByStatus(status: string) {
  const [bookings, setBookings] = useState<(BookingDoc & { bookingId: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const q = query(collection(db, "bookings"), where("status", "==", status));
    const snap = await getDocs(q);
    setBookings(snap.docs.map((d) => ({ ...(d.data() as BookingDoc), bookingId: d.id })));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return { bookings, loading, reload };
}

function PendingApprovalTab() {
  const { bookings, loading, reload } = useBookingsByStatus("pending-approval");

  if (loading) return <p>Loading…</p>;
  if (bookings.length === 0) return <p className="opacity-60">Nothing pending approval.</p>;

  return (
    <div className="space-y-4">
      {bookings.map((b) => (
        <div key={b.bookingId} className="brutalist-card p-4 bg-surface flex justify-between items-center">
          <div>
            <p className="font-bold">{b.venue} — {b.date} ({b.slot})</p>
            <p className="text-sm opacity-70">{b.name} · {b.empId} · {b.phone}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => { await approveBooking(b.bookingId); await reload(); }} className="px-4 py-2 bg-primary text-on-primary font-ui-button text-sm">Approve</button>
            <button onClick={async () => { await rejectApproval(b.bookingId); await reload(); }} className="px-4 py-2 border-2 border-primary text-primary font-ui-button text-sm">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PendingVerificationTab() {
  const { bookings, loading, reload } = useBookingsByStatus("pending-verification");

  if (loading) return <p>Loading…</p>;
  if (bookings.length === 0) return <p className="opacity-60">Nothing awaiting payment verification.</p>;

  return (
    <div className="space-y-4">
      {bookings.map((b) => (
        <div key={b.bookingId} className="brutalist-card p-4 bg-surface flex justify-between items-center">
          <div>
            <p className="font-bold">{b.venue} — {b.date} ({b.slot})</p>
            <p className="text-sm opacity-70">{b.name} · ₹{b.amount} · UTR: {b.utr}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => { await verifyPayment(b.bookingId); await reload(); }} className="px-4 py-2 bg-primary text-on-primary font-ui-button text-sm">Verify</button>
            <button onClick={async () => { await rejectPayment(b.bookingId); await reload(); }} className="px-4 py-2 border-2 border-primary text-primary font-ui-button text-sm">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AllBookingsTab() { return <p>Loading…</p>; }
function BlockedDatesTab() { return <p>Loading…</p>; }
function MembersTab() { return <p>Loading…</p>; }
function EmailSettingsTab() { return <p>Loading…</p>; }
