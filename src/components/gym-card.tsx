import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@/components/site-chrome";
import { useAuth } from "@/components/auth-context";
import { fetchMonthVisits } from "@/lib/gym/store";
import { buildLeaderboard } from "@/lib/gym/leaderboard";
import { formatIstTime, formatMinutes, istDayKey, istMonthKey } from "@/lib/gym/time";
import { effectiveStatus, memberDayTotals, memberTotal } from "@/lib/gym/visits";
import { useMemberHash } from "@/lib/gym/use-member-hash";

interface Summary {
  today: number;
  month: number;
  rank: number | null;
  inSince: Date | null;
}

export function GymCard() {
  const { verified, empId, requireLogin } = useAuth();
  const memberHash = useMemberHash(verified ? empId : null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!memberHash) return;
    let cancelled = false;
    const now = new Date();
    // One month query serves both the member's numbers and their rank.
    fetchMonthVisits(istMonthKey(now))
      .then((visits) => {
        if (cancelled) return;
        const mine = visits.filter((v) => v.memberHash === memberHash);
        const open = mine.find((v) => effectiveStatus(v, now) === "open");
        setSummary({
          today: memberDayTotals(mine, now).get(istDayKey(now)) ?? 0,
          month: memberTotal(mine, now),
          rank:
            buildLeaderboard(visits, now).find((r) => r.memberHash === memberHash)?.rank ?? null,
          inSince: open?.inAt ?? null,
        });
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [memberHash]);

  return (
    <div className="brutalist-card bg-surface-container p-6 flex flex-col gap-4 h-full overflow-hidden">
      {/* Photo: Jakub Żerdzicki on Unsplash (Unsplash License). */}
      <img
        src="/images/gym-equipment.jpg"
        alt="Dumbbell rack in the club gym"
        loading="lazy"
        className="-mx-6 -mt-6 mb-0 w-[calc(100%+3rem)] max-w-none h-40 object-cover"
      />
      <div className="flex items-center gap-3">
        <Icon name="fitness_center" className="text-3xl text-primary" />
        <h2 className="font-headline text-headline-lg text-primary">Gym</h2>
      </div>
      <p className="text-sm text-on-surface-variant">
        Scan the QR on the gym door to log your time.
      </p>

      {!verified ? (
        <button
          onClick={() => requireLogin()}
          className="mt-auto bg-primary text-on-primary font-ui-button text-ui-button px-6 py-3 uppercase tracking-widest"
        >
          Login
        </button>
      ) : error ? (
        <p className="text-error text-sm">Something went wrong, try again.</p>
      ) : !summary ? (
        <p className="text-on-surface-variant text-sm">Loading…</p>
      ) : (
        <>
          {summary.inSince && (
            <p className="flex items-center gap-2 text-secondary font-bold">
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
              In the gym since {formatIstTime(summary.inSince)}
            </p>
          )}
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-xs uppercase text-on-surface-variant">Today</dt>
              <dd className="font-bold text-primary">{formatMinutes(summary.today)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-on-surface-variant">This month</dt>
              <dd className="font-bold text-primary">{formatMinutes(summary.month)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-on-surface-variant">Rank</dt>
              <dd className="font-bold text-primary">{summary.rank ? `#${summary.rank}` : "—"}</dd>
            </div>
          </dl>
        </>
      )}

      <Link
        to="/gym/leaderboard"
        className="font-ui-button text-ui-button text-primary flex items-center gap-2 hover:underline"
      >
        View leaderboard <Icon name="arrow_forward" />
      </Link>
    </div>
  );
}
