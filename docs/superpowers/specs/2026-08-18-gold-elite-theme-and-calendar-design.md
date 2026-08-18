# Gold/Elite Theme, Two-Step Gate, and Availability Calendar Redesign

## Problem

The site currently uses a purple/violet "brutalist" visual style, a single-step
Employee ID gate, a 3-day-strip availability widget on the home page, and a
booking wizard whose first step re-asks membership status (with a non-member
fee path) even though the site-wide gate already only admits verified
members. The user wants a premium "gold/elite club" visual identity, a
welcome-first gate flow, a real month calendar with red/yellow/green
day-status coloring, and the now-redundant non-member booking path removed.

## Behavior

### 1. Theme — site-wide gold/elite palette

Applies everywhere (home, hall booking, admin panel, gate) via the existing
CSS-variable token system in `src/styles.css` — no per-component rewrites
needed for colors, since every component already consumes tokens like
`bg-primary` / `text-on-primary` rather than hardcoded colors (with a small
number of hardcoded-hex exceptions, see below).

- **Palette**: near-black/charcoal surfaces, warm ivory/cream text, gold as
  primary (with a brighter gold-container variant), a deep emerald or oxblood
  secondary/tertiary accent for contrast elements (tags, confirmed states).
  Success/error semantics stay conceptually the same (green success, red
  error) but recolored to fit the palette.
- **Shape language**: full luxury restyle — rounded corners (cards, buttons,
  inputs), soft shadows, subtle gold glow on hover/focus. Achieved primarily
  by redefining the shared `.brutalist-card` / `.brutalist-button` utility
  classes in `styles.css` in place, since ~27 call sites across the app
  already use them — this is a targeted, one-place fix consistent with
  "existing code has problems that affect the work" (duplicated visual
  language spread across many files, now centralized).
- **Typography**: display font switches from Bricolage Grotesque to a serif
  display face (e.g. Playfair Display, via Google Fonts) for the premium
  feel; Inter stays as the body font.
- **Known hardcoded-hex exceptions to sweep**: `site-chrome.tsx`'s "Hall free
  until 6pm" pill (`bg-[#D1FFBD]`, `border-[#1E4D12]`) and `index.tsx`'s
  `summarizeDay` dot colors (`bg-[#1E4D12]`) — these bypass the token system
  today and must be converted to token-based or new semantic classes so they
  pick up the new palette too.
- **Out of scope**: no change to page structure, section order, or content on
  any page — this is a visual re-skin only.

### 2. Gate — two-step welcome flow

`SiteGate` (`src/components/site-gate.tsx`) gains a `step: "welcome" |
"login"` state, starting at `"welcome"` whenever unverified for the session.

- **Step "welcome"**: full-bleed gold/dark splash — "Welcome to the
  Executives Club" headline, short subtext, single "Login to your Account"
  button. No form fields on this screen.
- **Step "login"**: clicking the button flips state to `"login"`, revealing
  today's Employee ID form (restyled to the new theme). Validation, error
  mapping (`empty` / `not-found` / `network`), duplicate-submit guard,
  autofocus/refocus-on-error, and `aria-live` behavior are all unchanged from
  the current implementation.
- No route change and no new top-level persistence key for the step itself —
  `step` is local component state, reset to `"welcome"` on each fresh
  (unverified) mount, matching the existing "ask every session" behavior.
- **Admin bypass** (`isAdminPath`) is unchanged.

### 3. Gate persists the verified Employee ID, not just a boolean

Today `sessionStorage` stores only a boolean flag (`hall_gate_verified`). This
changes: on successful verification, the gate also stores the **trimmed
Employee ID** itself under a new key, `hall_gate_emp_id`.

- New pure helper in `src/lib/hall/gate.ts`: `readGateEmpId(getItem: (key:
  string) => string | null): string | null`.
- `SiteGate` writes both keys together in the same `handleSubmit` success
  branch: `sessionStorage.setItem(GATE_SESSION_KEY, "1")` and
  `sessionStorage.setItem(GATE_EMP_ID_KEY, trimmed)`.
- Because `SiteGate` wraps `<Outlet />` at the root level, every non-admin
  route (including `/hall`) is only ever rendered after a successful gate
  verification — so `/hall` can read this value unconditionally, no fallback
  or "ID missing" state needs to be designed for.

### 4. Home page — full month availability calendar, red/yellow/green

Replaces the current 3-day-strip `HallAvailabilityWidget` in `index.tsx`.

- New pure helper, `dayColorFor(status: DayStatus): "red" | "yellow" |
  "green"` (added to `src/lib/hall/calendar.ts`), encoding the approved
  mapping:
  - `confirmed | held | blocked` → **red** ("can't book this")
  - `pending` → **yellow** (awaiting approval)
  - `available` → **green** (free)
- New shared component `src/components/availability-calendar.tsx`,
  `<AvailabilityCalendar venue compact? />`, rendering a full month grid
  where each day cell is **filled** with its status color (not a small dot),
  month navigation, and a Free/Pending/Booked legend.
  - `compact` (used on the home page): defaults to the current month, no
    venue switcher (single default venue), each day cell links through to
    `/hall`.
  - Non-compact (used on `/hall`'s existing Calendar tab): keeps its month
    nav and venue `<select>`, replacing today's dot-based rendering with the
    same filled-cell color language for one consistent visual system across
    both pages.
- This replaces two separate, duplicated pieces of day-status-to-color logic
  (`summarizeDay` in `index.tsx` and `dotForStatus`/`worstStatus` in
  `hall.tsx`) with one shared component and one shared color-mapping
  function.

### 5. Booking wizard — remove the non-member path

Since the site gate already guarantees every visitor to `/hall` is a
verified member, the wizard's own membership branch is redundant and is
removed.

- **Step 1 ("Membership") is deleted.** The wizard now opens directly on the
  Details step (steps renumber 4 → 3: Details, Payment, Confirmation).
- The Employee ID field moves into the Details step, **pre-filled and
  read-only**, sourced from `readGateEmpId` — not re-editable, so a user
  cannot type a different, unverified ID at booking time and bypass the
  gate's guarantee. `verifyMembership` is no longer called from the wizard at
  all (it was already called once, at the gate).
- `BookingFormState.isMember` and the "I'm a member" / "I'm not a member"
  toggle are deleted.
- `calculateBookingFee` (`src/lib/hall/fees.ts`) drops the `isMember`
  parameter and the non-member price tiers (₹1000 / ₹500) — becomes
  `calculateBookingFee(venue: string): number`, member rate only.
- `isMember` is removed from `BookingDoc` and `CreateBookingInput`
  (`src/lib/hall/types.ts`, `src/lib/hall/transactions.ts`). Confirmed via
  repo search that nothing outside `transactions.ts`/`fees.ts`/`hall.tsx`
  reads this field (not the admin panel, not email templates) — this is a
  clean deletion, not a field left dead-but-always-true.
- `src/lib/hall/members.ts` (`verifyMembership`, `MemberPublicDoc.isMember`)
  is unrelated to this and stays unchanged — it's the membership-directory
  lookup used by the gate itself.

## Out of Scope

- No changes to `/admin`'s own email/password authentication.
- No homepage restructuring into the image's tile-dashboard layout (gym
  QR access, separate photo-gallery tile, etc.) — current section
  order/content stays, only the visual skin and the calendar change.
- No changes to Firestore security rules beyond what naturally follows from
  removing the `isMember` field from writes (no new rules needed — rules
  that reference required fields, if any, are checked during
  implementation, not designed here).
- No change to the booking approval/payment/cancellation state machine.

## Testing

- `dayColorFor` (pure function) and `readGateEmpId` (pure function) get unit
  tests in the existing `vitest` (node environment) setup, alongside the
  existing `gate.test.ts` / `fees.test.ts` style.
- `calculateBookingFee`'s existing tests (`fees.test.ts`) are updated for the
  new single-argument signature; non-member-rate test cases are removed.
- Visual/component changes (theme, gate splash, calendar rendering, wizard
  flow) are verified manually via the dev server, matching this repo's
  existing convention (no component-level tests exist for any prior
  feature either).
