'use client'

import Link from 'next/link'
import AccountPage, { Feedback } from '@/components/AccountPage'
import { ResourceState } from '../_components'
import { BillingLoading, useBilling, useHostedBilling } from './_billing'

export default function PaymentSettings() {
  const { data, loading, error, refresh } = useBilling()
  const hosted = useHostedBilling()
  return <AccountPage title="Payment">
    {loading && <BillingLoading />}
    <ResourceState loading={false} error={error} retry={refresh}>
      {data && <>
        <section className="panel">
          <h2>Payment methods</h2>
          <p>Card and bank details are entered and managed securely with Stripe. SeatBelt shows only the masked details below.</p>
          {!data.configured ? <p className="status-note">Billing is not configured yet. Payment setup is unavailable.</p> : <>
            <p className="status-note">{data.mode === 'test' ? 'Test mode — use Stripe test details. No live payments are enabled.' : 'Live billing — payments use real money.'}</p>
            {data.paymentMethods.length ? <ul className="data-list">{data.paymentMethods.map((method, i) => <li key={`${method.type}-${method.last4}-${i}`}>
              <strong>{method.label} ending in {method.last4}</strong>{method.expires && <p>Expires {method.expires}</p>}
            </li>)}</ul> : <p>No saved payment methods.</p>}
            {data.accountState !== 'active' && <p className="status-note">Reactivate your account before adding payment methods.</p>}
            <button className="primary-button" disabled={hosted.busy || data.accountState !== 'active'} onClick={() => void hosted.open('/api/billing/payment-methods', { kind: 'card' })}>Add a card</button>
            <button className="secondary-button" disabled={hosted.busy || !data.bankConfigured || data.accountState !== 'active'} onClick={() => void hosted.open('/api/billing/payment-methods', { kind: 'bank' })}>Add a US bank account</button>
            {!data.bankConfigured && <p className="muted">Bank account setup is not configured yet.</p>}
            <button className="secondary-button" disabled={hosted.busy || !data.portalConfigured} onClick={() => void hosted.open('/api/billing/portal')}>Manage saved methods</button>
            {!data.portalConfigured && <p className="muted">Hosted payment management is not configured yet.</p>}
          </>}
        </section>
        {data.canSetUpPayouts && <section className="panel">
          <h2>Driver payouts</h2>
          <p>{data.payoutsEnabled ? 'Stripe confirms your payout account is ready.' : 'Complete Stripe onboarding and current Driver Eligibility approval before receiving ride payments.'}</p>
          {(!data.configured || !data.connectConfigured) && <p className="status-note">Driver payout onboarding is not configured yet.</p>}
          <button className="primary-button" disabled={hosted.busy || !data.configured || !data.connectConfigured || data.accountState !== 'active'} onClick={() => void hosted.open('/api/billing/connect')}>{data.payoutsEnabled ? 'Review payout details' : 'Set up payouts'}</button>
          <p><Link href="/driver-eligibility">Review Driver Eligibility</Link></p>
        </section>}
        <Feedback error={hosted.error} />
        {hosted.busy && <BillingLoading />}
        <button className="secondary-button" disabled={loading || hosted.busy} onClick={() => void refresh()}>Refresh provider status</button>
        <p className="muted">Returning from Stripe does not itself confirm setup. Refresh to see the current provider status.</p>
        <p><Link href="/profile/settings/subscription">Manage subscription</Link></p>
      </>}
    </ResourceState>
  </AccountPage>
}
