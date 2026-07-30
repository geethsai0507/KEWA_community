export const GATE_SESSION_KEY = "hall_gate_verified";

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function readGateSession(getItem: (key: string) => string | null): boolean {
  return getItem(GATE_SESSION_KEY) === "1";
}

export type GateErrorKind = "empty" | "not-found" | "network";

export function gateErrorMessage(kind: GateErrorKind): string {
  switch (kind) {
    case "empty":
      return "Enter your Employee ID.";
    case "not-found":
      return "No member found with this Employee ID — check for typos and try again.";
    case "network":
      return "Something went wrong, try again.";
  }
}
