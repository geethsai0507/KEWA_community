import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { verifyMembership } from "@/lib/hall/members";
import {
  GATE_SESSION_KEY,
  isAdminPath,
  readGateSession,
  gateErrorMessage,
  type GateErrorKind,
} from "@/lib/hall/gate";

export function SiteGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [verified, setVerified] = useState(() => {
    if (typeof window === "undefined") return false;
    return readGateSession((key) => sessionStorage.getItem(key));
  });
  const [empId, setEmpId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorKind, setErrorKind] = useState<GateErrorKind | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (isAdminPath(pathname) || verified) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = empId.trim();
    if (!trimmed) {
      setErrorKind("empty");
      inputRef.current?.focus();
      return;
    }
    setVerifying(true);
    setErrorKind(null);
    try {
      const isMember = await verifyMembership(trimmed);
      if (!isMember) {
        setErrorKind("not-found");
        inputRef.current?.focus();
        return;
      }
      sessionStorage.setItem(GATE_SESSION_KEY, "1");
      setVerified(true);
    } catch {
      setErrorKind("network");
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-primary px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 text-center text-on-primary"
      >
        <h1 className="font-display text-3xl font-extrabold tracking-tighter">
          Executives Club Portal
        </h1>
        <p className="text-sm opacity-80">Enter your Employee ID to continue. Members only.</p>
        <div className="space-y-2 text-left">
          <label htmlFor="gate-emp-id" className="text-sm font-bold uppercase tracking-wide">
            Employee ID
          </label>
          <input
            id="gate-emp-id"
            ref={inputRef}
            autoFocus
            type="text"
            value={empId}
            disabled={verifying}
            onChange={(e) => setEmpId(e.target.value)}
            className="w-full border-2 border-on-primary bg-transparent p-4 text-on-primary"
          />
        </div>
        <button
          type="submit"
          disabled={verifying}
          className="w-full border-2 border-on-primary bg-on-primary p-4 font-bold uppercase tracking-wide text-primary disabled:opacity-60"
        >
          {verifying ? "Verifying…" : "Verify"}
        </button>
        <p role="alert" aria-live="polite" className="min-h-[1.5rem] text-sm text-error-container">
          {errorKind ? gateErrorMessage(errorKind) : ""}
        </p>
      </form>
    </div>
  );
}
