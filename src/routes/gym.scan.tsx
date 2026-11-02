import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Icon, SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useAuth } from "@/components/auth-context";
import { getOrCreateDeviceId } from "@/lib/gym/device";
import { performScan, type ScanResult } from "@/lib/gym/scan";
import { formatIstTime, formatMinutes } from "@/lib/gym/time";

export const Route = createFileRoute("/gym/scan")({
  head: () => ({ meta: [{ title: "Gym Check-in — Executives Club" }] }),
  component: GymScanPage,
});

const MISMATCH_COPY = "This member's gym check-ins are linked to another phone — ask an admin to reset.";
const OVER_CAP_COPY = "This visit was over 3 hours, so it's counted as a missed check-out. Just arriving? Scan again to check in.";

type State = { kind: "idle" } | { kind: "running" } | { kind: "done"; result: ScanResult } | { kind: "error" };

function GymScanPage() {
  const { verified, empId, requireLogin, logout } = useAuth();
  const [state, setState] = useState<State>({ kind: "idle" });
  // The scan for a given login must run exactly once (StrictMode double-invokes effects).
  const scannedFor = useRef<string | null>(null);

  const run = async (id: string) => {
    setState({ kind: "running" });
    try {
      const result = await performScan(id, getOrCreateDeviceId(localStorage));
      setState({ kind: "done", result });
    } catch {
      setState({ kind: "error" });
    }
  };

  useEffect(() => {
    if (!verified || !empId) {
      requireLogin();
      return;
    }
    if (scannedFor.current === empId) return;
    scannedFor.current = empId;
    void run(empId);
    // requireLogin is recreated each render; only login changes should trigger a scan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified, empId]);

  const switchMember = () => {
    scannedFor.current = null;
    setState({ kind: "idle" });
    logout();
    requireLogin();
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <SiteHeader active="gym" />
      <main className="pt-32 pb-s-xl px-margin-mobile md:px-margin-desktop flex-1 w-full max-w-xl mx-auto">
        <p className="font-ui-button text-ui-button uppercase tracking-widest text-on-surface-variant mb-2">Gym check-in</p>

        {(!verified || !empId) && (
          <div className="brutalist-card bg-surface-container p-8 space-y-6 text-center">
            <h1 className="font-headline text-headline-lg text-primary">Log in to record your gym visit</h1>
            <button
              onClick={() => requireLogin()}
              className="w-full bg-primary text-on-primary font-ui-button text-ui-button px-8 py-4 uppercase tracking-widest"
            >
              Login
            </button>
          </div>
        )}

        {verified && empId && (
          <div className="brutalist-card bg-surface-container p-8 space-y-6 text-center">
            {state.kind === "done" && (
              <p className="text-sm text-on-surface-variant">
                Recording for <strong className="text-on-background">{state.result.displayName}</strong> —{" "}
                <button onClick={switchMember} className="underline text-primary">
                  Not you? Switch
                </button>
              </p>
            )}

            {(state.kind === "idle" || state.kind === "running") && (
              <h1 className="font-headline text-headline-lg text-primary">Recording…</h1>
            )}

            {state.kind === "error" && (
              <>
                <h1 className="font-headline text-headline-lg text-error">Something went wrong, try again.</h1>
                <button
                  onClick={() => void run(empId)}
                  className="w-full bg-primary text-on-primary font-ui-button text-ui-button px-8 py-4 uppercase tracking-widest"
                >
                  Retry
                </button>
                <button onClick={switchMember} className="text-sm underline text-primary">
                  Not you? Switch
                </button>
              </>
            )}

            {state.kind === "done" && <ResultView result={state.result} />}

            <Link
              to="/gym/leaderboard"
              className="inline-flex items-center gap-2 font-ui-button text-ui-button text-primary hover:underline"
            >
              View leaderboard <Icon name="arrow_forward" />
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function ResultView({ result }: { result: ScanResult }) {
  switch (result.kind) {
    case "device-mismatch":
      return <h1 className="font-headline text-headline-lg text-error">{MISMATCH_COPY}</h1>;
    case "checked-in":
      return (
        <>
          <Icon name="login" className="text-6xl text-primary" />
          <h1 className="font-display text-display-lg-mobile text-primary">Checked in at {formatIstTime(result.at)}</h1>
          <p className="text-on-surface-variant">Today so far: {formatMinutes(result.todayMinutes)}</p>
        </>
      );
    case "checked-out":
      return result.overCap ? (
        <h1 className="font-headline text-headline-lg text-error">{OVER_CAP_COPY}</h1>
      ) : (
        <>
          <Icon name="logout" className="text-6xl text-primary" />
          <h1 className="font-display text-display-lg-mobile text-primary">
            Checked out — {formatMinutes(result.minutes)} this visit
          </h1>
          <p className="text-on-surface-variant">{formatMinutes(result.todayMinutes)} today</p>
        </>
      );
    case "ignored":
      return (
        <>
          <h1 className="font-headline text-headline-lg text-primary">
            You already {result.last === "check-in" ? "checked in" : "checked out"} at {formatIstTime(result.at)}
          </h1>
          <p className="text-on-surface-variant">{formatMinutes(result.todayMinutes)} today</p>
        </>
      );
  }
}
