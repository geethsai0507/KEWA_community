import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon, SiteHeader, SiteFooter } from "@/components/site-chrome";
import { VENUES } from "@/lib/hall/constants";
import { subscribeToCalendar, type DayStatus } from "@/lib/hall/calendar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Executives Club Community Portal — A neighborhood for everyone" },
      {
        name: "description",
        content:
          "See hall availability, upcoming gatherings, notice board updates and community moments at Executives Club Residential Colony.",
      },
      { property: "og:title", content: "Executives Club Community Portal" },
      {
        property: "og:description",
        content:
          "A neighborhood for everyone. Check the hall, RSVP to gatherings and stay connected.",
      },
    ],
  }),
  component: Home,
});

const HERO_IMG =
  "https://images.unsplash.com/photo-1780402411700-96a84f2f483a?fm=jpg&q=80&w=2000";

const gatherings = [
  {
    tag: "Wellness",
    tagBg: "bg-primary text-on-primary",
    title: "Sunday Yoga",
    time: "07:00 AM",
    place: "Terrace Garden",
    cta: "Register",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCiCTXZKf9SKptoer44OXhCr68fKppLdpgDadQv1jo347Y5ep7Q-jgeOq6gQwqRbDwwuuzkEY-BMZXbrjnnAUAUomTjd2i7Oq1uRRz08woF0yDX24r85yI9OfwSwv_ZhwWQJj87bH0M5ag9FECSnJP1ev_T8vvDYu2krY0AERrZfO5P1yfvzXWgwWlp1h5p6whyUJRGgP6ELwGDTu-WGPBrBpq2fbM6D5kcTNYL5Vj9M5Qr3mCBoSDOQGXEE73bzZZK0mHP_IkYjqQ",
  },
  {
    tag: "Governance",
    tagBg: "bg-tertiary text-on-tertiary",
    title: "Residents Meeting",
    time: "06:30 PM",
    place: "Community Hall",
    cta: "View Agenda",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAwYuIa0in5x2rOtX5gvxIo9J3vAIe2SYWgKX58x5ibQAMIiI7gfZY2OvBmQD5Ev7fDfm-sjmX7w4QM0SlaBAVla5bUI5D1VUgJdp8OwNuAnfRp7pKol9g6Q6l-9JDJWkK2SXt0jyWARLFIGc70cMt7imr9xhd9eZXcvGBvsWp40EDUd34iMVxN_PBgN-af3FdRSyTW35CaETXtIUsX0lzrmLSuH0C-7JEZXeRyduJOWiNpsGIMSpEJB9XB3MwbBMNiwvdjfkmsurA",
  },
  {
    tag: "Kids",
    tagBg: "bg-secondary text-on-secondary",
    title: "Children's Art Fest",
    time: "10:00 AM",
    place: "Central Lawn",
    cta: "More Info",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBZIUWQz55b72MwjLESvlMt4DgIRYQES_ljF9WIittrHLt7qfu0guqKvCpUj7o7av6pgzaE-y79poflsUM2ujSZkgUXZGDErJzotlcsdx7rbowLlz48GTqml6rNgtneqILHAmWCZxPQcijtllWPKFDSkHgfKp3j8hjBlXyae-b3RVIjUy1rrn8SwbpnjILg8JQ9dR_hLZGzHqiT_KnKNCS_gKFSujjdDv6P67QL_MJajzKOD-xJ5Vv0VOFZBaambCc0LCcTpdl7xLY",
  },
];

const gallery = [
  { h: "h-64 md:h-80", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuANz4UL3LvNJIRbtCwnC0NNUF9jcT3tY_g6tgpMLjh8gmPLL5Xq0FQAiX43-SgatEKvcnV2b1OsIcVV9EtXr7TXHro8BVIXpBADO5Gjf9x2FvA7NqoDCH9MpeVqm0cD_xKTj2T8iWnxfGyAZOSzKp_PEBgr6IFP8JBi82t8QTTTz59xxZsHqeWEgvlEsulYdA9ExGxvv_YWF1KqMqXKlebTLWLaoQG7UaRmhLX-6hnXk04VOxiyQDDI7JlrCf-fZEB_wGeVC7lAhwA" },
  { h: "h-96 md:h-[450px]", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDnQGIKLgFeAj3dyGuB1-CGfKkxG11LHoN8u6U77SjZheGIQ-qbZ1PZsjVkx1tciJLkC5yAqSt1X0x4dOUrBKZSYeaKvQC5ZyfJgNzIL2U-drExAFrVKqRKdFTmK4zK5s0MVknDaeYM0AFlaK10dfGLUImNIrgsHluT5TqrSs3q_Fr4YeNhnGlpksctb9pw8aiwa3mjCICTDK0WgPFFcae9F00C6_WeO_QkqSWVr9SwWh3RECiNyMbsMZlQUAnb5iqfQemDDY86Cwo" },
  { h: "h-64", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBnxyWam6X9JuTT713Ru83rKZ0rY9AAeRBZf8RePUgUJwfe9rzrKyFPaw6Zsgw3wf-tqZDiHFLSghv_ovOJ7n67eRlsyPJ9w5tlMUFoYii4G2Tw1RPy1Sb_GYR02PGNy3oPhwev6ZSiZQ-T4p59fSXG_0O2BCFiPSiqH57oT38OFbZ6yhygzTz_ctOJIZHU5yn5ceMWtVJZ-ddWwbI_jhysQjKrLuJxzCV9X9t0w3kStd35gwh7SiJgmDjDycvKvt77YauRcW7EuoY" },
  { h: "h-96", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDvtDTUwnHs5mINHWnqUhjRCsElop2mBsFJkoDoMLckzUQOLuAJdDVN9Yo2xDF3KSitOljGbJ-V7tGrUTn4Ug0A7P3HbQ6yhw9EDlqVRdsc7tXDV0Xt1wd_KvDFdJ9jljkrfocz2O1u92fCL_DGY1R4cZ4MBZB67BWCEddzycMpBG253ImKpRhHaeS9d4oxSuzz6zoGTBaYlqr9TWbuGEuScXz7k2_lQf3E61XfyECfO6YHezKyjnIaWcwwC95jOQ6kMSoOCFjtBNA" },
  { h: "h-64 md:h-80", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBHU7KyFNupeXEhpE2vKYjBbKrMuJTIjk5E5OFpPMaLX9k9f0dKnMldqMfDqVWGupC9OhPYpQv0aMe1E4B8BPaU57519yn9uk5udAnNMV5xWkZ-lOzERu4LrrFtEm9N48xLWobl-_dZKOX6bX3WI-XbbYBHZ6WsdeDTn8sy90pOQ3V4y7i7-zXY3b9D1GgdxfVSIzEooynXBC24A8YwKM1AwK43D0nCjELrYFJI_HDg7q0vDYoXJU9ZACRqTyXWqXZIM1eYUgYzfsk" },
  { h: "h-[300px]", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuD3UZBdVg8jJu0V-BZzVjulQ5XBPfa9FK4_3-kCnWvuSVzgdWnC25w0BefLEBbnAgqTGI-BWNF-PwamB9LcZtMKsC9Di8CRLj3rpGynjLN04j7n4eBZt_fDuwVqhU4CqyTxYZoiCUH0yjBk0xiAlJMZnAltnMpcqHB0jJ0p72rl1yknI9jbnnY1VEWHSpiGwUPfMe2yxe4J5xmzGdzvGisGuUp2bxCIoRxLWfe83AZ0lR2yCvaJrkRNZT1gzX8-dIsEzBSarboOnCI" },
];

const contacts = [
  { title: "Main Security", sub: "Gate 1 & Surveillance", icon: "call", hover: "hover:bg-error hover:text-white" },
  { title: "First Aid / Medical", sub: "On-site Nurse Station", icon: "medical_services", hover: "hover:bg-primary hover:text-white" },
  { title: "Fire Safety", sub: "Internal Response Team", icon: "fire_truck", hover: "hover:bg-secondary hover:text-white" },
  { title: "Electrician / Lift", sub: "Emergency Maintenance", icon: "bolt", hover: "hover:bg-on-surface hover:text-white" },
];

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function summarizeDay(day: { Morning: DayStatus; Evening: DayStatus } | undefined) {
  const morning = day?.Morning ?? "available";
  const evening = day?.Evening ?? "available";
  if (morning === "available" && evening === "available") {
    return { dot: "bg-[#1E4D12]", text: "Available all day" };
  }
  if (morning !== "available" && evening !== "available") {
    return { dot: "bg-error", text: morning === "blocked" || evening === "blocked" ? "Blocked" : "Fully booked" };
  }
  const freeSlot = morning === "available" ? "Morning" : "Evening";
  return { dot: "bg-secondary-container", text: `Partially available (${freeSlot} free)` };
}

function HallAvailabilityWidget() {
  const venue = VENUES[0].name;
  const [byDate, setByDate] = useState<Record<string, { Morning: DayStatus; Evening: DayStatus }>>({});

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);
  const targets = [today, tomorrow, dayAfter];

  useEffect(() => {
    // Subscribe to every distinct (year, month) the 3 target days span, so this still works
    // correctly across a month boundary (e.g. today is the last day of the month).
    const months = new Set(targets.map((d) => `${d.getFullYear()}-${d.getMonth()}`));
    const unsubscribes = Array.from(months).map((key) => {
      const [year, month] = key.split("-").map(Number);
      return subscribeToCalendar(venue, year, month, (monthData) => {
        setByDate((prev) => ({ ...prev, ...monthData }));
      });
    });
    return () => unsubscribes.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue, toDateStr(today)]);

  const labels = ["Today", "Tomorrow", targets[2].toLocaleDateString("en-IN", { weekday: "long" })];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
      {targets.map((d, i) => {
        const dateStr = toDateStr(d);
        const { dot, text } = summarizeDay(byDate[dateStr]);
        return (
          <div key={dateStr} className="brutalist-card p-6 bg-white flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase">{labels[i]}</span>
              <span className={`w-3 h-3 rounded-full ${dot}`}></span>
            </div>
            <div className="font-headline text-headline-md">
              {d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
            </div>
            <p className="font-body text-body-md text-on-surface-variant">{text}</p>
          </div>
        );
      })}
    </div>
  );
}

function Home() {
  return (
    <div className="bg-background text-on-background">
      <SiteHeader active="status" />

      <main className="pt-24">
        {/* Hero */}
        <section className="bg-primary text-on-primary min-h-[870px] flex flex-col md:flex-row items-stretch overflow-hidden relative">
          <div className="flex-1 flex flex-col justify-center px-margin-mobile md:px-margin-desktop py-s-xl z-10">
            <h1 className="hero-headline font-display text-display-lg-mobile md:text-display-lg mb-8 max-w-2xl">
              A neighborhood for everyone.
            </h1>
            <div className="hero-btns flex flex-wrap gap-4" style={{ animationDelay: "0.3s" }}>
              <Link
                to="/hall"
                className="bg-secondary-container text-on-secondary-fixed font-ui-button text-ui-button px-8 py-4 uppercase tracking-widest hover:bg-tertiary-container hover:text-on-tertiary transition-all active:scale-95"
              >
                Check hall availability
              </Link>
              <a
                href="#gatherings"
                className="border-2 border-on-primary text-on-primary font-ui-button text-ui-button px-8 py-4 uppercase tracking-widest hover:bg-on-primary hover:text-primary transition-all active:scale-95"
              >
                See what's on
              </a>
            </div>
          </div>
          <div className="flex-1 relative min-h-[400px]">
            <div className="absolute inset-0 overflow-hidden">
              <img
                className="hero-img w-full h-full object-cover"
                alt="Executives Club community hall building illuminated at night"
                src={HERO_IMG}
              />
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-tertiary-container z-20 flex items-center justify-center">
              <Icon name="celebration" className="text-on-tertiary-container text-6xl md:text-8xl" />
            </div>
          </div>
        </section>

        {/* Hall availability */}
        <section className="px-margin-mobile md:px-margin-desktop py-s-lg bg-surface">
          <div className="flex flex-col md:flex-row gap-gutter justify-between items-end mb-s-lg">
            <h2 className="font-headline text-headline-lg text-primary">Hall Availability</h2>
            <Link to="/hall" className="font-ui-button text-ui-button text-primary flex items-center gap-2 hover:underline">
              View full calendar <Icon name="arrow_forward" />
            </Link>
          </div>
          <HallAvailabilityWidget />
        </section>

        {/* Gatherings */}
        <section id="gatherings" className="bg-secondary-container py-s-xl">
          <div className="px-margin-mobile md:px-margin-desktop">
            <div className="mb-s-lg">
              <h2 className="font-display text-display-lg-mobile md:text-display-lg text-on-secondary-fixed mb-2">
                Upcoming Gatherings
              </h2>
              <p className="font-body text-body-lg text-on-secondary-fixed-variant opacity-80">
                Life in Executives Club is better when shared.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {gatherings.map((g) => (
                <div key={g.title} className="group relative bg-white brutalist-card overflow-hidden hover:-translate-y-2 transition-transform duration-300">
                  <div className="h-48 bg-surface-variant overflow-hidden">
                    <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={g.title} src={g.img} />
                  </div>
                  <div className="p-6">
                    <span className={`inline-block font-label-md text-label-md px-3 py-1 mb-4 uppercase ${g.tagBg}`}>{g.tag}</span>
                    <h3 className="font-headline text-headline-md mb-2">{g.title}</h3>
                    <div className="flex items-center gap-2 text-on-surface-variant font-label-md text-label-md mb-4">
                      <Icon name="schedule" className="text-sm" /> {g.time}
                      <span className="mx-2">•</span>
                      <Icon name="location_on" className="text-sm" /> {g.place}
                    </div>
                    <button className="w-full py-3 border-2 border-primary text-primary font-ui-button text-ui-button uppercase hover:bg-primary hover:text-white transition-colors">
                      {g.cta}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Notice board */}
        <section id="notices" className="px-margin-mobile md:px-margin-desktop py-s-xl">
          <h2 className="font-headline text-headline-lg mb-s-lg text-primary flex items-center gap-4">
            <Icon name="campaign" className="text-4xl" /> Notice Board
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-margin-desktop">
            <div>
              <h3 className="font-label-md text-label-md text-on-surface-variant uppercase mb-6 flex items-center gap-2">
                <Icon name="push_pin" className="text-tertiary" /> Pinned Notices
              </h3>
              <div className="flex flex-col gap-4">
                <div className="p-6 border-l-8 border-tertiary bg-white brutalist-card shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-headline text-headline-md">Club Maintenance</h4>
                    <span className="font-label-md text-label-md text-tertiary">URGENT</span>
                  </div>
                  <p className="font-body text-body-md text-on-surface-variant mb-4">
                    Club facilities will be under maintenance this Saturday from 10:00 AM to 02:00 PM for cleaning.
                  </p>
                  <span className="font-label-md text-label-md text-outline">Posted 2 hours ago</span>
                </div>
                <div className="p-6 border-l-8 border-primary bg-white brutalist-card shadow-sm">
                  <h4 className="font-headline text-headline-md mb-2">New Security Protocols</h4>
                  <p className="font-body text-body-md text-on-surface-variant">
                    Starting Nov 1st, all guest entries must be verified via the Executives Club Resident App.
                  </p>
                  <span className="font-label-md text-label-md text-outline">Posted Oct 20</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-label-md text-label-md text-on-surface-variant uppercase mb-6">Recent Updates</h3>
              <div className="divide-y-2 divide-surface-container-highest">
                {[
                  { t: "Elevator B Service Schedule", d: "Monthly preventative maintenance for Elevator B is scheduled for tomorrow between 2 PM and 4 PM. Please use Elevator A during this period." },
                  { t: "Rainwater Harvesting Update", d: "We've successfully updated the filter systems in the central pit. This will improve collection efficiency by 15%." },
                  { t: "Pet Park Guidelines", d: "Please ensure all pets are leashed when entering or exiting the community gates." },
                ].map((n) => (
                  <details key={n.t} className="group py-4 cursor-pointer">
                    <summary className="flex justify-between items-center font-headline text-headline-md group-open:text-primary">
                      {n.t}
                      <Icon name="expand_more" className="transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="pt-4 font-body text-body-md text-on-surface-variant">{n.d}</div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Gallery */}
        <section id="gallery" className="bg-surface-container-low py-s-xl overflow-hidden">
          <div className="px-margin-mobile md:px-margin-desktop mb-s-lg text-center">
            <h2 className="font-display text-display-lg-mobile md:text-display-lg text-primary">Community Moments</h2>
            <p className="font-body text-body-lg text-on-surface-variant">Captured during our recent festivals and workshops.</p>
          </div>
          <div className="px-margin-mobile md:px-margin-desktop">
            <div className="masonry-grid">
              {gallery.map((g, i) => (
                <div key={i} className={`mb-4 brutalist-card overflow-hidden ${g.h} relative group`}>
                  <img className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" alt="Community moment" src={g.src} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Emergency contacts */}
        <section id="contacts" className="px-margin-mobile md:px-margin-desktop py-s-xl border-y-2 border-primary">
          <div className="flex flex-col lg:flex-row gap-margin-desktop items-start">
            <div className="lg:w-1/3">
              <h2 className="font-headline text-headline-lg text-primary mb-4">Emergency Contacts</h2>
              <p className="font-body text-body-md text-on-surface-variant">
                Quick access to essential services. These lines are available 24/7 for all residents.
              </p>
            </div>
            <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-gutter w-full">
              {contacts.map((c) => (
                <a key={c.title} href="tel:911" className={`brutalist-card p-6 flex justify-between items-center group transition-colors ${c.hover}`}>
                  <div>
                    <div className="font-headline text-headline-md">{c.title}</div>
                    <div className="font-label-md text-label-md opacity-70">{c.sub}</div>
                  </div>
                  <Icon name={c.icon} className="text-3xl" />
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
