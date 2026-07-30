# Site-wide Membership Gate

## Problem

Today, the "are you a member?" check happens as Step 1 inside the `/hall` booking wizard, after a visitor has already browsed the rest of the site (home, notices, gallery, etc.). We want to move that check to the front door: before anyone can see any page (except `/admin`), they must verify their Employee ID.

## Behavior

- **Scope:** Every route is gated except `/admin`, which keeps its own existing Firebase email/password sign-in and is otherwise untouched.
- **Gate UI:** A full-screen splash, visually distinct from the rest of the site (not styled like the `/hall` wizard's Step 1 card). Shows an Employee ID input and a Verify button. No "I'm a member / I'm not a member" choice at this layer — only verified members pass.
- **Verification:** Reuses the existing `verifyMembership(empId)` from `src/lib/hall/members.ts` — no changes to that function or to Firestore rules/schema.
  - Success → gate dismisses, the requested page renders.
  - Failure (not found) → inline error "No member found with this Employee ID — check for typos and try again," input stays editable, user can retry immediately (no dead end).
  - Empty input → "Enter your Employee ID."
  - Network/Firestore error during verify → generic "Something went wrong, try again" message; not treated as "not a member."
- **Persistence:** `sessionStorage` flag (`hall_gate_verified`). Once verified, the gate does not reappear for the rest of that browser session (i.e., until the tab/browser is fully closed and reopened). Navigating between pages within the session does not re-trigger it.
- **Booking wizard unchanged:** `/hall`'s own Step 1 (member/non-member choice, non-member fee path, its own Employee ID + Verify) stays exactly as-is. The new splash is a separate outer layer, not a replacement — a verified member could still choose "not a member" fee inside the wizard (e.g., booking on behalf of a guest).

## Implementation

- New component (e.g. `src/components/site-gate.tsx`) rendered from `RootComponent` in `src/routes/__root.tsx`, wrapping `<Outlet />`.
- On mount, reads `sessionStorage.hall_gate_verified`. If set, renders `<Outlet />` directly.
- If not set, checks current pathname (via router state/location): if it starts with `/admin`, renders `<Outlet />` directly (bypass). Otherwise renders the full-screen splash in place of `<Outlet />`.
- On successful verify, sets `sessionStorage.hall_gate_verified = "1"` and renders `<Outlet />`.
- No new Firestore reads/writes beyond the existing `verifyMembership` call; no changes to `firestore.rules`.

## Out of scope

- No changes to non-member pricing/fees in the booking wizard.
- No changes to `/admin`'s auth flow.
- No "remember on this device" (localStorage) persistence — session-only, by design.
