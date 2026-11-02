# Gym QR Check-in / Check-out & Leaderboard

## Why

Members want a light, friendly way to track how much time they spend at the club gym, and the club wants a fun monthly "who spent the most hours at the gym" leaderboard. There is no gym tracking today. This is **for fun, not for prizes** — fairness measures should stop the easy cheats, not be bulletproof.

## Goals

- A single **printed QR code on the gym door**. Scanning it with a phone opens the club website and records a timestamp.
- First scan of a visit = **entry**; next scan = **exit**. Minutes for the visit are recorded; a member's daily total is the sum of their visits that day.
- Members stay logged in on their phone so a scan normally needs **zero typing**.
- A **Gym card on the home page**, placed beside/next to Hall Availability (as in the reference mock-up), showing the member's own time today and this month, and linking to the leaderboard.
- A **monthly leaderboard** ranking members by total gym time.
- Admins can see and delete visits.

## Non-goals

- A rotating/changing QR on a screen (may come later; not now).
- Prizes, notifications, streaks, badges.
- Real identity proof (passwords, OTP). Login stays "enter your Employee ID".
- Hardware (turnstiles, NFC).

## Anti-goals (would be a failure even if it works)

- Members having to type their Employee ID every time they scan.
- A forgotten exit scan inflating someone's total (e.g. a "17-hour visit").
- Exposing members' private details (phone numbers, full employee IDs) publicly.
- Breaking or changing the existing hall booking flow beyond the login-persistence change below.

## Decided with the user

1. **Printed QR on the door** encodes a URL to a new route, `/gym/scan` (exact path is the builder's call). Scanning opens the site in the phone browser.
2. If the phone isn't logged in, the existing Employee-ID login modal is shown; after a successful login the scan is recorded immediately.
3. **Persistent login:** the member stays logged in on that phone until they explicitly log out. (Today it is `sessionStorage` — lost when the tab closes. Move to `localStorage`.) This applies site-wide, including hall booking.
4. **Forgot to scan out:** at the end of the day the open visit is closed and marked **"no logout"**, counting **0 minutes**.
5. Friendly leaderboard, so fairness is light (see below).

## Proposed by Claude, accepted by the user ("good enough")

- **Multiple visits per day** are allowed; minutes add up.
- **One phone per member for the gym.** The first gym scan links the member to that phone (a random device ID stored in `localStorage`). A gym scan for that member from a different phone is refused with a clear message ("This member's gym check-ins are linked to another phone — ask an admin to reset."). An admin can reset the link.
- **Shared phones allowed (user decision):** the link is one-directional — each *member* has exactly one gym phone, but one phone may be the gym phone for *several* members (e.g. a couple). Key the link by member hash. Because login persists, the scan screen shows "Checking in as Ramesh K. — not you? Switch" before/with the recorded action; "Switch" logs out and shows the login modal. This still stops the main cheat (a friend checking you in from *their* phone); the residual cheat (someone carrying your phone) is accepted.
- **Visit cap: 3 hours (user decision).** Any single visit longer than 3 hours is treated as a forgotten exit: marked **"no logout"** and counts **0 minutes**, same as a visit left open past midnight. The scan-out screen says so plainly ("This visit was over 3 hours, so it's counted as a missed check-out").
- **Daily cap: 4 hours** counted per member per day (sum of visits).
- **Double-scan guard:** a scan within **2 minutes** of the previous scan by the same member is ignored (shows the current status instead of creating a 0-minute visit).
- **Admin:** on the existing `/admin` page, a Gym section listing visits (filterable by date/month), with delete, and a "reset phone link" action per member.

## Claude's calls (made while writing this up — user can override)

- **Day boundary / timezone:** days are calendar days in **Asia/Kolkata (IST)**. A visit belongs to the day it started. "End of day" close-out happens at 00:00 IST.
- **No background job exists** (the site is static + Firestore, no server cron). So "closing" a forgotten visit is **lazy**: any open visit whose start date is before today (IST), **or that started more than 3 hours ago**, is treated as "no logout / 0 minutes" wherever it's read, and the next scan by that member starts a fresh entry rather than closing the stale one. Optionally the scan flow also writes the `no-logout` status onto the stale visit when it notices it.
- **Leaderboard visibility:** only logged-in members (it sits behind the existing site gate anyway). It shows a **display name: first name + last-name initial** (e.g. "Ramesh K.") — never phone or any part of the Employee ID. (Showing ID digits was rejected: `crypto.ts` notes the ID space is small, so even 3 digits beside the public hash would make full IDs recoverable.) This requires a public display name: the admin member upload should additionally write a `displayName` to `membersPublic`, derived from the existing `name` column — the first word that isn't an initial (skip tokens of ≤2 letters or ending in "."), title-cased, plus the initial of the last remaining word if any. Members uploaded before this change show as "Member" until the list is re-uploaded.
- **Leaderboard default:** current month, with a month picker for previous months. Shows rank, display name, total hours+minutes, and number of visits. The logged-in member's own row is highlighted.
- **Timestamps come from the server**, not the phone: Firestore rules require entry/exit times to equal `request.time` so a phone's clock can't be faked.
- **Scan result screen:** big, clear confirmation suited to a phone at the gym door — "Checked in at 6:42 AM" / "Checked out — 48 min this visit, 1 h 20 min today", plus a link to the leaderboard. Styled with the existing gold/elite theme.
- **Home-page Gym card:** if logged in, shows today's minutes, this month's total, and current rank; if a visit is open, shows "In the gym since 6:42 AM". If not logged in, shows a short description and the login prompt. It does *not* contain a scan button (scanning is done via the door QR); it may show the QR image itself so admins can print it.
- **Printable QR:** admin page gets a "Print gym QR" view that renders the QR for the `/gym/scan` URL (use a small QR library) so the club can print it.

## Constraints / current state

- Stack: TanStack Start (React, Vite), Tailwind, Firebase Firestore; admins use Firebase Auth (email/password). Members have **no Firebase Auth identity** — "login" is `verifyMembership(empId)` against `membersPublic/{sha-hash of empId}` (`src/lib/hall/members.ts`, `src/components/auth-context.tsx`, `src/lib/hall/gate.ts`).
- Because members are unauthenticated, Firestore rules **cannot verify who is scanning**. Rules should still: force server timestamps, restrict which fields can change on entry/exit transitions, make visits non-deletable except by admin, and make the phone link create-once (admin-only update/delete). Accept that a determined person could bypass the phone link — this is a friendly leaderboard.
- Keyed by the existing employee-ID hash (`hashEmployeeId`), not the raw ID, in any publicly readable collection.
- Firestore rules live in `firestore.rules`; follow the existing heavily-commented style. Rules must be deployed for the feature to work.
- Existing tests use Vitest (`src/lib/hall/*.test.ts`); pure logic (minutes calculation, daily cap, IST day boundaries, stale-visit handling, double-scan guard, leaderboard ranking) should live in testable pure functions with tests.

## Left to the builder

- Exact Firestore collection names and document shapes (e.g. `gymVisits`, `gymDevices`), and whether leaderboard totals are computed by querying a month's visits client-side or kept in aggregate docs. Prefer the simplest approach that is correct at club scale (hundreds of members, not millions).
- Exact route paths and component structure.
- Which QR-generation library to use.
- Visual details within the existing theme.
