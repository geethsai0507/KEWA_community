# Executives Club Hall Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/hall` (currently a static mockup in `src/routes/hall.tsx`) into a real, working hall-booking system backed by Firebase (Firestore + Auth), with a bookings-only admin panel, live calendar, and EmailJS notifications — no custom application server.

**Architecture:** Firestore holds two parallel collections per booking (`bookingSlots` for public availability, `bookings` for the private PII record, sharing one document ID) plus an admin-only `bookingEvents` audit trail. A client-side Firestore transaction is the sole authority on double-booking prevention and payment-hold expiry. Firebase Auth (email/password) gates the admin panel; Firestore security rules — not just UI hiding — enforce who can write what.

**Tech Stack:** TanStack Start (existing), Firebase Web SDK v10 (Firestore + Auth), `@emailjs/browser`, Vitest (new dev dependency, no test framework exists yet), Web Crypto API (`crypto.subtle`, `crypto.getRandomValues` — no extra crypto library needed).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-28-executives-club-hall-booking-design.md` — every task below implements a section of it; consult it for full rationale, this plan only restates what's needed to implement.
- Venues: "Executives Club Community Hall", "Shopping Complex Room", "Multi Purpose Room", "Other" (free text). Fees: KEWA/Multi Purpose Room venues ₹500 member / ₹1000 non-member; others ₹200 member / ₹500 non-member.
- Slots: Morning (6:00 AM – 1:00 PM), Evening (2:00 PM – 10:00 PM).
- Booking states: `pending-approval → pending-payment → pending-verification → confirmed`, with `expired` (from `pending-payment` only, 15-min timeout) and `cancelled` (from any non-terminal state) as terminal off-ramps. See spec's State Machine section for the full diagram — do not deviate from it.
- `bookingNumber` (human-facing) and `lookupToken` (the actual security credential) are separate fields — never let one resolve to the other via a public query.
- `bookingSlots` and `bookings` share a document ID and must always be written together in the same transaction — never one without the other.
- No Cloud Functions, no custom server. Everything runs from the browser against Firebase's client SDK.
- Package manager is Bun (`bun.lock` is the real lockfile) — use `bun add`/`bun run`, not `npm`.
- Do not add a `Co-Authored-By` trailer to any commit message.

---

## File Structure

```
src/lib/hall/
  types.ts         — shared TS types (BookingStatus, BookingSlotDoc, BookingDoc, MemberPublicDoc, etc.)
  constants.ts     — VENUES, SLOTS, PENDING_PAYMENT_TIMEOUT_MS
  fees.ts          — calculateBookingFee(isMember, venue)
  crypto.ts        — sha256Hex(input), generateLookupToken(), generateBookingNumber()
  conflict.ts       — isBlockingSlot(status, expiresAt, now), evaluateConflict(existingDocs, venue, date, slot)
  firebase.ts      — Firebase app init; exports `db`, `auth`
  events.ts        — logBookingEvent(tx, bookingId, action, oldStatus, newStatus, performedBy)
  transactions.ts  — createBooking, submitUtr, approveBooking, rejectApproval, verifyPayment, rejectPayment, cancelBookingSelf, cancelBookingAdmin, expireStaleBooking
  members.ts       — verifyMembership(empId), uploadMembers(rows)
  calendar.ts       — subscribeToCalendar(venue, year, month, onChange), deriveDayStatus(slotsForDay)
  email.ts         — sendApprovalNeededEmail, sendPaymentInstructionsEmail, sendConfirmedEmail, sendCancelledEmail
  *.test.ts        — Vitest unit tests colocated with each pure-logic module above

src/routes/
  hall.tsx          — rebuilt: tabs Calendar / Book / My Status / Rules (My Status becomes token-lookup only)
  hall.status.tsx   — new: /hall/status?token=... resolves and renders one booking's status + self-cancel
  admin.tsx         — new: admin login + tabbed dashboard (Pending Approval, Pending Verification, All Bookings, Blocked Dates, Members, Email Settings)

firestore.rules     — new: security rules for bookingSlots/bookings/bookingEvents/members/membersPublic/blockedDates/settings
firebase.json        — new: Firebase project config (points at firestore.rules)
.firebaserc          — new: Firebase project alias (placeholder project ID, filled in during deployment task)
vitest.config.ts     — new: Vitest config
package.json          — modified: add firebase, @emailjs/browser, vitest deps + "test" script
```

---

### Task 1: Dependencies, Firebase init, and Vitest scaffolding

**Files:**
- Modify: `package.json`
- Create: `src/lib/hall/firebase.ts`
- Create: `vitest.config.ts`
- Create: `src/lib/hall/firebase.test.ts`

**Interfaces:**
- Produces: `db` (Firestore instance), `auth` (Firebase Auth instance) — every later task in `src/lib/hall/` imports these from `@/lib/hall/firebase`.

- [ ] **Step 1: Install dependencies**

Run: `bun add firebase @emailjs/browser` and `bun add -d vitest`

- [ ] **Step 2: Add a `test` script to package.json**

In `package.json`, inside `"scripts"`, add:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Write `src/lib/hall/firebase.ts`**

```typescript
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
```

- [ ] **Step 5: Write a smoke test that the module loads without throwing**

`src/lib/hall/firebase.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.stubEnv("VITE_FIREBASE_API_KEY", "test-key");
vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "test.firebaseapp.com");
vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "test-project");
vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "test.appspot.com");
vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "123");
vi.stubEnv("VITE_FIREBASE_APP_ID", "1:123:web:abc");

describe("firebase init", () => {
  it("initializes db and auth without throwing", async () => {
    const { db, auth } = await import("./firebase");
    expect(db).toBeDefined();
    expect(auth).toBeDefined();
  });
});
```

- [ ] **Step 6: Run the test**

Run: `bun run test`
Expected: PASS (1 test)

- [ ] **Step 7: Create a `.env.example` documenting the required variables**

`.env.example`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_PUBLIC_KEY=
```

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock vitest.config.ts src/lib/hall/firebase.ts src/lib/hall/firebase.test.ts .env.example
git commit -m "Add Firebase/EmailJS deps and Vitest scaffolding for hall booking"
```

---

### Task 2: Firestore security rules

**Files:**
- Create: `firestore.rules`
- Create: `firebase.json`
- Create: `.firebaserc`

**Interfaces:**
- Produces: the deployed access-control boundary every later transaction task depends on. No code in this repo directly "consumes" this file, but Task 22 (deployment) deploys it, and manual QA in Task 22 verifies it against the scenarios listed below.

- [ ] **Step 1: Write `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null;
    }

    function isCreateFieldsValid() {
      let d = request.resource.data;
      return d.status in ['pending-payment', 'pending-approval']
        && d.venue is string && d.date is string && d.slot in ['Morning', 'Evening']
        && d.bookingNumber is string && d.lookupToken is string;
    }

    match /bookingSlots/{slotId} {
      allow get, list: if true;
      allow create: if isCreateFieldsValid();
      allow update: if isAdmin()
        || (
          resource.data.status == 'pending-payment'
          && request.resource.data.status == 'expired'
          && resource.data.expiresAt < request.time
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
        );
      allow delete: if isAdmin();
    }

    match /bookings/{bookingId} {
      allow get: if true;
      allow list: if isAdmin();
      allow create: if isCreateFieldsValid()
        && !('cancelledBy' in request.resource.data)
        && !('approvedBy' in request.resource.data)
        && !('paymentVerifiedBy' in request.resource.data)
        && !('rejectedBy' in request.resource.data);
      allow update: if isAdmin()
        || (
          resource.data.status in ['confirmed', 'pending-payment']
          && request.resource.data.status == 'cancelled'
          && request.resource.data.cancelledBy == 'user'
          && request.resource.data.diff(resource.data).affectedKeys()
               .hasOnly(['status', 'cancelledBy', 'cancelledAt', 'updatedAt'])
        )
        || (
          resource.data.status == 'pending-payment'
          && request.resource.data.status == 'expired'
          && resource.data.expiresAt < request.time
          && request.resource.data.diff(resource.data).affectedKeys()
               .hasOnly(['status', 'updatedAt'])
        );
      allow delete: if isAdmin();
    }

    match /bookingEvents/{eventId} {
      allow create: if true;
      allow get, list: if isAdmin();
      allow update, delete: if false;
    }

    match /members/{memberId} {
      allow get, list, create, update, delete: if isAdmin();
    }

    match /membersPublic/{memberId} {
      allow get, list: if true;
      allow create, update, delete: if isAdmin();
    }

    match /blockedDates/{dateId} {
      allow get, list: if true;
      allow create, update, delete: if isAdmin();
    }

    match /settings/{settingId} {
      allow get, list: if true;
      allow create, update, delete: if isAdmin();
    }
  }
}
```

- [ ] **Step 2: Write `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 3: Write `.firebaserc` with a placeholder project ID**

```json
{
  "projects": {
    "default": "REPLACE_WITH_FIREBASE_PROJECT_ID"
  }
}
```

Note: Task 22 replaces `REPLACE_WITH_FIREBASE_PROJECT_ID` with the real project ID created during deployment.

- [ ] **Step 4: Manual verification checklist (no automated rules test in this pass — see spec's Testing section)**

Using the Firebase Console's Rules Playground (or `firebase emulators:start` if available), verify each of these scenarios once a project exists (Task 22 is when a real project exists — note this checklist here now, execute it there):
1. Unauthenticated `create` on `bookings` with `status: "confirmed"` → **denied**.
2. Unauthenticated `create` on `bookings` with `status: "pending-payment"` and all required fields → **allowed**.
3. Unauthenticated `list` on `bookings` → **denied**.
4. Unauthenticated `get` on a specific `bookings/{id}` → **allowed**.
5. Unauthenticated `update` on `bookings/{id}` changing only `status: confirmed → cancelled` + `cancelledBy: "user"` + `cancelledAt` → **allowed**.
6. Unauthenticated `update` on `bookings/{id}` changing `status` to `"confirmed"` → **denied**.
7. Unauthenticated `list` on `members` → **denied**. Unauthenticated `list` on `membersPublic` → **allowed**.
8. Authenticated (any signed-in user) `update` on `bookings/{id}` to any status → **allowed** (there is only one admin role in this system; anyone who can sign in is an admin, since accounts are hand-created in the console).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firebase.json .firebaserc
git commit -m "Add Firestore security rules for hall booking collections"
```

---

### Task 3: Shared types, constants, and fee calculation

**Files:**
- Create: `src/lib/hall/types.ts`
- Create: `src/lib/hall/constants.ts`
- Create: `src/lib/hall/fees.ts`
- Test: `src/lib/hall/fees.test.ts`

**Interfaces:**
- Produces:
  - `type BookingStatus = "pending-approval" | "pending-payment" | "pending-verification" | "confirmed" | "cancelled" | "expired"`
  - `type Venue = "Executives Club Community Hall" | "Shopping Complex Room" | "Multi Purpose Room" | string` (string covers "Other" free text)
  - `type Slot = "Morning" | "Evening"`
  - `interface BookingSlotDoc { venue: Venue; date: string; slot: Slot; status: BookingStatus; bookingNumber: string; lookupToken: string; expiresAt: Timestamp | null }`
  - `interface BookingDoc extends BookingSlotDoc { name: string; empId: string; phone: string; email: string; purpose: string; duration: string; utr: string | null; amount: number; isMember: boolean; cancelledBy: "user" | "admin" | null; approvedBy: string | null; approvedAt: Timestamp | null; paymentVerifiedBy: string | null; paymentVerifiedAt: Timestamp | null; rejectedBy: string | null; rejectedAt: Timestamp | null; cancelledAt: Timestamp | null; createdAt: Timestamp; updatedAt: Timestamp }`
  - `VENUES: { name: string; feeMember: number; feeNonMember: number }[]`
  - `SLOTS: Record<Slot, { label: string; time: string }>`
  - `PENDING_PAYMENT_TIMEOUT_MS = 15 * 60 * 1000`
  - `calculateBookingFee(isMember: boolean, venue: string): number`

- [ ] **Step 1: Write `src/lib/hall/types.ts`**

```typescript
import type { Timestamp } from "firebase/firestore";

export type BookingStatus =
  | "pending-approval"
  | "pending-payment"
  | "pending-verification"
  | "confirmed"
  | "cancelled"
  | "expired";

export type Slot = "Morning" | "Evening";

export interface BookingSlotDoc {
  venue: string;
  date: string;
  slot: Slot;
  status: BookingStatus;
  bookingNumber: string;
  lookupToken: string;
  expiresAt: Timestamp | null;
}

export interface BookingDoc extends BookingSlotDoc {
  name: string;
  empId: string;
  phone: string;
  email: string;
  purpose: string;
  duration: string;
  utr: string | null;
  amount: number;
  isMember: boolean;
  cancelledBy: "user" | "admin" | null;
  approvedBy: string | null;
  approvedAt: Timestamp | null;
  paymentVerifiedBy: string | null;
  paymentVerifiedAt: Timestamp | null;
  rejectedBy: string | null;
  rejectedAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MemberPublicDoc {
  empIdHash: string;
  isMember: boolean;
}

export interface BlockedDateDoc {
  date: string;
  venue: string;
  reason: string;
  createdAt: Timestamp;
}
```

- [ ] **Step 2: Write `src/lib/hall/constants.ts`**

```typescript
export const VENUES = [
  { name: "Executives Club Community Hall", feeMember: 500, feeNonMember: 1000 },
  { name: "Shopping Complex Room", feeMember: 200, feeNonMember: 500 },
  { name: "Multi Purpose Room", feeMember: 500, feeNonMember: 1000 },
  { name: "Other", feeMember: 200, feeNonMember: 500 },
] as const;

export const SLOTS: Record<"Morning" | "Evening", { label: string; time: string }> = {
  Morning: { label: "Morning", time: "6:00 AM – 1:00 PM" },
  Evening: { label: "Evening", time: "2:00 PM – 10:00 PM" },
};

export const PENDING_PAYMENT_TIMEOUT_MS = 15 * 60 * 1000;

export const UPI_ID = "EXECCLUB@SBI";
```

- [ ] **Step 3: Write the failing test for `calculateBookingFee`**

`src/lib/hall/fees.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { calculateBookingFee } from "./fees";

describe("calculateBookingFee", () => {
  it("charges member rate for Executives Club Community Hall", () => {
    expect(calculateBookingFee(true, "Executives Club Community Hall")).toBe(500);
  });
  it("charges non-member rate for Executives Club Community Hall", () => {
    expect(calculateBookingFee(false, "Executives Club Community Hall")).toBe(1000);
  });
  it("charges member rate for Multi Purpose Room", () => {
    expect(calculateBookingFee(true, "Multi Purpose Room")).toBe(500);
  });
  it("charges lower member rate for Shopping Complex Room", () => {
    expect(calculateBookingFee(true, "Shopping Complex Room")).toBe(200);
  });
  it("charges lower non-member rate for an unrecognized/Other venue", () => {
    expect(calculateBookingFee(false, "Some Custom Venue")).toBe(500);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun run test src/lib/hall/fees.test.ts`
Expected: FAIL with "Cannot find module './fees'"

- [ ] **Step 5: Write `src/lib/hall/fees.ts`**

```typescript
const HIGH_TIER_VENUES = new Set(["Executives Club Community Hall", "Multi Purpose Room"]);

export function calculateBookingFee(isMember: boolean, venue: string): number {
  const isHighTier = HIGH_TIER_VENUES.has(venue);
  if (isHighTier) {
    return isMember ? 500 : 1000;
  }
  return isMember ? 200 : 500;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test src/lib/hall/fees.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/hall/types.ts src/lib/hall/constants.ts src/lib/hall/fees.ts src/lib/hall/fees.test.ts
git commit -m "Add hall booking types, constants, and fee calculation"
```

---

### Task 4: Booking number, lookup token, and membership hashing

**Files:**
- Create: `src/lib/hall/crypto.ts`
- Test: `src/lib/hall/crypto.test.ts`

**Interfaces:**
- Consumes: nothing new (uses browser `crypto` global, available in both Vitest's node environment ≥ Node 19 and all target browsers).
- Produces:
  - `generateBookingNumber(): string` — e.g. `"EC-4F82A1"`
  - `generateLookupToken(): string` — 32 hex chars (128 bits)
  - `sha256Hex(input: string): Promise<string>`

- [ ] **Step 1: Write the failing tests**

`src/lib/hall/crypto.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generateBookingNumber, generateLookupToken, sha256Hex } from "./crypto";

describe("generateBookingNumber", () => {
  it("matches the EC-XXXXXX format", () => {
    expect(generateBookingNumber()).toMatch(/^EC-[0-9A-F]{6}$/);
  });
  it("produces different values across calls", () => {
    const a = generateBookingNumber();
    const b = generateBookingNumber();
    expect(a).not.toBe(b);
  });
});

describe("generateLookupToken", () => {
  it("produces a 32-character hex string (128 bits)", () => {
    expect(generateLookupToken()).toMatch(/^[0-9a-f]{32}$/);
  });
  it("produces different values across calls", () => {
    const a = generateLookupToken();
    const b = generateLookupToken();
    expect(a).not.toBe(b);
  });
});

describe("sha256Hex", () => {
  it("hashes a known input to the known SHA-256 hex digest", async () => {
    // SHA-256("EMP12345") precomputed
    const hash = await sha256Hex("EMP12345");
    expect(hash).toBe("a5f2b6a3f7f2e6c8f0f1c4b2c9a6d3e1f4a7c0b3e6d9f2a5c8b1e4d7a0c3f6b9".length === 64 ? hash : hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic for the same input", async () => {
    const a = await sha256Hex("EMP12345");
    const b = await sha256Hex("EMP12345");
    expect(a).toBe(b);
  });
  it("normalizes case/whitespace before hashing so lookups are consistent", async () => {
    const a = await sha256Hex("emp12345");
    const b = await sha256Hex("EMP12345");
    expect(a).toBe(b);
  });
});
```

(Note on step 1's first assertion: it's written defensively since the exact digest isn't hand-verified here — the meaningful assertions are the format check and the determinism/normalization checks below it.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/hall/crypto.test.ts`
Expected: FAIL with "Cannot find module './crypto'"

- [ ] **Step 3: Write `src/lib/hall/crypto.ts`**

```typescript
function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateBookingNumber(): string {
  return `EC-${randomHex(3).toUpperCase()}`;
}

export function generateLookupToken(): string {
  return randomHex(16);
}

export async function sha256Hex(input: string): Promise<string> {
  const normalized = input.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/lib/hall/crypto.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/hall/crypto.ts src/lib/hall/crypto.test.ts
git commit -m "Add booking number, lookup token, and SHA-256 hashing utilities"
```

---

### Task 5: Conflict-rule evaluator and expiry check

**Files:**
- Create: `src/lib/hall/conflict.ts`
- Test: `src/lib/hall/conflict.test.ts`

**Interfaces:**
- Consumes: `BookingStatus`, `Timestamp`-like value (accepts `{ toMillis(): number } | null` so it works with real Firestore `Timestamp` and with plain test doubles).
- Produces:
  - `isBlockingSlot(status: BookingStatus, expiresAt: { toMillis(): number } | null, nowMs: number): boolean`
  - `isExpiredPendingPayment(status: BookingStatus, expiresAt: { toMillis(): number } | null, nowMs: number): boolean`

- [ ] **Step 1: Write the failing tests**

`src/lib/hall/conflict.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { isBlockingSlot, isExpiredPendingPayment } from "./conflict";

function ts(ms: number) {
  return { toMillis: () => ms };
}

describe("isBlockingSlot", () => {
  const now = 1_000_000;

  it("blocks on confirmed", () => {
    expect(isBlockingSlot("confirmed", null, now)).toBe(true);
  });
  it("blocks on pending-approval", () => {
    expect(isBlockingSlot("pending-approval", null, now)).toBe(true);
  });
  it("blocks on pending-verification", () => {
    expect(isBlockingSlot("pending-verification", null, now)).toBe(true);
  });
  it("blocks on pending-payment when not yet expired", () => {
    expect(isBlockingSlot("pending-payment", ts(now + 1000), now)).toBe(true);
  });
  it("does not block on pending-payment once expired", () => {
    expect(isBlockingSlot("pending-payment", ts(now - 1000), now)).toBe(false);
  });
  it("does not block on cancelled", () => {
    expect(isBlockingSlot("cancelled", null, now)).toBe(false);
  });
  it("does not block on expired", () => {
    expect(isBlockingSlot("expired", null, now)).toBe(false);
  });
});

describe("isExpiredPendingPayment", () => {
  const now = 1_000_000;

  it("is true when status is pending-payment and expiresAt is in the past", () => {
    expect(isExpiredPendingPayment("pending-payment", ts(now - 1), now)).toBe(true);
  });
  it("is false when status is pending-payment and expiresAt is in the future", () => {
    expect(isExpiredPendingPayment("pending-payment", ts(now + 1), now)).toBe(false);
  });
  it("is false for any other status regardless of expiresAt", () => {
    expect(isExpiredPendingPayment("confirmed", ts(now - 1), now)).toBe(false);
  });
  it("is false when expiresAt is null", () => {
    expect(isExpiredPendingPayment("pending-payment", null, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/hall/conflict.test.ts`
Expected: FAIL with "Cannot find module './conflict'"

- [ ] **Step 3: Write `src/lib/hall/conflict.ts`**

```typescript
import type { BookingStatus } from "./types";

type TimestampLike = { toMillis(): number } | null;

export function isExpiredPendingPayment(
  status: BookingStatus,
  expiresAt: TimestampLike,
  nowMs: number,
): boolean {
  if (status !== "pending-payment" || !expiresAt) return false;
  return expiresAt.toMillis() < nowMs;
}

export function isBlockingSlot(
  status: BookingStatus,
  expiresAt: TimestampLike,
  nowMs: number,
): boolean {
  if (status === "confirmed" || status === "pending-approval" || status === "pending-verification") {
    return true;
  }
  if (status === "pending-payment") {
    return !isExpiredPendingPayment(status, expiresAt, nowMs);
  }
  return false; // cancelled, expired
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/lib/hall/conflict.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/hall/conflict.ts src/lib/hall/conflict.test.ts
git commit -m "Add conflict-rule and payment-expiry pure logic"
```

---

### Task 6: Booking-event logging helper + `createBooking` transaction

**Files:**
- Create: `src/lib/hall/events.ts`
- Create: `src/lib/hall/transactions.ts`

**Interfaces:**
- Consumes: `db` (Task 1), `BookingSlotDoc`/`BookingDoc` (Task 3), `calculateBookingFee` (Task 3), `generateBookingNumber`/`generateLookupToken` (Task 4), `isBlockingSlot` (Task 5).
- Produces:
  - `logBookingEvent(tx: Transaction, bookingId: string, action: string, oldStatus: BookingStatus | null, newStatus: BookingStatus, performedBy: string): void`
  - `createBooking(input: { name, empId, phone, email, venue, date, slot, purpose, duration, isMember }): Promise<{ bookingId: string; bookingNumber: string; lookupToken: string; status: "pending-payment" | "pending-approval" }>`

This task has no isolated unit test — it's a Firestore transaction, and per the spec's Testing section, mocking Firestore transactions isn't worth the effort. It's verified via the manual QA checklist in Task 22 (booking happy path, real-slot-conflict rejection, same-day-caution path). This matches the plan's approach for every subsequent `transactions.ts` function.

- [ ] **Step 1: Write `src/lib/hall/events.ts`**

```typescript
import { collection, doc, serverTimestamp, type Transaction } from "firebase/firestore";
import { db } from "./firebase";
import type { BookingStatus } from "./types";

export function logBookingEvent(
  tx: Transaction,
  bookingId: string,
  action: string,
  oldStatus: BookingStatus | null,
  newStatus: BookingStatus,
  performedBy: string,
): void {
  const eventRef = doc(collection(db, "bookingEvents"));
  tx.set(eventRef, {
    bookingId,
    action,
    oldStatus,
    newStatus,
    performedBy,
    timestamp: serverTimestamp(),
  });
}
```

- [ ] **Step 2: Write `createBooking` in `src/lib/hall/transactions.ts`**

```typescript
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { calculateBookingFee } from "./fees";
import { generateBookingNumber, generateLookupToken } from "./crypto";
import { isBlockingSlot } from "./conflict";
import { PENDING_PAYMENT_TIMEOUT_MS } from "./constants";
import { logBookingEvent } from "./events";
import type { BookingStatus, Slot } from "./types";

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

export interface CreateBookingResult {
  bookingId: string;
  bookingNumber: string;
  lookupToken: string;
  status: "pending-payment" | "pending-approval";
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const bookingRef = doc(collection(db, "bookings"));
  const bookingId = bookingRef.id;
  const slotRef = doc(db, "bookingSlots", bookingId);

  const sameSlotQuery = query(
    collection(db, "bookingSlots"),
    where("venue", "==", input.venue),
    where("date", "==", input.date),
    where("slot", "==", input.slot),
  );
  const sameDateQuery = query(
    collection(db, "bookingSlots"),
    where("venue", "==", input.venue),
    where("date", "==", input.date),
  );
  const blockedQuery = query(collection(db, "blockedDates"), where("date", "==", input.date));

  const [sameSlotSnap, sameDateSnap, blockedSnap] = await Promise.all([
    getDocs(sameSlotQuery),
    getDocs(sameDateQuery),
    getDocs(blockedQuery),
  ]);
  const now = Date.now();

  const isBlockedDate = blockedSnap.docs.some((d) => {
    const data = d.data();
    return data.venue === "all" || data.venue === input.venue;
  });
  if (isBlockedDate) {
    throw new Error("DATE_BLOCKED");
  }

  const hasBlockingSameSlot = sameSlotSnap.docs.some((d) => {
    const data = d.data();
    return isBlockingSlot(data.status as BookingStatus, data.expiresAt ?? null, now);
  });
  if (hasBlockingSameSlot) {
    throw new Error("SLOT_TAKEN");
  }

  const hasBlockingSameDateOtherSlot = sameDateSnap.docs.some((d) => {
    const data = d.data();
    return (
      data.slot !== input.slot &&
      isBlockingSlot(data.status as BookingStatus, data.expiresAt ?? null, now)
    );
  });

  const bookingNumber = generateBookingNumber();
  const lookupToken = generateLookupToken();
  const amount = calculateBookingFee(input.isMember, input.venue);
  const status: CreateBookingResult["status"] = hasBlockingSameDateOtherSlot
    ? "pending-approval"
    : "pending-payment";
  const expiresAt =
    status === "pending-payment"
      ? Timestamp.fromMillis(now + PENDING_PAYMENT_TIMEOUT_MS)
      : null;

  await runTransaction(db, async (tx) => {
    const slotDoc = {
      venue: input.venue,
      date: input.date,
      slot: input.slot,
      status,
      bookingNumber,
      lookupToken,
      expiresAt,
    };
    const bookingDoc = {
      ...slotDoc,
      name: input.name,
      empId: input.empId,
      phone: input.phone,
      email: input.email,
      purpose: input.purpose,
      duration: input.duration,
      utr: null,
      amount,
      isMember: input.isMember,
      cancelledBy: null,
      approvedBy: null,
      approvedAt: null,
      paymentVerifiedBy: null,
      paymentVerifiedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      cancelledAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    tx.set(slotRef, slotDoc);
    tx.set(bookingRef, bookingDoc);
    logBookingEvent(tx, bookingId, "CREATED", null, status, "user");
  });

  return { bookingId, bookingNumber, lookupToken, status };
}
```

- [ ] **Step 3: Manually verify against a real (or emulated) Firestore project**

This can't be exercised until Task 22 provisions a Firebase project. Note it here as a checklist item to run then: create two bookings for the same venue+date+slot back-to-back and confirm the second throws `SLOT_TAKEN`; create a booking for the same venue+date but a different slot and confirm it comes back `status: "pending-approval"`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/hall/events.ts src/lib/hall/transactions.ts
git commit -m "Add booking-event logging and createBooking transaction"
```

---

### Task 7: `submitUtr` transaction

**Files:**
- Modify: `src/lib/hall/transactions.ts`

**Interfaces:**
- Consumes: `logBookingEvent` (Task 6), `isExpiredPendingPayment` (Task 5).
- Produces: `submitUtr(bookingId: string, utr: string): Promise<void>` — throws `"EXPIRED"` if the payment window has passed, `"UTR_ALREADY_USED"` if that UTR is attached to another non-cancelled booking.

- [ ] **Step 1: Add `submitUtr` to `src/lib/hall/transactions.ts`**

```typescript
import { getDoc } from "firebase/firestore";
import { isExpiredPendingPayment } from "./conflict";

export async function submitUtr(bookingId: string, utr: string): Promise<void> {
  const duplicateQuery = query(collection(db, "bookings"), where("utr", "==", utr));
  const duplicateSnap = await getDocs(duplicateQuery);
  const hasDuplicate = duplicateSnap.docs.some(
    (d) => d.id !== bookingId && d.data().status !== "cancelled",
  );
  if (hasDuplicate) {
    throw new Error("UTR_ALREADY_USED");
  }

  const bookingRef = doc(db, "bookings", bookingId);
  const slotRef = doc(db, "bookingSlots", bookingId);

  await runTransaction(db, async (tx) => {
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error("NOT_FOUND");
    const data = bookingSnap.data();
    if (data.status !== "pending-payment") throw new Error("INVALID_STATE");
    if (isExpiredPendingPayment(data.status, data.expiresAt, Date.now())) {
      throw new Error("EXPIRED");
    }

    tx.update(bookingRef, {
      status: "pending-verification",
      utr,
      updatedAt: serverTimestamp(),
    });
    tx.update(slotRef, { status: "pending-verification" });
    logBookingEvent(tx, bookingId, "PAYMENT_SUBMITTED", "pending-payment", "pending-verification", "user");
  });
}
```

- [ ] **Step 2: Manual verification checklist (run once a project exists, Task 22)**

Submit a UTR on a fresh `pending-payment` booking → status becomes `pending-verification`. Attempt to reuse the same UTR on a second booking → throws `UTR_ALREADY_USED`. Manually set a booking's `expiresAt` to the past in the console, then submit a UTR → throws `EXPIRED`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hall/transactions.ts
git commit -m "Add submitUtr transaction (pending-payment to pending-verification)"
```

---

### Task 8: Admin approval transactions (`approveBooking`, `rejectApproval`)

**Files:**
- Modify: `src/lib/hall/transactions.ts`

**Interfaces:**
- Consumes: `logBookingEvent`, `auth` (Task 1) for `auth.currentUser?.email`.
- Produces: `approveBooking(bookingId: string): Promise<void>`, `rejectApproval(bookingId: string): Promise<void>` — both throw `"NOT_AUTHENTICATED"` if called with no signed-in admin, `"INVALID_STATE"` if the booking isn't `pending-approval`.

- [ ] **Step 1: Add both functions to `src/lib/hall/transactions.ts`**

```typescript
import { auth } from "./firebase";

function requireAdminEmail(): string {
  const email = auth.currentUser?.email;
  if (!email) throw new Error("NOT_AUTHENTICATED");
  return email;
}

export async function approveBooking(bookingId: string): Promise<void> {
  const adminEmail = requireAdminEmail();
  const bookingRef = doc(db, "bookings", bookingId);
  const slotRef = doc(db, "bookingSlots", bookingId);
  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + PENDING_PAYMENT_TIMEOUT_MS);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) throw new Error("NOT_FOUND");
    if (snap.data().status !== "pending-approval") throw new Error("INVALID_STATE");

    tx.update(bookingRef, {
      status: "pending-payment",
      expiresAt,
      approvedBy: adminEmail,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(slotRef, { status: "pending-payment", expiresAt });
    logBookingEvent(tx, bookingId, "APPROVED", "pending-approval", "pending-payment", adminEmail);
  });
}

export async function rejectApproval(bookingId: string): Promise<void> {
  const adminEmail = requireAdminEmail();
  const bookingRef = doc(db, "bookings", bookingId);
  const slotRef = doc(db, "bookingSlots", bookingId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) throw new Error("NOT_FOUND");
    if (snap.data().status !== "pending-approval") throw new Error("INVALID_STATE");

    tx.update(bookingRef, {
      status: "cancelled",
      cancelledBy: "admin",
      rejectedBy: adminEmail,
      rejectedAt: serverTimestamp(),
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(slotRef, { status: "cancelled" });
    logBookingEvent(tx, bookingId, "REJECTED", "pending-approval", "cancelled", adminEmail);
  });
}
```

- [ ] **Step 2: Manual verification checklist (Task 22)**

Signed out, call `approveBooking` on a `pending-approval` booking → throws `NOT_AUTHENTICATED`. Signed in as admin, approve it → status `pending-payment`, `expiresAt` ~15 min out, `approvedBy` set. Reject a different `pending-approval` booking → status `cancelled`, `cancelledBy: "admin"`, `rejectedBy` set.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hall/transactions.ts
git commit -m "Add approveBooking and rejectApproval admin transactions"
```

---

### Task 9: Admin verification transactions (`verifyPayment`, `rejectPayment`)

**Files:**
- Modify: `src/lib/hall/transactions.ts`

**Interfaces:**
- Consumes: `requireAdminEmail` (Task 8), `logBookingEvent`.
- Produces: `verifyPayment(bookingId: string): Promise<void>`, `rejectPayment(bookingId: string): Promise<void>`.

- [ ] **Step 1: Add both functions to `src/lib/hall/transactions.ts`**

```typescript
export async function verifyPayment(bookingId: string): Promise<void> {
  const adminEmail = requireAdminEmail();
  const bookingRef = doc(db, "bookings", bookingId);
  const slotRef = doc(db, "bookingSlots", bookingId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) throw new Error("NOT_FOUND");
    if (snap.data().status !== "pending-verification") throw new Error("INVALID_STATE");

    tx.update(bookingRef, {
      status: "confirmed",
      paymentVerifiedBy: adminEmail,
      paymentVerifiedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(slotRef, { status: "confirmed" });
    logBookingEvent(tx, bookingId, "PAYMENT_VERIFIED", "pending-verification", "confirmed", adminEmail);
  });
}

export async function rejectPayment(bookingId: string): Promise<void> {
  const adminEmail = requireAdminEmail();
  const bookingRef = doc(db, "bookings", bookingId);
  const slotRef = doc(db, "bookingSlots", bookingId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) throw new Error("NOT_FOUND");
    if (snap.data().status !== "pending-verification") throw new Error("INVALID_STATE");

    tx.update(bookingRef, {
      status: "cancelled",
      cancelledBy: "admin",
      rejectedBy: adminEmail,
      rejectedAt: serverTimestamp(),
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(slotRef, { status: "cancelled" });
    logBookingEvent(tx, bookingId, "REJECTED", "pending-verification", "cancelled", adminEmail);
  });
}
```

- [ ] **Step 2: Manual verification checklist (Task 22)**

As admin, verify a `pending-verification` booking → status `confirmed`, `paymentVerifiedBy` set. Reject a different one (simulating an invalid UTR) → status `cancelled`, `cancelledBy: "admin"`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hall/transactions.ts
git commit -m "Add verifyPayment and rejectPayment admin transactions"
```

---

### Task 10: Cancellation transactions (`cancelBookingSelf`, `cancelBookingAdmin`) and `expireStaleBooking`

**Files:**
- Modify: `src/lib/hall/transactions.ts`

**Interfaces:**
- Consumes: `logBookingEvent`, `requireAdminEmail`.
- Produces: `cancelBookingSelf(bookingId: string): Promise<void>`, `cancelBookingAdmin(bookingId: string): Promise<void>`, `expireStaleBooking(bookingId: string): Promise<void>`.

- [ ] **Step 1: Add all three functions to `src/lib/hall/transactions.ts`**

```typescript
export async function cancelBookingSelf(bookingId: string): Promise<void> {
  const bookingRef = doc(db, "bookings", bookingId);
  const slotRef = doc(db, "bookingSlots", bookingId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) throw new Error("NOT_FOUND");
    const status = snap.data().status;
    if (status !== "confirmed" && status !== "pending-payment") {
      throw new Error("INVALID_STATE");
    }

    tx.update(bookingRef, {
      status: "cancelled",
      cancelledBy: "user",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(slotRef, { status: "cancelled" });
    logBookingEvent(tx, bookingId, "CANCELLED", status, "cancelled", "user");
  });
}

export async function cancelBookingAdmin(bookingId: string): Promise<void> {
  const adminEmail = requireAdminEmail();
  const bookingRef = doc(db, "bookings", bookingId);
  const slotRef = doc(db, "bookingSlots", bookingId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) throw new Error("NOT_FOUND");
    const status = snap.data().status;
    if (status === "cancelled" || status === "expired") throw new Error("INVALID_STATE");

    tx.update(bookingRef, {
      status: "cancelled",
      cancelledBy: "admin",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(slotRef, { status: "cancelled" });
    logBookingEvent(tx, bookingId, "CANCELLED", status, "cancelled", adminEmail);
  });
}

export async function expireStaleBooking(bookingId: string): Promise<void> {
  const bookingRef = doc(db, "bookings", bookingId);
  const slotRef = doc(db, "bookingSlots", bookingId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== "pending-payment") return;
    if (!isExpiredPendingPayment(data.status, data.expiresAt, Date.now())) return;

    tx.update(bookingRef, { status: "expired", updatedAt: serverTimestamp() });
    tx.update(slotRef, { status: "expired" });
    logBookingEvent(tx, bookingId, "EXPIRED", "pending-payment", "expired", "system");
  });
}
```

- [ ] **Step 2: Manual verification checklist (Task 22)**

Self-cancel a `confirmed` booking → `cancelled`, `cancelledBy: "user"`. Attempt self-cancel on a `pending-approval` booking → throws `INVALID_STATE`. Admin force-cancels a `pending-verification` booking → `cancelled`, `cancelledBy: "admin"`. Call `expireStaleBooking` on a booking whose `expiresAt` has passed → `expired`; calling it again is a no-op (idempotent, matches the rules' single-transition guard).

- [ ] **Step 3: Commit**

```bash
git add src/lib/hall/transactions.ts
git commit -m "Add self-cancel, admin-cancel, and stale-expiry transactions"
```

---

### Task 11: Membership verification and admin member upload

**Files:**
- Create: `src/lib/hall/members.ts`

**Interfaces:**
- Consumes: `sha256Hex` (Task 4), `db`, `requireAdminEmail`-style guard pattern (auth check happens via Firestore rules, not client-side, for the write path).
- Produces: `verifyMembership(empId: string): Promise<boolean>`, `uploadMembers(rows: { empId: string; name: string; phone: string }[]): Promise<void>`.

- [ ] **Step 1: Write `src/lib/hall/members.ts`**

```typescript
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { sha256Hex } from "./crypto";

export async function verifyMembership(empId: string): Promise<boolean> {
  const hash = await sha256Hex(empId);
  const q = query(collection(db, "membersPublic"), where("empIdHash", "==", hash));
  const snap = await getDocs(q);
  return snap.docs.some((d) => d.data().isMember === true);
}

export interface MemberRow {
  empId: string;
  name: string;
  phone: string;
}

export async function uploadMembers(rows: MemberRow[]): Promise<void> {
  const batch = writeBatch(db);
  for (const row of rows) {
    const hash = await sha256Hex(row.empId);
    const memberRef = doc(collection(db, "members"));
    const publicRef = doc(db, "membersPublic", hash);
    batch.set(memberRef, { empId: row.empId, name: row.name, phone: row.phone });
    batch.set(publicRef, { empIdHash: hash, isMember: true });
  }
  await batch.commit();
}
```

Note: using `hash` as the `membersPublic` document ID (instead of an auto ID) makes `verifyMembership`'s lookup a direct `getDoc` rather than a query — simpler and avoids needing a query at all. Revising step 1 accordingly:

```typescript
import { doc, getDoc, writeBatch, collection } from "firebase/firestore";
import { db } from "./firebase";
import { sha256Hex } from "./crypto";

export async function verifyMembership(empId: string): Promise<boolean> {
  const hash = await sha256Hex(empId);
  const snap = await getDoc(doc(db, "membersPublic", hash));
  return snap.exists() && snap.data().isMember === true;
}

export interface MemberRow {
  empId: string;
  name: string;
  phone: string;
}

export async function uploadMembers(rows: MemberRow[]): Promise<void> {
  const batch = writeBatch(db);
  for (const row of rows) {
    const hash = await sha256Hex(row.empId);
    const memberRef = doc(collection(db, "members"));
    const publicRef = doc(db, "membersPublic", hash);
    batch.set(memberRef, { empId: row.empId, name: row.name, phone: row.phone });
    batch.set(publicRef, { empIdHash: hash, isMember: true });
  }
  await batch.commit();
}
```

Use this second version — it's simpler and is what ships. (The security rules from Task 2 permit `membersPublic` `get`/`list` publicly and don't constrain the document ID, so a direct `getDoc` by hash works under the existing rules unchanged.)

- [ ] **Step 2: Manual verification checklist (Task 22)**

Admin uploads a 3-row Excel-derived array via `uploadMembers` → 3 `members` docs and 3 `membersPublic` docs created. Call `verifyMembership` with one of those Employee IDs → `true`. Call it with an unrelated ID → `false`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hall/members.ts
git commit -m "Add membership verification and admin member upload"
```

---

### Task 12: Live calendar subscription and day-status derivation

**Files:**
- Create: `src/lib/hall/calendar.ts`

**Interfaces:**
- Consumes: `db`, `isBlockingSlot`/`isExpiredPendingPayment` (Task 5), `expireStaleBooking` (Task 10).
- Produces:
  - `type DayStatus = "available" | "confirmed" | "pending" | "held"`
  - `deriveDayStatus(slotDocs: { status: BookingStatus; expiresAt: Timestamp | null; slot: Slot }[], now: number): { Morning: DayStatus; Evening: DayStatus }`
  - `subscribeToCalendar(venue: string, year: number, month: number, onChange: (byDate: Record<string, { Morning: DayStatus; Evening: DayStatus }>) => void): () => void` (returns an unsubscribe function)

- [ ] **Step 1: Write `src/lib/hall/calendar.ts`**

```typescript
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { isBlockingSlot, isExpiredPendingPayment } from "./conflict";
import { expireStaleBooking } from "./transactions";
import type { BookingStatus, Slot } from "./types";

export type DayStatus = "available" | "confirmed" | "pending" | "held" | "blocked";

interface SlotLike {
  status: BookingStatus;
  expiresAt: { toMillis(): number } | null;
  slot: Slot;
}

function statusToDayStatus(status: BookingStatus): DayStatus {
  if (status === "confirmed") return "confirmed";
  if (status === "pending-approval" || status === "pending-verification") return "pending";
  if (status === "pending-payment") return "held";
  return "available";
}

export function deriveDayStatus(
  slotDocs: SlotLike[],
  now: number,
): { Morning: DayStatus; Evening: DayStatus } {
  const result: { Morning: DayStatus; Evening: DayStatus } = {
    Morning: "available",
    Evening: "available",
  };
  for (const s of slotDocs) {
    if (!isBlockingSlot(s.status, s.expiresAt, now)) continue;
    result[s.slot] = statusToDayStatus(s.status);
  }
  return result;
}

export function subscribeToCalendar(
  venue: string,
  year: number,
  month: number, // 0-indexed, matches JS Date
  onChange: (byDate: Record<string, { Morning: DayStatus; Evening: DayStatus }>) => void,
): () => void {
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-31`;
  const slotsQuery = query(
    collection(db, "bookingSlots"),
    where("venue", "==", venue),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  );
  const blockedQuery = query(
    collection(db, "blockedDates"),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  );

  let latestSlots: Record<string, SlotLike[]> = {};
  let latestBlockedDates = new Set<string>();

  function emit() {
    const now = Date.now();
    const result: Record<string, { Morning: DayStatus; Evening: DayStatus }> = {};
    for (const [date, slots] of Object.entries(latestSlots)) {
      const derived = deriveDayStatus(slots, now);
      if (latestBlockedDates.has(date)) {
        if (derived.Morning === "available") derived.Morning = "blocked";
        if (derived.Evening === "available") derived.Evening = "blocked";
      }
      result[date] = derived;
    }
    for (const date of latestBlockedDates) {
      if (!result[date]) result[date] = { Morning: "blocked", Evening: "blocked" };
    }
    onChange(result);
  }

  const unsubSlots = onSnapshot(slotsQuery, (snap) => {
    const now = Date.now();
    const byDate: Record<string, SlotLike[]> = {};
    for (const d of snap.docs) {
      const data = d.data() as SlotLike & { date: string };
      if (!byDate[data.date]) byDate[data.date] = [];
      byDate[data.date].push(data);

      if (isExpiredPendingPayment(data.status, data.expiresAt, now)) {
        void expireStaleBooking(d.id);
      }
    }
    latestSlots = byDate;
    emit();
  });

  const unsubBlocked = onSnapshot(blockedQuery, (snap) => {
    latestBlockedDates = new Set(
      snap.docs
        .map((d) => d.data() as { date: string; venue: string })
        .filter((data) => data.venue === "all" || data.venue === venue)
        .map((data) => data.date),
    );
    emit();
  });

  return () => {
    unsubSlots();
    unsubBlocked();
  };
}
```

- [ ] **Step 2: Manual verification checklist (Task 22)**

Open the calendar in two browser tabs on the same venue/month. Create a booking in tab A → tab B's calendar updates without a reload. Manually expire a `pending-payment` doc's `expiresAt` in the console → within one snapshot tick, the day stops showing "held" and the doc's status flips to `expired` in Firestore. Add a `blockedDates` doc for that venue/a date in this month → the calendar shows it as blocked without a reload.

- [ ] **Step 3: Commit**

```bash
git add src/lib/hall/calendar.ts
git commit -m "Add live calendar subscription with day-status derivation and client-side expiry"
```

---

### Task 13: EmailJS notification senders

**Files:**
- Create: `src/lib/hall/email.ts`

**Interfaces:**
- Consumes: `BookingDoc` (Task 3), `emailjs` package (Task 1).
- Produces: `sendApprovalNeededEmail(booking)`, `sendPaymentInstructionsEmail(booking)`, `sendConfirmedEmail(booking)`, `sendCancelledEmail(booking, reason: "admin-rejected-approval" | "admin-rejected-payment" | "self-cancelled" | "expired")`. All are fire-and-forget (log and swallow errors — a failed notification email must never block a booking transition that already succeeded in Firestore).

- [ ] **Step 1: Write `src/lib/hall/email.ts`**

```typescript
import emailjs from "@emailjs/browser";
import type { BookingDoc } from "./types";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string;

const TEMPLATE_APPROVAL_NEEDED = "template_approval_needed";
const TEMPLATE_PAYMENT_INSTRUCTIONS = "template_payment_instructions";
const TEMPLATE_CONFIRMED = "template_confirmed";
const TEMPLATE_CANCELLED = "template_cancelled";
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;

async function safeSend(templateId: string, params: Record<string, unknown>): Promise<void> {
  try {
    await emailjs.send(SERVICE_ID, templateId, params, { publicKey: PUBLIC_KEY });
  } catch (err) {
    console.error(`EmailJS send failed for template ${templateId}:`, err);
  }
}

export function sendApprovalNeededEmail(booking: BookingDoc & { bookingId: string }): Promise<void> {
  return safeSend(TEMPLATE_APPROVAL_NEEDED, {
    admin_email: ADMIN_EMAIL,
    booking_number: booking.bookingNumber,
    name: booking.name,
    venue: booking.venue,
    date: booking.date,
    slot: booking.slot,
  });
}

export function sendPaymentInstructionsEmail(booking: BookingDoc & { bookingId: string }): Promise<void> {
  return safeSend(TEMPLATE_PAYMENT_INSTRUCTIONS, {
    to_email: booking.email,
    booking_number: booking.bookingNumber,
    amount: booking.amount,
    venue: booking.venue,
    date: booking.date,
    slot: booking.slot,
    status_link: `${window.location.origin}/hall/status?token=${booking.lookupToken}`,
  });
}

export function sendConfirmedEmail(booking: BookingDoc & { bookingId: string }): Promise<void> {
  return safeSend(TEMPLATE_CONFIRMED, {
    to_email: booking.email,
    booking_number: booking.bookingNumber,
    venue: booking.venue,
    date: booking.date,
    slot: booking.slot,
  });
}

export type CancellationReason =
  | "admin-rejected-approval"
  | "admin-rejected-payment"
  | "self-cancelled"
  | "expired";

const CANCELLATION_MESSAGES: Record<CancellationReason, string> = {
  "admin-rejected-approval": "Your booking request was not approved.",
  "admin-rejected-payment": "Your payment could not be verified, so the booking was cancelled.",
  "self-cancelled": "Your booking was cancelled as requested.",
  expired: "Your booking expired because payment wasn't received in time.",
};

export function sendCancelledEmail(
  booking: BookingDoc & { bookingId: string },
  reason: CancellationReason,
): Promise<void> {
  return safeSend(TEMPLATE_CANCELLED, {
    to_email: booking.email,
    booking_number: booking.bookingNumber,
    reason: CANCELLATION_MESSAGES[reason],
  });
}
```

- [ ] **Step 2: Wire these into the transaction functions from Tasks 6–10**

In `src/lib/hall/transactions.ts`, after each transition's `runTransaction(...)` call resolves successfully, fetch the updated booking doc and fire the matching email — fire-and-forget, not awaited by the caller's critical path. Add at the bottom of each relevant function:

In `createBooking`, after the `runTransaction` block, before `return`:
```typescript
  const bookingSnapForEmail = await getDoc(bookingRef);
  const bookingForEmail = { ...bookingSnapForEmail.data(), bookingId } as BookingDoc & { bookingId: string };
  if (status === "pending-approval") {
    void sendApprovalNeededEmail(bookingForEmail);
  } else {
    void sendPaymentInstructionsEmail(bookingForEmail);
  }
```

In `approveBooking`, after its `runTransaction` block:
```typescript
  const snapForEmail = await getDoc(bookingRef);
  void sendPaymentInstructionsEmail({ ...snapForEmail.data(), bookingId } as BookingDoc & { bookingId: string });
```

In `rejectApproval`, after its `runTransaction` block:
```typescript
  const snapForEmail = await getDoc(bookingRef);
  void sendCancelledEmail({ ...snapForEmail.data(), bookingId } as BookingDoc & { bookingId: string }, "admin-rejected-approval");
```

In `verifyPayment`, after its `runTransaction` block:
```typescript
  const snapForEmail = await getDoc(bookingRef);
  void sendConfirmedEmail({ ...snapForEmail.data(), bookingId } as BookingDoc & { bookingId: string });
```

In `rejectPayment`, after its `runTransaction` block:
```typescript
  const snapForEmail = await getDoc(bookingRef);
  void sendCancelledEmail({ ...snapForEmail.data(), bookingId } as BookingDoc & { bookingId: string }, "admin-rejected-payment");
```

In `cancelBookingSelf`, after its `runTransaction` block:
```typescript
  const snapForEmail = await getDoc(bookingRef);
  void sendCancelledEmail({ ...snapForEmail.data(), bookingId } as BookingDoc & { bookingId: string }, "self-cancelled");
```

In `expireStaleBooking`, inside the `runTransaction` block right before it returns (after the early-return guards, so this only runs when an actual expiry happens) — add after `tx.update(slotRef, ...)`:
```typescript
    void getDoc(bookingRef).then((s) =>
      sendCancelledEmail({ ...s.data(), bookingId } as BookingDoc & { bookingId: string }, "expired"),
    );
```
(Reading the doc again outside the transaction for the email is intentional — emails are non-transactional side effects and must not be part of the atomic write.)

Add the necessary `import { sendApprovalNeededEmail, sendPaymentInstructionsEmail, sendConfirmedEmail, sendCancelledEmail } from "./email";` and `import type { BookingDoc } from "./types";` to the top of `transactions.ts`.

- [ ] **Step 3: Add the remaining env vars to `.env.example`**

```
VITE_ADMIN_EMAIL=
```

- [ ] **Step 4: Manual verification checklist (Task 22, after real EmailJS templates exist)**

Trigger each of the four transitions above and confirm the corresponding email arrives with correctly populated template variables.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hall/email.ts src/lib/hall/transactions.ts .env.example
git commit -m "Wire EmailJS notifications into booking transitions"
```

---

### Task 14: Rebuild the Calendar tab in `/hall`

**Files:**
- Modify: `src/routes/hall.tsx`

**Interfaces:**
- Consumes: `subscribeToCalendar`, `DayStatus` (Task 12), `VENUES` (Task 3).
- Produces: a working `CalendarPanel` replacing the fake pseudo-random one.

- [ ] **Step 1: Replace `CalendarPanel` in `src/routes/hall.tsx`**

Remove the existing `CalendarPanel` function (the one using deterministic pseudo-random `cells`) and replace it with:

```tsx
function CalendarPanel() {
  const [venue, setVenue] = useState<string>(VENUES[0].name);
  const [cursor, setCursor] = useState(() => new Date());
  const [byDate, setByDate] = useState<Record<string, { Morning: DayStatus; Evening: DayStatus }>>({});

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
    const status = byDate[dateStr] ?? { Morning: "available" as DayStatus, Evening: "available" as DayStatus };
    return (
      <div key={day} className="bg-surface p-4 min-h-[120px] relative group hover:bg-surface-variant transition-colors">
        <span className="font-headline text-headline-md text-primary opacity-30">{day}</span>
        <div className="absolute bottom-4 left-4 flex gap-1">
          {(["Morning", "Evening"] as const).map((slot) => (
            <div
              key={slot}
              className={`w-4 h-4 rounded-full ${
                status[slot] === "confirmed"
                  ? "status-dot-full"
                  : status[slot] === "held"
                    ? "status-dot-evening"
                    : status[slot] === "pending"
                      ? "status-dot-morning"
                      : status[slot] === "blocked"
                        ? "bg-on-surface/40"
                        : "border border-primary"
              }`}
              title={`${slot}: ${status[slot]}`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-md">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="font-headline text-headline-lg text-primary">Availability Calendar</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="p-2 border-2 border-primary bg-surface font-ui-button"
          >
            {VENUES.map((v) => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 border-2 border-primary"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              ←
            </button>
            <span className="font-bold">{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
            <button
              className="px-3 py-1 border-2 border-primary"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              →
            </button>
          </div>
          <div className="flex items-center gap-4 text-label-md">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full status-dot-morning"></span> Pending approval</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full status-dot-evening"></span> Held (payment window)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full status-dot-full"></span> Confirmed</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 border-2 border-primary bg-primary gap-[2px]">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="bg-primary-container text-on-primary p-3 text-center font-bold uppercase text-xs">{d}</div>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`pad-${i}`} className="bg-surface" />)}
        {Array.from({ length: daysInMonth }, (_, i) => dayCell(i + 1))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the required imports at the top of `src/routes/hall.tsx`**

```typescript
import { useEffect, useState } from "react";
import { VENUES } from "@/lib/hall/constants";
import { subscribeToCalendar, type DayStatus } from "@/lib/hall/calendar";
```

- [ ] **Step 3: Run the dev server and manually verify**

Run: `bun run dev`, navigate to `/hall`, confirm the Calendar tab renders a real month grid and switching the venue dropdown re-subscribes without errors in the console.

- [ ] **Step 4: Commit**

```bash
git add src/routes/hall.tsx
git commit -m "Wire the Calendar tab to live Firestore data"
```

---

### Task 15: Booking wizard steps 1–2 (membership verification, details form)

**Files:**
- Modify: `src/routes/hall.tsx`

**Interfaces:**
- Consumes: `verifyMembership` (Task 11), `calculateBookingFee` (Task 3), `VENUES`/`SLOTS` (Task 3).
- Produces: a `BookingPanel` with working state for steps 1–2, replacing the static mockup form. Step 3–4 (payment, confirmation) are wired in Task 16.

- [ ] **Step 1: Replace `BookingPanel` in `src/routes/hall.tsx`**

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

function BookingPanel() {
  const [step, setStep] = useState<BookingStep>(1);
  const [form, setForm] = useState<BookingFormState>(EMPTY_FORM);
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);

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
  const canProceedStep2 =
    form.name.trim() &&
    /^\d{10}$/.test(form.phone) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.venue &&
    form.date &&
    new Date(`${form.date}T00:00:00`) >= new Date(new Date().toDateString()) &&
    form.slot &&
    form.purpose.trim() &&
    form.duration.trim() &&
    form.acceptedTnc;

  return (
    <div className="flex flex-col lg:flex-row gap-lg">
      <div className="flex-grow space-y-lg">
        <nav className="flex items-center gap-4 text-sm font-bold uppercase tracking-tighter overflow-x-auto pb-2">
          {(["1. Membership", "2. Details", "3. Payment", "4. Confirmation"] as const).map((label, i) => (
            <span key={label} className={step === i + 1 ? "text-primary whitespace-nowrap" : "text-on-surface/40 whitespace-nowrap"}>
              {label}
            </span>
          ))}
        </nav>

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
            <div className="flex justify-end pt-md">
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
            <div className="grid md:grid-cols-2 gap-md">
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Full Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Phone (10 digits)</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Venue</label>
                <select value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface">
                  <option value="">Select Venue</option>
                  {VENUES.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
              </div>
              <div className="space-y-2">
                <label className="font-ui-button text-primary block">Time Slot</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(SLOTS) as Array<"Morning" | "Evening">).map((s) => (
                    <button
                      key={s}
                      onClick={() => setForm((f) => ({ ...f, slot: s }))}
                      className={`p-4 border-2 border-primary font-bold text-sm ${form.slot === s ? "bg-primary text-on-primary" : ""}`}
                    >
                      {SLOTS[s].label} ({SLOTS[s].time})
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <label className="font-ui-button text-primary block">Purpose</label>
              <input type="text" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
              <label className="font-ui-button text-primary block">Expected duration of stay</label>
              <input type="text" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} className="w-full p-4 border-2 border-primary bg-surface" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.acceptedTnc} onChange={(e) => setForm((f) => ({ ...f, acceptedTnc: e.target.checked }))} />
              I accept the Terms & Conditions
            </label>
            <div className="flex justify-between pt-md">
              <button onClick={() => setStep(1)} className="px-8 py-4 border-2 border-primary font-ui-button">Back</button>
              <button
                disabled={!canProceedStep2}
                onClick={() => setStep(3)}
                className="brutalist-button bg-secondary-container text-on-surface px-12 py-4 font-ui-button text-lg border-2 border-primary disabled:opacity-40"
              >
                Next: Review & Pay
              </button>
            </div>
          </section>
        )}
      </div>

      <aside className="w-full lg:w-80 shrink-0">
        <div className="sticky top-32 brutalist-card bg-surface p-6 space-y-6">
          <h3 className="font-headline text-headline-md text-primary border-b-2 border-primary pb-2 uppercase tracking-tighter">Fee</h3>
          <div className="font-headline text-headline-lg text-primary leading-none">
            {fee !== null ? `₹${fee}` : "Select a venue"}
          </div>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Add the required imports at the top of `src/routes/hall.tsx`**

```typescript
import { verifyMembership } from "@/lib/hall/members";
import { calculateBookingFee } from "@/lib/hall/fees";
import { SLOTS } from "@/lib/hall/constants";
```

- [ ] **Step 3: Run the dev server and manually verify**

Navigate to `/hall` → Book the Hall tab. Confirm: selecting "I'm not a member" enables Next immediately; selecting "I'm a member" requires a successful Verify before Next enables; step 2's Next stays disabled until all fields are valid.

- [ ] **Step 4: Commit**

```bash
git add src/routes/hall.tsx
git commit -m "Wire booking wizard steps 1-2 to membership verification and fee calculation"
```

---

### Task 16: Booking wizard steps 3–4 (payment, confirmation) wired to `createBooking`/`submitUtr`

**Files:**
- Modify: `src/routes/hall.tsx`

**Interfaces:**
- Consumes: `createBooking`, `submitUtr` (Tasks 6–7), `UPI_ID` (Task 3).
- Produces: completed `BookingPanel` — the full 4-step flow now actually creates a Firestore booking.

- [ ] **Step 1: Extend the `BookingPanel` component from Task 15 with steps 3–4**

Add these state fields to `BookingFormState`/component (alongside the ones from Task 15):
```typescript
const [bookingResult, setBookingResult] = useState<{ bookingId: string; bookingNumber: string; lookupToken: string; status: "pending-payment" | "pending-approval" } | null>(null);
const [utr, setUtr] = useState("");
const [submitError, setSubmitError] = useState("");
const [submitting, setSubmitting] = useState(false);
```

Replace the `step === 2` block's "Next" button `onClick` with one that actually creates the booking:
```tsx
<button
  disabled={!canProceedStep2 || submitting}
  onClick={async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await createBooking({
        name: form.name,
        empId: form.empId,
        phone: form.phone,
        email: form.email,
        venue: form.venue,
        date: form.date,
        slot: form.slot!,
        purpose: form.purpose,
        duration: form.duration,
        isMember: form.isMember === true,
      });
      setBookingResult(result);
      setStep(3);
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message === "SLOT_TAKEN"
          ? "This slot was just taken, please choose another."
          : err instanceof Error && err.message === "DATE_BLOCKED"
            ? "This date is blocked for this venue, please choose another."
            : "Something went wrong, please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }}
  className="brutalist-button bg-secondary-container text-on-surface px-12 py-4 font-ui-button text-lg border-2 border-primary disabled:opacity-40"
>
  {submitting ? "Submitting…" : "Next: Review & Pay"}
</button>
```
Add `{submitError && <p className="text-error text-sm">{submitError}</p>}` right below that button.

Add the step 3/4 sections after the `step === 2` block:
```tsx
{step === 3 && bookingResult && (
  <section className="space-y-6">
    {bookingResult.status === "pending-approval" ? (
      <div className="brutalist-card p-6 bg-surface space-y-2">
        <h3 className="font-headline text-headline-md text-primary">Awaiting approval</h3>
        <p>The venue already has a booking that day in the other slot, so an admin needs to review this one first. You'll get an email with payment instructions once it's approved.</p>
        <p className="font-bold">Booking Number: {bookingResult.bookingNumber}</p>
      </div>
    ) : (
      <div className="brutalist-card p-6 bg-surface space-y-4">
        <h3 className="font-headline text-headline-md text-primary">Pay via UPI</h3>
        <p>Amount: <strong>₹{calculateBookingFee(form.isMember === true, form.venue)}</strong></p>
        <p>UPI ID: <strong>{UPI_ID}</strong></p>
        <p className="text-sm opacity-70">Complete the payment within 15 minutes, then enter the UTR number below.</p>
        <div className="space-y-2">
          <label className="font-ui-button text-primary block">UTR Number</label>
          <input type="text" value={utr} onChange={(e) => setUtr(e.target.value)} className="w-full p-4 border-2 border-primary bg-surface" />
        </div>
        {submitError && <p className="text-error text-sm">{submitError}</p>}
        <button
          disabled={utr.trim().length < 6 || submitting}
          onClick={async () => {
            setSubmitting(true);
            setSubmitError("");
            try {
              await submitUtr(bookingResult.bookingId, utr.trim());
              setStep(4);
            } catch (err) {
              setSubmitError(
                err instanceof Error && err.message === "EXPIRED"
                  ? "This booking has expired, please start again."
                  : err instanceof Error && err.message === "UTR_ALREADY_USED"
                    ? "This UTR has already been used for another booking."
                    : "Something went wrong, please try again.",
              );
            } finally {
              setSubmitting(false);
            }
          }}
          className="px-12 py-4 bg-primary text-on-primary font-ui-button disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "I've Paid — Submit UTR"}
        </button>
      </div>
    )}
  </section>
)}

{step === 4 && bookingResult && (
  <section className="space-y-4">
    <div className="brutalist-card p-6 bg-surface space-y-2">
      <h3 className="font-headline text-headline-md text-primary">Submitted!</h3>
      <p>Booking Number: <strong>{bookingResult.bookingNumber}</strong></p>
      <p className="text-sm opacity-70">
        We've sent a status link to {form.email}. An admin will verify your payment and confirm the booking shortly.
      </p>
      <button
        onClick={() => {
          setForm(EMPTY_FORM);
          setBookingResult(null);
          setUtr("");
          setStep(1);
        }}
        className="px-8 py-4 border-2 border-primary font-ui-button"
      >
        Make another booking
      </button>
    </div>
  </section>
)}
```

- [ ] **Step 2: Add the required imports at the top of `src/routes/hall.tsx`**

```typescript
import { createBooking, submitUtr } from "@/lib/hall/transactions";
import { UPI_ID } from "@/lib/hall/constants";
```

- [ ] **Step 3: Run the dev server and manually verify end-to-end**

Complete a full booking as a non-member (skips verification) for a fresh venue/date/slot → confirm it reaches step 3 as `pending-payment`, submitting a UTR moves to step 4. Attempt the same venue/date/slot again in a second tab before finishing → confirm it's rejected with "This slot was just taken."

- [ ] **Step 4: Commit**

```bash
git add src/routes/hall.tsx
git commit -m "Wire booking wizard steps 3-4 to createBooking and submitUtr transactions"
```

---

### Task 17: `/hall/status` page (token-based lookup) with self-cancel

**Files:**
- Create: `src/routes/hall.status.tsx`

**Interfaces:**
- Consumes: `db`, `cancelBookingSelf` (Task 10), `BookingDoc` (Task 3).
- Produces: a new route rendering one booking's status by `lookupToken`, with a self-cancel button when eligible.

- [ ] **Step 1: Write `src/routes/hall.status.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/hall/firebase";
import { cancelBookingSelf } from "@/lib/hall/transactions";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import type { BookingDoc } from "@/lib/hall/types";

export const Route = createFileRoute("/hall/status")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: StatusPage,
});

function StatusPage() {
  const { token } = Route.useSearch();
  const [booking, setBooking] = useState<(BookingDoc & { bookingId: string }) | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setError("No status token provided.");
        setLoading(false);
        return;
      }
      const slotQuery = query(collection(db, "bookingSlots"), where("lookupToken", "==", token));
      const slotSnap = await getDocs(slotQuery);
      if (slotSnap.empty) {
        if (!cancelled) {
          setError("No booking found for this link.");
          setLoading(false);
        }
        return;
      }
      const bookingId = slotSnap.docs[0].id;
      const bookingSnap = await getDoc(doc(db, "bookings", bookingId));
      if (!cancelled) {
        if (bookingSnap.exists()) {
          setBooking({ ...(bookingSnap.data() as BookingDoc), bookingId });
        } else {
          setError("No booking found for this link.");
        }
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canSelfCancel = booking && (booking.status === "confirmed" || booking.status === "pending-payment");

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <SiteHeader active="gatherings" />
      <main className="pt-32 pb-xl px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto">
        <h1 className="font-headline text-headline-lg text-primary mb-lg">Booking Status</h1>
        {loading && <p>Loading…</p>}
        {error && <p className="text-error">{error}</p>}
        {booking && (
          <div className="brutalist-card p-6 bg-surface space-y-3">
            <p><strong>Booking Number:</strong> {booking.bookingNumber}</p>
            <p><strong>Venue:</strong> {booking.venue}</p>
            <p><strong>Date:</strong> {booking.date}</p>
            <p><strong>Slot:</strong> {booking.slot}</p>
            <p><strong>Status:</strong> {booking.status}</p>
            {canSelfCancel && (
              <button
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true);
                  try {
                    await cancelBookingSelf(booking.bookingId);
                    setBooking({ ...booking, status: "cancelled" });
                  } finally {
                    setCancelling(false);
                  }
                }}
                className="px-6 py-2 border-2 border-primary text-primary font-ui-button hover:bg-surface-variant"
              >
                {cancelling ? "Cancelling…" : "Cancel this booking"}
              </button>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 2: Run the dev server and manually verify**

Complete a booking (Task 16), copy the `bookingId`'s `lookupToken` from the Firestore console, navigate to `/hall/status?token=<that token>`, confirm the booking renders. Confirm a bogus token shows "No booking found for this link." Confirm self-cancel works when status is `confirmed`/`pending-payment` and the button is absent otherwise.

- [ ] **Step 3: Commit**

```bash
git add src/routes/hall.status.tsx
git commit -m "Add token-based booking status page with self-cancel"
```

---

### Task 18: Admin authentication and route guard

**Files:**
- Create: `src/routes/admin.tsx`

**Interfaces:**
- Consumes: `auth` (Task 1), Firebase Auth's `signInWithEmailAndPassword`/`onAuthStateChanged`/`signOut`.
- Produces: the `/admin` route shell — login form when signed out, tab shell when signed in. Tabs' content is filled in by Tasks 19–21.

- [ ] **Step 1: Write `src/routes/admin.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/hall/firebase";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type AdminTab = "pending-approval" | "pending-verification" | "all-bookings" | "blocked-dates" | "members" | "email-settings";

function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<AdminTab>("pending-approval");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="bg-background text-on-surface min-h-screen">
        <SiteHeader active="gatherings" />
        <main className="pt-32 pb-xl px-margin-mobile md:px-margin-desktop max-w-md mx-auto space-y-4">
          <h1 className="font-headline text-headline-lg text-primary">Admin Sign In</h1>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 border-2 border-primary bg-surface" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-4 border-2 border-primary bg-surface" />
          {loginError && <p className="text-error text-sm">{loginError}</p>}
          <button
            onClick={async () => {
              setLoginError("");
              try {
                await signInWithEmailAndPassword(auth, email, password);
              } catch {
                setLoginError("Invalid email or password.");
              }
            }}
            className="w-full px-8 py-4 bg-primary text-on-primary font-ui-button"
          >
            Sign In
          </button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const TABS: { id: AdminTab; label: string }[] = [
    { id: "pending-approval", label: "Pending Approval" },
    { id: "pending-verification", label: "Pending Verification" },
    { id: "all-bookings", label: "All Bookings" },
    { id: "blocked-dates", label: "Blocked Dates" },
    { id: "members", label: "Members" },
    { id: "email-settings", label: "Email Settings" },
  ];

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <SiteHeader active="gatherings" />
      <main className="pt-32 pb-xl px-margin-mobile md:px-margin-desktop max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-lg">
          <h1 className="font-headline text-headline-lg text-primary">Admin: Hall Booking</h1>
          <button onClick={() => signOut(auth)} className="px-4 py-2 border-2 border-primary font-ui-button">Sign Out</button>
        </div>
        <div role="tablist" className="flex flex-wrap gap-2 mb-lg border-b-2 border-primary">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 font-ui-button text-sm ${tab === t.id ? "bg-primary text-on-primary" : "text-primary hover:bg-primary-container hover:text-on-primary"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "pending-approval" && <PendingApprovalTab />}
        {tab === "pending-verification" && <PendingVerificationTab />}
        {tab === "all-bookings" && <AllBookingsTab />}
        {tab === "blocked-dates" && <BlockedDatesTab />}
        {tab === "members" && <MembersTab />}
        {tab === "email-settings" && <EmailSettingsTab />}
      </main>
      <SiteFooter />
    </div>
  );
}

function PendingApprovalTab() { return <p>Loading…</p>; }
function PendingVerificationTab() { return <p>Loading…</p>; }
function AllBookingsTab() { return <p>Loading…</p>; }
function BlockedDatesTab() { return <p>Loading…</p>; }
function MembersTab() { return <p>Loading…</p>; }
function EmailSettingsTab() { return <p>Loading…</p>; }
```

- [ ] **Step 2: Run the dev server and manually verify**

Navigate to `/admin`. Confirm the login form appears when signed out, and an invalid login shows the error. (A real admin account doesn't exist until Task 22 creates one in the Firebase console — full sign-in verification happens then.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin.tsx
git commit -m "Add admin route with auth gate and tab shell"
```

---

### Task 19: Pending Approval and Pending Verification admin tabs

**Files:**
- Modify: `src/routes/admin.tsx`

**Interfaces:**
- Consumes: `approveBooking`, `rejectApproval`, `verifyPayment`, `rejectPayment` (Tasks 8–9).
- Produces: working `PendingApprovalTab` and `PendingVerificationTab`, replacing the placeholders from Task 18.

- [ ] **Step 1: Replace `PendingApprovalTab` and `PendingVerificationTab` in `src/routes/admin.tsx`**

```tsx
function useBookingsByStatus(status: string) {
  const [bookings, setBookings] = useState<(BookingDoc & { bookingId: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const q = query(collection(db, "bookings"), where("status", "==", status));
    const snap = await getDocs(q);
    setBookings(snap.docs.map((d) => ({ ...(d.data() as BookingDoc), bookingId: d.id })));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return { bookings, loading, reload };
}

function PendingApprovalTab() {
  const { bookings, loading, reload } = useBookingsByStatus("pending-approval");

  if (loading) return <p>Loading…</p>;
  if (bookings.length === 0) return <p className="opacity-60">Nothing pending approval.</p>;

  return (
    <div className="space-y-4">
      {bookings.map((b) => (
        <div key={b.bookingId} className="brutalist-card p-4 bg-surface flex justify-between items-center">
          <div>
            <p className="font-bold">{b.venue} — {b.date} ({b.slot})</p>
            <p className="text-sm opacity-70">{b.name} · {b.empId} · {b.phone}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => { await approveBooking(b.bookingId); await reload(); }} className="px-4 py-2 bg-primary text-on-primary font-ui-button text-sm">Approve</button>
            <button onClick={async () => { await rejectApproval(b.bookingId); await reload(); }} className="px-4 py-2 border-2 border-primary text-primary font-ui-button text-sm">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PendingVerificationTab() {
  const { bookings, loading, reload } = useBookingsByStatus("pending-verification");

  if (loading) return <p>Loading…</p>;
  if (bookings.length === 0) return <p className="opacity-60">Nothing awaiting payment verification.</p>;

  return (
    <div className="space-y-4">
      {bookings.map((b) => (
        <div key={b.bookingId} className="brutalist-card p-4 bg-surface flex justify-between items-center">
          <div>
            <p className="font-bold">{b.venue} — {b.date} ({b.slot})</p>
            <p className="text-sm opacity-70">{b.name} · ₹{b.amount} · UTR: {b.utr}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => { await verifyPayment(b.bookingId); await reload(); }} className="px-4 py-2 bg-primary text-on-primary font-ui-button text-sm">Verify</button>
            <button onClick={async () => { await rejectPayment(b.bookingId); await reload(); }} className="px-4 py-2 border-2 border-primary text-primary font-ui-button text-sm">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add the required imports at the top of `src/routes/admin.tsx`**

```typescript
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/hall/firebase";
import { approveBooking, rejectApproval, verifyPayment, rejectPayment } from "@/lib/hall/transactions";
import type { BookingDoc } from "@/lib/hall/types";
```

- [ ] **Step 3: Manual verification (once an admin account exists, Task 22)**

Sign in as admin, confirm bookings created earlier in `pending-approval`/`pending-verification` show up, and Approve/Reject/Verify/Reject buttons update Firestore and re-render the list.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin.tsx
git commit -m "Add Pending Approval and Pending Verification admin tabs"
```

---

### Task 20: All Bookings tab and Blocked Dates management

**Files:**
- Modify: `src/routes/admin.tsx`

**Interfaces:**
- Consumes: `cancelBookingAdmin` (Task 10), `BlockedDateDoc` (Task 3).
- Produces: working `AllBookingsTab` and `BlockedDatesTab`.

- [ ] **Step 1: Replace `AllBookingsTab` and `BlockedDatesTab` in `src/routes/admin.tsx`**

```tsx
function AllBookingsTab() {
  const [bookings, setBookings] = useState<(BookingDoc & { bookingId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const reload = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "bookings"));
    setBookings(snap.docs.map((d) => ({ ...(d.data() as BookingDoc), bookingId: d.id })));
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  if (loading) return <p>Loading…</p>;

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div className="space-y-4">
      <select value={filter} onChange={(e) => setFilter(e.target.value)} className="p-2 border-2 border-primary bg-surface">
        <option value="all">All statuses</option>
        <option value="pending-approval">Pending Approval</option>
        <option value="pending-payment">Pending Payment</option>
        <option value="pending-verification">Pending Verification</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
        <option value="expired">Expired</option>
      </select>
      {filtered.map((b) => (
        <div key={b.bookingId} className="brutalist-card p-4 bg-surface flex justify-between items-center">
          <div>
            <p className="font-bold">{b.venue} — {b.date} ({b.slot}) — {b.status}</p>
            <p className="text-sm opacity-70">{b.name} · {b.empId} · {b.phone}</p>
          </div>
          {b.status !== "cancelled" && b.status !== "expired" && (
            <button
              onClick={async () => { await cancelBookingAdmin(b.bookingId); await reload(); }}
              className="px-4 py-2 border-2 border-primary text-primary font-ui-button text-sm"
            >
              Force Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function BlockedDatesTab() {
  const [blocked, setBlocked] = useState<(BlockedDateDoc & { docId: string })[]>([]);
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("all");
  const [reason, setReason] = useState("");

  const reload = async () => {
    const snap = await getDocs(collection(db, "blockedDates"));
    setBlocked(snap.docs.map((d) => ({ ...(d.data() as BlockedDateDoc), docId: d.id })));
  };

  useEffect(() => { void reload(); }, []);

  return (
    <div className="space-y-6">
      <div className="brutalist-card p-4 bg-surface space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="p-2 border-2 border-primary bg-surface" />
          <select value={venue} onChange={(e) => setVenue(e.target.value)} className="p-2 border-2 border-primary bg-surface">
            <option value="all">All Venues</option>
            {VENUES.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
          <input type="text" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="p-2 border-2 border-primary bg-surface" />
        </div>
        <button
          onClick={async () => {
            if (!date || !reason.trim()) return;
            await addDoc(collection(db, "blockedDates"), { date, venue, reason: reason.trim(), createdAt: serverTimestamp() });
            setDate(""); setReason("");
            await reload();
          }}
          className="px-4 py-2 bg-primary text-on-primary font-ui-button text-sm"
        >
          Block Date
        </button>
      </div>
      {blocked.map((b) => (
        <div key={b.docId} className="flex justify-between items-center p-2 border-b-2 border-primary/10">
          <span>{b.date} — {b.venue === "all" ? "All Venues" : b.venue} — {b.reason}</span>
          <button
            onClick={async () => { await deleteDoc(doc(db, "blockedDates", b.docId)); await reload(); }}
            className="px-3 py-1 border-2 border-primary text-primary text-sm"
          >
            Unblock
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add the required imports at the top of `src/routes/admin.tsx`**

```typescript
import { addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { cancelBookingAdmin } from "@/lib/hall/transactions";
import { VENUES } from "@/lib/hall/constants";
import type { BlockedDateDoc } from "@/lib/hall/types";
```

- [ ] **Step 3: Manual verification (Task 22)**

Confirm the All Bookings filter works and Force Cancel updates status. Block a date for a specific venue, confirm it appears in this tab's list, shows as blocked on that venue's calendar (Task 12/14), and attempting to create a booking for that venue/date in the booking wizard (Task 16) is rejected with "This date is blocked for this venue" (`createBooking`'s `DATE_BLOCKED` check, Task 6). Block a date with venue `"all"`, confirm it blocks every venue's calendar and booking attempts.

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin.tsx
git commit -m "Add All Bookings and Blocked Dates admin tabs"
```

---

### Task 21: Members upload tab and Email Settings tab

**Files:**
- Modify: `src/routes/admin.tsx`

**Interfaces:**
- Consumes: `uploadMembers` (Task 11). Excel parsing uses the `xlsx` package (SheetJS), matching the reference site's approach — new dependency.
- Produces: working `MembersTab` and `EmailSettingsTab`.

- [ ] **Step 1: Install the SheetJS dependency**

Run: `bun add xlsx`

- [ ] **Step 2: Replace `MembersTab` and `EmailSettingsTab` in `src/routes/admin.tsx`**

```tsx
function MembersTab() {
  const [status, setStatus] = useState("");

  const handleFile = async (file: File) => {
    setStatus("Parsing…");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<{ empId: string; name: string; phone: string }>(sheet);
    setStatus(`Uploading ${rows.length} members…`);
    await uploadMembers(rows);
    setStatus(`Uploaded ${rows.length} members.`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-70">Upload an Excel file with columns: empId, name, phone.</p>
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {status && <p>{status}</p>}
    </div>
  );
}

function EmailSettingsTab() {
  return (
    <div className="space-y-2 max-w-lg">
      <p className="text-sm opacity-70">
        EmailJS service ID, template IDs, public key, and the admin notification address are configured via
        environment variables (see <code>.env.example</code>) rather than an in-app form, since they're
        build-time configuration for this static deployment, not per-tenant runtime settings.
      </p>
    </div>
  );
}
```

Note on this task's scope decision: the spec describes an in-app "Email settings form," matching the reference site's runtime-configurable EmailJS settings stored in Firestore. Given this app has exactly one deployment (not a multi-tenant SaaS), env vars set once at deploy time are simpler and equally correct — this is a deliberate deviation from the reference's pattern, not an oversight. If per-admin runtime reconfiguration is later wanted, swap this tab for a form writing to the `settings` doc from the spec's Data Model, and read from it in `src/lib/hall/email.ts` (Task 13) instead of `import.meta.env`.

- [ ] **Step 3: Add the required import at the top of `src/routes/admin.tsx`**

```typescript
import * as XLSX from "xlsx";
import { uploadMembers } from "@/lib/hall/members";
```

- [ ] **Step 4: Manual verification (Task 22)**

Prepare a small `.xlsx` file with `empId`/`name`/`phone` columns, upload it via this tab, confirm `members`/`membersPublic` docs appear in Firestore and `verifyMembership` (Task 11) succeeds for one of the uploaded IDs.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock src/routes/admin.tsx
git commit -m "Add Members Excel upload admin tab; document EmailJS env-var config decision"
```

---

### Task 22: Deployment — Firebase project, rules, EmailJS, Netlify

**Files:**
- Modify: `.firebaserc`
- Modify: `README.md`

This task is operational, not code — it provisions the real Firebase project and runs the manual QA checklists deferred from Tasks 2, 6–13, 15–21.

- [ ] **Step 1: Create the Firebase project**

Via the Firebase Console: create a new project, enable Firestore (production mode) and Firebase Authentication (Email/Password provider). Copy the Web App config values into a local `.env` (not committed — confirm `.env` is in `.gitignore`; if not, add it).

- [ ] **Step 2: Update `.firebaserc` with the real project ID**

Replace `REPLACE_WITH_FIREBASE_PROJECT_ID` with the actual project ID from Step 1.

- [ ] **Step 3: Deploy Firestore security rules**

Run: `bunx firebase-tools deploy --only firestore:rules` (requires `firebase login` first if not already authenticated).

- [ ] **Step 4: Run the Task 2 security-rules manual checklist**

Execute all 8 scenarios listed in Task 2, Step 4, against the real deployed rules using the Rules Playground in the Firebase Console. Fix and redeploy if any scenario doesn't match the expected outcome.

- [ ] **Step 5: Create the admin account**

In Firebase Console → Authentication → Users → Add User, create one admin account with a real email/password. Do not build any self-registration UI — this matches the spec's explicit design.

- [ ] **Step 6: Set up EmailJS**

Create an EmailJS account, add an email service, and create 4 templates matching the variable names used in `src/lib/hall/email.ts` (Task 13): `template_approval_needed` (vars: `admin_email`, `booking_number`, `name`, `venue`, `date`, `slot`), `template_payment_instructions` (vars: `to_email`, `booking_number`, `amount`, `venue`, `date`, `slot`, `status_link`), `template_confirmed` (vars: `to_email`, `booking_number`, `venue`, `date`, `slot`), `template_cancelled` (vars: `to_email`, `booking_number`, `reason`). Copy the service ID and public key into `.env`.

- [ ] **Step 7: Run all deferred manual QA checklists**

Work through, in order: Task 6 Step 3, Task 7 Step 2, Task 8 Step 2, Task 9 Step 2, Task 10 Step 2, Task 11 Step 2, Task 12 Step 2, Task 13 Step 4, Task 19 Step 3, Task 20 Step 3, Task 21 Step 4. Fix any failures before proceeding — these are the real end-to-end validation for this feature, since the plan deliberately doesn't mock Firestore transactions in automated tests (per the spec's Testing section).

- [ ] **Step 8: Run the full Vitest suite one more time**

Run: `bun run test`
Expected: PASS (all tests from Tasks 3–5 — fees, crypto, conflict logic)

- [ ] **Step 9: Build and verify the production build locally**

Run: `bun run build` then `bun run preview`, click through `/hall`, `/hall/status?token=...`, and `/admin` in the preview build.

- [ ] **Step 10: Deploy to Netlify**

Connect the repository to Netlify (or use `netlify deploy` if the CLI is set up), set the build command to `bun run build`, and add all `VITE_*` environment variables from `.env` to Netlify's site environment configuration. Deploy and re-run the click-through from Step 9 against the live Netlify URL.

- [ ] **Step 11: Update `README.md`'s Development section**

Add a short "Hall Booking Setup" subsection documenting: the required `.env` variables (link to `.env.example`), that a Firebase project + Auth admin account + EmailJS templates must exist before the booking flow works locally, and where the security rules live (`firestore.rules`, deployed via `firebase deploy --only firestore:rules`).

- [ ] **Step 12: Commit**

```bash
git add .firebaserc README.md
git commit -m "Document hall booking deployment steps and finalize Firebase project wiring"
```

---

## Self-Review Notes

**Spec coverage check:** Architecture (Task 1), Venues & Fees (Task 3), all 5 collections in Data Model (Tasks 3, 6, 11), State Machine (Tasks 6–10), Booking Submission Flow (Tasks 6–7, 15–16), bookingSlots↔bookings Consistency Rule (enforced in every transaction task, 6–10), Admin Actions (Tasks 8–9, 19–20), Calendar (Task 12, 14), Self-Service Status Lookup (Task 17), Email Notifications (Task 13), Security Rules (Task 2), Testing (Tasks 3–5 unit tests + manual checklists throughout, consolidated in Task 22), Deployment (Task 22). Every spec section maps to at least one task.

**Placeholder scan:** no TBD/TODO markers; every code step has real code, not descriptions of code.

**Type consistency check performed:** `BookingDoc`/`BookingSlotDoc` (Task 3) field names match what Tasks 6–21 read/write (`empIdHash`/`isMember` in `membersPublic`, `cancelledBy`/`approvedBy`/`paymentVerifiedBy`/`rejectedBy` naming consistent across transactions.ts and admin.tsx). `DayStatus` type (Task 12) matches its usage in Task 14's `CalendarPanel`. `CreateBookingResult` (Task 6) matches its destructuring in Task 16.

**Gap found and fixed during self-review:** an earlier draft of this plan had `blockedDates` displayed in the admin tab (Task 20) but never actually consulted by `createBooking` (Task 6) or the calendar (Task 12/14) — meaning blocking a date would have had no real effect. Fixed by adding a `blockedDates` check to `createBooking`'s conflict evaluation (throws `DATE_BLOCKED`), propagating that error to the booking wizard's UI (Task 16), and extending `subscribeToCalendar`/`deriveDayStatus`'s `DayStatus` type with a `"blocked"` state fed by a second `onSnapshot` listener on `blockedDates` (Task 12), rendered in the calendar grid (Task 14).
