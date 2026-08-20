import { describe, it, expect } from "vitest";
import { GATE_SESSION_KEY, GATE_EMP_ID_KEY, isAdminPath, readGateSession, readGateEmpId, gateErrorMessage } from "./gate";

describe("isAdminPath", () => {
  it("matches the bare /admin path", () => {
    expect(isAdminPath("/admin")).toBe(true);
  });
  it("matches admin sub-paths", () => {
    expect(isAdminPath("/admin/login")).toBe(true);
    expect(isAdminPath("/admin/dashboard")).toBe(true);
  });
  it("does not match non-admin paths", () => {
    expect(isAdminPath("/")).toBe(false);
    expect(isAdminPath("/hall")).toBe(false);
    expect(isAdminPath("/hall/status")).toBe(false);
  });
  it("does not match paths that merely start with the same letters", () => {
    expect(isAdminPath("/administration")).toBe(false);
  });
});

describe("readGateSession", () => {
  it("returns true when the session flag is set to \"1\"", () => {
    expect(readGateSession((key) => (key === GATE_SESSION_KEY ? "1" : null))).toBe(true);
  });
  it("returns false when the session flag is missing", () => {
    expect(readGateSession(() => null)).toBe(false);
  });
  it("returns false when the session flag has an unexpected value", () => {
    expect(readGateSession(() => "true")).toBe(false);
  });
});

describe("readGateEmpId", () => {
  it("returns the stored employee id when present", () => {
    expect(readGateEmpId((key) => (key === GATE_EMP_ID_KEY ? "EMP1234" : null))).toBe("EMP1234");
  });
  it("returns null when nothing is stored", () => {
    expect(readGateEmpId(() => null)).toBe(null);
  });
});

describe("gateErrorMessage", () => {
  it("maps empty input", () => {
    expect(gateErrorMessage("empty")).toBe("Enter your Employee ID.");
  });
  it("maps not-found distinctly from network errors", () => {
    const notFound = gateErrorMessage("not-found");
    const network = gateErrorMessage("network");
    expect(notFound).toBe("No member found with this Employee ID — check for typos and try again.");
    expect(network).toBe("Something went wrong, try again.");
    expect(notFound).not.toBe(network);
  });
});
