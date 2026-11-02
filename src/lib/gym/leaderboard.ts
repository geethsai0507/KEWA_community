import { memberTotal, visitMinutes, type GymVisit } from "./visits";

export interface LeaderboardRow {
  memberHash: string;
  displayName: string;
  minutes: number;
  visits: number;
  rank: number;
}

export function buildLeaderboard(visits: GymVisit[], now: Date): LeaderboardRow[] {
  const byMember = new Map<string, GymVisit[]>();
  for (const v of visits) {
    const list = byMember.get(v.memberHash);
    if (list) list.push(v);
    else byMember.set(v.memberHash, [v]);
  }

  const rows: Omit<LeaderboardRow, "rank">[] = [];
  for (const [memberHash, list] of byMember) {
    const minutes = memberTotal(list, now);
    if (minutes === 0) continue;
    const latest = list.reduce((a, b) => (b.inAt > a.inAt ? b : a));
    rows.push({
      memberHash,
      displayName: latest.displayName,
      minutes,
      visits: list.filter((v) => visitMinutes(v, now) > 0).length,
    });
  }

  rows.sort((a, b) => b.minutes - a.minutes || a.displayName.localeCompare(b.displayName));
  // Competition ranking: ties share a rank and the next rank is skipped (1, 1, 3).
  const ranked: LeaderboardRow[] = [];
  rows.forEach((row, i) => {
    const prev = ranked[i - 1];
    ranked.push({ ...row, rank: prev && prev.minutes === row.minutes ? prev.rank : i + 1 });
  });
  return ranked;
}
