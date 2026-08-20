import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { subscribeToCalendar, dayColorFor, type DayStatus } from "@/lib/hall/calendar";

type DayEntry = { Morning: DayStatus; Evening: DayStatus };

const PRIORITY: DayStatus[] = ["confirmed", "held", "pending", "blocked", "available"];

function worstStatus(entry: DayEntry): DayStatus {
  return PRIORITY.find((s) => entry.Morning === s || entry.Evening === s) ?? "available";
}

const CELL_BG: Record<"red" | "yellow" | "green", string> = {
  red: "bg-tertiary/70 text-on-tertiary",
  yellow: "bg-secondary-container/70 text-on-secondary-container",
  green: "bg-secondary/20 text-on-surface",
};

export function AvailabilityCalendar({ venue, compact = false }: { venue: string; compact?: boolean }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [byDate, setByDate] = useState<Record<string, DayEntry>>({});

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
    const entry = byDate[dateStr] ?? { Morning: "available" as DayStatus, Evening: "available" as DayStatus };
    const color = dayColorFor(worstStatus(entry));
    const cellClass = `${CELL_BG[color]} ${compact ? "min-h-[44px] text-sm" : "min-h-[96px]"} p-2 flex items-start justify-start font-bold rounded-lg`;
    return (
      <div key={day} className={cellClass} title={`Morning: ${entry.Morning}, Evening: ${entry.Evening}`}>
        {day}
      </div>
    );
  };

  const grid = (
    <div className="grid grid-cols-7 gap-1">
      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
        <div key={`${d}-${i}`} className="p-2 text-center text-xs font-bold uppercase text-on-surface-variant">
          {d}
        </div>
      ))}
      {Array.from({ length: firstWeekday }, (_, i) => <div key={`pad-${i}`} />)}
      {Array.from({ length: daysInMonth }, (_, i) => dayCell(i + 1))}
    </div>
  );

  return (
    <div className="brutalist-card space-y-4 bg-surface-container p-6">
      <div className="flex items-center justify-between">
        {!compact && (
          <button className="px-3 py-1 text-primary" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            ←
          </button>
        )}
        <span className="font-headline text-lg font-bold text-primary">
          {cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </span>
        {!compact && (
          <button className="px-3 py-1 text-primary" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            →
          </button>
        )}
      </div>
      {compact ? (
        <Link to="/hall" className="block">
          {grid}
        </Link>
      ) : (
        grid
      )}
      <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-full ${CELL_BG.green}`}></span> Free</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-full ${CELL_BG.yellow}`}></span> Pending</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-full ${CELL_BG.red}`}></span> Booked</span>
      </div>
    </div>
  );
}
