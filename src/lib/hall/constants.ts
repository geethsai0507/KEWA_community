export const VENUES = [
  { name: "Executives Club Community Hall", feeMember: 500 },
  { name: "Shopping Complex Room", feeMember: 200 },
  { name: "Multi Purpose Room", feeMember: 500 },
  { name: "Other", feeMember: 200 },
] as const;

export const SLOTS: Record<"Morning" | "Evening", { label: string; time: string }> = {
  Morning: { label: "Morning", time: "6:00 AM – 1:00 PM" },
  Evening: { label: "Evening", time: "2:00 PM – 10:00 PM" },
};

export const PENDING_PAYMENT_TIMEOUT_MS = 15 * 60 * 1000;

export const UPI_ID = "velumula.ramgopal@okhdfcbank"; // TODO: temporary, replace with the real club UPI ID
