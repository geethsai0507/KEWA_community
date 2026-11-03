# Gym QR Check-in & Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members scan a printed door QR to check in/out of the gym; minutes are tallied per day and ranked on a monthly leaderboard.

**Architecture:** All time rules (3 h visit cap, 4 h daily cap, 2-min double-scan guard, IST days/months, leaderboard ranking) live in pure, tested functions under `src/lib/gym/`. A thin Firestore layer (`store.ts`) reads/writes `gymVisits` and `gymDevices`; Firestore rules force server timestamps and restrict transitions. Pages: `/gym/scan` (QR target), `/gym/leaderboard`, a home-page Gym card, and an admin "Gym" tab with a printable QR.

**Tech Stack:** TanStack Start/Router (file routes in `src/routes`), React, Tailwind (existing gold theme tokens), Firebase Firestore v10 modular SDK, Vitest, `qrcode` (already a dependency).

**Spec:** `docs/superpowers/specs/2026-11-02-gym-qr-checkin-design.md`

## Global Constraints

- Branch: `gym-qr-checkin` (already created). Commit messages must NOT include a `Co-Authored-By` trailer (user preference).
- Days and months are **Asia/Kolkata (IST, UTC+05:30, no DST)**; a visit belongs to the IST day its `inAt` falls on.
- `MAX_VISIT_MINUTES = 180` — any visit (open or closed) longer than this counts **0** and is "no logout".
- `DAILY_CAP_MINUTES = 240` per member per IST day.
- `DOUBLE_SCAN_MS = 120_000` — a scan within 2 min of the member's previous scan is ignored.
- Open visits count 0 minutes on all totals until closed.
- Public data is keyed by `hashEmployeeId(empId)` (`src/lib/hall/crypto.ts`); never store raw employee IDs, phone numbers or ID digits in gym collections.
- Leaderboard name = `displayName` from `membersPublic`, fallback `"Member"`.
- Login persists in `localStorage` until explicit logout (site-wide).
- Timestamps `inAt`/`outAt`/`linkedAt` are written with `serverTimestamp()`; rules require `== request.time`.
- Firestore rules follow the existing heavily-commented style in `firestore.rules`.
- Copy (exact): device mismatch → `"This member's gym check-ins are linked to another phone — ask an admin to reset."`; long visit on scan-out → `"This visit was over 3 hours, so it's counted as a missed check-out. Just arriving? Scan again to check in."`

## Review Focus

1. **Late-night visit across midnight** (in 23:50 IST, out 00:20 IST) → closes normally, 30 min counted on the start day. Test in Task 2 (`decideScanAction` + `memberDayTotals`).
2. **Forgotten exit then return next day** → stale open visit is marked no-logout and a fresh check-in is created; yesterday contributes 0. Test in Task 2.
3. **Double tap / second scan seconds after check-out** → ignored, shows last action instead of a new 0-minute check-in. Test in Task 2.
4. **Shared phone, persisted login of someone else** → scan screen always names who is being recorded and offers "Not you? Switch" before the member walks off. Manual check in Task 5.
5. **Rules not yet deployed / Firestore permission-denied** → scan page shows a retryable error, never a blank screen. Manual check in Task 5.

---

### Task 1: Persistent login + display names on member upload

**Files:**
- Modify: `src/components/auth-context.tsx` (lines 31, 35, 56-57, 84-85: `sessionStorage` → `localStorage`)
- Modify: `src/routes/hall.tsx:155` (`sessionStorage` → `localStorage`)
- Create: `src/lib/gym/display-name.ts`, test `src/lib/gym/display-name.test.ts`
- Modify: `src/lib/hall/members.ts` (`uploadMembers` also writes `displayName`)

**Interfaces:**
- Produces: `deriveDisplayName(fullName: string): string`; `membersPublic/{hash}` gains `displayName: string`.

- [ ] **Step 1: Write failing tests** in `display-name.test.ts`:

```ts
expect(deriveDisplayName("ramesh kumar")).toBe("Ramesh K.");
expect(deriveDisplayName("RAMESH KUMAR SHARMA")).toBe("Ramesh S.");
expect(deriveDisplayName("K. Ramesh")).toBe("Ramesh");
expect(deriveDisplayName("K Ramesh")).toBe("Ramesh");
expect(deriveDisplayName("Ramesh K")).toBe("Ramesh K.");
expect(deriveDisplayName("Om Prakash")).toBe("Om P.");
expect(deriveDisplayName("Ramesh")).toBe("Ramesh");
expect(deriveDisplayName("  ")).toBe("Member");
expect(deriveDisplayName("A. B.")).toBe("A");   // all initials: first token, dots stripped
```

- [ ] **Step 2:** `bun run test src/lib/gym/display-name.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** — an initial is a single letter or any token ending in `"."`. First name = first non-initial token (else first token with dots stripped), title-cased; if any token follows the chosen one, append the uppercase first letter of the **last** token + `"."`.
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5:** In `uploadMembers`, add `displayName: deriveDisplayName(row.name ?? "")` to the `membersPublic` write. Swap all `sessionStorage` uses listed above to `localStorage` (keys unchanged). `logout` keeps removing both keys.
- [ ] **Step 6:** `bun run test && bun run build` → all pass.
- [ ] **Step 7: Commit** `feat: persist member login and publish display names`

### Task 2: Pure gym time logic

**Files:**
- Create: `src/lib/gym/time.ts`, `src/lib/gym/visits.ts`, tests `src/lib/gym/time.test.ts`, `src/lib/gym/visits.test.ts`

**Interfaces:**
- Produces (`time.ts`):
  - `istDayKey(d: Date): string` → `"YYYY-MM-DD"` in IST
  - `istMonthKey(d: Date): string` → `"YYYY-MM"`
  - `istMonthRange(monthKey: string): { start: Date; end: Date }` (end exclusive, IST midnights)
  - `formatMinutes(min: number): string` → `"0 min"`, `"48 min"`, `"1 h"`, `"1 h 20 min"`
  - `formatIstTime(d: Date): string` → `"6:42 AM"`
- Produces (`visits.ts`):
  - constants `MAX_VISIT_MINUTES`, `DAILY_CAP_MINUTES`, `DOUBLE_SCAN_MS`
  - `type GymVisitStatus = "open" | "closed" | "no-logout"`
  - `interface GymVisit { id: string; memberHash: string; displayName: string; inAt: Date; outAt: Date | null; status: GymVisitStatus }`
  - `effectiveStatus(v: GymVisit, now: Date): GymVisitStatus` — open & older than 180 min → `"no-logout"`; closed with duration > 180 min → `"no-logout"`
  - `visitMinutes(v: GymVisit, now: Date): number` — floor of minutes for effective `"closed"`, else 0
  - `memberDayTotals(visits: GymVisit[], now: Date): Map<string, number>` — per IST day of `inAt`, summed and capped at 240
  - `memberTotal(visits: GymVisit[], now: Date): number` — sum of `memberDayTotals`
  - `type ScanDecision = { kind: "check-in"; staleOpen: GymVisit[] } | { kind: "check-out"; visit: GymVisit; overCap: boolean } | { kind: "ignore"; last: "check-in" | "check-out"; at: Date }`
  - `decideScanAction(memberVisits: GymVisit[], now: Date): ScanDecision` — memberVisits = this member's open visits plus recent ones.

`decideScanAction` algorithm (not determined by signatures):
1. Last scan time = max over visits of `outAt ?? inAt`. If `now - last < DOUBLE_SCAN_MS` → `ignore` (`last` = `"check-out"` if that time was an `outAt`).
2. Take the stored-`"open"` visit with the latest `inAt`. If its age ≤ `STALE_VISIT_MINUTES` (360) → `check-out` it, with `overCap = age > MAX_VISIT_MINUTES`. (So someone scanning out at 3 h 10 min gets "missed check-out" rather than a confusing new check-in.)
3. Otherwise → `check-in` with `staleOpen` = all stored-open visits older than 360 min.
Add `STALE_VISIT_MINUTES = 360` to the constants. Totals are unaffected: any open visit counts 0, and `effectiveStatus` still reports open > 180 min as `"no-logout"`.

- [ ] **Step 1: Write failing tests.** Build IST dates with a helper `ist("2026-11-02T06:42")` → `new Date("2026-11-02T06:42:00+05:30")`. Required cases:
  - `istDayKey(ist("2026-11-02T00:10"))` → `"2026-11-02"`; `istDayKey(new Date("2026-11-01T19:00:00Z"))` → `"2026-11-02"` (00:30 IST).
  - `istMonthRange("2026-11")` → start `2026-10-31T18:30:00Z`, end `2026-11-30T18:30:00Z`; `"2026-12"` end rolls to 2027-01.
  - `formatMinutes(0/48/60/80)` → `"0 min"`, `"48 min"`, `"1 h"`, `"1 h 20 min"`. `formatIstTime(ist("2026-11-02T18:05"))` → `"6:05 PM"`.
  - closed 48-min visit → 48; closed 181-min → 0 and effective `"no-logout"`; open 30-min old → 0 and `"open"`; open 181-min old → `"no-logout"`.
  - Three closed visits same day of 100+100+100 min → day total 240; a no-logout + a 40-min visit same day → 40.
  - **Midnight:** open visit in at 23:50 IST, now 00:20 next day → `check-out`; after closing at 00:20, `memberDayTotals` gives `{ "<start day>": 30 }`.
  - **Forgotten:** open visit from 07:00 yesterday, now 07:00 today → `check-in` with that visit in `staleOpen`.
  - **Late exit:** open visit 190 min old → `check-out` with `overCap: true`; 59 min old → `overCap: false`; 361 min old → `check-in`.
  - **Double scan:** open visit `inAt` 60 s ago → `ignore`, `last: "check-in"`; visit closed 30 s ago → `ignore`, `last: "check-out"`; closed 3 min ago → `check-in`.
  - No visits → `check-in`, `staleOpen: []`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** IST formatting via `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", ... })` (or fixed +330-minute offset — IST has no DST).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat: add gym visit time rules`

### Task 3: Leaderboard aggregation

**Files:**
- Create: `src/lib/gym/leaderboard.ts`, test `src/lib/gym/leaderboard.test.ts`

**Interfaces:**
- Consumes: `GymVisit`, `memberTotal`, `visitMinutes` (Task 2).
- Produces: `interface LeaderboardRow { memberHash: string; displayName: string; minutes: number; visits: number; rank: number }` and `buildLeaderboard(visits: GymVisit[], now: Date): LeaderboardRow[]` — group by `memberHash`; `minutes` = `memberTotal`; `visits` = count with `visitMinutes > 0`; drop members with 0 minutes; sort minutes desc then `displayName` asc; competition ranking (ties share rank: 1, 1, 3); `displayName` from the member's most recent visit.

- [ ] **Step 1: Failing tests:** two members (120 vs 90 min) → ranks 1, 2; tie at 90 → both rank 1, next rank 3; member with only no-logout visits excluded; daily cap applied (300 min one day → 240).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: add gym leaderboard ranking`

### Task 4: Firestore rules, index, device id and data layer

**Files:**
- Modify: `firestore.rules` (add `gymVisits`, `gymDevices` blocks)
- Modify: `firestore.indexes.json` (add `gymVisits`: `memberHash` ASC, `inAt` ASC)
- Modify: `src/lib/hall/crypto.ts` (export `generateDeviceId(): string` = `randomHex(16)`)
- Create: `src/lib/gym/device.ts`, test `src/lib/gym/device.test.ts`
- Create: `src/lib/gym/store.ts`

**Interfaces:**
- Produces (`device.ts`): `GYM_DEVICE_ID_KEY = "gym_device_id"`; `getOrCreateDeviceId(storage: Pick<Storage, "getItem" | "setItem">): string`.
- Produces (`store.ts`, all `async`):
  - `getMemberDisplayName(memberHash): Promise<string>` (`membersPublic` `displayName` ?? `"Member"`)
  - `ensureDeviceLink(memberHash, deviceId): Promise<"ok" | "mismatch">` — get `gymDevices/{memberHash}`; missing → create `{ deviceId, linkedAt: serverTimestamp() }` → `"ok"`; equal → `"ok"`; else `"mismatch"`.
  - `fetchMemberVisitsForScan(memberHash, now: Date): Promise<GymVisit[]>` — union (dedupe by id) of `where memberHash == h && status == "open"` and `where memberHash == h && inAt >= now-24h`.
  - `fetchMemberMonthVisits(memberHash, monthKey): Promise<GymVisit[]>`
  - `fetchMonthVisits(monthKey): Promise<GymVisit[]>` (`inAt` in `istMonthRange`)
  - `checkIn(memberHash, displayName): Promise<void>` (status `"open"`, `outAt: null`, `inAt: serverTimestamp()`)
  - `closeVisit(visitId, status: "closed" | "no-logout"): Promise<void>` (`outAt: serverTimestamp()`)
  - Admin: `deleteVisit(visitId)`, `resetDeviceLink(memberHash)`.
  - Doc→`GymVisit` mapping converts Firestore `Timestamp`s via `.toDate()`; pending server timestamps are read back after write, so callers refetch after writing.

Rules (write in the file's comment style):
- `gymVisits/{id}`: `get, list: true`. `create`: keys `hasOnly(['memberHash','displayName','inAt','outAt','status'])`, `status == 'open'`, `inAt == request.time`, `outAt == null`, `get(membersPublic/memberHash).data.isMember == true`, `displayName == get(...).data.get('displayName', 'Member')`. `update`: `isAdmin()` or (`resource.data.status == 'open'` && new `status in ['closed','no-logout']` && `outAt == request.time` && `affectedKeys().hasOnly(['status','outAt'])`). `delete`: `isAdmin()`.
- `gymDevices/{memberHash}`: `get: true`; `list: isAdmin()`; `create`: keys `hasOnly(['deviceId','linkedAt'])`, `deviceId is string && size() >= 16`, `linkedAt == request.time`, `exists(membersPublic/$(memberHash))`; `update, delete: isAdmin()`. Comment that the device link is a friendly-leaderboard deterrent, readable and therefore spoofable by a determined user (accepted in spec).

- [ ] **Step 1: Failing test** for `getOrCreateDeviceId` with an in-memory storage: first call stores and returns a 32-hex string; second call returns the same value.
- [ ] **Step 2:** FAIL. **Step 3:** implement `device.ts`, `generateDeviceId`, `store.ts`, rules and index. **Step 4:** `bun run test && bun run build` → PASS.
- [ ] **Step 5: Commit** `feat: add gym Firestore data layer and rules`

### Task 5: Scan page `/gym/scan`

**Files:**
- Create: `src/routes/gym.scan.tsx` (`createFileRoute("/gym/scan")`)
- Create: `src/lib/gym/scan.ts`

**Interfaces:**
- Consumes: Tasks 2 and 4; `useAuth()` (`verified`, `empId`, `requireLogin`, `logout`); `hashEmployeeId`.
- Produces: `type ScanOutcome = { kind: "checked-in"; at: Date; todayMinutes: number } | { kind: "checked-out"; minutes: number; overCap: boolean; todayMinutes: number } | { kind: "ignored"; last: "check-in" | "check-out"; at: Date; todayMinutes: number } | { kind: "device-mismatch" }` and `performScan(empId: string, deviceId: string): Promise<ScanOutcome>` in `scan.ts`: hash → `ensureDeviceLink` → fetch → `decideScanAction(visits, new Date())` → for check-in, first `closeVisit(id, "no-logout")` each `staleOpen` then `checkIn`; for check-out, `closeVisit(id, overCap ? "no-logout" : "closed")` → refetch → `todayMinutes` = `memberDayTotals(...).get(istDayKey(now)) ?? 0`. `at` for check-in = refetched open visit's `inAt`.

Page states:
- Not logged in → call `requireLogin(runScan)` on mount; if the modal is dismissed, show "Log in to record your gym visit" + Login button.
- Running → "Recording…".
- Header always: "Recording for **{displayName}** — Not you? Switch" (Switch = `logout()` then `requireLogin(runScan)`).
- `checked-in` → large "Checked in at {formatIstTime(at)}". `checked-out` → "Checked out — {formatMinutes(minutes)} this visit, {formatMinutes(todayMinutes)} today", or the exact long-visit copy if `overCap`. `ignored` → "You already {checked in|checked out} at {time}". `device-mismatch` → exact mismatch copy. Error → "Something went wrong, try again." + Retry.
- Link to `/gym/leaderboard`. Guard against double-run in React StrictMode (ref flag). Use `SiteHeader`/`SiteFooter` and theme classes from `index.tsx`.

- [ ] **Step 1:** implement. **Step 2:** `bun run build` passes; `bun run dev`, open `/gym/scan` on a phone-width viewport: login → checked in; reload within 2 min → "already checked in"; with rules undeployed → error + Retry (Review Focus 5); Switch flow works (Review Focus 4).
- [ ] **Step 3: Commit** `feat: add gym QR scan page`

### Task 6: Leaderboard page and home Gym card

**Files:**
- Create: `src/routes/gym.leaderboard.tsx` (`createFileRoute("/gym/leaderboard")`)
- Create: `src/components/gym-card.tsx`
- Modify: `src/routes/index.tsx:124-133` (Hall Availability section → `lg:grid-cols-3`, calendar `lg:col-span-2`, `<GymCard />` beside it, stacked on mobile)
- Modify: `src/components/site-chrome.tsx` (add "Gym" link to `/gym/leaderboard` in desktop + mobile nav)

**Interfaces:**
- Consumes: `fetchMonthVisits`, `fetchMemberMonthVisits`, `buildLeaderboard`, `memberDayTotals`, `memberTotal`, `effectiveStatus`, `istMonthKey`, `formatMinutes`, `formatIstTime`, `hashEmployeeId`, `useAuth`.

Leaderboard page: if not logged in → `requireLogin` with a "Members only — log in to see the leaderboard" fallback. Month picker (current month + previous 11, `<select>`), table: rank, name, total (`formatMinutes`), visits; logged-in member's row highlighted; empty state "No gym time logged this month yet."

Gym card: logged out → title "Gym", one line "Scan the QR on the gym door to log your time", Login button. Logged in → today's minutes, month total, current rank (from `buildLeaderboard(fetchMonthVisits(current))`), "In the gym since {time}" if an effectively-open visit exists, link "View leaderboard". No scan button.

- [ ] **Step 1:** implement. **Step 2:** `bun run build` passes; check home at 375 px and desktop widths; leaderboard renders with seeded data.
- [ ] **Step 3: Commit** `feat: add gym leaderboard and home card`

### Task 7: Admin Gym tab with printable QR

**Files:**
- Modify: `src/routes/admin.tsx` (add `"gym"` to `AdminTab` and `TABS` as "Gym"; render `<GymTab />`)
- Create: `src/components/admin-gym-tab.tsx`

Contents:
- **Door QR:** `QRCode.toDataURL(\`${window.location.origin}/gym/scan\`, { width: 600, margin: 2 })` shown as `<img>` with the caption "Scan to check in / out of the gym" and a "Print" button that opens a new window with only the image + caption and calls `print()`.
- **Visits:** month picker, table (name, IST date, in, out, effective status, minutes), Delete button per row (confirm dialog) → `deleteVisit`.
- **Reset phone link:** Employee ID input → `hashEmployeeId` → `resetDeviceLink` → "Phone link reset for {displayName}."
- **Note** under Members tab copy: "Re-upload the member list once so leaderboard names appear."

- [ ] **Step 1:** implement. **Step 2:** `bun run build` passes; QR renders and decodes to `/gym/scan` (scan with a phone).
- [ ] **Step 3: Commit** `feat: add admin gym tab with printable QR`

### Task 8: Final verification

- [ ] `bun run test` → all pass; `bun run lint` → no new errors; `bun run build` → success.
- [ ] Note for the user in the hand-off: deploy rules and index with `firebase deploy --only firestore`, re-upload the member Excel, then print the QR from Admin → Gym.
