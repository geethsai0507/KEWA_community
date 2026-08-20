const HIGH_TIER_VENUES = new Set(["Executives Club Community Hall", "Multi Purpose Room"]);

export function calculateBookingFee(venue: string): number {
  return HIGH_TIER_VENUES.has(venue) ? 500 : 200;
}
