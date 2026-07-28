import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon, SiteHeader, SiteFooter } from "@/components/site-chrome";
import { VENUES } from "@/lib/hall/constants";
import { subscribeToCalendar, type DayStatus } from "@/lib/hall/calendar";

export const Route = createFileRoute("/hall")({
  head: () => ({
    meta: [
      { title: "Hall Booking & Calendar — KEWA Community" },
      {
        name: "description",
        content:
          "Check hall availability, book the KEWA community hall in four quick steps, and review rates and rules.",
      },
      { property: "og:title", content: "Hall Booking & Calendar — KEWA Community" },
      {
        property: "og:description",
        content:
          "Reserve the KEWA community hall, review your bookings and see the house rules.",
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

      <main className="pt-32 pb-xl px-margin-mobile md:px-margin-desktop max-w-7xl mx-auto">
        <div role="tablist" aria-label="Hall Management Tabs" className="flex flex-wrap gap-2 mb-lg border-b-2 border-primary">
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

  const dayCell = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const status = byDate[dateStr] ?? { Morning: "available" as DayStatus, Evening: "available" as DayStatus };
    return (
      <div key={day} className="bg-surface p-4 min-h-[120px] relative group hover:bg-surface-variant transition-colors">
        <span className="font-headline text-headline-md text-primary opacity-30">{day}</span>
        <div className="absolute bottom-4 left-4 flex gap-1">
          {(["Morning", "Evening"] as const).map((slot) => (
            <div
              key={slot}
              className={`w-4 h-4 rounded-full ${
                status[slot] === "confirmed"
                  ? "status-dot-full"
                  : status[slot] === "held"
                    ? "status-dot-evening"
                    : status[slot] === "pending"
                      ? "status-dot-morning"
                      : status[slot] === "blocked"
                        ? "bg-on-surface/40"
                        : "border border-primary"
              }`}
              title={`${slot}: ${status[slot]}`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-md">
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

function BookingPanel() {
  return (
    <div className="flex flex-col lg:flex-row gap-lg">
      <div className="flex-grow space-y-lg">
        <nav className="flex items-center gap-4 text-sm font-bold uppercase tracking-tighter overflow-x-auto pb-2">
          <span className="text-primary whitespace-nowrap">1. Date & Slot</span>
          <Icon name="arrow_forward" className="text-xs" />
          <span className="text-on-surface/40 whitespace-nowrap">2. Details</span>
          <Icon name="arrow_forward" className="text-xs" />
          <span className="text-on-surface/40 whitespace-nowrap">3. Add-ons</span>
          <Icon name="arrow_forward" className="text-xs" />
          <span className="text-on-surface/40 whitespace-nowrap">4. Contact</span>
        </nav>

        <section className="space-y-6">
          <div className="grid md:grid-cols-2 gap-md">
            <div className="space-y-2">
              <label className="font-ui-button text-primary block">Select Date</label>
              <input type="date" className="w-full p-4 border-2 border-primary bg-surface focus:ring-0 focus:border-secondary-container" />
            </div>
            <div className="space-y-2">
              <label className="font-ui-button text-primary block">Time Slot</label>
              <div className="grid grid-cols-2 gap-2">
                <button className="p-4 border-2 border-primary font-bold text-sm hover:bg-primary-container hover:text-on-primary transition-all">08:00 - 14:00</button>
                <button className="p-4 border-2 border-primary font-bold text-sm bg-primary text-on-primary">16:00 - 22:00</button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="font-ui-button text-primary block">Event Details</label>
            <input type="text" placeholder="e.g., Birthday Party, Community Meeting" className="w-full p-4 border-2 border-primary bg-surface focus:ring-0" />
            <textarea rows={4} placeholder="Special Requirements" className="w-full p-4 border-2 border-primary bg-surface focus:ring-0" />
          </div>

          <div className="space-y-4">
            <label className="font-ui-button text-primary block">Equipment Add-ons</label>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 border-2 border-primary flex flex-col gap-2">
                <Icon name="chair" />
                <span className="font-bold">Extra Chairs</span>
                <input type="number" defaultValue={0} className="border-2 border-primary p-2 text-center" />
              </div>
              <div className="p-4 border-2 border-primary flex flex-col gap-2">
                <Icon name="podium" />
                <span className="font-bold">Sound System</span>
                <button className="border-2 border-primary p-2 font-ui-button hover:bg-primary-container hover:text-on-primary">Add ₹1500</button>
              </div>
              <div className="p-4 border-2 border-primary flex flex-col gap-2">
                <Icon name="ac_unit" />
                <span className="font-bold">Full AC</span>
                <button className="border-2 border-primary p-2 font-ui-button hover:bg-primary-container hover:text-on-primary">Add ₹2000</button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-md">
            <button className="brutalist-button bg-secondary-container text-on-surface px-12 py-4 font-ui-button text-lg border-2 border-primary hover:bg-primary hover:text-on-primary transition-all flex items-center gap-3">
              Next: Review Details <Icon name="arrow_forward" />
            </button>
          </div>
        </section>
      </div>

      <aside className="w-full lg:w-80 shrink-0">
        <div className="sticky top-32 brutalist-card bg-surface p-6 space-y-6">
          <h3 className="font-headline text-headline-md text-primary border-b-2 border-primary pb-2 uppercase tracking-tighter">Cost Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Base Rental (Slot B)</span><span className="font-bold">₹4,500</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Security Deposit</span><span className="font-bold text-tertiary">₹2,000</span>
            </div>
            <div className="flex justify-between text-sm text-success">
              <span>Member Discount (10%)</span><span className="font-bold">-₹450</span>
            </div>
          </div>
          <div className="border-t-2 border-primary pt-4 flex justify-between items-end">
            <div>
              <div className="text-[10px] font-bold uppercase opacity-60">Total Estimated</div>
              <div className="font-headline text-headline-lg text-primary leading-none">₹6,050</div>
            </div>
            <div className="text-[10px] text-right font-bold opacity-60 uppercase">*Tax calculated at checkout</div>
          </div>
          <div className="bg-primary-container/10 p-3 border-l-4 border-primary text-xs">
            Note: Deposits are fully refundable within 48 hours of event completion, subject to damage assessment.
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
    <div className="max-w-4xl space-y-md">
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
    <div className="grid md:grid-cols-2 gap-lg">
      <div className="space-y-6">
        <h2 className="font-headline text-headline-lg text-primary">Hall Usage Rates</h2>
        <div className="brutalist-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary text-on-primary uppercase text-xs font-bold tracking-widest">
                <th className="p-4">Slot</th><th className="p-4">Resident</th><th className="p-4">Guest</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b-2 border-primary/10"><td className="p-4 font-bold">Morning (8AM-2PM)</td><td className="p-4">₹3,500</td><td className="p-4">₹7,000</td></tr>
              <tr className="border-b-2 border-primary/10 bg-surface-variant/30"><td className="p-4 font-bold">Evening (4PM-10PM)</td><td className="p-4">₹5,000</td><td className="p-4">₹9,500</td></tr>
              <tr className="border-b-2 border-primary/10"><td className="p-4 font-bold">Full Day</td><td className="p-4">₹8,000</td><td className="p-4">₹15,000</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm opacity-70 italic">* Rates exclude cleaning charges (₹500 fixed) and electricity (per unit).</p>
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
