export const GATE_SESSION_KEY = "hall_gate_verified";
export const GATE_EMP_ID_KEY = "hall_gate_emp_id";

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function readGateSession(getItem: (key: string) => string | null): boolean {
  return getItem(GATE_SESSION_KEY) === "1";
}

export function readGateEmpId(getItem: (key: string) => string | null): string | null {
  return getItem(GATE_EMP_ID_KEY);
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
