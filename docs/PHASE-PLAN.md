# Admin Security and Driver Eligibility Phases

## Phase 1 — Admin Security Baseline and Authority

Status: Complete — administrator acceptance verified

Checklist:

Complete: Establish server-controlled administrator authority for the two approved founding administrators.
Complete: Require a verified authenticated session and AAL2 multi-factor authentication for future administrator-only routes.
Complete: Provide administrator enrollment for a primary and backup TOTP authenticator.
Complete: Record the approved MFA, passkey, SMS, email-code, and privacy boundaries without enabling staff review yet.
Complete: Keep the existing driver eligibility gate unchanged.

## Phase 2 — Private Driver-Eligibility Review Portal

Status: In Progress — implementation complete; manual acceptance pending

Checklist:

Complete: Add administrator-only review actions and an append-only review audit trail for private driver documents.
Complete: Show drivers safe, signed-in status and reason messages without placing document details in email.
Complete: Require the Phase 1 administrator authority and AAL2 protection for every review action.
Complete: Provide private document previews through 10-minute signed URLs.
In-Progress: Perform manual AAL2 administrator review and driver-facing acceptance checks.

## Phase 3 — Retention and Generic Notifications

Status: In Progress — provider integration and acceptance testing pending

Checklist:

Complete: Add configurable post-review document deletion deadlines, a legal-hold override, and a 30-day backfill for legacy reviewed documents.
Complete: Keep incomplete upload drafts within the existing 72-hour deletion window.
Complete: Queue generic review notifications that omit document type, reason, expiry, attachments, and privileged links.
Complete: Add a server-only Resend delivery route with bounded retries that cannot block a review decision.
In-Progress: Add Resend credentials and verified sender domain to local and Vercel environments, then perform end-to-end delivery tests.
Complete: Apply the Phase 3 migration, verify its retention columns and notification table RLS, and run linked Supabase security advisors.
Planned: Obtain attorney/privacy review of the final document-retention period and provider disclosure before public release.


## Phase 4 — Administrator Analytics

Status: In Progress — local implementation integrated; acceptance and data coverage pending

Checklist:

Implemented locally (unverified): Separate Operations, Finance, and Trust & Safety views with AAL2-protected aggregate APIs and date filters.
Implemented locally (unverified): Account activity, lifecycle, private support and provider-confirmed ledger sources with coverage explanations. Uninstrumented platform revenue and external monitoring remain unavailable.
Deferred: Role-specific analyst and staff access requires its own approved authorization phase.

## Full Product Build — Approved 2026-10-09

The user approved the remaining decision-log scope as one implementation effort,
with the full test pass after implementation. Existing Phase 1–3 records remain
historical evidence; no new work is considered tested until that final pass.
Branch: `feature/full-platform-completion`. The original build approval did not
include commits or pushes; the user later explicitly authorized a reviewed
feature-branch commit and push. Missing providers receive usable integration boundaries and honest
unavailable states; provider setup and attorney review remain release prerequisites.

### Phase 4A — Data and administrator dashboards

Implemented locally (unverified): Private account preferences, transactional lifecycle events, notifications, support requests, and aggregate reporting sources.
Implemented locally (unverified): AAL2-protected Operations, Finance, and Trust & Safety dashboards with date filters and data-coverage explanations; protected, audited support review.
Implemented locally (unverified): Provider-confirmed gross ride volume, refunds and account spending by currency. Platform/subscription revenue and operating-cost instrumentation remain unavailable; no revenue is inferred from posts or client payment confirmation.
Implemented boundary (unverified): Founding-admin authority is preserved; staff/analyst delegation and external fraud providers remain deferred.

### Phase 5A — Shared navigation and account settings

Implemented locally (unverified): Child Settings pages for Account, Identification, Privacy & Security, Payment, Subscription, Notifications, Ride History, Travel History, and Guidance.
Implemented locally (unverified): Shared page shell/footer, accessible controls, back navigation and bottom-navigation exceptions; project-local Universal Navigation skill.
Implemented locally (unverified): Private PII editing/onboarding, owner portrait, role/presence display, signed-in password change, private reviews, account freeze/deletion requests, and sign-out in the requested locations. Secure-password Auth configuration remains an activation prerequisite.
Implemented locally (unverified): FAQs, DOs/DON'Ts, General Information, Data Usage, support/dispute/appeal entry points, and processor/configuration documentation.

### Phase 5B — Ride agreement, history, and review lifecycle

Implemented locally (unverified): Atomic Driver offers/Rider acceptance, accepted-post locking, and explicit start/completion/cancellation. Payment reservations require support-led cancellation/refund resolution.
Implemented locally (unverified): Private active/completed ride records, date filters, recent-ten view, role tabs and stored distance when present. No route/distance provider is fabricated; the legacy commute table is preserved.
Implemented locally (unverified): Optional completed-ride reviews visible only to the reviewed account, with anonymous reviewer identifiers withheld.
Implemented locally (unverified): Required-form summaries, field highlights, clearing of corrected errors, scheduled/Present departure and final $1.00–$999.00 offer limits.

### Phase 5C — Billing and communications

Implemented locally (unverified): Authenticated payment creation using accepted agreement amounts, immutable reservation locks, provider-event reconciliation and webhook-confirmed success.
Implemented locally (unverified): Hosted payment-method management, Driver payout onboarding, subscription checkout/portal/status and provider-confirmed pause/resume. Account lifecycle finalization holds the billing lock; failed resume finalization attempts to restore the collection pause.
Implemented locally (unverified): Role-aware notification preferences, private inbox, generic transactional delivery with leased claims and five-attempt retry bounds, renewal reminders and daily account reactivation.
Implemented boundary (unverified): Explicit test/live states, server-only secrets, actual configured products and safe portal validation. Delivery, paid subscriptions, payouts and bank methods remain subject to real provider setup.

### Phase 5D — Location, eligibility, and remaining integrations

Implemented locally (unverified): Active/complete account and Driver eligibility gates, opt-in coarse discovery, stop/expiry flows, protected legacy location access and optional disclosed Mapbox area presentation.
Implemented locally (unverified): Persistent registration/insurance expiration notices, official jurisdiction-neutral renewal guidance and expired-document restrictions.
Implemented locally (unverified): Stripe-hosted identity capture with safe errors and minimal status data; unavailable identity-document expiration remains unknown.
Implemented boundary (unverified): Cameras, background checks, passkeys/SMS and international settlement show unavailable/setup states. Activation still requires their actual providers, configuration and approved legal requirements.

### Parallel implementation boundaries

After the shared `apiRequest`, `AccountPage`, and account type contracts exist,
Settings/Profile UI, Ride lifecycle, Billing, and Location lanes may be implemented
independently in disjoint files. Billing consumes the fixed Ride record contract;
integration waits for that contract. Shared schema, account APIs, notification
delivery, analytics, common CSS/navigation, and documentation remain owned by the
coordinating Builder. No worker stages, commits, pushes, or mutates the live database.

### Phase 6 — Combined verification and release handoff

Status: In Progress — implementation integrated; local checks pass; Reviewer approved; broader runtime and provider acceptance pending.

Complete: Run lint, TypeScript, production build, and local Supabase schema lint.
Complete: Run the required two SECURITY rounds for the identity verification surfaces and fix the Round 1 session-creation rate-limit finding.
Complete: Complete the required read-only REVIEWER line scan, resolve in-scope findings, and produce an exact changed-line report.
Complete: Run lint, TypeScript, production build, local schema lint, synthetic local account API checks, and main-tab back-arrow checks.
Planned: Run broader runtime lifecycle/authorization and responsive user-role checks. Clean migration-chain validation is blocked until the legacy `public.profiles` baseline expected by the first saved migration is recovered; the temporary clean stack stopped before applying that migration.
Planned: Present the local preview and record provider/legal prerequisites. BUDDY remains conditional on a later explicit request; commit/push requires separate approval.

## Phase Commit Rule

No phase or sub-phase is committed until its planned steps and acceptance criteria are complete, reviewed, and explicitly approved. A Phase Commit supplements the repository commit convention with the required `Phase` section; it does not replace the required `What changed`, `Why`, `Collaboration`, `Boundaries`, and `Validation` sections.
