// Gym days and months are Indian Standard Time (UTC+05:30, no daylight saving), so a fixed
// offset is exact and avoids depending on the runtime's Intl time-zone data.
const IST_OFFSET_MS = 330 * 60_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** A Date whose UTC fields read as the IST wall-clock time of `d`. */
const shifted = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS);

export function istDayKey(d: Date): string {
  const s = shifted(d);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}

export function istMonthKey(d: Date): string {
  return istDayKey(d).slice(0, 7);
}

/** Start (inclusive) and end (exclusive) instants of an IST month, e.g. "2026-11". */
export function istMonthRange(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS),
  };
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatIstTime(d: Date): string {
  const s = shifted(d);
  const h24 = s.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(s.getUTCMinutes())} ${h24 < 12 ? "AM" : "PM"}`;
}
