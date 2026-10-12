# Full Platform Builder Handoff

Updated: 2026-10-12. Branch: `feature/full-platform-completion`.

The approved implementation is integrated locally. This is an implementation
handoff, not a deployment or release verdict. Local lint, TypeScript, production
build, and Supabase schema lint pass; lint reports three warnings. SECURITY
Rounds 1 and 2 covered the identity surfaces, with the Round 1 rate-limit finding
fixed. The full read-only REVIEWER pass approved the local implementation. A
synthetic local signup/account API check passed, and Feed, Nearby, Post, Messages,
and Profile render without back arrows. Broad lifecycle/provider acceptance
remains pending. At handoff, no staging, commits, pushes, hosted schema changes,
or provider calls had been made. The user later explicitly authorized the
feature-branch commit and push; hosted schema changes and provider calls remain
outside that authorization.

## Saved implementation and ownership

| Lane | Saved work | Owner |
| --- | --- | --- |
| Shared foundations | Authenticated API client, private account types, page shell, footer, session-aware navigation, account-change state clearing and common styles | Coordinating Builder |
| Account | Private onboarding/details, portrait, export, preferences, transactional account updates, freeze/resume and reviewed deletion request | Coordinating Builder |
| Administration | AAL2-protected Operations, Finance and Trust & Safety aggregates; support queue with audited content access and responses | Coordinating Builder |
| Communications | Private inbox, preference-aware ride notices, generic email queues with leased claims, bounded retries, renewal reminders and daily maintenance | Coordinating Builder and Rides |
| Billing | Hosted methods, configured subscription products, portal, Driver payout onboarding, accepted-ride payments and provider-event reconciliation | Billing worker, integrated by Builder |
| Rides | Protected Feed/Post/messages, atomic offers and Rider acceptance, immutable accepted terms, start/completion/cancellation, private histories and reviews | Rides worker |
| Settings | Profile, account/security/payment links, notifications, reviews, support, privacy/export, guidance and data-usage screens | Settings worker |
| Location | Authenticated opt-in coarse discovery, expiry/stop, account and Driver gates, legacy access restrictions and optional disclosed Mapbox area map | Saved Location work and Settings worker |
| Records | Phase/decision updates, Privacy/Terms drafts and project-local Universal Navigation skill | Coordinating Builder |

All three worker sessions were available after the interruption and reported
their assigned implementation complete. Their saved changes were preserved.
Shared schema, account lifecycle, delivery, analytics and documentation stayed
with the coordinating Builder; workers did not mutate live services or Git.

## Integration boundaries

- Account PATCH uses one database transaction for settings, audit and notification
  enqueue. Support creation/review also uses transactional functions. Account-state
  changes stop discovery and Driver mode together with their audit records.
- Freeze/resume finalization holds the billing user lock. A provider failure never
  reports collection paused. A failed resume finalization attempts to restore an
  indefinite pause and returns a safe failure. Freeze save failure explicitly
  reports that collection was paused but account state was not saved.
- Deletion is a support-review request. It blocks new activity, cannot be reversed
  by ordinary resume, does not erase records, and does not automatically cancel a
  subscription. Retention/legal-hold review and billing cancellation are separate.
- Frozen accounts retain private history and safe cancellation/completion of an
  existing ride. A payment reservation blocks cancellation pending support-led
  resolution; refunds are not fabricated or performed by a client redirect.
- Active, complete accounts are required for new ride activity and location.
  Driver activity additionally requires verified identity and approved, unexpired
  registration/insurance. Account role and eligibility are server-controlled.
- General Stripe-hosted identity verification is available to Riders and Drivers;
  Riders must verify before posting or accepting rides. Driver License verification
  is separate and must confirm a current license before Driver activity. Optional
  U.S. ID-number verification belongs only to U.S. Driver Eligibility, is entered
  directly with Stripe, and is never collected in Account details or stored by Seatbelt.
- Legal names remain private; discoverable profile names become initials. New
  profile inserts preserve the legal name privately before masking the public
  field. Ordinary users cannot directly change account role/discovery fields or
  write trips/messages through browser table grants.
- Owner records stay private under RLS and protected APIs. Administrator access
  requires the existing founding-admin authority and AAL2. Analytics aggregate
  data; support content access is audited. Anonymous reviews omit reviewer IDs.
- Emails contain only a generic account-update notice. They never copy document
  contents, rejection reasons, expiration dates, messages or support requests.
  Delivery claims recover stale work, allow at most five attempts, and admit ten
  messages per source per invocation. Missing credentials leave delivery unavailable.

## Local migration sequence

Before deployment, reconcile the target's migration history using metadata only.
Do not replay a migration already applied to that target. Historical Phase 3
records describe earlier work; they do not authorize new live database operations.

1. `20260923031527_phase3_retention_notifications.sql`
2. `20260923033952_phase3_backfill_reviewed_document_retention.sql`
3. `20261010034001_full_platform_accounts_notifications.sql`
4. `20261010034047_protected_location_presence.sql`
5. `20261010034050_full_platform_billing.sql`
6. `20261010034100_ride_agreements_history_reviews.sql`
7. `20261012204705_account_private_gender_and_identity_purposes.sql`
8. `20261012221500_atomic_driver_eligibility_review.sql`

The account migration depends on the existing profiles, identity, eligibility,
admin authority and Phase 3 notification schema. Location depends on account
helpers; Billing precedes the Ride migration's payment-reservation integration.
The final migration makes each Driver Eligibility decision and its audit record
one service-only database transaction; “Request update” remains pending and
retains its reason for the Driver to address.
Validate the complete sequence on an isolated database during the authorized
combined pass. Profile-name backfill and narrowed profile/trip/message grants
require coordinated application deployment, a backup and a verified restore plan.

Local-only database result (2026-10-12): Docker Desktop is running and the
identity clarification migration was applied transactionally to the existing
`seatbelt-local` stack. Its local migration history contains a bootstrap and
auth-repair version whose source files are absent from this checkout; earlier
project migrations consequently still appear pending in CLI history even though
the bootstrap schema contains their tables. Do not replay or reset this stack.
The new identity migration is recorded locally, RLS and grants were checked by
metadata, and `supabase db lint --local --schema public --fail-on error` passed.
The full historical migration chain remains unverified on a clean database:
the first saved migration, `20260918211925_session_modes_and_account_roles.sql`,
expects `public.profiles`, but this checkout has no earlier migration that
creates the legacy profile table. A fresh temporary stack stopped at that first
migration; it was isolated and did not affect `seatbelt-local` or hosted
Supabase. Recover the authoritative pre-existing schema/migration history before
claiming clean-chain validation or preparing deployment migrations.

## Activation and coverage still outstanding

- Stripe: configure matching test/live keys, trusted `BILLING_APP_URL`, Identity
  and Billing webhook secrets/delivery, actual tier prices and Connect readiness.
  The portal must enable payment-method updates and disable subscription updates.
  Verify timed-to-indefinite pause handling, webhook ordering, pause compensation,
  cancellation and payout/payment acceptance against the real provider. Bank
  methods require explicit provider enablement; configuration flags are not proof
  of readiness. Keep secrets server-only.
- Resend and Auth: verify sender domain and transactional credentials. Configure
  Supabase secure password change and its Auth SMTP separately. Verify current
  password/recent-authentication/code flows using the deployed Auth configuration.
- Location: configure a restricted public Mapbox token. Map presentation is
  optional and explicitly discloses the coarse area center and network address
  sent to Mapbox; Driver positions are not sent to that provider. No route or
  distance provider is fabricated; histories display recorded distance only.
- Scheduling: one protected Production cron runs daily. Verify Fluid Compute and
  the route's 300-second allowance. Reactivation admits at most twenty candidates
  and stops starting work after sixty seconds; backlog/outages can delay return.
  Cleanup processes up to 1,000 due drafts and 1,000 reviewed rows in a bounded
  180-second budget and reports remaining backlog as a failed run. Monitor queue
  health and throughput for the intended 72-hour draft window. Preview deployments
  do not provide cron acceptance.
- Analytics: account events and recorded ledgers expose their coverage. Gross
  ride payments are not platform revenue. Platform/subscription revenue,
  operating costs, automated incident coverage and external fraud monitoring
  remain unavailable until reliable sources are instrumented.
- Provider/legal prerequisites: camera integrations, background checks,
  passkeys/SMS, marketing distribution, international settlement and identity
  document-expiration coverage remain unavailable/setup states. Staff/analyst
  delegation requires its own authorization phase. Attorney/privacy review must
  settle jurisdictional obligations, retention/legal holds and public disclosures.
- Dependencies: the earlier package-lock-only install reported thirteen audit
  findings (one moderate, twelve high). Compatibility and vulnerability review
  remain pending; no automatic audit fix or forced upgrade was run.
- Recovery: `.git/codex-recovery/20261009-full-platform/` and confidential ignored
  working documents remain preserved. No secure archival destination was chosen;
  confidential documents were not deleted and restore readiness is unverified.

## Local Verification and Remaining Acceptance

Completed local checks: `npm run lint` (zero errors, three warnings), `tsc --noEmit`,
`npm run build`, local Supabase schema lint, and migration metadata verification.
With synthetic local auth, `/api/account` returned 200 with expected account
sections; the unauthenticated request returned 401. The five main tabs returned
HTTP 200 with no back-arrow element. SECURITY Round 1 found one MINOR
session-creation rate-limit issue; the atomic per-user/purpose limiter and Stripe
idempotency key were added, and targeted SECURITY Round 2 found no remaining issue.

Still required before broader acceptance: runtime owner/anonymous/AAL1/AAL2
authorization and lifecycle checks; incomplete/returning onboarding,
role selection, expired eligibility, freeze/deletion activity gates, concurrent
offers/acceptance/payment reservations, provider failure/retry/webhook ordering,
support concurrency/audits and queue recovery; navigation/session clearing,
forms, keyboard access and responsive layouts across both modes. Browser preview
acceptance and complete migration-chain validation on a clean isolated database
remain pending. The 72-hour cleanup window depends on verified production volume
and monitoring for the 1,000-row daily cap. Provider and legal activation
requirements remain listed above.

BUDDY remains conditional on a later user request. The user has authorized
staging, commits, and a push to `fork/feature/full-platform-completion` for this
reviewed work. Deployment still needs separate authorization. Seatbelt must
never be pushed to main under this build handoff.

Exact changed ranges and formatting scan results are recorded in
[Full Platform Line Reference](FULL-PLATFORM-LINE-REFERENCE.md). That report uses
HEAD because a clean resume baseline was unavailable; it includes saved and
pre-existing work rather than claiming every difference was authored this turn.
