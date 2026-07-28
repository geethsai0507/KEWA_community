# Executives Club Hall Booking — Design Spec

Date: 2026-07-28

## Context

`/hall` (`src/routes/hall.tsx`) is currently a static mockup: fake calendar data,
non-functional forms, no persistence, no admin view. This spec covers rebuilding
it into a real, working hall-booking system, informed by an end-to-end analysis
of a reference site (an unrelated NTPC Kudgi KEWA portal) that solves a similar
problem — reusing what works there, fixing what doesn't, and adapting naming to
this project ("Executives Club" instead of "KEWA").

**Out of scope:** events, training, movies, BPL tournament, gaming hub — the
reference site has these, this spec covers hall booking only.

## Architecture

- Frontend: this repo's existing TanStack Start app; `/hall` rebuilt in place.
- Data + Auth: Firebase (Firestore + Firebase Auth), Spark (free) tier.
- Email: EmailJS free tier, triggered client-side.
- Hosting: Netlify static build. Firebase/EmailJS are called directly from the
  browser. There is no custom application server to deploy, run, or maintain
  — Firebase itself is still backend infrastructure, just infrastructure this
  project doesn't have to build or operate.
- Double-booking prevention and 15-minute payment-hold expiry are both done
  with Firestore transactions from the client SDK — no Cloud Functions needed
  for the core flow.

New dependencies: `firebase` (client SDK), `@emailjs/browser`.

## Venues & Fees

Hardcoded in code (not a Firestore collection — they rarely change and a config
layer isn't justified):

| Venue | Member fee | Non-member fee |
|---|---|---|
| Executives Club Community Hall | ₹500 | ₹1000 |
| Shopping Complex Room | ₹200 | ₹500 |
| Multi Purpose Room | ₹500 | ₹1000 |
| Other (free text) | ₹200 | ₹500 |

Slots: Morning (6:00 AM – 1:00 PM), Evening (2:00 PM – 10:00 PM). Fixed in a
`SLOTS` constant; `slot` is the source of truth on a booking, times are derived
from the constant at render time, not stored per-booking.

**Known limitation (accepted, not solved by this spec):** `amount` is computed
client-side from a hardcoded fee table and only loosely validated by Firestore
rules (see Security Rules). A modified client could submit a different amount.
Firestore rules are not well suited to expressing "amount must equal
`calculateBookingFee(isMember, venue)`" as a fully trusted calculation. Treat
`amount` validation as advisory unless/until a Cloud Function or a
rules-readable fee-configuration document is added later.

## Data Model

### `bookingSlots` (public, no PII — source of truth for availability)

```
venue         string
date          string   "YYYY-MM-DD"
slot          "Morning" | "Evening"
status        "pending-approval" | "pending-payment" | "pending-verification"
              | "confirmed" | "cancelled" | "expired"
bookingNumber string   "EC-XXXXXX", public human-readable reference (display only)
lookupToken   string   random 128-bit token (hex/base64), the actual lookup credential
expiresAt     Firestore Timestamp | null   (set only while status = pending-payment)
```

Document ID is Firestore's auto-generated ID, and **the same ID is used for the
paired `bookings/{id}` document** — this is how a status lookup resolves to the
private record (see below) without ever needing a public field to be the
document ID.

**`bookingNumber` vs `lookupToken`:** `bookingNumber` is what the user sees
(confirmation screen, print slip, emails) — it can be a short, readable
sequence like `EC-4F82A1` since it is *not* the security boundary.
`lookupToken` is a separate, cryptographically random 128-bit value generated
at booking creation, never displayed, and used only as the query key for
status lookup (see below). This avoids the security of the lookup depending on
`bookingNumber` being unguessable — a sequential or short human-facing ID
(`EC-000001`, `EC-000002`, ...) would otherwise be enumerable.

Public fields are deliberately limited to the above. Do not add: internal audit
fields, or timestamps beyond `expiresAt` that would reveal activity patterns
(e.g. no `createdAt` in this collection — it isn't needed for calendar
rendering or conflict checks).

This collection is what the calendar and the booking-creation transaction read
and write. It must never diverge from `bookings` (see Consistency Rule below).

### `bookings` (private — full record with PII)

```
bookingNumber   string   "EC-XXXXXX" (denormalized copy, matches bookingSlots)
lookupToken     string   denormalized copy, matches bookingSlots
name, empId, phone, email   string
venue           string
date            string
slot            "Morning" | "Evening"
purpose, duration   string
utr             string | null
amount          number
isMember        boolean
status          same enum as bookingSlots
cancelledBy     "user" | "admin" | null
approvedBy      string | null   (admin email, set on pending-approval → pending-payment)
approvedAt      Firestore Timestamp | null
paymentVerifiedBy string | null   (admin email, set on pending-verification → confirmed)
paymentVerifiedAt Firestore Timestamp | null
rejectedBy      string | null   (admin email, set on any admin rejection)
rejectedAt      Firestore Timestamp | null
cancelledAt     Firestore Timestamp | null
expiresAt       Firestore Timestamp | null   (mirrors bookingSlots)
createdAt       Firestore Timestamp (serverTimestamp())
updatedAt       Firestore Timestamp   — bumped on every status change
```

Document ID: Firestore auto-generated, shared with the paired `bookingSlots`
document. **The Booking Number (`bookingNumber`) is never the document ID** —
it's a denormalized display/lookup field on both documents.

### `bookingEvents` (admin-only read — audit trail)

```
bookingId    string   (the shared doc ID)
action       "CREATED" | "APPROVED" | "REJECTED" | "PAYMENT_SUBMITTED"
             | "PAYMENT_VERIFIED" | "CANCELLED" | "EXPIRED"
oldStatus    string | null
newStatus    string
performedBy  string   admin email, "user", or "system" (for auto-expiry)
timestamp    Firestore Timestamp (serverTimestamp())
```

Written alongside every transition, in the same transaction where practical.

### `members` (admin-only, full PII)

`empId, name, phone` — populated via admin Excel upload (SheetJS). Used by the
admin panel's Members directory tab. **Read and write are both admin-only** —
this is not exposed to the public client.

### `membersPublic` (public read, no PII)

```
empIdHash   string   SHA-256(empId, lowercased/trimmed)
isMember    boolean
```

Written by the admin panel alongside `members` — when the admin uploads the
Excel sheet, the client computes `empIdHash` for each row and writes both the
full `members` doc (admin-only) and the corresponding `membersPublic` doc
(public, hash only) in the same operation.

**Membership verification step, revised:** user types their Employee ID, the
client computes `SHA-256(empId)` locally and queries `membersPublic` for a
matching `empIdHash`. If found, membership is confirmed and fee tier is set to
"member" — but **the employee's name is no longer auto-filled**, since no
public collection holds the name/phone mapping anymore. The user types their
own name/phone/email in the Details step, same as they would for a
non-member booking. This is a deliberate trade-off: it fully closes the
"anyone can read the whole employee directory from devtools" gap the
reference site has, at the cost of one convenience feature (auto-fill) that
isn't required for the booking to work.

### `blockedDates`

`date, venue, reason, createdAt` — admin-managed, public read (needed for
calendar and booking-time validation).

### `settings` (single doc)

EmailJS `serviceId` / `adminTemplateId` / `paymentInstructionsTemplateId` /
`confirmedTemplateId` / `cancelledTemplateId` / `publicKey`, `adminEmail`.
Admin-configurable from the panel.

## State Machine

```
pending-approval ──approve──▶ pending-payment ──UTR submitted──▶ pending-verification ──admin verifies──▶ confirmed
       │                            │
     reject                    15-min timeout
       │                            │
       ▼                            ▼
   cancelled                    expired

confirmed ──user cancel or admin cancel──▶ cancelled
```

Rules:
- **`pending-payment` is the only state with automatic timing.** 15 minutes
  after entering this state (`expiresAt`), if no UTR has been submitted, the
  booking becomes `expired`. No admin action needed or possible to prevent this.
- **`pending-approval` and `pending-verification` never auto-expire.** Both are
  explicit admin-queue states. This matches an accepted gap in the reference
  site (a request can sit unactioned indefinitely) — the admin dashboard's
  pending counts are the only nudge, by deliberate choice, not oversight.
- **`pending-verification → confirmed` requires an authenticated admin action.
  The system must never automatically move this transition based only on UTR
  entry.** A typed UTR is a claim, not proof of payment — without a payment
  gateway or server-side verification, only a human checking the actual bank
  statement can confirm it. This is the one correction made relative to the
  reference site's model (which auto-confirmed on UTR entry).
- Self-cancel (user) is only reachable from `confirmed` or `pending-payment`.
- Admin force-cancel (the "exception" path) is reachable from any non-terminal
  state.

## Booking Submission Flow

1. **Membership verification** — user enters Employee ID, client computes
   `SHA-256(empId)` and queries `membersPublic` for a matching `empIdHash` (see
   Data Model). Unlike the reference site, this does not auto-fill name/phone
   — the user provides those in the Details step.
2. **Details form** — same client-side validation as reference (phone/email
   regex, no past dates, T&C checkbox). Fee computed via
   `calculateBookingFee(isMember, venue)`.
3. **Conflict check + creation (Firestore transaction, operating on
   `bookingSlots` as the source of truth):**
   - Read `bookingSlots` docs matching `venue` + `date` + `slot`.
   - A doc is **blocking** if `status ∈ {confirmed, pending-approval,
     pending-verification}`, OR `status === 'pending-payment' AND expiresAt >
     now`. Everything else (`cancelled`, `expired`, or an expired
     `pending-payment`) is non-blocking.
   - If a blocking doc exists for the exact same venue+date+slot → abort the
     transaction, surface "This slot was just taken, please choose another."
   - Else if the venue already has any non-blocking-excluded booking that same
     date in the *other* slot (policy caution, not a technical conflict) →
     create both `bookingSlots/{id}` and `bookings/{id}` with
     `status: 'pending-approval'` (no payment step shown yet).
   - Else → create both docs with `status: 'pending-payment'`,
     `expiresAt = now + 15min` → proceed directly to the payment step.
   - **Expiry checks happen inside this transaction, not just in the calendar
     UI.** The calendar's own expiry handling (below) is a display/cleanup
     convenience only and must never be relied on for conflict prevention —
     the transaction is the sole source of truth for whether a slot is free.
4. **Payment step** (only reached once status is `pending-payment`): UPI QR +
   UTR text entry, same UI as reference. Submitting a UTR before `expiresAt`
   moves status to `pending-verification` (transaction updates both
   `bookingSlots` and `bookings`, logs a `PAYMENT_SUBMITTED` event). After
   `expiresAt`, submission is rejected client-side ("This booking has
   expired, please start again").
5. **Confirmation screen** shown once `confirmed` (reached only via explicit
   admin verification, not immediately after step 4).

### bookingSlots ↔ bookings Consistency Rule

**Any status transition affecting availability must update both
`bookingSlots/{id}` and `bookings/{id}` inside the same Firestore transaction.
The two documents must never intentionally diverge.** Example: on a
`pending-payment → expired` transition, the same transaction sets
`bookingSlots.status = expired` and `bookings.status = expired` together —
never one without the other.

## Admin Actions

- **On a `pending-approval` booking:** Approve → `pending-payment`,
  `expiresAt = now + 15min`, `approvedBy`/`approvedAt` set, email sent to user
  with payment instructions (new deadline starts at approval, not original
  request). Reject → `cancelled`, `cancelledBy: "admin"`,
  `rejectedBy`/`rejectedAt` set, email sent to user.
- **On a `pending-verification` booking:** Verify → `confirmed`,
  `paymentVerifiedBy`/`paymentVerifiedAt` set, confirmation email sent. Reject
  (invalid/fake UTR) → `cancelled`, `cancelledBy: "admin"`,
  `rejectedBy`/`rejectedAt` set, email sent.
- **Force-cancel (exception path):** available on any non-terminal booking from
  the All Bookings tab — same write as admin rejection, `cancelledBy: "admin"`.
- **Blocked Dates management** and **Members Excel upload** — same as reference
  site, admin-only.
- **Email settings form** — same as reference.
- Every admin action above writes a matching `bookingEvents` row.

Admin auth: Firebase email/password, account(s) created directly in the
Firebase console (no self-registration UI).

## Calendar

- Live sync via Firestore `onSnapshot` listeners on `bookingSlots` and
  `blockedDates` while the calendar is mounted — other admins'/users' changes
  appear without navigating away and back.
- Three distinct visual states: `confirmed` (solid/booked), `pending-approval`
  or `pending-verification` (amber — admin-queue holds), `pending-payment`
  ("Held — expires in Xm", live countdown).
- **Expired bookings must never render as blocking, even briefly.** When a
  client's snapshot listener observes a `pending-payment` doc whose
  `expiresAt` has passed, it immediately (a) stops treating it as blocking in
  the render, and (b) issues a best-effort write flipping both
  `bookingSlots.status` and `bookings.status` to `expired` (guarded by a
  status check so repeat writes are avoided) — first client to notice fixes
  it for everyone. This is a UI/data-hygiene convenience; **the authoritative
  expiry check that actually prevents double-booking lives in the
  booking-creation transaction**, not here.

## Self-Service Status Lookup ("My Status")

Lookup is **by `lookupToken` only** — there is no public path that accepts a
Booking Number and resolves it to a token, since that would just reintroduce
Booking Number as the real security boundary through indirection (it's
documented above as short/guessable by design, not a secret). Concretely:
1. The confirmation screen, printable slip, and every notification email
   present a direct link encoding the token (e.g. `/hall/status?token=...`).
   This link is the only way a user reaches their own booking's status page.
2. That page queries `bookingSlots.where('lookupToken', '==', token)` (public,
   no PII) to resolve the doc ID, then `bookings.doc(id).get()` (public
   single-doc get) to fetch and display the full record.
3. Booking Number is still shown everywhere (confirmation, slip, emails) as a
   human-friendly reference for phone/in-person conversations with the
   office — but it is not a valid input anywhere in the self-service lookup
   UI. If a user loses their status link and can't find the emails, an admin
   can look them up in the admin panel via an authenticated query on
   `bookings` by `bookingNumber` (admin-only `list` access already covers
   this) and re-send the link.

The token itself must come from a cryptographically random source (not
`Math.random()`), generated once at booking creation and never regenerated.

## Email Notifications (EmailJS, 4 templates)

1. **Approval needed** (→ admin) — fired when a booking becomes
   `pending-approval`.
2. **Payment instructions** (→ user) — fired whenever a booking enters
   `pending-payment` (whether immediately or after admin approval); includes
   UPI QR, amount, and the 15-minute deadline.
3. **Booking confirmed** (→ user) — fired when an admin verifies payment.
4. **Booking cancelled/rejected** (→ user) — fired on any cancellation,
   wording branches on `cancelledBy` and which stage it happened at
   (admin-rejected-approval / admin-rejected-payment / self-cancelled /
   expired).

## Security Rules (Firestore)

- `bookingSlots`: `get`/`list` public (no PII, safe to expose broadly).
  **Firestore rules cannot verify that a write came from a transaction or that
  a client followed the intended application flow** — a rule only sees the
  document being written, so "only via the transaction paths described above"
  must be expressed as explicit per-field constraints, not as a comment. The
  rules must state:
  - `create`: allowed only when `status` is exactly `pending-payment` or
    `pending-approval`, `expiresAt` is set/absent consistently with that
    status, and `bookingNumber`/`lookupToken` are present and correctly
    typed. A client cannot create a doc with `status: "confirmed"` or any
    other value.
  - `update`: **no general public update path on this collection.** Every
    transition after creation (approval, rejection, payment verification,
    cancellation) is admin-only or handled by the narrowly-scoped self-cancel
    rule defined under `bookings` below — `bookingSlots` is kept in sync by
    the *same authenticated/rule-permitted operation* that updates `bookings`,
    not by a separate public write path. A malicious client attempting to
    directly PATCH an existing `bookingSlots` doc to `{"status":
    "confirmed"}` must be rejected by the rules regardless of intent. The one
    deliberate exception is the client-side expiry write described in the
    Calendar section: a narrowly-scoped public update rule permitting *only*
    the transition `status: "pending-payment" → "expired"`, and only when
    `resource.data.expiresAt < request.time` and no field other than `status`
    (and the mirrored `bookings.status`, written in the same transaction)
    changes. This is the sole public write path on an existing document in
    either collection.
  - `delete`: admin-only.
  - Public fields are strictly limited to `venue, date, slot, status,
    bookingNumber, lookupToken, expiresAt` — no internal audit fields.
  - **Rules cannot enforce the cross-collection consistency rule** (that
    `bookingSlots` and `bookings` update together) — that guarantee comes only
    from the application's transaction code. Each collection's rules must
    independently protect against a client writing to *only one* of the two
    documents; the deny-by-default posture above (no public update on
    `bookingSlots`, and the equally narrow rule on `bookings` below) is what
    makes a partial/inconsistent write impossible for a non-admin client to
    produce, not the transaction alone.
- `bookings`:
  - `create`: public, but rule-constrained — `status` must be exactly
    `pending-payment` or `pending-approval` on create, all required fields
    must be present, and admin-only fields (`cancelledBy`, `approvedBy`,
    `approvedAt`, `paymentVerifiedBy`, `paymentVerifiedAt`, `rejectedBy`,
    `rejectedAt`, `cancelledAt`) must be absent/null on create.
  - `get` (single doc, known ID): public — this is what powers Booking Number
    lookup.
  - `list`/query: **admin-only**. There is no public query path on this
    collection.
  - `update`: admin-only, **except** a narrowly-scoped public self-cancel rule
    that permits a write only when the diff is exactly `status: confirmed |
    pending-payment → cancelled` + `cancelledBy: "user"` + `cancelledAt` set,
    with no other field changed, and only from `confirmed` or
    `pending-payment`. No other transition is reachable without admin auth.
- `bookingEvents`: `create` alongside the transitions above; `get`/`list`
  admin-only.
- `members`: `get`/`list`/`create`/`update`/`delete` **admin-only** — full PII,
  never exposed to the public client. This closes a gap the reference site
  has (there, the full member directory is downloaded client-side).
- `membersPublic`: `get`/`list` public (only `empIdHash`/`isMember`, no PII);
  `create`/`update`/`delete` admin-only, and only ever written by the admin
  panel's Excel-upload flow alongside the matching `members` doc.
- `blockedDates`, `settings`: read public where needed for the app to function
  (calendar/booking validation, EmailJS config isn't itself secret); write
  admin-only.

**Accepted limitation:** there is no per-user authentication layer for regular
users (only admins authenticate). This is why `bookings` has no public `list`
— without proving "you are this Employee ID / this phone number," any
Firestore rule permitting a public filtered query is equivalent to permitting
anyone to browse by guessing the filter value. The lookup-token-based status
lookup above is the mitigation: it requires knowing an effectively-unguessable
128-bit token rather than a structured, possibly-guessable Employee ID or
booking number.

## Testing

No test framework currently in this repo. Add lightweight Vitest unit tests for
pure, easy-to-get-wrong logic: `calculateBookingFee`, the conflict-rule
evaluator, and expiry-time comparisons. Not attempting to mock
Firestore/transactions — low value for the effort. Everything else gets manual
QA against the running dev server: booking happy path, real-slot-conflict
rejection, same-day-caution → approval → payment → verification → confirmed
chain, 15-minute auto-expiry, self-cancel, admin reject at each stage.

## Deployment

- Firebase project (Firestore + Auth enabled), security rules from this spec
  deployed via the Firebase console or CLI.
- EmailJS account + 4 templates (exact variable names to be finalized during
  implementation to match the booking object's fields).
- Netlify: standard static build (`bun run build` output). Firebase config
  values are not secret (client-side by design) and can live directly in code
  or Netlify env vars — cosmetic choice either way.
- Admin account(s) created once via the Firebase console, not through app UI.
