# Seatbelt Decisions and Follow-Up

## Security and Phased Delivery

Status: Approved / Implemented

- Phase tracking: `docs/PHASE-PLAN.md` is the committed source for Phase 1–4 implementation scope. No phase or sub-phase is committed until its planned work is complete, reviewed, and explicitly approved.
- Administrator authority: Administrator status is controlled only by the protected `admin_roles` database table. It is not stored in user-editable profile or user-metadata fields. The initial table contains the two approved founding administrators.
- Administrator MFA: Administrator-only operations must use a verified Supabase session and AAL2 multi-factor authentication. Phase 1 provides a required primary and backup TOTP authenticator-app enrollment path; each administrator should store the backup in a separate app or device where reasonably possible.
- Passkeys and SMS: Passkeys remain optional and deferred until a stable production WebAuthn relying-party configuration is approved. SMS MFA remains deferred until an SMS provider, cost limits, and abuse controls are approved. Email codes are not accepted as an AAL2 replacement.
- Private eligibility documents: The Phase 1 review-audit table is protected foundation only. No staff or administrator document-review workflow is enabled until Phase 2. Future review routes must require administrator authority and AAL2.
- Retention and notifications: The existing upload-draft deletion window remains in effect. Rejected-document retention, generic notifications, provider setup, and legal-hold handling remain Phase 3 work; no notification provider is selected in Phase 1.
- Attorney/privacy review: Before public release, counsel must review administrator access, MFA recovery, driver-document review, document retention/deletion, secure communications, and New York-specific eligibility rules.


## Recorded Conditions

- Operating name: Seatbelt by Kinoshi
- Website: https://useseatbelt.com
- Business address: To be added later
- Legal/privacy email: support@useseatbelt.com
- Agreements effective: Upon sign-up and acceptance
- Governing law: New York State; venue in New York City
- Retention: Purpose-based, generally with one additional year where justified
- Camera rules: Seatbelt-owned cameras operate whenever the vehicle is on or in Drive; personal vehicles record during passenger rides
- Audio: Driver discretion for personal cameras; always active for Seatbelt-owned cameras
- GPS: Live access for participating Rider and Driver; historical access restricted to authorized Seatbelt personnel
- Legal disclosures: Only when required by law or valid legal process
- Third parties: Stripe and external background-check providers; additional providers to be identified
- Attorney/privacy review: Required before publication

## Follow-Up

- Create third-party provider framework
- Add final company address
- Confirm camera/audio retention periods
- Identify hosting, authentication, maps, analytics, communications, and camera-storage providers
- Draft Terms of Service
- Draft Privacy Policy
- Add sign-up agreement checkbox

## Attorney Review Note — Authenticated Cameras

- Drivers may use side-cameras or other non-authenticated cameras only as supplemental devices.
- Supplemental cameras may not replace, disable, obscure, bypass, or substitute for the authenticated Seatbelt-connected camera.
- The authenticated camera is the required primary camera for applicable rides.
- Review whether suspension, termination, or other remedies for bypassing the authenticated camera comply with applicable law.
- Review disclosure, consent, audio-recording, privacy, retention, and evidence-use requirements.

## Approved Conditions 16–27

- Emergency response: Users contact local emergency services first; Seatbelt may suspend accounts, preserve records, contact affected users, and cooperate with lawful authorities.
- Security: Seatbelt uses reasonable administrative, technical, and organizational safeguards.
- Eligibility: Users must be 18+ and complete required identity verification.
- Verification storage: Store verification results and limited metadata; delete ID images unless retention is legally or operationally necessary.
- Appeals: Suspended or terminated users may request review through support@useseatbelt.com.
- Agreement priority: Privacy Policy controls privacy matters; Terms control other matters.
- Updates: Notices may be delivered through in-app Bell notifications, email, or opted-in text messages.
- No response to an update may result in restricted access, but is not affirmative consent where express consent is legally required.
- Payment disclosure: Price, fees, payment method, renewals, cancellation, refund rules, and receipts must be disclosed.
- Stripe: Seatbelt remains the primary contact for platform payment issues.
- Refund appeals: Users may provide additional records, including timestamps, GPS, messages, receipts, and supplemental camera footage.
- Refund decisions: Seatbelt provides the decision, general reason, and available appeal option.
- Attorney review: Terms, Privacy Policy, camera/audio rules, retention, identity verification, and third-party processing require legal/privacy review before publication.

## Stripe Configuration — Pending

- Do not generate or substitute a new Stripe key for the existing deployment.
- Obtain the correct Stripe test/production configuration from the original creator.
- A new key would connect the app to a different Stripe account.
- The original creator may provide the test key for local development or enter production secrets directly into Vercel.
- Never commit or share Stripe secret keys.

# FAQs

- Future FAQ-only guest access may be added; no guest accounts for authenticated features.


## Identity, Driver, and Vehicle Input Requirements

- Car Make, Car Model, and Year must use API-backed dropdowns instead of free-text fields.
- Research NHTSA vPIC and other vehicle-data APIs.
- Riders and Drivers must provide verified personal information.
NHTSA vPIC API
https://vpic.nhtsa.dot.gov/api/
- Required: legal full name, domicile address, country, city, state/province where applicable, ZIP/postal code, date of birth, and government ID/document verification.
- Phone number is optional.
- Driver photo must be a selfie or portrait/bust image; full-body images are not allowed.
- Drivers must select Camera: Yes or No.
- A selected Seatbelt camera must register with Seatbelt and become the authenticated primary camera.
- Non-authenticated side-cameras may supplement but may not replace the authenticated camera.
- Research Stripe Identity or another identity-verification API for ID capture, document checks, liveness, face matching, and prefilled fields.
- Do not build custom AI biometric verification until privacy, security, consent, retention, and legal review are complete.

## Approved — Sign-up and Driver Profile Input Bundle

- All users: legal name (1–32 characters, up to four name parts; allowed numbers, hyphens, apostrophes, and multiple spaces; must match verified ID), address, country, city, state/province where applicable, postal code, date of birth (18+), email, and required identity verification.
- Phone is optional; use a phone-friendly keypad on mobile/tablet.
- Email: standard validation; allow personal, work, school, and business addresses; block only addresses identified by maintained disposable-email detection.
- Password: 8–32 characters; require uppercase, lowercase, number, and one allowed symbol from !.@,#$%&*_-+; no spaces or other symbols.
- Every textbox uses the Universal Help Textbox helper.
- ID verification: government photo ID; store result and limited metadata; delete ID images after verification unless legally or operationally necessary. Provider and biometric/liveness review remain follow-up items.
- Drivers: vehicle make/model/year are required API-backed dropdowns; required selfie or portrait/bust photo; required camera Yes/No; Seatbelt-authenticated camera is primary and supplemental cameras cannot replace it.

## Multi-Currency — Follow-Up

- Initial launch is primarily domestic.
- Add multi-currency support for prices based on the user’s country.
- Define currency conversion, rounding, settlement, and displayed currency behavior before enabling international transactions.

## Post Trips — Price Range Clarification

- Rider sets a minimum and maximum price, from $1.00 to $999.99, inclusive.
- Both endpoints display exactly two decimal places and use the applicable country currency.
- Minimum must not exceed maximum.
- Drivers may respond with an amount within the Rider's range.
- Rider reviews Driver responses and chooses; the Platform does not automatically award the ride to the lowest response.
- A future Drivers' DOs and DON'Ts document should explain how considering the full range may create more opportunities.

## Critical — Supabase Price Schema Review

- Before implementing the Rider price range, inspect the existing Supabase schema and every application/API use of the current price field. Confirm whether it is stored as text, an integer, or a numeric type; do not assume.
- The current single-price design may need to change to separate minimum and maximum amounts, plus an ISO 4217 currency code.
- Prefer exact decimal storage, such as PostgreSQL `numeric(5,2)`, rather than floating point. The approved range is $1.00–$999.99; both endpoints must use two decimal places and minimum must not exceed maximum.
- Store numeric amounts without currency symbols; apply the currency symbol/formatting in the UI.
- Review and update affected Supabase tables, constraints, generated types, queries, API routes, validation, and any existing-data migration.
- Driver responses should store an exact amount and use the same currency as the Rider’s range unless a later product decision specifies otherwise.
- Do not apply a production schema migration until the current schema, existing data, and migration/backfill plan are reviewed.

## Reminder — Account Creation Confirmation Email

- During account creation, no confirmation email was sent.
- Review Supabase Auth email-confirmation settings and email delivery/SMTP configuration.
- Decide whether account creation should send a confirmation email, and test the full sign-up and confirmation flow.

## Ride Histpry - User and Driver Ride Logs and Dates

Replace Frequent Commutes: Do not expose recurring routes, days, or times as a driver-discovery/profile feature because they can reveal a user’s travel routine. Replace the feature with private Ride History visible to the account holder. Define separately any limited administrative access needed for disputes. Do not remove or alter the existing database table until its code/schema dependencies have been reviewed.

# Wager and Price Terminology and Schema Recovery

Wager field label: Display “Wager Price” in the UI while preserving the existing schema field name if it is wager.

## Completed Agreement - Renegotiation During Accepted Trip

Trip-post editing: Before a completed Driver–Rider contract agreement, a user may edit their own post using the same fields and validation as when creating it, while preserving the Rider/Driver distinctions. After the agreement is completed, changes require a new negotiation or cancellation; cancellation details will be defined in the cancellation policy.

## Ride offer and confirmation flow:

Rider provides an estimated Wager Price window of $1.00–$999.00, displayed to two decimal places. This is an estimate for the Rider, not a binding offer or limit on the Driver. A Driver may offer below or above the Rider’s estimate, subject to the platform-wide $1.00–$999.00 limits. The Rider accepts the Driver’s offer, and that acceptance confirms the ride; the Driver does not separately confirm the Rider’s acceptance. Do not prompt the Rider to enter a new price during confirmation. Review and replace the current reversed confirmation flow.

## Input Validation and Field Help

Status: Approved

- Requirement: Login/signup, password reset, and direct-message fields use the Universal Help Textbox pattern with accessible `?` controls.
- Requirement: Legal full name is required, limited to 1–32 accepted characters, and accepts letters, numbers, spaces, hyphens, and apostrophes.
- Requirement: New and reset passwords use 8–32 characters; require uppercase, lowercase, a number, and one allowed symbol from `!.@,#$%&*_-+`; spaces and other symbols are blocked.
- Requirement: Direct messages are required to send and limited to 140 characters, including emoji.
- Implementation note: Client-side validation and input blocking are implemented. Database-level enforcement for custom password rules remains deferred pending Supabase Auth design and migration review.
- Affected files: `src/components/FieldHelp.tsx`, `src/lib/inputValidation.ts`, `src/app/login/page.tsx`, `src/app/reset-password/page.tsx`, `src/app/messages/[tripId]/page.tsx`.
## Required Form Validation Feedback

Status: Approved

- Requirement: On an attempted submission or a required next-step action, forms must show an accessible error summary at the top of the current input area; do not rely only on a disabled primary action.
- Requirement: Every missing or invalid required field must receive a red visual highlight and a clear field-specific error. Correcting a field clears only that field's error and highlight.
- Requirement: A field with a specified format, range, or allowed file type must state the valid input requirement in its error. Client-side feedback must be paired with server-side validation before data is changed.
- Requirement: Where a text-entry field already has a helper icon, invalid state may emphasize that helper in red. Do not add helpers to date/time, file, checkbox, radio, select, number, or other self-explanatory native controls without a separate approved requirement.
- Implementation note: `error-message-finder` is the reusable Codex skill for this pattern. Driver Eligibility is the first implemented application of the standard; applying it to all existing forms remains future work.
## Code Health and Release Severity

Status: Follow-Up

The current lint report contains 16 errors and 7 warnings. These issues are concentrated in older application files and do not block the current Phase 1 administrator-security build.

### Imminent - Address Before Payment Deployment

- Resolved configuration note: the current local production build succeeds with the required server-only environment variables present. Continue to verify matching Stripe environment variables in Vercel before enabling payment changes.
- Do not commit, expose, or place the Stripe server key in a `NEXT_PUBLIC_` variable.

### Major - Address Before Public Feature Release

- Replace explicit `any` types in the DMs, Nearby, and Profile pages with defined data types.
- Refactor React effects in DMs and Nearby so effect dependencies and function lifecycles are stable. Current lint reports functions being referenced before declaration and missing effect dependencies; these can lead to stale data or repeated loading behavior.
- Correct the Nearby page's direct `window.location` mutation and review its GPS initialization flow before releasing the map/location feature.

### Minor - Batch During Cleanup

- Escape quotation marks and apostrophes reported in About, Landing, and Post pages.
- Remove unused variables reported in DMs, PaymentModal, Messages, Nearby, and related pages.

### Deferral Guidance

- Minor issues may be deferred without stopping the current UI work.
- Major issues should be resolved before the affected feature is publicly released.
- Stripe configuration is an immediate deployment prerequisite for payment functionality.

## Mode-Aware Feed Visibility, Settings, and Universal Navigation

Status: Approved

- Add a Driver/Rider account mode setting.
- Users may support both roles and switch their active mode from the Profile Settings gear icon.
- Rider mode displays Driver trip posts.
- Driver mode displays Rider ride requests.
- The active mode controls Feed visibility and posting behavior.
- Add a date picker and time picker to trip creation.
- Retain the ASAP option; ASAP uses the current date and time.
- Price range controls must increase in $1.00 increments.
- Keep back arrows on secondary pages; use the previous URL or a safe parent page when no prior route is available.
- Main application tabs (Feed, Nearby, Post, Messages, and Profile) have no back arrow because the shared bottom navigation moves between them.
- Keep bottom navigation visible on standard application pages.
- Hide bottom navigation inside account Settings and informational/legal pages, including Privacy Policy, Terms of Service, FAQs, DOs and DON'Ts, General Information, Data Usage, and future equivalent pages.
- Create a reusable Universal Navigation skill covering secondary-page back navigation, main-tab exceptions, persistent navigation, and mode-aware Feed visibility.
## Driver Identity and Vehicle Expiration Safeguards

Status: Approved — Deferred Until Stripe Verification and Profile Are Live

- Requirement: Keep any verified Driver License expiration in the separate Driver License verification record so Driver mode can be blocked when the license expires. Do not place ID documents, ID numbers, or SSNs in Profile Account details.
- Requirement: When an identity document is within one year of expiration, show a non-obstructing yellow notice above the Driver avatar that recommends renewal and links to the official DMV location/renewal search page; do not assume a state.
- Requirement: When one month or less remains, replace the notice with a clear, non-obstructing red warning that directs the Driver to the same official DMV search page.
- Requirement: Require Drivers to maintain applicable license, vehicle registration, and other mandatory Driver documentation and expiration dates. Determine the document set and renewal cadence by the Driver's actual jurisdiction and vehicle type; do not assume a monthly or yearly schedule.
- Requirement: Expiration notices remain visible until updated documentation is recorded and verified in the system.
- Requirement: Disable Driver-mode availability when required identity or vehicle documentation has expired, until compliant updated documentation is verified. Rider access should remain subject to the future account-policy design.
- Affected files: Future Stripe Identity integration, Driver Profile, document/vehicle schema, notification delivery, and mode-access controls.
- Attorney/privacy review: Required before implementation because this feature processes government-identity, driver's-license, vehicle-registration, suspension, and retention data.
- Open questions: Define the verification provider's document coverage, lawful retention period, jurisdiction-specific requirements, appeal process, staff clearance model, and exact DMV destination service.
## Secure Password Change

Status: Approved — Deferred Until Signed-In Password Change Is Built

- Requirement: Enable Supabase Auth Secure password change when Seatbelt adds an authenticated Account → Privacy & Security → Change Password screen.
- Implementation note: Require recent authentication before a signed-in password change. This does not alter the existing Forgot Password email-reset flow.
- Affected files: Future account-security settings UI and Supabase Auth configuration.
## Stripe Identity Verification and Data Minimization

Status: Approved / Attorney Review

- Requirement: Government-issued identity verification for Riders and Drivers must be performed through Stripe Identity, not through a Seatbelt file-upload field. Riders must verify before posting or accepting ride arrangements.
- Affected files: `src/app/verify-identity/page.tsx`, `src/app/api/identity/session/route.ts`, `src/app/api/stripe/webhook/route.ts`, `supabase/migrations/20260919074244_driver_identity_verification.sql`.
- Implementation note: Seatbelt retains only the Stripe Verification Session ID, verification status, error status, and relevant timestamps. It does not retain ID images, ID numbers, raw date of birth, or raw address data.
- Implementation note: Identity document choices may include a Driver License, government ID card, or passport where Stripe supports them. The Driver License is a separate Driver Eligibility check and must be verified, unexpired, and have a confirmed expiration date before Driver mode is enabled.
- Implementation note: A U.S. ID-number check, which may involve an SSN, is available only from the Driver Eligibility flow for U.S. Driver accounts and is entered directly with Stripe. Seatbelt never collects or stores the SSN in Account details.
- Attorney/privacy review: Update the Privacy Policy and Terms of Service before public release to describe Stripe Identity as a processor, the verification purpose, retention/deletion process, user rights, and any applicable biometric or identity-verification disclosures.
- Open questions: Confirm the required document types, whether selfie/liveness verification is required, retention duration for verification metadata, and any jurisdiction-specific notices before enabling production verification.

## Rider Identity and Separate Driver License Gate

Status: Approved / Implemented locally / Provider and legal review pending

- Requirement: Offer general Stripe-hosted identity verification to Riders as well as Drivers. Riders must complete it before creating Rider trip posts or accepting rides.
- Requirement: Keep the verified Driver License and its confirmed expiration date separate from general identity verification; Driver mode and offers remain blocked if the license is missing, expired, or its expiration cannot be confirmed.
- Requirement: SSNs belong only in the optional U.S. Driver Eligibility ID-number check hosted by Stripe. Never place SSNs in Profile Account details, Seatbelt forms, logs, or ordinary account exports.
- Open questions: Confirm Stripe Identity availability, restricted results-key permissions, supported documents by jurisdiction, legal basis and notice/consent wording before production activation.
## Driver Eligibility Documents and Approval

Status: Approved — Implemented Private Upload Workflow / Attorney Review

- Requirement: Stripe Identity is limited to personal identity verification. For Driver eligibility, configure the Identity flow to require a driver-license document where supported; do not treat identity verification alone as proof of an active license, driving record, vehicle registration, insurance coverage, or jurisdictional eligibility.
- Requirement: Vehicle registration, proof of insurance, and any jurisdiction-specific driver documents must use a separate Driver Eligibility workflow with secure collection, expiration tracking, and internal statuses of Pending, Approved, Rejected, and Expired.
- Requirement: Do not rely solely on manually typed expiration dates. Before public Driver availability, eligibility documents must be reviewed or verified through an appropriate provider and the Driver must be blocked from Driver mode while required approval is missing or expired. Rider access remains available.
- Implementation note: Do not add vehicle-registration or insurance fields to ordinary signup. Keep vehicle make/model/year in signup and build the gated eligibility workflow separately.
- Requirement: Initial Driver Eligibility rules apply to New York. Required document content must be valid for the Driver’s actual New York vehicle and insurance circumstances; do not treat a file extension as proof of validity.
- Requirement: A Driver may create an account and complete permitted setup activities, but may not receive or accept payment offers, appear as an available Driver, or appear on the GPS locator until identity and Driver Eligibility requirements are approved. GPS visibility enforcement is deferred until Mapbox integration is active.
- Requirement: Staff/admin review roles and clearance rules are deferred to the future Admin and Staff Supabase design. Until that design exists, no staff document-review workflow is authorized for implementation.
- Sequencing decision: Build the private Driver Eligibility document-upload and user-status workflow before the Admin/Staff reviewer-role system. Uploaded eligibility documents remain pending and inaccessible to staff until the future reviewer roles and clearance controls are implemented; connect the two workflows at that later stage.
- Attorney/privacy review: Required before implementation to establish document scope, collection method, access controls, retention/deletion, jurisdiction-specific insurance and transportation-network requirements, appeals, and staff-review authority.
- Requirement: Incomplete Driver Eligibility uploads are tracked as private drafts and scheduled for deletion within 72 hours. Submitted documents remain private while awaiting the future authorized review workflow.
- Implementation note: Vercel Hobby permits the protected Production Cron route to run once daily. Drafts become eligible after 48 hours so the next scheduled run can remove them within the 72-hour window. The job processes up to 1,000 expired drafts and 1,000 reviewed rows within a bounded 180-second cleanup budget; if backlog remains it reports a failed maintenance run. Monitor backlog and confirm capacity before public release. `CRON_SECRET` must remain server-only. Cron is not invoked for Preview deployments.
- Open questions: Confirm New York-specific required insurance coverage, registration/inspection requirements, background and motor-vehicle-record provider, document-review workflow, technical upload limits, and whether a specialized verification provider can validate each requirement.
## Phase 2 — Private Driver Eligibility Review Portal

Status: Approved — In Progress

- Requirement: The two approved founding administrators may review private Driver Eligibility documents only after verified sign-in and AAL2 MFA.
- Implementation note: Review actions are `approved`, `rejected`, or `needs_update`; safe reason codes are stored separately from document contents.
- Implementation note: Document previews use private signed URLs valid for 10 minutes and are never made public.
- Implementation note: If Stripe reports that a stored Verification Session no longer exists, Seatbelt clears the stale reference and starts a fresh session; raw provider errors are not shown to the user.
- Requirement: Drivers receive only safe signed-in status guidance; document details are not sent through ordinary email.
- Staff accounts, automated DMV verification, external document providers, analytics, and notification delivery remain deferred.
- Attorney/privacy review: Required before public release because this workflow processes registration, insurance, identity, access-control, and retention data.

## Phase 3 — Retention and Generic Notifications

Status: Approved — In Progress

- Requirement: Incomplete Driver Eligibility drafts remain subject to the existing 72-hour deletion lifecycle. Reviewed registration and insurance documents receive a configurable 30-day deletion deadline, unless a legal hold is active.
- Requirement: Review outcomes queue generic email notices only. Messages must not reveal document type, rejection reason, expiration, attachment, or privileged link; detailed status remains available only after signed-in access.
- Implementation note: Seatbelt uses Resend for transactional delivery through server-only RESEND_API_KEY and RESEND_FROM_EMAIL configuration. APP_URL may provide a standard signed-in Seatbelt link.
- Implementation note: Notification delivery retries are bounded and cannot block a review decision. Delivery-event records retain only operational status and generic failure state.
- Affected files: admin review API, protected cron routes, Vercel configuration, safe environment template, the Phase 3 migration, and applicable policy records.
- Attorney/privacy review: Required before public release to confirm the final document-retention period, legal-hold process, Resend processor disclosure, and New York-specific obligations.
- Open questions: Define legal-hold ownership and release process, final post-decision retention duration, and production sender-domain ownership before public launch.

## Full Platform Builder Integration — 2026-10-11

Status: Approved scope / Implemented locally / Unverified

- Requirement: Preserve the approved full-platform scope, private onboarding, account-state and Driver-eligibility boundaries, and honest provider-unavailable states. Defer the combined verification pass until implementation is finished. The original build approval did not include staging, commits, pushes or live schema changes; the user later authorized a reviewed feature-branch commit and push. No live schema changes are authorized.
- Affected files: Account/notification/support APIs and migrations; administrator analytics/support; profile/settings/guidance; ride agreements/history/reviews; billing/provider reconciliation; protected location; shared navigation/footer; environment template and policy drafts. Exact current ranges are recorded in `docs/FULL-PLATFORM-LINE-REFERENCE.md`.
- Implementation note: Account settings, account lifecycle audits and support notifications now commit transactionally. Freeze/resume holds billing locks through account finalization; failed resume finalization attempts to restore an indefinite collection pause. Deletion remains a reviewed request, cannot be undone through ordinary resume, and never automatically erases data. Safe existing-ride completion/cancellation and private history remain available after a freeze.
- Implementation note: Legal names move into private account records; discoverable profile names are initials. Signup/returning-account onboarding, driver-mode activation, offers, payments and location use account/eligibility checks. Review APIs omit anonymous reviewer identifiers. Administrator support content access and responses are audited behind founding-admin authority and AAL2.
- Implementation note: One daily protected maintenance cron retains the existing draft/retention cleanup, processes due reactivation and renewal reminders, and delivers only generic emails using claimed queues. Cleanup processes up to 1,000 expired drafts and 1,000 reviewed rows within a bounded 180-second budget and reports a remaining backlog as a failed run. Claims allow at most five attempts and ten messages per source per invocation. Reactivation is limited to twenty candidates with a sixty-second admission budget; failures leave recoverable states. Provider outages, daily scheduling jitter and backlog can delay processing, so monitor queue health before relying on the 72-hour draft window.
- Implementation note: Finance reports actual provider-confirmed gross ride volume, refunds and account spending by currency. Platform/subscription revenue, operating-cost instrumentation, automated incident coverage and external fraud monitoring remain unavailable until their reliable sources exist.
- Open questions: Verify target migration history before deployment; configure Stripe products/Connect/webhooks/portal, Resend sender, Mapbox public token, Supabase secure-password change and Auth SMTP. Validate provider timed-to-indefinite pause behavior, cron Fluid Compute duration/backlog limits, privacy/legal retention ownership and public-release notices. Cameras, background checks, passkeys/SMS, marketing distribution, international settlement and route/distance recording still require separate real provider/legal prerequisites. Existing confidential working documents and recovery copies remain preserved; no secure archival destination or restore test was chosen.
- Implementation status: The combined local lint, TypeScript, build, schema lint and focused account/tab smoke pass completed; SECURITY and REVIEWER rounds are complete. The clean migration chain is blocked by the missing legacy `public.profiles` baseline, and broad lifecycle/provider checks remain pending.
- Next step: The implementation handoff and exact changed-line report are in `docs/FULL-PLATFORM-HANDOFF.md` and `docs/FULL-PLATFORM-LINE-REFERENCE.md`. Verify the authoritative migration baseline and cleanup capacity before deployment. BUDDY is conditional on the user's later request. The user explicitly authorized the current reviewed feature-branch commit and push; no deployment or merge is authorized.

## VERY IMPORTANT — External AGENTS.md Update

This is **not** a Seatbelt decision or follow-up. It records a major update required in the external instruction file: `C:\Users\Github\AGENTS\AGENTS.md`.

- Deferred external action: After Seatbelt is complete, create a dedicated private Codex Skills repository for stable cross-project skills and package them as a Codex plugin for remote/cloud distribution.
- External AGENTS.md direction: Keep experimental or personal skills in the local Codex skills directory; store project-specific team skills in that project's `.agents/skills` directory; use the private Skills repository/plugin for reusable cross-project skills such as the permanent Planner, Builder, and Reviewer agents.
- This notice must always remain the final section of this file.
- Sequencing decision: Phase 2 connects the private Driver Eligibility upload workflow to the approved founding-administrator review workflow. Staff review, role expansion, and clearance delegation remain deferred.
