# Gold/Elite Theme, Two-Step Gate, and Availability Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the site in a gold/elite palette, turn the site gate into a two-step welcome-then-login flow that persists the verified Employee ID, replace the home page's 3-day availability strip with a full month calendar (shared with the hall booking page) colored red/yellow/green by day status, and remove the now-redundant non-member booking path from the hall wizard.

**Architecture:** The color/shape re-skin is done almost entirely by redefining the existing `@theme` CSS custom properties and the shared `.brutalist-card`/`.brutalist-button` utility classes in `src/styles.css` — every page already consumes these tokens, so this is a low-risk, centralized change. The gate and calendar changes add small pure helper functions (`src/lib/hall/gate.ts`, `src/lib/hall/calendar.ts`) plus one new shared component (`src/components/availability-calendar.tsx`) used by both the home page and the hall booking page. The non-member removal is a straight deletion sweep through `fees.ts`, `types.ts`, `transactions.ts`, and `hall.tsx`.

**Tech Stack:** React 19, TanStack Start/Router, Tailwind CSS v4 (`@theme` tokens in `src/styles.css`), Vitest (node environment, no jsdom), Firebase Firestore.

**Spec:** `docs/superpowers/specs/2026-08-18-gold-elite-theme-and-calendar-design.md`

## Global Constraints

- Vitest runs in `"node"` environment (`vitest.config.ts`) — no jsdom/React Testing Library. Only pure TypeScript functions get unit tests; React components are verified manually via the dev server, matching every prior feature in this repo.
- All color changes go through the existing `--color-*` CSS custom properties in `src/styles.css`'s `@theme` block — do not hardcode new hex values directly in `.tsx` files except where explicitly called out (the two known hardcoded-hex exceptions).
- The shape/rounding change (luxury restyle) is achieved via the shared `.brutalist-card` / `.brutalist-button` classes only. Do not rewrite every individual `border-2 border-primary` input/button className across `hall.tsx` — those pick up the new gold color automatically through the token change and stay square-cornered; only the two shared classes get rounded.
- `SiteGate` wraps `<Outlet />` at the root (`src/routes/__root.tsx`) and is the only gate to non-admin routes — any component under `/hall` can assume gate verification already happened, with no fallback needed.
- Prettier/ESLint: this repo has pre-existing CRLF lint noise unrelated to this work (Windows checkout). Only run `npx prettier --write <file>` on files this plan actually touches, and only fix genuinely new lint issues in those files.
- Never commit with `--no-verify`. Create a new commit per task; do not amend.

---

### Task 1: Gold/elite theme tokens

**Files:**
- Modify: `src/styles.css:69-137` (the `--color-*` block), `src/styles.css:164-168` (`.brutalist-card` / `.status-dot-*`), `src/styles.css:8-18` (display font vars)
- Modify: `src/routes/__root.tsx:96-99` (Google Fonts link)

**Interfaces:**
- Produces: every `bg-*`, `text-*`, `border-*` Tailwind color utility used across the app now resolves to the gold/charcoal palette. No new exports.

- [ ] **Step 1: Add Playfair Display to the Google Fonts link**

In `src/routes/__root.tsx`, find:

```tsx
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Inter:wght@400;600;700&display=swap",
      },
```

Replace with:

```tsx
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;600;700&display=swap",
      },
```

- [ ] **Step 2: Swap the display font family in `styles.css`**

In `src/styles.css`, find the font block (lines 8-18):

```css
  --font-display: "Bricolage Grotesque", sans-serif;
  --font-headline: "Bricolage Grotesque", sans-serif;
  --font-ui-button: "Bricolage Grotesque", sans-serif;
  --font-body: "Inter", sans-serif;
  --font-body-md: "Inter", sans-serif;
  --font-body-lg: "Inter", sans-serif;
  --font-label-md: "Inter", sans-serif;
  --font-display-lg: "Bricolage Grotesque", sans-serif;
  --font-display-lg-mobile: "Bricolage Grotesque", sans-serif;
  --font-headline-md: "Bricolage Grotesque", sans-serif;
  --font-headline-lg: "Bricolage Grotesque", sans-serif;
```

Replace with:

```css
  --font-display: "Playfair Display", serif;
  --font-headline: "Playfair Display", serif;
  --font-ui-button: "Inter", sans-serif;
  --font-body: "Inter", sans-serif;
  --font-body-md: "Inter", sans-serif;
  --font-body-lg: "Inter", sans-serif;
  --font-label-md: "Inter", sans-serif;
  --font-display-lg: "Playfair Display", serif;
  --font-display-lg-mobile: "Playfair Display", serif;
  --font-headline-md: "Playfair Display", serif;
  --font-headline-lg: "Playfair Display", serif;
```

(`--font-ui-button` switches to Inter — buttons stay in the readable sans-serif; headlines/display get the serif luxury feel.)

- [ ] **Step 3: Replace the color palette**

In `src/styles.css`, replace the entire block from `--color-background: #fdf7ff;` (line 69) through `--color-foreground: #1c1a24;` (line 136) with:

```css
  --color-background: #14110c;
  --color-on-background: #f3ead8;
  --color-surface: #14110c;
  --color-surface-bright: #241f16;
  --color-surface-dim: #0c0a07;
  --color-surface-variant: #2a2318;
  --color-surface-tint: #c9a24b;
  --color-surface-container: #1c1810;
  --color-surface-container-low: #18140d;
  --color-surface-container-lowest: #0c0a07;
  --color-surface-container-high: #241f16;
  --color-surface-container-highest: #2a2318;
  --color-on-surface: #f3ead8;
  --color-on-surface-variant: #c9bba0;
  --color-inverse-surface: #f3ead8;
  --color-inverse-on-surface: #1c1810;

  --color-primary: #c9a24b;
  --color-on-primary: #1a1508;
  --color-primary-container: #e5c158;
  --color-on-primary-container: #2a1e00;
  --color-primary-fixed: #e5c158;
  --color-primary-fixed-dim: #c9a24b;
  --color-on-primary-fixed: #2a1e00;
  --color-on-primary-fixed-variant: #4a3a10;
  --color-inverse-primary: #e5c158;

  --color-secondary: #1f6b4a;
  --color-on-secondary: #ffffff;
  --color-secondary-container: #2e9468;
  --color-on-secondary-container: #f0fff6;
  --color-secondary-fixed: #beead3;
  --color-secondary-fixed-dim: #6bc79a;
  --color-on-secondary-fixed: #04291a;
  --color-on-secondary-fixed-variant: #14503a;

  --color-tertiary: #7a2331;
  --color-on-tertiary: #ffffff;
  --color-tertiary-container: #a5303f;
  --color-on-tertiary-container: #ffe3e6;
  --color-tertiary-fixed: #ffdadd;
  --color-tertiary-fixed-dim: #e8a6ad;
  --color-on-tertiary-fixed: #400009;
  --color-on-tertiary-fixed-variant: #5c1420;

  --color-error: #e5484d;
  --color-on-error: #ffffff;
  --color-error-container: #4a1113;
  --color-on-error-container: #ffd9da;

  --color-success: #2fa86b;

  --color-outline: #8a7e63;
  --color-outline-variant: #4a4232;
  --color-border: #33291a;
  --color-input: #33291a;
  --color-ring: #c9a24b;
  --color-card: #1c1810;
  --color-card-foreground: #f3ead8;
  --color-popover: #1c1810;
  --color-popover-foreground: #f3ead8;
  --color-muted: #241f16;
  --color-muted-foreground: #c9bba0;
  --color-accent: #241f16;
  --color-accent-foreground: #f3ead8;
  --color-destructive: #e5484d;
  --color-destructive-foreground: #ffffff;
  --color-foreground: #f3ead8;
```

- [ ] **Step 4: Restyle the shared card/button classes for the luxury look**

In `src/styles.css`, find:

```css
.brutalist-card { border: 2px solid #4300ba; border-radius: 0; transition: transform 0.1s ease; }
.brutalist-button:active { transform: scale(0.95); }
.status-dot-morning { background-color: #5b2bd9; }
.status-dot-evening { background-color: #fdaf1e; }
.status-dot-full { background-color: #ba1a1a; }
```

Replace with:

```css
.brutalist-card {
  border: 1px solid var(--color-outline-variant);
  border-radius: 1rem;
  background-color: var(--color-surface-container);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.brutalist-card:hover {
  box-shadow: 0 0 0 1px var(--color-primary), 0 12px 28px -10px rgba(201, 162, 75, 0.35);
}
.brutalist-button {
  border-radius: 0.75rem;
}
.brutalist-button:active { transform: scale(0.95); }
```

(`.status-dot-*` classes are dropped here — their only consumer, `hall.tsx`'s `CalendarPanel`, is replaced in Task 8 with the new red/yellow/green day-fill calendar, so keeping these unused rules would be dead CSS.)

- [ ] **Step 5: Manually verify in the browser**

Run `bun run dev` (or use the already-running dev server), open the home page and `/hall`. Confirm: dark charcoal background, gold primary color on buttons/links/borders, rounded corners on card elements (e.g. the "Fee" sidebar on `/hall`, notice board cards), serif headlines. Confirm nothing renders as unstyled/broken (no missing color reference).

- [ ] **Step 6: Commit**

```bash
git add src/styles.css src/routes/__root.tsx
git commit -m "Apply gold/elite theme palette and luxury card styling"
```

---

### Task 2: Gate persists the verified Employee ID

**Files:**
- Modify: `src/lib/hall/gate.ts`
- Modify: `src/lib/hall/gate.test.ts`

**Interfaces:**
- Produces: `GATE_EMP_ID_KEY: string`, `readGateEmpId(getItem: (key: string) => string | null): string | null`

- [ ] **Step 1: Write the failing tests**

In `src/lib/hall/gate.test.ts`, add (after the `readGateSession` import and describe block):

```ts
import { GATE_SESSION_KEY, GATE_EMP_ID_KEY, isAdminPath, readGateSession, readGateEmpId, gateErrorMessage } from "./gate";
```

(replacing the existing import line), and add a new describe block after `readGateSession`'s:

```ts
describe("readGateEmpId", () => {
  it("returns the stored employee id when present", () => {
    expect(readGateEmpId((key) => (key === GATE_EMP_ID_KEY ? "EMP1234" : null))).toBe("EMP1234");
  });
  it("returns null when nothing is stored", () => {
    expect(readGateEmpId(() => null)).toBe(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/hall/gate.test.ts`
Expected: FAIL — `GATE_EMP_ID_KEY` and `readGateEmpId` are not exported from `./gate`.

- [ ] **Step 3: Implement `GATE_EMP_ID_KEY` and `readGateEmpId`**

In `src/lib/hall/gate.ts`, find:

```ts
export const GATE_SESSION_KEY = "hall_gate_verified";
```

Replace with:

```ts
export const GATE_SESSION_KEY = "hall_gate_verified";
export const GATE_EMP_ID_KEY = "hall_gate_emp_id";
```

Then find:

```ts
export function readGateSession(getItem: (key: string) => string | null): boolean {
  return getItem(GATE_SESSION_KEY) === "1";
}
```

Add immediately after it:

```ts
export function readGateEmpId(getItem: (key: string) => string | null): string | null {
  return getItem(GATE_EMP_ID_KEY);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/lib/hall/gate.test.ts`
Expected: PASS, all tests including the new `readGateEmpId` describe block.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hall/gate.ts src/lib/hall/gate.test.ts
git commit -m "Add readGateEmpId helper for persisting the verified Employee ID"
```

---

### Task 3: Two-step gate flow (welcome → login) and gold restyle

**Files:**
- Modify: `src/components/site-gate.tsx`

**Interfaces:**
- Consumes: `GATE_SESSION_KEY`, `GATE_EMP_ID_KEY`, `isAdminPath`, `readGateSession`, `readGateEmpId`, `gateErrorMessage`, `type GateErrorKind` from `@/lib/hall/gate` (Task 2); `verifyMembership` from `@/lib/hall/members` (unchanged).
- Produces: no new exports — `SiteGate`'s external contract (`{ children: ReactNode }`) is unchanged.

- [ ] **Step 1: Add the `step` state and welcome screen**

In `src/components/site-gate.tsx`, replace the whole file with:

```tsx
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
```

- [ ] **Step 2: Manually verify in the browser**

Clear session storage (devtools → Application → Session Storage → clear), reload the site. Confirm: the welcome splash appears first with the "Login to your Account" button; clicking it reveals the Employee ID form; entering a valid Employee ID and submitting reveals the site; `sessionStorage` now has both `hall_gate_verified=1` and `hall_gate_emp_id=<the id you typed>`. Reload the page — you should land straight on the site (still verified this session). Visit `/admin` in a fresh session (no verification) — it should NOT show the gate.

- [ ] **Step 3: Commit**

```bash
git add src/components/site-gate.tsx
git commit -m "Add two-step welcome screen to the site gate and persist the verified Employee ID"
```

---

### Task 4: `dayColorFor` helper

**Files:**
- Modify: `src/lib/hall/calendar.ts`
- Create: `src/lib/hall/calendar.test.ts`

**Interfaces:**
- Consumes: `type DayStatus` (already exported from `./calendar`)
- Produces: `dayColorFor(status: DayStatus): "red" | "yellow" | "green"`

- [ ] **Step 1: Write the failing test**

Create `src/lib/hall/calendar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dayColorFor, type DayStatus } from "./calendar";

describe("dayColorFor", () => {
  it("shows green for available", () => {
    expect(dayColorFor("available")).toBe("green");
  });
  it("shows yellow for pending", () => {
    expect(dayColorFor("pending")).toBe("yellow");
  });
  it("shows red for confirmed", () => {
    expect(dayColorFor("confirmed")).toBe("red");
  });
  it("shows red for held (payment window)", () => {
    expect(dayColorFor("held")).toBe("red");
  });
  it("shows red for admin-blocked", () => {
    expect(dayColorFor("blocked")).toBe("red");
  });
  it("covers every DayStatus value with no fallthrough", () => {
    const statuses: DayStatus[] = ["available", "confirmed", "pending", "held", "blocked"];
    for (const s of statuses) {
      expect(["red", "yellow", "green"]).toContain(dayColorFor(s));
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/hall/calendar.test.ts`
Expected: FAIL — `dayColorFor` is not exported from `./calendar`.

- [ ] **Step 3: Implement `dayColorFor`**

In `src/lib/hall/calendar.ts`, find:

```ts
export type DayStatus = "available" | "confirmed" | "pending" | "held" | "blocked";
```

Add immediately after it:

```ts
export function dayColorFor(status: DayStatus): "red" | "yellow" | "green" {
  if (status === "pending") return "yellow";
  if (status === "available") return "green";
  return "red"; // confirmed | held | blocked
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/hall/calendar.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hall/calendar.ts src/lib/hall/calendar.test.ts
git commit -m "Add dayColorFor helper mapping booking status to red/yellow/green"
```

---

### Task 5: Shared `AvailabilityCalendar` component

**Files:**
- Create: `src/components/availability-calendar.tsx`

**Interfaces:**
- Consumes: `subscribeToCalendar`, `type DayStatus`, `dayColorFor` from `@/lib/hall/calendar` (Task 4); `VENUES` from `@/lib/hall/constants`; `Icon` from `@/components/site-chrome`; `Link` from `@tanstack/react-router`.
- Produces: `<AvailabilityCalendar venue={string} compact?={boolean} />` — a default export is NOT used, this is a named export `AvailabilityCalendar`.

- [ ] **Step 1: Create the component**

Create `src/components/availability-calendar.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { subscribeToCalendar, dayColorFor, type DayStatus } from "@/lib/hall/calendar";

type DayEntry = { Morning: DayStatus; Evening: DayStatus };

const PRIORITY: DayStatus[] = ["confirmed", "held", "pending", "blocked", "available"];

function worstStatus(entry: DayEntry): DayStatus {
  return PRIORITY.find((s) => entry.Morning === s || entry.Evening === s) ?? "available";
}

const CELL_BG: Record<"red" | "yellow" | "green", string> = {
  red: "bg-tertiary/70 text-on-tertiary",
  yellow: "bg-secondary-container/70 text-on-secondary-container",
  green: "bg-secondary/20 text-on-surface",
};

export function AvailabilityCalendar({ venue, compact = false }: { venue: string; compact?: boolean }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [byDate, setByDate] = useState<Record<string, DayEntry>>({});

  useEffect(() => {
    const unsubscribe = subscribeToCalendar(venue, cursor.getFullYear(), cursor.getMonth(), setByDate);
    return unsubscribe;
  }, [venue, cursor]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const dayCell = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const entry = byDate[dateStr] ?? { Morning: "available" as DayStatus, Evening: "available" as DayStatus };
    const color = dayColorFor(worstStatus(entry));
    const cellClass = `${CELL_BG[color]} ${compact ? "min-h-[44px] text-sm" : "min-h-[96px]"} p-2 flex items-start justify-start font-bold rounded-lg`;
    return (
      <div key={day} className={cellClass} title={`Morning: ${entry.Morning}, Evening: ${entry.Evening}`}>
        {day}
      </div>
    );
  };

  const grid = (
    <div className="grid grid-cols-7 gap-1">
      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
        <div key={`${d}-${i}`} className="p-2 text-center text-xs font-bold uppercase text-on-surface-variant">
          {d}
        </div>
      ))}
      {Array.from({ length: firstWeekday }, (_, i) => <div key={`pad-${i}`} />)}
      {Array.from({ length: daysInMonth }, (_, i) => dayCell(i + 1))}
    </div>
  );

  return (
    <div className="brutalist-card space-y-4 bg-surface-container p-6">
      <div className="flex items-center justify-between">
        {!compact && (
          <button className="px-3 py-1 text-primary" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            ←
          </button>
        )}
        <span className="font-headline text-lg font-bold text-primary">
          {cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </span>
        {!compact && (
          <button className="px-3 py-1 text-primary" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            →
          </button>
        )}
      </div>
      {compact ? (
        <Link to="/hall" className="block">
          {grid}
        </Link>
      ) : (
        grid
      )}
      <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-full ${CELL_BG.green}`}></span> Free</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-full ${CELL_BG.yellow}`}></span> Pending</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-full ${CELL_BG.red}`}></span> Booked</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify in isolation**

This component has no page wiring it up yet — verification happens in Tasks 6 and 8 once it's mounted. Just confirm the file compiles: run `bun run build` or check `bunx tsc --noEmit` for type errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/availability-calendar.tsx
git commit -m "Add shared AvailabilityCalendar component with red/yellow/green day coloring"
```

---

### Task 6: Home page uses the shared calendar

**Files:**
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: `AvailabilityCalendar` from `@/components/availability-calendar` (Task 5); `VENUES` from `@/lib/hall/constants` (unchanged).

- [ ] **Step 1: Replace `HallAvailabilityWidget` with the shared calendar**

In `src/routes/index.tsx`, delete: the `import { useEffect, useState } from "react";` line, the `import { subscribeToCalendar, type DayStatus } from "@/lib/hall/calendar";` line, the `toDateStr` function, the `summarizeDay` function, and the entire `HallAvailabilityWidget` function. (Confirmed by search: `useEffect`/`useState`/`subscribeToCalendar`/`DayStatus` have no other usage anywhere else in this file — `Home()` itself uses no hooks — so all four are safe to remove outright, not just the widget.)

Add this import alongside the existing ones at the top of the file:

```tsx
import { AvailabilityCalendar } from "@/components/availability-calendar";
```

Then find:

```tsx
          <HallAvailabilityWidget />
```

Replace with:

```tsx
          <AvailabilityCalendar venue={VENUES[0].name} compact />
```

The resulting top-of-file imports for this route should be exactly:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon, SiteHeader, SiteFooter } from "@/components/site-chrome";
import { VENUES } from "@/lib/hall/constants";
import { AvailabilityCalendar } from "@/components/availability-calendar";
```

- [ ] **Step 2: Manually verify in the browser**

Load the home page. Confirm the "Hall Availability" section now shows a full month calendar (not the old 3-card strip), colored green/yellow/red per day, and clicking any day navigates to `/hall`.

- [ ] **Step 3: Run the build to catch type/lint errors**

Run: `bun run build`
Expected: succeeds with no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx
git commit -m "Replace home page 3-day availability widget with the shared month calendar"
```

---

### Task 7: Fix hardcoded-hex colors outside the token system

**Files:**
- Modify: `src/components/site-chrome.tsx:28-33`

**Interfaces:** None — purely a className swap, no signature changes.

- [ ] **Step 1: Replace the hardcoded "Hall free" pill colors**

In `src/components/site-chrome.tsx`, find:

```tsx
        <div className="hidden sm:flex items-center bg-[#D1FFBD] px-4 py-1.5 rounded-full border-2 border-[#1E4D12]">
          <span className="w-2 h-2 bg-[#1E4D12] rounded-full mr-2 animate-pulse"></span>
          <span className="text-[12px] font-bold text-[#1E4D12] uppercase tracking-wider">
            Hall free until 6 pm
          </span>
        </div>
```

Replace with:

```tsx
        <div className="hidden sm:flex items-center bg-secondary/20 px-4 py-1.5 rounded-full border border-secondary">
          <span className="w-2 h-2 bg-secondary rounded-full mr-2 animate-pulse"></span>
          <span className="text-[12px] font-bold text-secondary uppercase tracking-wider">
            Hall free until 6 pm
          </span>
        </div>
```

- [ ] **Step 2: Manually verify in the browser**

Load any page. Confirm the "Hall free until 6 pm" pill in the header now uses the emerald secondary color instead of the old hardcoded green, and reads correctly against the dark header background.

- [ ] **Step 3: Commit**

```bash
git add src/components/site-chrome.tsx
git commit -m "Replace hardcoded hex colors in the header pill with theme tokens"
```

---

### Task 8: Hall booking page's own calendar uses the shared component

**Files:**
- Modify: `src/routes/hall.tsx` (the `CalendarPanel` function and its imports)

**Interfaces:**
- Consumes: `AvailabilityCalendar` from `@/components/availability-calendar` (Task 5).
- Produces: `CalendarPanel`'s external behavior (a tab inside `HallPage`) is unchanged — still shows a venue switcher above the calendar.

- [ ] **Step 1: Replace `CalendarPanel`'s body with the shared component**

In `src/routes/hall.tsx`, find the entire `CalendarPanel` function (from `function CalendarPanel() {` through its closing `}` — currently spans the venue/cursor state, `dotForStatus`, `PRIORITY`/`worstStatus`, `dayCell`, and the returned JSX with the month grid) and replace it with:

```tsx
function CalendarPanel() {
  const [venue, setVenue] = useState<string>(VENUES[0].name);

  return (
    <div className="space-y-s-md">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="font-headline text-headline-lg text-primary">Availability Calendar</h2>
        <select
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className="p-2 border-2 border-primary bg-surface font-ui-button"
        >
          {VENUES.map((v) => (
            <option key={v.name} value={v.name}>{v.name}</option>
          ))}
        </select>
      </div>
      <AvailabilityCalendar venue={venue} />
    </div>
  );
}
```

- [ ] **Step 2: Update imports**

At the top of `src/routes/hall.tsx`, find:

```tsx
import { subscribeToCalendar, type DayStatus } from "@/lib/hall/calendar";
```

Replace with:

```tsx
import { AvailabilityCalendar } from "@/components/availability-calendar";
```

(`DayStatus` was only used inside the old `CalendarPanel` body just deleted in Step 1 — confirmed by search, it has no other usage in this file — so both `subscribeToCalendar` and `DayStatus` are dropped entirely, replaced by the `AvailabilityCalendar` import.)

- [ ] **Step 3: Manually verify in the browser**

Go to `/hall` → "Hall Status" tab. Confirm the calendar now renders as filled colored cells (red/yellow/green) matching the home page's style, with a venue switcher and month navigation still working.

- [ ] **Step 4: Run the build**

Run: `bun run build`
Expected: succeeds with no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/hall.tsx
git commit -m "Restyle the hall booking page calendar to use the shared red/yellow/green component"
```

---

### Task 9: `calculateBookingFee` drops the `isMember` parameter

**Files:**
- Modify: `src/lib/hall/fees.ts`
- Modify: `src/lib/hall/fees.test.ts`

**Interfaces:**
- Produces: `calculateBookingFee(venue: string): number` (was `(isMember: boolean, venue: string): number`)

- [ ] **Step 1: Update the tests first**

Replace `src/lib/hall/fees.test.ts` entirely with:

```ts
import { describe, it, expect } from "vitest";
import { calculateBookingFee } from "./fees";

describe("calculateBookingFee", () => {
  it("charges the member rate for Executives Club Community Hall", () => {
    expect(calculateBookingFee("Executives Club Community Hall")).toBe(500);
  });
  it("charges the member rate for Multi Purpose Room", () => {
    expect(calculateBookingFee("Multi Purpose Room")).toBe(500);
  });
  it("charges the lower member rate for Shopping Complex Room", () => {
    expect(calculateBookingFee("Shopping Complex Room")).toBe(200);
  });
  it("charges the lower member rate for an unrecognized/Other venue", () => {
    expect(calculateBookingFee("Some Custom Venue")).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/hall/fees.test.ts`
Expected: FAIL — `calculateBookingFee` still requires 2 arguments (TypeScript error) or returns wrong values.

- [ ] **Step 3: Update the implementation**

Replace `src/lib/hall/fees.ts` entirely with:

```ts
const HIGH_TIER_VENUES = new Set(["Executives Club Community Hall", "Multi Purpose Room"]);

export function calculateBookingFee(venue: string): number {
  return HIGH_TIER_VENUES.has(venue) ? 500 : 200;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/lib/hall/fees.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hall/fees.ts src/lib/hall/fees.test.ts
git commit -m "Drop the isMember parameter from calculateBookingFee now that only members can book"
```

---

### Task 10: Remove `isMember` from the booking data model

**Files:**
- Modify: `src/lib/hall/types.ts:28-50` (`BookingDoc`)
- Modify: `src/lib/hall/transactions.ts` (`CreateBookingInput`, `createBooking`)

**Interfaces:**
- Consumes: `calculateBookingFee(venue: string): number` (Task 9)
- Produces: `CreateBookingInput` no longer has an `isMember` field; `BookingDoc` no longer has an `isMember` field.

- [ ] **Step 1: Remove `isMember` from `BookingDoc`**

In `src/lib/hall/types.ts`, find (inside the `BookingDoc` interface):

```ts
  amount: number;
  isMember: boolean;
  cancelledBy: "user" | "admin" | null;
```

Replace with:

```ts
  amount: number;
  cancelledBy: "user" | "admin" | null;
```

(Leave `MemberPublicDoc.isMember` untouched — that's the unrelated membership-directory record used by `verifyMembership`.)

- [ ] **Step 2: Remove `isMember` from `CreateBookingInput` and the fee/doc-building logic**

In `src/lib/hall/transactions.ts`, find:

```ts
export interface CreateBookingInput {
  name: string;
  empId: string;
  phone: string;
  email: string;
  venue: string;
  date: string;
  slot: Slot;
  purpose: string;
  duration: string;
  isMember: boolean;
}
```

Replace with:

```ts
export interface CreateBookingInput {
  name: string;
  empId: string;
  phone: string;
  email: string;
  venue: string;
  date: string;
  slot: Slot;
  purpose: string;
  duration: string;
}
```

Then find:

```ts
  const amount = calculateBookingFee(input.isMember, input.venue);
```

Replace with:

```ts
  const amount = calculateBookingFee(input.venue);
```

Then find:

```ts
      amount,
      isMember: input.isMember,
      cancelledBy: null,
```

Replace with:

```ts
      amount,
      cancelledBy: null,
```

- [ ] **Step 3: Run the full test suite and the build**

Run: `bun run test`
Expected: PASS (no test in this repo directly constructs a `CreateBookingInput` or `BookingDoc` literal, so no test file needs updating here — confirm this is true by checking the output for any type errors).

Run: `bun run build`
Expected: succeeds — this step will surface any remaining call site still passing `isMember` (Task 11 hasn't updated `hall.tsx` yet, so this build IS expected to fail at this point because `hall.tsx`'s `createBooking(...)` call still includes `isMember` and `calculateBookingFee` calls still pass two args). That failure is expected and resolved in Task 11 — do not attempt to fix `hall.tsx` in this task.

- [ ] **Step 4: Commit**

```bash
git add src/lib/hall/types.ts src/lib/hall/transactions.ts
git commit -m "Remove isMember from the booking data model"
```

---

### Task 11: Booking wizard drops Step 1 and prefills the Employee ID from the gate

**Files:**
- Modify: `src/routes/hall.tsx` (`BookingFormState`, `EMPTY_FORM`, `BookingPanel`, the `TABS`-adjacent step labels, imports)

**Interfaces:**
- Consumes: `readGateEmpId` from `@/lib/hall/gate` (Task 2); `calculateBookingFee(venue: string): number` (Task 9); `CreateBookingInput` without `isMember` (Task 10).
- Produces: `BookingPanel`'s external behavior (a tab inside `HallPage`) is unchanged in shape — still a multi-step wizard — but now starts on the renumbered Details step.

- [ ] **Step 1: Update imports**

In `src/routes/hall.tsx`, find:

```tsx
import { verifyMembership } from "@/lib/hall/members";
import { calculateBookingFee } from "@/lib/hall/fees";
```

Replace with:

```tsx
import { readGateEmpId } from "@/lib/hall/gate";
import { calculateBookingFee } from "@/lib/hall/fees";
```

(`verifyMembership` is no longer called from this file — it was only used by the now-deleted Step 1 verification. If `verifyMembership` is used elsewhere in `hall.tsx`, keep the import; check before deleting. It is not used elsewhere in this file.)

- [ ] **Step 2: Simplify `BookingFormState` and `EMPTY_FORM`**

Find:

```tsx
type BookingStep = 1 | 2 | 3 | 4;

interface BookingFormState {
  isMember: boolean | null;
  empId: string;
  verified: boolean;
  name: string;
  phone: string;
  email: string;
  venue: string;
  date: string;
  slot: "Morning" | "Evening" | null;
  purpose: string;
  duration: string;
  acceptedTnc: boolean;
}

const EMPTY_FORM: BookingFormState = {
  isMember: null,
  empId: "",
  verified: false,
  name: "",
  phone: "",
  email: "",
  venue: "",
  date: "",
  slot: null,
  purpose: "",
  duration: "",
  acceptedTnc: false,
};
```

Replace with:

```tsx
type BookingStep = 1 | 2 | 3;

interface BookingFormState {
  empId: string;
  name: string;
  phone: string;
  email: string;
  venue: string;
  date: string;
  slot: "Morning" | "Evening" | null;
  purpose: string;
  duration: string;
  acceptedTnc: boolean;
}

function emptyForm(): BookingFormState {
  return {
    empId: typeof window === "undefined" ? "" : (readGateEmpId((key) => sessionStorage.getItem(key)) ?? ""),
    name: "",
    phone: "",
    email: "",
    venue: "",
    date: "",
    slot: null,
    purpose: "",
    duration: "",
    acceptedTnc: false,
  };
}
```

- [ ] **Step 3: Rewrite `BookingPanel`'s state, step-1 removal, and fee calculation**

Find:

```tsx
function BookingPanel() {
  const [step, setStep] = useState<BookingStep>(1);
  const [form, setForm] = useState<BookingFormState>(EMPTY_FORM);
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ bookingId: string; bookingNumber: string; lookupToken: string; status: "pending-payment" | "pending-approval" } | null>(null);
  const [utr, setUtr] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async () => {
    if (!form.empId.trim()) {
      setVerifyError("Enter your Employee ID");
      return;
    }
    setVerifying(true);
    setVerifyError("");
    try {
      const isMember = await verifyMembership(form.empId.trim());
      if (!isMember) {
        setVerifyError("No member found with this Employee ID");
        return;
      }
      setForm((f) => ({ ...f, verified: true, isMember: true }));
    } finally {
      setVerifying(false);
    }
  };

  const fee = form.venue ? calculateBookingFee(form.isMember === true, form.venue) : null;

  const canProceedStep1 = form.isMember === false || (form.isMember === true && form.verified);
  const canProceedStep2 = Boolean(
```

Replace with:

```tsx
function BookingPanel() {
  const [step, setStep] = useState<BookingStep>(1);
  const [form, setForm] = useState<BookingFormState>(emptyForm);
  const [bookingResult, setBookingResult] = useState<{ bookingId: string; bookingNumber: string; lookupToken: string; status: "pending-payment" | "pending-approval" } | null>(null);
  const [utr, setUtr] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fee = form.venue ? calculateBookingFee(form.venue) : null;

  const canProceedStep1 = Boolean(
```

- [ ] **Step 4: Delete the old Step 1 JSX block and renumber the Details step to `step === 1`**

Find:

```tsx
        {step === 1 && (
          <section className="space-y-6">
            <div className="flex gap-4">
              <button
                className={`p-4 border-2 border-primary font-bold ${form.isMember === true ? "bg-primary text-on-primary" : ""}`}
                onClick={() => setForm((f) => ({ ...f, isMember: true }))}
              >
                I'm a member
              </button>
              <button
                className={`p-4 border-2 border-primary font-bold ${form.isMember === false ? "bg-primary text-on-primary" : ""}`}
                onClick={() => setForm((f) => ({ ...f, isMember: false, verified: false }))}
              >
                I'm not a member
              </button>
            </div>
            {form.isMember === true && (
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Employee ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.empId}
                    onChange={(e) => setForm((f) => ({ ...f, empId: e.target.value, verified: false }))}
                    className="flex-grow p-4 border-2 border-primary bg-surface"
                  />
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="px-6 border-2 border-primary bg-secondary-container font-ui-button"
                  >
                    {verifying ? "Verifying…" : "Verify"}
                  </button>
                </div>
                {verifyError && <p className="text-error text-sm">{verifyError}</p>}
                {form.verified && <p className="text-success text-sm">Verified ✅</p>}
              </div>
            )}
            <div className="flex justify-end pt-s-md">
              <button
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className="brutalist-button bg-secondary-container text-on-surface px-12 py-4 font-ui-button text-lg border-2 border-primary disabled:opacity-40"
              >
                Next: Details
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <div className="grid md:grid-cols-2 gap-s-md">
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Full Name</label>
```

Replace with:

```tsx
        {step === 1 && (
          <section className="space-y-6">
            <div className="grid md:grid-cols-2 gap-s-md">
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Employee ID</label>
                <input type="text" value={form.empId} readOnly disabled className="w-full p-4 border-2 border-primary bg-surface-variant text-on-surface-variant" />
                <p className="text-xs text-on-surface-variant">Verified at login.</p>
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Full Name</label>
```

- [ ] **Step 5: Renumber the rest of the wizard's step references**

Within the same `BookingPanel` function, make these renumbering changes (each `step === N` / `setStep(N)` shifts down by 1, since old Step 1 is gone):

1. Find `{step === 3 && bookingResult && (` → replace with `{step === 2 && bookingResult && (`
2. Find `{step === 4 && bookingResult && (` → replace with `{step === 3 && bookingResult && (`
3. Inside the Step 2 (old) section's submit handler, find `onClick={() => setStep(1)}` (the "Back" button) → replace with removing that Back button entirely, since there's no Step 1 to go back to now: find

```tsx
              <button onClick={() => setStep(1)} className="px-8 py-4 border-2 border-primary font-ui-button">Back</button>
              <button
                disabled={!canProceedStep2 || submitting}
```

replace with:

```tsx
              <button
                disabled={!canProceedStep1 || submitting}
```

Note the `canProceedStep2` → `canProceedStep1` rename here: Step 3 above already renamed the *declaration* (the old `canProceedStep2` validation logic now lives in a variable called `canProceedStep1`, since it guards the new Step 1). This is the only place that reads it, so it must be updated to match or the build will fail with "canProceedStep2 is not defined".

(and remove the now-empty `justify-between` wrapper's need for two children — find the parent `<div className="flex justify-between pt-s-md">` for this section and change `justify-between` to `justify-end`.)

4. Inside the `createBooking` success handler, find `setBookingResult(result); setStep(3);` → replace `setStep(3);` with `setStep(2);`.
5. Inside the `submitUtr` success handler, find `await submitUtr(bookingResult.bookingId, utr.trim()); setStep(4);` → replace `setStep(4);` with `setStep(3);`.
6. Find the "Make another booking" handler:

```tsx
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setBookingResult(null);
                  setUtr("");
                  setStep(1);
                }}
```

Replace with:

```tsx
                onClick={() => {
                  setForm(emptyForm());
                  setBookingResult(null);
                  setUtr("");
                  setStep(1);
                }}
```

7. Find every remaining `calculateBookingFee(form.isMember === true, form.venue)` (there are two, in the Step 3/old-numbering payment section) and replace each with `calculateBookingFee(form.venue)`.
8. Find `isMember: form.isMember === true,` inside the `createBooking({...})` call and delete that line entirely.
9. Update the step-label nav at the top of `BookingPanel`'s JSX: find

```tsx
        <nav className="flex items-center gap-4 text-sm font-bold uppercase tracking-tighter overflow-x-auto pb-2">
          {(["1. Membership", "2. Details", "3. Payment", "4. Confirmation"] as const).map((label, i) => (
```

Replace with:

```tsx
        <nav className="flex items-center gap-4 text-sm font-bold uppercase tracking-tighter overflow-x-auto pb-2">
          {(["1. Details", "2. Payment", "3. Confirmation"] as const).map((label, i) => (
```

- [ ] **Step 6: Run the build**

Run: `bun run build`
Expected: succeeds with no type errors (this resolves the expected failure noted at the end of Task 10).

- [ ] **Step 7: Run the full test suite**

Run: `bun run test`
Expected: PASS.

- [ ] **Step 8: Manually verify in the browser**

Go through the gate with a valid Employee ID, then go to `/hall` → "Book the Hall" tab. Confirm: the wizard opens directly on the Details step (no membership question), the Employee ID field is pre-filled with what you entered at the gate and is not editable, the step nav shows "1. Details / 2. Payment / 3. Confirmation", and completing a full booking (through to UTR submission and the confirmation screen) still works end-to-end. Confirm the Fee sidebar shows the member rate once a venue is selected.

- [ ] **Step 9: Commit**

```bash
git add src/routes/hall.tsx
git commit -m "Remove the non-member booking path and prefill Employee ID from the site gate"
```

---

### Task 12: Drop the non-member rate column from Rules & Rates

**Files:**
- Modify: `src/lib/hall/constants.ts:1-6` (`VENUES`)
- Modify: `src/routes/hall.tsx` (`RulesPanel`'s rate table)

**Interfaces:**
- Produces: `VENUES` entries no longer have a `feeNonMember` field (only `name` and `feeMember` — confirm no other file reads `feeNonMember` before removing; Task-11's grep already confirmed the only two usages are both in the `RulesPanel` table this task rewrites).

- [ ] **Step 1: Drop `feeNonMember` from the venue data**

In `src/lib/hall/constants.ts`, find:

```ts
export const VENUES = [
  { name: "Executives Club Community Hall", feeMember: 500, feeNonMember: 1000 },
  { name: "Shopping Complex Room", feeMember: 200, feeNonMember: 500 },
  { name: "Multi Purpose Room", feeMember: 500, feeNonMember: 1000 },
  { name: "Other", feeMember: 200, feeNonMember: 500 },
] as const;
```

Replace with:

```ts
export const VENUES = [
  { name: "Executives Club Community Hall", feeMember: 500 },
  { name: "Shopping Complex Room", feeMember: 200 },
  { name: "Multi Purpose Room", feeMember: 500 },
  { name: "Other", feeMember: 200 },
] as const;
```

- [ ] **Step 2: Drop the Non-Member column from the rates table**

In `src/routes/hall.tsx`, find:

```tsx
              <tr className="bg-primary text-on-primary uppercase text-xs font-bold tracking-widest">
                <th className="p-4">Venue</th><th className="p-4">Member</th><th className="p-4">Non-Member</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {VENUES.map((v, i) => (
                <tr key={v.name} className={`border-b-2 border-primary/10 ${i % 2 === 1 ? "bg-surface-variant/30" : ""}`}>
                  <td className="p-4 font-bold">{v.name}</td>
                  <td className="p-4">₹{v.feeMember.toLocaleString("en-IN")}</td>
                  <td className="p-4">₹{v.feeNonMember.toLocaleString("en-IN")}</td>
                </tr>
              ))}
```

Replace with:

```tsx
              <tr className="bg-primary text-on-primary uppercase text-xs font-bold tracking-widest">
                <th className="p-4">Venue</th><th className="p-4">Rate</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {VENUES.map((v, i) => (
                <tr key={v.name} className={`border-b-2 border-primary/10 ${i % 2 === 1 ? "bg-surface-variant/30" : ""}`}>
                  <td className="p-4 font-bold">{v.name}</td>
                  <td className="p-4">₹{v.feeMember.toLocaleString("en-IN")}</td>
                </tr>
              ))}
```

- [ ] **Step 3: Run the build**

Run: `bun run build`
Expected: succeeds with no type errors.

- [ ] **Step 4: Manually verify in the browser**

Go to `/hall` → "Rules & Rates" tab. Confirm the rates table now shows only "Venue" and "Rate" columns.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hall/constants.ts src/routes/hall.tsx
git commit -m "Drop the non-member rate column from Rules & Rates"
```

---

## Final Verification

After all 12 tasks: run `bun run test` (full suite) and `bun run build` one more time, then do a full manual pass — clear session storage, load the site, go through the welcome splash → login → home page (gold theme, month calendar) → `/hall` (all four tabs, complete a full booking) → confirm `/admin` still works with its own separate login and is unaffected by the gate or theme (it should still render, now in the new gold color tokens, since Task 1 is site-wide).
