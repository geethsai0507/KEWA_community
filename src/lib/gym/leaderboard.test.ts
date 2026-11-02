import { describe, it, expect } from "vitest";
import { buildLeaderboard } from "./leaderboard";
import type { GymVisit } from "./visits";

const now = new Date("2026-11-20T12:00:00+05:30");
let seq = 0;
function closed(memberHash: string, displayName: string, day: string, minutes: number): GymVisit {
  const inAt = new Date(`2026-11-${day}T07:00:00+05:30`);
  return {
    id: `v${++seq}`,
    memberHash,
    displayName,
    inAt,
    outAt: new Date(inAt.getTime() + minutes * 60_000),
    status: "closed",
  };
}

describe("buildLeaderboard", () => {
  it("ranks members by total minutes", () => {
    const rows = buildLeaderboard(
      [closed("a", "Asha R.", "01", 90), closed("b", "Bala S.", "01", 120)],
      now,
    );
    expect(rows.map((r) => [r.displayName, r.minutes, r.rank, r.visits])).toEqual([
      ["Bala S.", 120, 1, 1],
      ["Asha R.", 90, 2, 1],
    ]);
  });
  it("gives tied members the same rank and skips the next", () => {
    const rows = buildLeaderboard(
      [
        closed("a", "Asha R.", "01", 90),
        closed("b", "Bala S.", "01", 90),
        closed("c", "Chitra M.", "01", 30),
      ],
      now,
    );
    expect(rows.map((r) => [r.displayName, r.rank])).toEqual([
      ["Asha R.", 1],
      ["Bala S.", 1],
      ["Chitra M.", 3],
    ]);
  });
  it("leaves out members whose visits all count 0", () => {
    const rows = buildLeaderboard(
      [closed("a", "Asha R.", "01", 200), closed("b", "Bala S.", "01", 10)],
      now,
    );
    expect(rows.map((r) => r.memberHash)).toEqual(["b"]);
  });
  it("applies the daily cap", () => {
    const visits = [
      closed("a", "Asha R.", "02", 150),
      {
        ...closed("a", "Asha R.", "02", 150),
        inAt: new Date("2026-11-02T15:00:00+05:30"),
        outAt: new Date("2026-11-02T17:30:00+05:30"),
      },
    ];
    expect(buildLeaderboard(visits, now)[0]).toMatchObject({ minutes: 240, visits: 2 });
  });
  it("uses the member's most recent display name", () => {
    const rows = buildLeaderboard(
      [closed("a", "Member", "01", 30), closed("a", "Asha R.", "05", 30)],
      now,
    );
    expect(rows[0].displayName).toBe("Asha R.");
  });
});
