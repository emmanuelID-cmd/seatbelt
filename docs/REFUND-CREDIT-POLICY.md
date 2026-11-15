# Managed Ride Credits and Refunds

Updated: 2026-10-14.

Status: Approved product policy / Credit workflow pending implementation and activation / Agent automation deferred / Attorney review required.

This policy defines the approved managed account-credit workflow. It does not mean a credit balance, issuance service, redemption flow, or automated refund agent is currently available. Requests continue through Seatbelt support with human review. Existing provider-confirmed refund reporting is separate from account-credit issuance.

## Resolution choices

- A Rider may accept an eligible Seatbelt account credit or request a refund to the original payment method. An account credit is recorded separately from money returned through the payment provider.
- Original-payment refunds always require human review, regardless of amount. Credits exceeding $20 for one ride also require human review and may be issued only for the full approved eligible amount in one transaction.
- During the current deferred-agent period, every credit and monetary refund requires human review. No agent is authorized to approve or issue either resolution.

## One ride, one credit

- Each eligible ride may receive at most one completed credit transaction, linked to that ride and its original payment record.
- The credit must equal the full amount the Rider is entitled to receive under the reviewed eligibility decision. The eligible amount may differ from the total fare; it must not be reduced to an arbitrary partial award.
- Partial credit awards, split credits, and duplicate credits for the same ride are not permitted. A request above $20 must not be divided into smaller transactions to fit the future automation threshold.
- Multiple rides are assessed independently, each with its own eligibility decision and transaction record. A previously credited or refunded amount must be considered before another resolution is approved so that the same loss is not compensated twice. Switching resolution methods requires human reconciliation of the prior credit or refund.

## Verification and transaction safeguards

Before issuance, the managed workflow must verify the Rider's authority over the request, the ride ID, original payment, eligibility, approved amount and currency, chosen resolution, and previous credit/refund history. Client-supplied amounts or a checkout redirect are not proof of entitlement or completion.

The issuance operation must enforce the one-credit-per-ride rule atomically and use an idempotent transaction reference. Concurrent requests, retries, and duplicate submissions must return or reconcile the existing transaction rather than issue another credit. A processing or uncertain transaction must be reconciled before another attempt can complete.

Each completed credit requires a unique transaction record linked to the ride, Rider and original payment, with the approved amount/currency, decision and authorizing reviewer, timestamps, and processing outcome. Refund completion must reflect provider confirmation. Account-credit completion must reflect a committed credit-ledger entry; an approval or UI success message alone is insufficient.

## Planned request statuses

These are workflow requirements, not implemented application statuses:

- Submitted: request recorded; no entitlement or transaction is implied.
- Under review: eligibility, amount, resolution choice and previous transactions are being checked.
- Approved: a reviewer has authorized the full eligible amount and resolution; funds or credits have not necessarily been issued.
- Processing: issuance or provider confirmation is outstanding; duplicate completion is blocked.
- Credited / Refunded: the credit ledger has committed, or the provider has confirmed the original-payment refund, respectively. Keep the two outcomes distinct.
- Declined: provide a general reason and the available appeal path.
- Failed / Reconciliation required: explain that completion is unconfirmed and reconcile the existing transaction before retrying.

The Rider should be able to see the chosen resolution, approved amount, current status, and final transaction reference without seeing private reviewer notes or fraud signals. Existing support-request statuses do not establish that compensation was issued.

## Deferred automation threshold

If agent automation is separately approved and activated, it may issue only an eligible, approved account credit whose full amount is no more than $20 for one ride. It must use the same verified issuance workflow; it may not bypass human review requirements or access controls.

| Ride | Full eligible amount | Current workflow | Future automation boundary |
| --- | --- | --- | --- |
| R-1001 | $4 | Human-reviewed credit | Within threshold |
| R-1002 | $8 | Human-reviewed credit | Within threshold |
| R-1003 | $12 | Human-reviewed credit | Within threshold |
| Boundary example | $20 | Human-reviewed credit | Within threshold |
| R-1004 | $25 | Human review; one full credit or reviewed original-payment refund | Human review required |

These are illustrative amounts, not real transactions. Original-payment refunds require human review in every row.

## Cumulative activity and open activation decisions

Monitor cumulative account credit/refund activity and flag unusual patterns across rides for human review. The one-credit-per-ride rule does not by itself cap total account exposure. No cumulative dollar limit, time window, or automatic denial rule has been approved; those settings require a separate decision.

Before activation, define eligibility and eligible-amount rules, authorized reviewer permissions, credit funding/accounting, redemption and balance rules, any expiry or transfer conditions, provider refund handling, dispute/chargeback reconciliation, and retention/access for audit records. Do not invent these settings or treat an absent setting as permission to issue compensation.

Attorney/payment review must confirm the final disclosures and treatment of mandatory refunds, credits, disputes and retention. This policy does not remove non-waivable refund, payment-dispute or chargeback rights. The implementation and acceptance tests remain pending; no credit transaction, payment refund, live migration or provider activation is authorized by this documentation update.
