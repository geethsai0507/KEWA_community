import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { subscribeToCalendar, dayColorFor, dayStatusLabel, type DayStatus } from "@/lib/hall/calendar";
import { useUnmountDelay } from "@/hooks/use-unmount-delay";

type DayEntry = { Morning: DayStatus; Evening: DayStatus };

const PRIORITY: DayStatus[] = ["confirmed", "held", "pending", "blocked", "available"];

function worstStatus(entry: DayEntry): DayStatus {
  return PRIORITY.find((s) => entry.Morning === s || entry.Evening === s) ?? "available";
}

const CELL_BG: Record<"red" | "yellow" | "green", string> = {
  red: "bg-tertiary/70 text-on-tertiary",
  yellow: "bg-warning/70 text-on-warning",
  green: "bg-secondary/35 text-on-surface",
};

export function AvailabilityCalendar({
  venue,
  compact = false,
  onBook,
}: {
  venue: string;
  compact?: boolean;
  onBook?: (date: string, venue: string) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [byDate, setByDate] = useState<Record<string, DayEntry>>({});
  const [selected, setSelected] = useState<{ date: string; entry: DayEntry } | null>(null);
  const [displayed, setDisplayed] = useState<{ date: string; entry: DayEntry } | null>(null);
  const showPopup = useUnmountDelay(selected !== null, 320);

  useEffect(() => {
    if (selected) setDisplayed(selected);
  }, [selected]);

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
    const cellClass = `${CELL_BG[color]} ${compact ? "min-h-[44px] text-sm" : "min-h-[96px]"} p-2 flex items-start justify-start font-bold rounded-lg w-full text-left`;
    const title = `Morning: ${entry.Morning}, Evening: ${entry.Evening}`;

    if (compact) {
      return (
        <div key={day} className={cellClass} title={title}>
          {day}
        </div>
      );
    }

    return (
      <button
        key={day}
        type="button"
        onClick={() => setSelected({ date: dateStr, entry })}
        className={`${cellClass} cursor-pointer hover:ring-2 hover:ring-primary transition-shadow`}
        title={title}
      >
        {day}
      </button>
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

  const canBook = displayed ? displayed.entry.Morning === "available" || displayed.entry.Evening === "available" : false;

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

      {showPopup && displayed && (
        <div
          className={`fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-background/80 backdrop-blur-sm px-4 duration-[320ms] ease-club ${
            selected ? "animate-in fade-in" : "animate-out fade-out"
          }`}
        >
          <div
            className={`brutalist-card relative w-full max-w-sm space-y-6 bg-surface-container p-8 text-on-background duration-[320ms] ease-club ${
              selected ? "animate-in fade-in zoom-in-95" : "animate-out fade-out zoom-out-95"
            }`}
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="absolute right-4 top-4 text-on-surface-variant hover:text-primary"
            >
              ✕
            </button>
            <h2 className="font-display text-xl font-extrabold tracking-tight text-primary">
              {new Date(`${displayed.date}T00:00:00`).toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-ui-button text-sm uppercase tracking-wide text-on-surface-variant">Morning</span>
                <span className="text-sm font-bold">{dayStatusLabel(displayed.entry.Morning)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-ui-button text-sm uppercase tracking-wide text-on-surface-variant">Evening</span>
                <span className="text-sm font-bold">{dayStatusLabel(displayed.entry.Evening)}</span>
              </div>
            </div>
            {canBook && onBook && (
              <button
                type="button"
                onClick={() => {
                  onBook(displayed.date, venue);
                  setSelected(null);
                }}
                className="w-full rounded-xl border border-primary bg-primary p-4 font-bold uppercase tracking-wide text-on-primary transition-all duration-[220ms] ease-club hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-10px_rgba(201,162,75,0.5)]"
              >
                Book this date
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
