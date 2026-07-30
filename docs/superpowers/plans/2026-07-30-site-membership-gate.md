# Site-wide Membership Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate every route except `/admin` behind a full-screen "Employee ID" membership check, verified once per browser session, without touching the existing `/hall` booking wizard or `/admin` auth flow.

**Architecture:** A pure helper module (`src/lib/hall/gate.ts`) owns the session-storage key, the admin-path bypass check, and the error-message mapping — all unit-testable in Node with no DOM. A new `src/components/site-gate.tsx` client component consumes that helper, renders a full-screen splash (Employee ID input + Verify button) when unverified, and wraps `<Outlet />` in `src/routes/__root.tsx`. No changes to Firestore rules, `verifyMembership`, or `/hall`'s own Step 1.

**Tech Stack:** React (TanStack Start), TypeScript, Vitest (Node environment — no jsdom/RTL in this repo), Tailwind CSS v4, existing `verifyMembership` from `src/lib/hall/members.ts`.

## Global Constraints

- Reuse `verifyMembership(empId): Promise<boolean>` from `src/lib/hall/members.ts` unchanged — no edits to that file, `firestore.rules`, or Firestore schema.
- `/admin` and all its sub-paths are fully exempt from the gate — bypass check is `location.pathname.startsWith("/admin")`.
- Persistence is `sessionStorage` only, under the exact key `hall_gate_verified` with value `"1"` — no `localStorage`, no cookies.
- `/hall`'s existing Step 1 (member/non-member choice, non-member fee path, its own Employee ID + Verify) must not be modified.
- Gate UI must be a full-screen splash visually distinct from the rest of the site (not reusing the `/hall` Step 1 card styling).
- Error messages must stay distinct per the spec's mapping table — do not collapse "not found" and "network error" into one message.
- This repo's Vitest config runs in `environment: "node"` with no React Testing Library — pure logic goes in `.test.ts` files under `src/lib/hall/`; the React component itself is verified manually in the dev server, matching how `BookingPanel` etc. in `src/routes/hall.tsx` are handled today.

---

### Task 1: Gate logic helper (`src/lib/hall/gate.ts`)

**Files:**
- Create: `src/lib/hall/gate.ts`
- Test: `src/lib/hall/gate.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, no imports from other hall lib files)
- Produces:
  - `export const GATE_SESSION_KEY = "hall_gate_verified";`
  - `export function isAdminPath(pathname: string): boolean;`
  - `export function readGateSession(getItem: (key: string) => string | null): boolean;` — takes a storage-getter function so it's testable without a real `Storage` object
  - `export type GateErrorKind = "empty" | "not-found" | "network";`
  - `export function gateErrorMessage(kind: GateErrorKind): string;`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/hall/gate.test.ts
import { describe, it, expect } from "vitest";
import { GATE_SESSION_KEY, isAdminPath, readGateSession, gateErrorMessage } from "./gate";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/hall/gate.test.ts`
Expected: FAIL — `./gate` module does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/hall/gate.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/lib/hall/gate.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hall/gate.ts src/lib/hall/gate.test.ts
git commit -m "Add pure gate logic helper for site-wide membership check"
```

---

### Task 2: `SiteGate` component

**Files:**
- Create: `src/components/site-gate.tsx`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Consumes:
  - `GATE_SESSION_KEY`, `isAdminPath`, `readGateSession`, `GateErrorKind`, `gateErrorMessage` from `src/lib/hall/gate.ts` (Task 1)
  - `verifyMembership(empId: string): Promise<boolean>` from `src/lib/hall/members.ts` (existing, unchanged)
  - `useRouterState` from `@tanstack/react-router` (already a project dependency) to read `location.pathname` reactively
- Produces: `export function SiteGate({ children }: { children: ReactNode }): JSX.Element;` — used by `RootComponent` in `__root.tsx`

- [ ] **Step 1: Write `SiteGate`**

```tsx
// src/components/site-gate.tsx
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { verifyMembership } from "@/lib/hall/members";
import { GATE_SESSION_KEY, isAdminPath, readGateSession, gateErrorMessage, type GateErrorKind } from "@/lib/hall/gate";

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
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 text-center text-on-primary">
        <h1 className="font-display text-3xl font-extrabold tracking-tighter">Executives Club Portal</h1>
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
```

- [ ] **Step 2: Wire `SiteGate` into the root route**

Read `src/routes/__root.tsx` first to confirm the current `RootComponent` body (it renders `<QueryClientProvider><Outlet /></QueryClientProvider>`), then modify:

```tsx
// src/routes/__root.tsx
import { SiteGate } from "@/components/site-gate";
// ...existing imports stay as-is

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SiteGate>
        <Outlet />
      </SiteGate>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Run the full test suite to confirm nothing else broke**

Run: `bun run test`
Expected: PASS — all existing `src/lib/hall/*.test.ts` suites plus the new `gate.test.ts` green (no component tests exist for `SiteGate` itself per this repo's Node-only Vitest setup).

- [ ] **Step 4: Manual verification in the dev server**

Run: `bun run dev`, then in a browser:
1. Open `http://localhost:8080/` in a fresh incognito/private window (clean session storage). Confirm the full-screen splash appears instead of the homepage.
2. Submit with an empty field → see "Enter your Employee ID." and focus stays on the input.
3. Submit a bogus Employee ID → see "No member found with this Employee ID — check for typos and try again."; input still editable, retry immediately.
4. Submit a real member's Employee ID (one already in `members`/`membersPublic` from earlier testing) → splash disappears, homepage renders.
5. Navigate to `/hall` and `/hall/status` in the same tab → splash does not reappear; `/hall`'s own Step 1 (member/non-member buttons, its own Employee ID field) still behaves exactly as before.
6. Close and reopen the tab (or open a fresh private window) → splash reappears (session-only persistence, not remembered across sessions).
7. In a fresh private window, navigate directly to `/admin` → splash never appears; the existing admin email/password sign-in shows immediately.

- [ ] **Step 5: Commit**

```bash
git add src/components/site-gate.tsx src/routes/__root.tsx
git commit -m "Add full-screen site-wide membership gate before all non-admin routes"
```

---

## Self-Review Notes

- **Spec coverage:** admin bypass (Task 2 Step 1 + manual check 7), full-screen distinct splash (Task 2 Step 1 styling, `fixed inset-0` overlay separate from site chrome), sessionStorage-only persistence with no flash on refresh (Task 2 Step 1 `useState` initializer reads synchronously), trimmed input, disabled button/input + "Verifying…" while in flight, distinct empty/not-found/network messages (Task 1, consumed in Task 2), autofocus + refocus-on-error + `aria-live` (Task 2 Step 1), `/hall` wizard untouched (no file for it in this plan), no Firestore/rules changes (no such task) — all covered.
- **Placeholder scan:** no TBD/TODO markers; all steps contain full, runnable code.
- **Type consistency:** `GateErrorKind` defined in Task 1, imported and used with the same literal values (`"empty" | "not-found" | "network"`) in Task 2; `GATE_SESSION_KEY` and `readGateSession`/`isAdminPath` signatures match between definition and call site.
