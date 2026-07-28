const HIGH_TIER_VENUES = new Set(["Executives Club Community Hall", "Multi Purpose Room"]);

export function calculateBookingFee(isMember: boolean, venue: string): number {
  const isHighTier = HIGH_TIER_VENUES.has(venue);
  if (isHighTier) {
    return isMember ? 500 : 1000;
  }
  return isMember ? 200 : 500;
}
