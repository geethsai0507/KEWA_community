import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { verifyMembership } from "@/lib/hall/members";
import {
  GATE_SESSION_KEY,
  GATE_EMP_ID_KEY,
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
  const [step, setStep] = useState<"welcome" | "login">("welcome");
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
      sessionStorage.setItem(GATE_EMP_ID_KEY, trimmed);
      setVerified(true);
    } catch {
      setErrorKind("network");
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  if (step === "welcome") {
    return (
      <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div className="w-full max-w-md space-y-8">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-primary">
            Welcome to the Executives Club
          </h1>
          <p className="text-sm text-on-surface-variant">
            Exclusive amenities and events for members.
          </p>
          <button
            type="button"
            onClick={() => setStep("login")}
            className="w-full rounded-xl border border-primary bg-primary p-4 font-bold uppercase tracking-wide text-on-primary transition-colors hover:bg-primary-container"
          >
            Login to your Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 text-center text-on-background"
      >
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-primary">
          Executives Club Portal
        </h1>
        <p className="text-sm text-on-surface-variant">Enter your Employee ID to continue. Members only.</p>
        <div className="space-y-2 text-left">
          <label htmlFor="gate-emp-id" className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">
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
            className="w-full rounded-xl border border-outline-variant bg-surface-container p-4 text-on-background"
          />
        </div>
        <button
          type="submit"
          disabled={verifying}
          className="w-full rounded-xl border border-primary bg-primary p-4 font-bold uppercase tracking-wide text-on-primary disabled:opacity-60"
        >
          {verifying ? "Verifying…" : "Verify"}
        </button>
        <p role="alert" aria-live="polite" className="min-h-[1.5rem] text-sm text-error">
          {errorKind ? gateErrorMessage(errorKind) : ""}
        </p>
      </form>
    </div>
  );
}
