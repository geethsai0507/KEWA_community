import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Icon, SiteHeader, SiteFooter } from "@/components/site-chrome";
import { VENUES, SLOTS, UPI_ID } from "@/lib/hall/constants";
import { subscribeToCalendar, type DayStatus } from "@/lib/hall/calendar";
import { verifyMembership } from "@/lib/hall/members";
import { calculateBookingFee } from "@/lib/hall/fees";
import { createBooking, submitUtr } from "@/lib/hall/transactions";

export const Route = createFileRoute("/hall")({
  head: () => ({
    meta: [
      { title: "Hall Booking & Calendar — Executives Club Community" },
      {
        name: "description",
        content:
          "Check hall availability, book the Executives Club community hall in four quick steps, and review rates and rules.",
      },
      { property: "og:title", content: "Hall Booking & Calendar — Executives Club Community" },
      {
        property: "og:description",
        content:
          "Reserve the Executives Club community hall, review your bookings and see the house rules.",
      },
    ],
  }),
  component: HallPage,
});

type Tab = "calendar" | "booking" | "my-bookings" | "rules";

const TABS: { id: Tab; label: string }[] = [
  { id: "calendar", label: "Hall Status" },
  { id: "booking", label: "Book the Hall" },
  { id: "my-bookings", label: "My Bookings" },
  { id: "rules", label: "Rules & Rates" },
];

function HallPage() {
  const [tab, setTab] = useState<Tab>("calendar");

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <SiteHeader active="gatherings" />

      <main className="pt-32 pb-s-xl px-margin-mobile md:px-margin-desktop max-w-7xl mx-auto">
        <div role="tablist" aria-label="Hall Management Tabs" className="flex flex-wrap gap-2 mb-s-lg border-b-2 border-primary">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`px-6 py-3 font-ui-button text-lg transition-all focus:outline-none ${
                  active
                    ? "bg-primary text-on-primary border-t-2 border-x-2 border-primary"
                    : "text-primary hover:bg-primary-container hover:text-on-primary"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "calendar" && <CalendarPanel />}
        {tab === "booking" && <BookingPanel />}
        {tab === "my-bookings" && <MyBookingsPanel />}
        {tab === "rules" && <RulesPanel />}
      </main>

      <SiteFooter />

      <button
        aria-label="Help"
        className="fixed bottom-8 right-8 w-14 h-14 bg-secondary-container text-on-surface flex items-center justify-center border-2 border-primary brutalist-button z-50"
      >
        <Icon name="help" />
      </button>
    </div>
  );
}

function CalendarPanel() {
  const [venue, setVenue] = useState<string>(VENUES[0].name);
  const [cursor, setCursor] = useState(() => new Date());
  const [byDate, setByDate] = useState<Record<string, { Morning: DayStatus; Evening: DayStatus }>>({});

  useEffect(() => {
    const unsubscribe = subscribeToCalendar(venue, cursor.getFullYear(), cursor.getMonth(), setByDate);
    return unsubscribe;
  }, [venue, cursor]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const dotForStatus = (s: DayStatus) =>
    s === "confirmed"
      ? "status-dot-full"
      : s === "held"
        ? "status-dot-evening"
        : s === "pending"
          ? "status-dot-morning"
          : s === "blocked"
            ? "bg-on-surface/40"
            : "border border-primary";

  // Most-restrictive-wins: a day shows one dot summarizing both slots, so a fully booked
  // slot always outranks a still-available one.
  const PRIORITY: DayStatus[] = ["confirmed", "held", "pending", "blocked", "available"];
  const worstStatus = (status: { Morning: DayStatus; Evening: DayStatus }) =>
    PRIORITY.find((s) => status.Morning === s || status.Evening === s) ?? "available";

  const dayCell = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const status = byDate[dateStr] ?? { Morning: "available" as DayStatus, Evening: "available" as DayStatus };
    const overall = worstStatus(status);
    return (
      <div key={day} className="bg-surface p-4 min-h-[120px] relative group hover:bg-surface-variant transition-colors">
        <span className="font-headline text-headline-md text-primary opacity-30">{day}</span>
        <div className="absolute bottom-4 left-4">
          <div
            className={`w-4 h-4 rounded-full ${dotForStatus(overall)}`}
            title={`Morning: ${status.Morning}, Evening: ${status.Evening}`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-s-md">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="font-headline text-headline-lg text-primary">Availability Calendar</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="p-2 border-2 border-primary bg-surface font-ui-button"
          >
            {VENUES.map((v) => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 border-2 border-primary"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              ←
            </button>
            <span className="font-bold">{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
            <button
              className="px-3 py-1 border-2 border-primary"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              →
            </button>
          </div>
          <div className="flex items-center gap-4 text-label-md">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full status-dot-morning"></span> Pending approval</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full status-dot-evening"></span> Held (payment window)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full status-dot-full"></span> Confirmed</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 border-2 border-primary bg-primary gap-[2px]">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="bg-primary-container text-on-primary p-3 text-center font-bold uppercase text-xs">{d}</div>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`pad-${i}`} className="bg-surface" />)}
        {Array.from({ length: daysInMonth }, (_, i) => dayCell(i + 1))}
      </div>
    </div>
  );
}

function UpiQrCode({ amount, bookingNumber }: { amount: number; bookingNumber: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const uri = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent("Executives Club")}&am=${amount}&cu=INR&tn=${encodeURIComponent(bookingNumber)}`;
    let cancelled = false;
    QRCode.toDataURL(uri, { margin: 1, width: 220 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [amount, bookingNumber]);

  if (!dataUrl) return null;
  return <img src={dataUrl} alt="Scan to pay via UPI" width={220} height={220} className="border-2 border-primary" />;
}

type BookingStep = 1 | 2 | 3 | 4;

interface BookingFormState {
  isMember: boolean | null;
  empId: string;
  verified: boolean;
  name: string;
  phone: string;
  email: string;
  venue: string;
  date: string;
  slot: "Morning" | "Evening" | null;
  purpose: string;
  duration: string;
  acceptedTnc: boolean;
}

const EMPTY_FORM: BookingFormState = {
  isMember: null,
  empId: "",
  verified: false,
  name: "",
  phone: "",
  email: "",
  venue: "",
  date: "",
  slot: null,
  purpose: "",
  duration: "",
  acceptedTnc: false,
};

function BookingPanel() {
  const [step, setStep] = useState<BookingStep>(1);
  const [form, setForm] = useState<BookingFormState>(EMPTY_FORM);
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ bookingId: string; bookingNumber: string; lookupToken: string; status: "pending-payment" | "pending-approval" } | null>(null);
  const [utr, setUtr] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async () => {
    if (!form.empId.trim()) {
      setVerifyError("Enter your Employee ID");
      return;
    }
    setVerifying(true);
    setVerifyError("");
    try {
      const isMember = await verifyMembership(form.empId.trim());
      if (!isMember) {
        setVerifyError("No member found with this Employee ID");
        return;
      }
      setForm((f) => ({ ...f, verified: true, isMember: true }));
    } finally {
      setVerifying(false);
    }
  };

  const fee = form.venue ? calculateBookingFee(form.isMember === true, form.venue) : null;

  const canProceedStep1 = form.isMember === false || (form.isMember === true && form.verified);
  const canProceedStep2 = Boolean(
    form.name.trim() &&
    /^\d{10}$/.test(form.phone) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.venue &&
    form.date &&
    new Date(`${form.date}T00:00:00`) >= new Date(new Date().toDateString()) &&
    form.slot &&
    form.purpose.trim() &&
    form.duration.trim() &&
    form.acceptedTnc,
  );

  return (
    <div className="flex flex-col lg:flex-row gap-s-lg">
      <div className="flex-grow space-y-s-lg">
        <nav className="flex items-center gap-4 text-sm font-bold uppercase tracking-tighter overflow-x-auto pb-2">
          {(["1. Membership", "2. Details", "3. Payment", "4. Confirmation"] as const).map((label, i) => (
            <span key={label} className={step === i + 1 ? "text-primary whitespace-nowrap" : "text-on-surface/40 whitespace-nowrap"}>
              {label}
            </span>
          ))}
        </nav>

        {step === 1 && (
          <section className="space-y-6">
            <div className="flex gap-4">
              <button
                className={`p-4 border-2 border-primary font-bold ${form.isMember === true ? "bg-primary text-on-primary" : ""}`}
                onClick={() => setForm((f) => ({ ...f, isMember: true }))}
              >
                I'm a member
              </button>
              <button
                className={`p-4 border-2 border-primary font-bold ${form.isMember === false ? "bg-primary text-on-primary" : ""}`}
                onClick={() => setForm((f) => ({ ...f, isMember: false, verified: false }))}
              >
                I'm not a member
              </button>
            </div>
            {form.isMember === true && (
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Employee ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.empId}
                    onChange={(e) => setForm((f) => ({ ...f, empId: e.target.value, verified: false }))}
                    className="flex-grow p-4 border-2 border-primary bg-surface"
                  />
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="px-6 border-2 border-primary bg-secondary-container font-ui-button"
                  >
                    {verifying ? "Verifying…" : "Verify"}
                  </button>
                </div>
                {verifyError && <p className="text-error text-sm">{verifyError}</p>}
                {form.verified && <p className="text-success text-sm">Verified ✅</p>}
              </div>
            )}
            <div className="flex justify-end pt-s-md">
              <button
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className="brutalist-button bg-secondary-container text-on-surface px-12 py-4 font-ui-button text-lg border-2 border-primary disabled:opacity-40"
              >
                Next: Details
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <div className="grid md:grid-cols-2 gap-s-md">
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Full Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Phone (10 digits)</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Venue</label>
                <select value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface">
                  <option value="">Select Venue</option>
                  {VENUES.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Time Slot</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(SLOTS) as Array<"Morning" | "Evening">).map((s) => (
                    <button
                      key={s}
                      onClick={() => setForm((f) => ({ ...f, slot: s }))}
                      className={`p-4 border-2 border-primary font-bold text-sm ${form.slot === s ? "bg-primary text-on-primary" : ""}`}
                    >
                      {SLOTS[s].label} ({SLOTS[s].time})
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <label className="font-ui-button text-primary block">Purpose</label>
              <input type="text" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
              <label className="font-ui-button text-primary block">Expected duration of stay</label>
              <input type="text" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.acceptedTnc} onChange={(e) => setForm((f) => ({ ...f, acceptedTnc: e.target.checked }))} />
              I accept the Terms & Conditions
            </label>
            <div className="flex justify-between pt-s-md">
              <button onClick={() => setStep(1)} className="px-8 py-4 border-2 border-primary font-ui-button">Back</button>
              <button
                disabled={!canProceedStep2 || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  setSubmitError("");
                  try {
                    const result = await createBooking({
                      name: form.name,
                      empId: form.empId,
                      phone: form.phone,
                      email: form.email,
                      venue: form.venue,
                      date: form.date,
                      slot: form.slot!,
                      purpose: form.purpose,
                      duration: form.duration,
                      isMember: form.isMember === true,
                    });
                    setBookingResult(result);
                    setStep(3);
                  } catch (err) {
                    console.error("createBooking failed:", err);
                    setSubmitError(
                      err instanceof Error && err.message === "SLOT_TAKEN"
                        ? "This slot was just taken, please choose another."
                        : err instanceof Error && err.message === "DATE_BLOCKED"
                          ? "This date is blocked for this venue, please choose another."
                          : "Something went wrong, please try again.",
                    );
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="brutalist-button bg-secondary-container text-on-surface px-12 py-4 font-ui-button text-lg border-2 border-primary disabled:opacity-40"
              >
                {submitting ? "Submitting…" : "Next: Review & Pay"}
              </button>
            </div>
            {submitError && <p className="text-error text-sm">{submitError}</p>}
          </section>
        )}

        {step === 3 && bookingResult && (
          <section className="space-y-6">
            {bookingResult.status === "pending-approval" ? (
              <div className="brutalist-card p-6 bg-surface space-y-2">
                <h3 className="font-headline text-headline-md text-primary">Awaiting approval</h3>
                <p>The venue already has a booking that day in the other slot, so an admin needs to review this one first. You'll get an email with payment instructions once it's approved.</p>
                <p className="font-bold">Booking Number: {bookingResult.bookingNumber}</p>
              </div>
            ) : (
              <div className="brutalist-card p-6 bg-surface space-y-4">
                <h3 className="font-headline text-headline-md text-primary">Pay via UPI</h3>
                <p>Amount: <strong>₹{calculateBookingFee(form.isMember === true, form.venue)}</strong></p>
                <p>UPI ID: <strong>{UPI_ID}</strong></p>
                <UpiQrCode
                  amount={calculateBookingFee(form.isMember === true, form.venue)}
                  bookingNumber={bookingResult.bookingNumber}
                />
                <p className="text-sm opacity-70">Scan the QR with any UPI app, or pay manually to the UPI ID above. Complete the payment within 15 minutes, then enter the UTR number below.</p>
                <div className="space-y-2">
                  <label className="font-ui-button text-primary block">UTR Number</label>
                  <input type="text" value={utr} onChange={(e) => setUtr(e.target.value)} className="w-full p-4 border-2 border-primary bg-surface" />
                </div>
                {submitError && <p className="text-error text-sm">{submitError}</p>}
                <button
                  disabled={utr.trim().length < 6 || submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    setSubmitError("");
                    try {
                      await submitUtr(bookingResult.bookingId, utr.trim());
                      setStep(4);
                    } catch (err) {
                      setSubmitError(
                        err instanceof Error && err.message === "EXPIRED"
                          ? "This booking has expired, please start again."
                          : err instanceof Error && err.message === "UTR_ALREADY_USED"
                            ? "This UTR has already been used for another booking."
                            : "Something went wrong, please try again.",
                      );
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="px-12 py-4 bg-primary text-on-primary font-ui-button disabled:opacity-40"
                >
                  {submitting ? "Submitting…" : "I've Paid — Submit UTR"}
                </button>
              </div>
            )}
          </section>
        )}

        {step === 4 && bookingResult && (
          <section className="space-y-4">
            <div className="brutalist-card p-6 bg-surface space-y-2">
              <h3 className="font-headline text-headline-md text-primary">Submitted!</h3>
              <p>Booking Number: <strong>{bookingResult.bookingNumber}</strong></p>
              <p className="text-sm opacity-70">
                We've sent a status link to {form.email}. An admin will verify your payment and confirm the booking shortly.
              </p>
              <button
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setBookingResult(null);
                  setUtr("");
                  setStep(1);
                }}
                className="px-8 py-4 border-2 border-primary font-ui-button"
              >
                Make another booking
              </button>
            </div>
          </section>
        )}
      </div>

      <aside className="w-full lg:w-80 shrink-0">
        <div className="sticky top-32 brutalist-card bg-surface p-6 space-y-6">
          <h3 className="font-headline text-headline-md text-primary border-b-2 border-primary pb-2 uppercase tracking-tighter">Fee</h3>
          <div className="font-headline text-headline-lg text-primary leading-none">
            {fee !== null ? `₹${fee}` : "Select a venue"}
          </div>
        </div>
      </aside>
    </div>
  );
}

function MyBookingsPanel() {
  const steps: { label: string; done?: boolean; current?: boolean; icon: string | null }[] = [
    { label: "Requested", done: true, icon: "check" },
    { label: "Approved", done: true, icon: "check" },
    { label: "Pending Payment", current: true, icon: "payments" },
    { label: "Completed", icon: null },
  ];

  return (
    <div className="max-w-4xl space-y-s-md">
      <div className="flex justify-between items-end">
        <h2 className="font-headline text-headline-lg text-primary">Your History</h2>
        <span className="text-sm opacity-60 font-bold uppercase">Logged in as resident #402</span>
      </div>

      <div className="brutalist-card bg-surface overflow-hidden">
        <div className="bg-primary text-on-primary p-4 flex justify-between items-center">
          <div>
            <span className="text-xs uppercase font-bold opacity-70">Dec 24, 2024</span>
            <h3 className="font-headline text-lg">Christmas Community Brunch</h3>
          </div>
          <span className="px-3 py-1 bg-secondary-container text-on-surface text-[10px] font-extrabold uppercase">Upcoming</span>
        </div>
        <div className="p-6">
          <div className="relative flex justify-between items-center mb-8">
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-primary-container z-0"></div>
            {steps.map((s, i) => (
              <div key={i} className={`relative z-10 bg-surface flex flex-col items-center ${!s.done && !s.current ? "opacity-30" : ""}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-2 ${
                  s.done ? "bg-primary text-on-primary border-primary" :
                  s.current ? "bg-primary-container text-on-primary border-primary" :
                  "border-primary-container"
                }`}>
                  {s.icon && <Icon name={s.icon} className="text-sm" />}
                </span>
                <span className={`text-[10px] font-bold uppercase ${s.current ? "text-primary" : ""}`}>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-2 bg-primary text-on-primary font-ui-button">Pay Now</button>
            <button className="px-6 py-2 border-2 border-primary text-primary font-ui-button hover:bg-surface-variant">Cancel Request</button>
          </div>
        </div>
      </div>

      <div className="brutalist-card bg-surface grayscale opacity-80">
        <div className="p-4 border-b-2 border-primary/20 flex justify-between items-center">
          <div>
            <span className="text-xs uppercase font-bold opacity-50">Oct 12, 2024</span>
            <h3 className="font-headline text-lg opacity-60">Committee Monthly Meet</h3>
          </div>
          <span className="px-3 py-1 border border-success text-success text-[10px] font-extrabold uppercase">Completed</span>
        </div>
      </div>
    </div>
  );
}

function RulesPanel() {
  return (
    <div className="grid md:grid-cols-2 gap-s-lg">
      <div className="space-y-6">
        <h2 className="font-headline text-headline-lg text-primary">Hall Usage Rates</h2>
        <div className="brutalist-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary text-on-primary uppercase text-xs font-bold tracking-widest">
                <th className="p-4">Venue</th><th className="p-4">Member</th><th className="p-4">Non-Member</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {VENUES.map((v, i) => (
                <tr key={v.name} className={`border-b-2 border-primary/10 ${i % 2 === 1 ? "bg-surface-variant/30" : ""}`}>
                  <td className="p-4 font-bold">{v.name}</td>
                  <td className="p-4">₹{v.feeMember.toLocaleString("en-IN")}</td>
                  <td className="p-4">₹{v.feeNonMember.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm opacity-70 italic">* Rate is per slot (Morning {SLOTS.Morning.time} or Evening {SLOTS.Evening.time}).</p>
      </div>
      <div className="space-y-6">
        <h2 className="font-headline text-headline-lg text-primary">Key Terms</h2>
        <ul className="space-y-4">
          <li className="flex gap-4">
            <Icon name="warning" className="text-tertiary" />
            <div>
              <h4 className="font-bold">Cancellation Policy</h4>
              <p className="text-sm opacity-70">100% refund if cancelled 7 days before. 50% refund if cancelled 48 hours before.</p>
            </div>
          </li>
          <li className="flex gap-4">
            <Icon name="volume_off" className="text-primary" />
            <div>
              <h4 className="font-bold">Noise Levels</h4>
              <p className="text-sm opacity-70">Amplified sound is permitted until 10:00 PM only. Fines apply for violations.</p>
            </div>
          </li>
          <li className="flex gap-4">
            <Icon name="cleaning_services" className="text-success" />
            <div>
              <h4 className="font-bold">Maintenance</h4>
              <p className="text-sm opacity-70">Garbage must be segregated. Any damage to furniture will be deducted from security deposit.</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
