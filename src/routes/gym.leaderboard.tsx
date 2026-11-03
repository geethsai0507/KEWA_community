import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { useAuth } from "@/components/auth-context";
import { fetchMonthVisits } from "@/lib/gym/store";
import { buildLeaderboard, type LeaderboardRow } from "@/lib/gym/leaderboard";
import { formatMinutes, istMonthKey, istMonthRange } from "@/lib/gym/time";
import { useMemberHash } from "@/lib/gym/use-member-hash";

export const Route = createFileRoute("/gym/leaderboard")({
  head: () => ({ meta: [{ title: "Gym Leaderboard — Executives Club" }] }),
  component: GymLeaderboardPage,
});

/** The current IST month and the 11 before it, newest first. */
function recentMonths(now: Date): string[] {
  const months: string[] = [];
  let key = istMonthKey(now);
  for (let i = 0; i < 12; i++) {
    months.push(key);
    key = istMonthKey(new Date(istMonthRange(key).start.getTime() - 1));
  }
  return months;
}

const monthLabel = (key: string) =>
  new Date(`${key}-15T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

function GymLeaderboardPage() {
  const { verified, empId, requireLogin } = useAuth();
  const memberHash = useMemberHash(verified ? empId : null);
  const months = useMemo(() => recentMonths(new Date()), []);
  const [month, setMonth] = useState(months[0]);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!verified) requireLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified]);

  useEffect(() => {
    if (!verified) return;
    let cancelled = false;
    setRows(null);
    setError(false);
    fetchMonthVisits(month)
      .then((visits) => !cancelled && setRows(buildLeaderboard(visits, new Date())))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [month, verified]);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <SiteHeader active="gym" />
      <main className="pt-32 pb-s-xl px-margin-mobile md:px-margin-desktop flex-1 w-full max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-s-lg">
          <h1 className="font-headline text-headline-lg text-primary">Gym Leaderboard</h1>
          {verified && (
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Month"
              className="border-2 border-primary bg-surface px-4 py-2 font-ui-button text-ui-button"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          )}
        </div>

        {!verified ? (
          <div className="brutalist-card bg-surface-container p-8 text-center space-y-6">
            <p>Members only — log in to see the leaderboard.</p>
            <button
              onClick={() => requireLogin()}
              className="bg-primary text-on-primary font-ui-button text-ui-button px-8 py-4 uppercase tracking-widest"
            >
              Login
            </button>
          </div>
        ) : error ? (
          <p className="text-error">Something went wrong, try again.</p>
        ) : rows === null ? (
          <p className="text-on-surface-variant">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-on-surface-variant">No gym time logged this month yet.</p>
        ) : (
          <div className="brutalist-card bg-surface-container overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-primary font-ui-button text-xs sm:text-sm uppercase tracking-wider text-on-surface-variant">
                  <th className="py-3 pl-4 pr-2 w-12">#</th>
                  <th className="py-3 px-2">Member</th>
                  <th className="py-3 px-2 text-right">Time</th>
                  <th className="py-3 pl-2 pr-4 text-right">Visits</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const mine = r.memberHash === memberHash;
                  return (
                    <tr
                      key={r.memberHash}
                      className={`border-b border-outline-variant ${mine ? "bg-primary/15 font-bold" : ""}`}
                    >
                      <td className="py-3 pl-4 pr-2 text-primary font-bold">{r.rank}</td>
                      <td className="py-3 px-2">
                        {r.displayName}
                        {mine && <span className="ml-2 text-xs uppercase text-primary">You</span>}
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        {formatMinutes(r.minutes)}
                      </td>
                      <td className="py-3 pl-2 pr-4 text-right">{r.visits}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
