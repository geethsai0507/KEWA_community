import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/hall/firebase";
import { approveBooking, rejectApproval, verifyPayment, rejectPayment, cancelBookingAdmin, expireStaleBooking } from "@/lib/hall/transactions";
import { isExpiredPendingPayment } from "@/lib/hall/conflict";
import { slotDocId } from "@/lib/hall/slotKey";
import { VENUES } from "@/lib/hall/constants";
import * as XLSX from "xlsx";
import { uploadMembers } from "@/lib/hall/members";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import type { BookingDoc, BlockedDateDoc } from "@/lib/hall/types";

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

function AllBookingsTab() {
  const [bookings, setBookings] = useState<(BookingDoc & { bookingId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const reload = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "bookings"));
    const loaded = snap.docs.map((d) => ({ ...(d.data() as BookingDoc), bookingId: d.id }));

    // Two admin-side sweeps, both syncing bookingSlots from state the admin panel already has
    // authenticated access to.
    const now = Date.now();
    for (const b of loaded) {
      if (isExpiredPendingPayment(b.status, b.expiresAt, now)) {
        // Stale-payment expiry: the calendar deliberately no longer triggers this write itself
        // (see Task 12), since doing so would have required bookingSlots to carry a bookingId
        // pointer, which is a PII-leak risk once that collection is publicly listable. Safe to
        // blindly retry — expireStaleBooking re-checks the booking's live status, and once
        // expired it can never match this branch's condition again.
        void expireStaleBooking(b.bookingId);
        b.status = "expired"; // optimistic local update so the UI doesn't wait for the write
      } else if (b.status === "cancelled") {
        // Self-cancel sync: cancelBookingSelf (Task 10) can't write bookingSlots itself, since
        // it's called anonymously and bookingSlots' deterministic ID is public/guessable — a
        // rule permitting that write for anyone would let a stranger free or tamper with a
        // slot they have no connection to. The admin write below is authorized via isAdmin(),
        // no new rule needed. Unlike expiry, "cancelled" matches forever on every reload, so
        // this must verify occupiedSince still matches THIS booking before writing, or a
        // stale sweep could stomp a different, newer booking that has since claimed the slot.
        const slotRef = doc(db, "bookingSlots", slotDocId(b.venue, b.date, b.slot));
        void getDoc(slotRef).then((slotSnap) => {
          if (slotSnap.exists() && slotSnap.data().occupiedSince?.isEqual(b.occupiedSince)) {
            void updateDoc(slotRef, { status: "cancelled" }).catch(() => {});
          }
        });
      }
    }

    setBookings(loaded);
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  if (loading) return <p>Loading…</p>;

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div className="space-y-4">
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className="p-2 border-2 border-primary bg-surface">
        <option value="all">All statuses</option>
        <option value="pending-approval">Pending Approval</option>
        <option value="pending-payment">Pending Payment</option>
        <option value="pending-verification">Pending Verification</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
        <option value="expired">Expired</option>
      </select>
      {filtered.map((b) => (
        <div key={b.bookingId} className="brutalist-card p-4 bg-surface flex justify-between items-center">
          <div>
            <p className="font-bold">{b.venue} — {b.date} ({b.slot}) — {b.status}</p>
            <p className="text-sm opacity-70">{b.name} · {b.empId} · {b.phone}</p>
          </div>
          {b.status !== "cancelled" && b.status !== "expired" && (
            <button
              onClick={async () => { await cancelBookingAdmin(b.bookingId); await reload(); }}
              className="px-4 py-2 border-2 border-primary text-primary font-ui-button text-sm"
            >
              Force Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function BlockedDatesTab() {
  const [blocked, setBlocked] = useState<(BlockedDateDoc & { docId: string })[]>([]);
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("all");
  const [reason, setReason] = useState("");

  const reload = async () => {
    const snap = await getDocs(collection(db, "blockedDates"));
    setBlocked(snap.docs.map((d) => ({ ...(d.data() as BlockedDateDoc), docId: d.id })));
  };

  useEffect(() => { void reload(); }, []);

  return (
    <div className="space-y-6">
      <div className="brutalist-card p-4 bg-surface space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="p-2 border-2 border-primary bg-surface" />
          <select value={venue} onChange={(e) => setVenue(e.target.value)} className="p-2 border-2 border-primary bg-surface">
            <option value="all">All Venues</option>
            {VENUES.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
          <input type="text" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="p-2 border-2 border-primary bg-surface" />
        </div>
        <button
          onClick={async () => {
            if (!date || !reason.trim()) return;
            await addDoc(collection(db, "blockedDates"), { date, venue, reason: reason.trim(), createdAt: serverTimestamp() });
            setDate(""); setReason("");
            await reload();
          }}
          className="px-4 py-2 bg-primary text-on-primary font-ui-button text-sm"
        >
          Block Date
        </button>
      </div>
      {blocked.map((b) => (
        <div key={b.docId} className="flex justify-between items-center p-2 border-b-2 border-primary/10">
          <span>{b.date} — {b.venue === "all" ? "All Venues" : b.venue} — {b.reason}</span>
          <button
            onClick={async () => { await deleteDoc(doc(db, "blockedDates", b.docId)); await reload(); }}
            className="px-3 py-1 border-2 border-primary text-primary text-sm"
          >
            Unblock
          </button>
        </div>
      ))}
    </div>
  );
}
function MembersTab() {
  const [status, setStatus] = useState("");

  const handleFile = async (file: File) => {
    setStatus("Parsing…");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<{ empId: string; name: string; phone: string }>(sheet);
    setStatus(`Uploading ${rows.length} members…`);
    await uploadMembers(rows);
    setStatus(`Uploaded ${rows.length} members.`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-70">Upload an Excel file with columns: empId, name, phone.</p>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {status && <p>{status}</p>}
    </div>
  );
}

function EmailSettingsTab() {
  return (
    <div className="space-y-2 max-w-lg">
      <p className="text-sm opacity-70">
        EmailJS service ID, template IDs, public key, and the admin notification address are configured via
        environment variables (see <code>.env.example</code>) rather than an in-app form, since they're
        build-time configuration for this static deployment, not per-tenant runtime settings.
      </p>
    </div>
  );
}
