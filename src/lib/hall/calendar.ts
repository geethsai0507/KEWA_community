import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { isBlockingSlot } from "./conflict";
import type { BookingStatus, Slot } from "./types";

export type DayStatus = "available" | "confirmed" | "pending" | "held" | "blocked";

export function dayColorFor(status: DayStatus): "red" | "yellow" | "green" {
  if (status === "pending") return "yellow";
  if (status === "available") return "green";
  return "red"; // confirmed | held | blocked
}

interface SlotLike {
  status: BookingStatus;
  expiresAt: { toMillis(): number } | null;
  slot: Slot;
}

function statusToDayStatus(status: BookingStatus): DayStatus {
  if (status === "confirmed") return "confirmed";
  if (status === "pending-approval" || status === "pending-verification") return "pending";
  if (status === "pending-payment") return "held";
  return "available";
}

export function deriveDayStatus(
  slotDocs: SlotLike[],
  now: number,
): { Morning: DayStatus; Evening: DayStatus } {
  const result: { Morning: DayStatus; Evening: DayStatus } = {
    Morning: "available",
    Evening: "available",
  };
  for (const s of slotDocs) {
    if (!isBlockingSlot(s.status, s.expiresAt, now)) continue;
    result[s.slot] = statusToDayStatus(s.status);
  }
  return result;
}

export function subscribeToCalendar(
  venue: string,
  year: number,
  month: number, // 0-indexed, matches JS Date
  onChange: (byDate: Record<string, { Morning: DayStatus; Evening: DayStatus }>) => void,
): () => void {
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-31`;
  const slotsQuery = query(
    collection(db, "bookingSlots"),
    where("venue", "==", venue),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  );
  const blockedQuery = query(
    collection(db, "blockedDates"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  );

  let latestSlots: Record<string, SlotLike[]> = {};
  let latestBlockedDates = new Set<string>();

  function emit() {
    const now = Date.now();
    const result: Record<string, { Morning: DayStatus; Evening: DayStatus }> = {};
    for (const [date, slots] of Object.entries(latestSlots)) {
      const derived = deriveDayStatus(slots, now);
      if (latestBlockedDates.has(date)) {
        if (derived.Morning === "available") derived.Morning = "blocked";
        if (derived.Evening === "available") derived.Evening = "blocked";
      }
      result[date] = derived;
    }
    for (const date of latestBlockedDates) {
      if (!result[date]) result[date] = { Morning: "blocked", Evening: "blocked" };
    }
    onChange(result);
  }

  const unsubSlots = onSnapshot(slotsQuery, (snap) => {
    const byDate: Record<string, SlotLike[]> = {};
    for (const d of snap.docs) {
      const data = d.data() as SlotLike & { date: string };
      if (!byDate[data.date]) byDate[data.date] = [];
      byDate[data.date].push(data);
    }
    latestSlots = byDate;
    emit();
  });

  const unsubBlocked = onSnapshot(blockedQuery, (snap) => {
    latestBlockedDates = new Set(
      snap.docs
        .map((d) => d.data() as { date: string; venue: string })
        .filter((data) => data.venue === "all" || data.venue === venue)
        .map((data) => data.date),
    );
    emit();
  });

  return () => {
    unsubSlots();
    unsubBlocked();
  };
}
