import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/hall/firebase";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

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

function PendingApprovalTab() { return <p>Loading…</p>; }
function PendingVerificationTab() { return <p>Loading…</p>; }
function AllBookingsTab() { return <p>Loading…</p>; }
function BlockedDatesTab() { return <p>Loading…</p>; }
function MembersTab() { return <p>Loading…</p>; }
function EmailSettingsTab() { return <p>Loading…</p>; }
