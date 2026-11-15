# Seatbelt Project Checklist

Last reviewed: 2026-11-14. This is a living record of the project, including work before the phase system. Update entries as evidence and decisions change. Source records: [phase plan](docs/PHASE-PLAN.md), [decisions](docs/DECISIONS-AND-FOLLOW-UP.md), [full-platform handoff](docs/FULL-PLATFORM-HANDOFF.md), and [refund-credit policy](docs/REFUND-CREDIT-POLICY.md).

**Status key:** Completed = the specific described work or historical check was completed; Incomplete = started, implemented without full acceptance, blocked, or awaiting review; Not started = planned work with no recorded implementation. A completed implementation item does not imply the feature is deployed, provider-ready, legally approved, or fully tested. Older check results are historical and may need rerunning after changes.

## Before the phase system

### Foundation, public pages, and accounts

- [x] **Completed —** Establish the Next.js application, landing page, About page, sign-in/sign-up, session persistence, and password-reset entry point. The history includes follow-up corrections to homepage and sign-in redirects.
- [x] **Completed —** Add initial profile editing, driver vehicle information, user branding, and required signup name.
- [x] **Completed —** Draft Terms and Privacy Policy pages, add signup agreement and a legal footer, and record initial legal/privacy decisions.
- [x] **Completed —** Add reusable field help, input controls, and client-side validation for the recorded login, password-reset, and messaging surfaces.
- [ ] **Incomplete —** Verify signup email confirmation and Auth SMTP behavior; finalize the business address and provider disclosures; obtain counsel review of Terms, Privacy, identity, camera/audio, retention, and dispute provisions.
- [ ] **Incomplete —** Apply required-field error summaries and field-specific feedback consistently across applicable forms; review database/Auth enforcement of custom password rules.
- [ ] **Not started —** Define and implement maintained disposable-email detection if still required; establish approved passkey and SMS MFA configurations separately.

### Rides, messaging, location, and payments

- [x] **Completed —** Add the initial Feed, ride posting, edit/delete controls, Rider requests, Driver offers, scheduling, price increments, and posting validation.
- [x] **Completed —** Add direct-message inbox and conversations, sender identification, and message-routing corrections.
- [x] **Completed —** Add initial Nearby/location, payment integration and modal, and role-aware signup/session navigation; later phases replace or harden portions of these flows.
- [x] **Completed —** Record the updated agreement model: Rider price window is an estimate; the Driver may offer within platform limits; Rider acceptance confirms the ride. Preserve completed-agreement terms against unilateral edits.
- [x] **Completed —** Record the privacy decision to replace public recurring-commute discovery with private Ride History while preserving the legacy table until dependencies are reviewed.
- [ ] **Incomplete —** Verify full Rider/Driver flows, messaging, negotiation, payment, location privacy, and accepted-ride lifecycle against current code and deployed configuration.
- [ ] **Not started —** Define and implement international currency conversion, rounding, settlement, and country-specific display beyond the initial domestic scope.

### Identity and Driver prerequisites

- [x] **Completed —** Add tracked session-mode migrations, Stripe identity flow, private eligibility-document onboarding, Driver-mode eligibility gates, and upload-cleanup safeguards.
- [x] **Completed —** Record private legal-name/address/date-of-birth requirements, optional phone, API-backed vehicle make/model/year, and the separation of identity verification from Driver License and vehicle eligibility.
- [ ] **Incomplete —** Verify identity-provider availability, legal basis, document options, expired-license renewal, Driver gating, and real provider results before activation. Keep raw identity documents and SSNs out of ordinary Account/Profile flows.
- [ ] **Not started —** Activate approved camera integrations, background checks, DMV/driving-record verification, and other external eligibility providers; each needs its own provider, configuration, privacy, and legal prerequisites.

## Phase 1 — Administrator security baseline

- [x] **Completed —** Establish server-controlled authority for the approved founding administrators and require verified sign-in plus AAL2 for administrator routes.
- [x] **Completed —** Implement primary and backup TOTP enrollment, protected review-audit foundation, and administrator security boundaries. The phase plan records administrator acceptance as verified.
- [ ] **Incomplete —** Review the interrupted BUDDY finding that the backup authenticator has no visible session-verification selection; reproduce and resolve any confirmed recovery gap before relying on it.
- [ ] **Not started —** Implement staff/analyst delegation, passkeys, or SMS MFA; these remain separate deferred authorization and provider decisions.

## Phase 2 — Private Driver Eligibility review

- [x] **Completed —** Implement AAL2-protected administrator review, private short-lived document previews, review actions/reasons, audit records, and safe Driver-facing status guidance.
- [x] **Completed —** Add service-only atomic eligibility decision/audit handling and stale Stripe session recovery in the local full-platform work.
- [ ] **Incomplete —** Complete manual AAL2 administrator and Driver acceptance tests, including approval, rejection, update requests, document replacement, expiry, and permission boundaries.
- [ ] **Incomplete —** Investigate BUDDY/SECURITY source findings that a review may not be bound to the viewed document version and concurrent document updates may overwrite another update. Runtime race behavior was not proven; independent verification and remediation review remain needed.
- [ ] **Incomplete —** Verify the reported eligibility date-only edit and Rider-mode-switch behavior. No correction has been recorded.

## Phase 3 — Retention and generic notifications

- [x] **Completed —** Add draft-upload cleanup, reviewed-document retention deadlines/backfill, legal-hold support, generic notification queueing, bounded retries, and the protected delivery/maintenance routes.
- [x] **Completed —** The phase plan records earlier Phase 3 migration/RLS metadata checks and linked security advisors. This historical record does not authorize another live migration.
- [ ] **Incomplete —** Configure and verify the Resend sender domain and credentials, Auth SMTP/secure-password settings, generic message content, retry/recovery, and end-to-end delivery.
- [ ] **Incomplete —** Verify daily cron runtime, backlog monitoring, 1,000-row processing limits, and the intended 72-hour draft window under realistic volume and outages.
- [ ] **Incomplete —** Obtain legal/privacy decisions for document retention, legal holds, sender/processor disclosures, and release.

## Phase 4 / 4A — Administrator analytics and support

- [x] **Completed —** Implement local AAL2-protected Operations, Finance, and Trust & Safety aggregates; date filters; account/lifecycle events; and audited support review.
- [ ] **Incomplete —** Test AAL1/AAL2 and unauthorized access, support review/audits, date filters, responsive layouts, aggregate accuracy, and instrumentation start/coverage.
- [ ] **Incomplete —** Validate provider-confirmed gross ride volume, refund, and spending coverage; do not describe gross payments as platform revenue.
- [ ] **Not started —** Instrument reliable platform/subscription revenue, operating costs, automated incident coverage, external fraud monitoring, and separate staff/analyst permissions.

## Phase 5A — Navigation, Profile, and Settings

- [x] **Completed —** Implement the shared app shell/footer, Settings gear, child Settings pages, main-tab back-arrow exceptions, and the project-local Universal Navigation skill.
- [x] **Completed —** Implement private account details, portrait controls, presence, security/password UI, notifications preferences, privacy/export, support, guidance, and account freeze/deletion requests locally.
- [x] **Completed —** Implement the personal-information grid, hidden empty optional fields, optional gender, U.S. phone formatting, and collapsed address editor in the local UI.
- [ ] **Incomplete —** Finish authenticated signup/returning-user, session selection, account save/reload, address, freeze/resume/deletion, profile image, session clearing, and responsive/keyboard acceptance tests.
- [ ] **Incomplete —** Reproduce and review BUDDY source findings concerning unsaved Account edits appearing in the grid, hidden address edits being omitted on save, a hidden post-save continuation, and the Profile settings icon. These were not fully reproduced after the local database stopped responding.
- [ ] **Incomplete —** Review public and account accessibility findings: labels, keyboard navigation/focus, mobile helper overflow, informational-page back/navigation, and contrast. Preserve the requested main-tab navigation behavior.

## Phase 5B — Rides, history, and reviews

- [x] **Completed —** Implement protected ride posts/offers, Rider acceptance, locked accepted terms, conversations, start/completion/cancellation, and payment-reservation boundaries locally.
- [x] **Completed —** Implement private Ride/Travel History, filters, recent-ten view, reviews, and recorded-distance display; no route or distance provider is fabricated.
- [ ] **Incomplete —** Test both user roles and all ride states, concurrent offers/acceptance/reservations, cancellations, messages, pagination, review permissions, and provider-failure/retry paths.
- [ ] **Incomplete —** Verify BUDDY's source finding that Travel History uses an unfiltered ride endpoint and the Reviews screen lacks an inbound navigation link; correct only through an approved follow-up.

## Phase 5C — Billing, communications, and refunds

- [x] **Completed —** Implement local accepted-ride payment creation/reservation, provider-event reconciliation, hosted payment-method/portal routes, Driver payout onboarding, subscriptions, private inbox, and preference-aware generic notifications.
- [ ] **Incomplete —** Configure and test Stripe test/live keys, billing URL, webhook secrets and ordering, products/prices, portal restrictions, Connect, payments, payouts, bank-method enablement, pause/resume compensation, and provider failure handling.
- [x] **Completed —** Record the approved managed-credit policy and proposed request statuses in [the refund-credit policy](docs/REFUND-CREDIT-POLICY.md). The policy is committed locally; implementation remains pending.
- [ ] **Not started —** Implement the managed credit ledger, balance/redemption, one-credit-per-ride atomic/idempotent issuance, linked audit trail, rider-visible resolution statuses, and cumulative-activity review controls. The amount/window for a cumulative limit has not been approved.
- [ ] **Not started —** Activate refund-agent automation. A future separately approved agent may issue only a verified full eligible account credit up to $20 per ride; credits above $20 and all original-payment refunds require human review. Until activation, compensation requests require human review.
- [ ] **Incomplete —** Define eligible amounts, reviewer authority, credit funding/use/expiry, provider refund and chargeback reconciliation, and audit retention; obtain attorney/payment review before activation.

## Phase 5D — Location, identity, and integrations

- [x] **Completed —** Implement authenticated opt-in, coarse Driver discovery, stop/expiry flows, account/eligibility gates, and restricted legacy location access locally.
- [x] **Completed —** Implement local renewal guidance, expiry notices, and separate general identity, Driver License, and optional U.S. Driver ID-number verification paths.
- [ ] **Incomplete —** Test sharing permission/denial, stale location, expiration, stop, cross-account privacy, Driver eligibility, Mapbox configuration/disclosure, and provider-unavailable states.
- [ ] **Incomplete —** Verify the reported missing/expired Driver License renewal path and the vehicle-expiry-day mismatch between ride and discovery gates; SECURITY identified source-level concerns, not proven exploits.
- [ ] **Not started —** Activate cameras, background checks, passkeys/SMS, marketing distribution, and international settlement; do not present setup states as functioning integrations.

## Phase 6 — Combined verification, review, and release handoff

- [x] **Completed —** Historical local lint (zero errors, three warnings), TypeScript, production build, Supabase schema lint, focused synthetic account API checks, and main-tab HTTP/back-arrow smoke checks passed in the prior implementation pass.
- [x] **Completed —** Prior identity SECURITY rounds addressed the session-creation rate-limit finding; the earlier implementation and changed-line report received a read-only Reviewer approval. That approval predates the later interrupted BUDDY findings and refund-credit policy.
- [x] **Completed —** Started the requested conditional BUDDY audit, mapped 38 page routes and 37 API route files, and performed public/signed-out and anonymous API checks. This is partial coverage, not a completed audit.
- [ ] **Incomplete —** Resume BUDDY and consolidate every reachable control's result; complete local synthetic Rider/Driver and authorized deployed administrator/AAL2 testing, including responsive, keyboard, error, and recovery states. Do not test destructive operations against real users or production data.
- [ ] **Incomplete —** Investigate runtime observations from the interrupted audit: live Terms/Privacy and many newer routes returned 404; the feature preview required Vercel authentication; the local identity page raised an empty-Stripe-key error. Verify the current deployments and configuration before concluding these still occur.
- [ ] **Incomplete —** Restore/check the isolated local Supabase service after its Auth and REST health requests timed out during synthetic signup; preserve the existing local stack and do not reset or replay it blindly.
- [ ] **Incomplete —** Recover the authoritative legacy `public.profiles` baseline and migration history, then validate the complete migration chain on a clean isolated database. The prior Supabase Preview check failed at the missing baseline.
- [ ] **Incomplete —** Complete owner/anonymous/AAL1/AAL2 authorization, RLS, lifecycle, concurrency, privacy, provider, upload, responsive, accessibility, and recovery checks; re-run SECURITY/REVIEWER as required after approved fixes.
- [ ] **Incomplete —** Inspect and resolve the previously reported dependency audit findings with compatibility review; do not run automatic or forced upgrades without inspection.
- [ ] **Incomplete —** Choose an approved secure archive for confidential working documents and verify backup integrity and isolated restore readiness before authorized deletion or deployment. Preserve `.git/codex-recovery/20261009-full-platform/`.
- [ ] **Incomplete —** Complete legal/privacy review, provider activation, deployment planning, and final acceptance before declaring the project complete or publicly releasing the full-platform work.

## Branch consolidation and next Git steps

- [x] **Completed —** Fetched and compared fork/origin branch tips. At the last check, all local branch histories were ancestors of `feature/full-platform-completion`; no two-sided divergence was found.
- [ ] **Incomplete —** Review the local-only `7a5e9cd` handoff and subsequent refund-policy and checklist commits before synchronization. Local commits put the branch ahead of the fork, not by themselves create two-sided divergence.
- [ ] **Incomplete —** Review the existing draft PR targeting `main` against the newer integration workflow; do not merge or change its target without the appropriate authorization and current branch checks.
- [ ] **Not started —** After these issues are resolved and the required approval is in place, create `developer` from a verified `main` baseline and use it for the approved consolidation path. Do not push Seatbelt to `main`.
- [ ] **Not started —** Consider fast-forwarding or removing older feature branches only after their work is integrated, ancestry and recovery are verified, and any required cleanup approval is given.
- [ ] **Incomplete —** Before any future commit/push, update this checklist from current evidence, resolve the solo handoff-instruction conflict, review exact outgoing files and histories, and use the required final metadata-only review-summary commit.

## Maintenance rule

- Update this file whenever a recorded item changes. Record evidence or links for completion, keep blocked and deferred work visible, and add newly approved work under the relevant phase without marking it complete before acceptance. Preserve historical results as dated evidence rather than assuming they still pass.
