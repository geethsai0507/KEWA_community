import type { Slot } from "./types";

export function slotDocId(venue: string, date: string, slot: Slot): string {
  return `${venue}|${date}|${slot}`;
}

export function otherSlot(slot: Slot): Slot {
  return slot === "Morning" ? "Evening" : "Morning";
}
