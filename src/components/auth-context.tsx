import { createContext, useContext, useRef, useState, type FormEvent, type ReactNode } from "react";
import { verifyMembership } from "@/lib/hall/members";
import {
  GATE_SESSION_KEY,
  GATE_EMP_ID_KEY,
  readGateSession,
  readGateEmpId,
  gateErrorMessage,
  type GateErrorKind,
} from "@/lib/hall/gate";

interface AuthContextValue {
  verified: boolean;
  empId: string | null;
  requireLogin: (onSuccess?: () => void) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [verified, setVerified] = useState(() => {
    if (typeof window === "undefined") return false;
    return readGateSession((key) => sessionStorage.getItem(key));
  });
  const [empId, setEmpId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return readGateEmpId((key) => sessionStorage.getItem(key));
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorKind, setErrorKind] = useState<GateErrorKind | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSuccessRef = useRef<(() => void) | undefined>(undefined);

  const requireLogin = (onSuccess?: () => void) => {
    if (verified) {
      onSuccess?.();
      return;
    }
    onSuccessRef.current = onSuccess;
    setInputValue("");
    setErrorKind(null);
    setModalOpen(true);
  };

  const logout = () => {
    sessionStorage.removeItem(GATE_SESSION_KEY);
    sessionStorage.removeItem(GATE_EMP_ID_KEY);
    setVerified(false);
    setEmpId(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    onSuccessRef.current = undefined;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
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
      setEmpId(trimmed);
      setModalOpen(false);
      const onSuccess = onSuccessRef.current;
      onSuccessRef.current = undefined;
      onSuccess?.();
    } catch {
      setErrorKind("network");
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <AuthContext.Provider value={{ verified, empId, requireLogin, logout }}>
      {children}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <form
            onSubmit={handleSubmit}
            className="brutalist-card relative w-full max-w-sm space-y-6 bg-surface-container p-8 text-center text-on-background"
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="absolute right-4 top-4 text-on-surface-variant hover:text-primary"
            >
              ✕
            </button>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-primary">
              Login to your Account
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
                value={inputValue}
                disabled={verifying}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-surface p-4 text-on-background"
              />
            </div>
            <button
              type="submit"
              disabled={verifying}
              className="w-full rounded-xl border border-primary bg-primary p-4 font-bold uppercase tracking-wide text-on-primary disabled:opacity-60"
            >
              {verifying ? "Verifying…" : "Login"}
            </button>
            <p role="alert" aria-live="polite" className="min-h-[1.5rem] text-sm text-error">
              {errorKind ? gateErrorMessage(errorKind) : ""}
            </p>
          </form>
        </div>
      )}
    </AuthContext.Provider>
  );
}
