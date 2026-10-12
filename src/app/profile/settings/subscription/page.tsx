'use client'

import { useState } from 'react'
import Link from 'next/link'
import AccountPage, { Feedback } from '@/components/AccountPage'
import { apiRequest } from '@/lib/apiClient'
import { requestError, ResourceState } from '../_components'
import { billingDate, BillingLoading, useBilling, useHostedBilling } from '../payment/_billing'

export default function SubscriptionSettings() {
  const { data, loading, error, refresh } = useBilling()
  const hosted = useHostedBilling()
  const [months, setMonths] = useState(1)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const hasSubscription = Boolean(data && !['none', 'not_configured', 'canceled', 'incomplete_expired'].includes(data.status))
  async function change(action: 'cancel' | 'freeze' | 'resume') {
    if (busy || hosted.busy) return
    setBusy(true); setActionError(''); setMessage('')
    try {
      await apiRequest('/api/billing/subscription', { method: 'POST', body: JSON.stringify({ action, months }) })
      setConfirmCancel(false)
      setMessage(action === 'cancel' ? 'Stripe confirmed cancellation at the end of the current billing period.' : action === 'freeze' ? 'Stripe confirmed the pause in collection.' : 'Stripe confirmed collection has resumed on your existing billing schedule.')
      await refresh()
    } catch (cause) { setActionError(requestError(cause)) }
    finally { setBusy(false) }
  }
  const disabled = busy || hosted.busy || loading
  return <AccountPage title="Subscription">
    {loading && <BillingLoading />}
    <ResourceState loading={false} error={error} retry={refresh}>
      {data && <>
        <section className="panel">
          <h2>Current subscription</h2>
          {!data.configured ? <p className="status-note">Subscriptions are not configured yet. No paid plan can be started here.</p> : <>
            <p className="status-note">{data.mode === 'test' ? 'Test billing — no live subscription charges.' : 'Live billing — subscriptions renew with real charges.'}</p>
            <p><strong>{data.tier || 'No configured tier'}</strong> · Provider status: {data.status.replaceAll('_', ' ')}</p>
            {data.startedAt && <p>Started: {billingDate(data.startedAt)}</p>}
            {hasSubscription && <p>{data.cancelAtPeriodEnd ? 'Scheduled end' : 'Current billing period ends'}: {billingDate(data.renewalAt)}</p>}
            {data.collectionPaused && <p className="status-note">Collection is paused. {data.frozenUntil ? `Scheduled to resume ${billingDate(data.frozenUntil)}.` : data.accountState === 'frozen' ? `Your account freeze is scheduled through ${billingDate(data.accountFrozenUntil)}. Collection resumes only after account reactivation succeeds.` : 'No automatic billing resume date is set.'}</p>}
            {data.cancelAtPeriodEnd && <p>Renewal is canceled at the end of this billing period.</p>}
            {hasSubscription && <>
              <button className="secondary-button" disabled={disabled || !data.portalConfigured} onClick={() => void hosted.open('/api/billing/portal')}>Open Stripe billing portal</button>
              {!data.portalConfigured && <p className="muted">The billing portal is not configured yet.</p>}
              {data.accountState !== 'active' && <p><Link href="/profile/settings/account">Reactivate your account</Link> before changing collection.</p>}
              {['active', 'trialing'].includes(data.status) && !data.cancelAtPeriodEnd && <>
                {data.collectionPaused ? <button className="primary-button" disabled={disabled || data.accountState !== 'active'} onClick={() => void change('resume')}>Resume collection</button> : <>
                  <div className="form-field"><label htmlFor="freeze-months">Pause collection for</label><select id="freeze-months" value={months} disabled={disabled} onChange={event => setMonths(Number(event.target.value))}>{[1,2,3,4,5,6].map(value => <option key={value} value={value}>{value} {value === 1 ? 'month' : 'months'}</option>)}</select></div>
                  <p className="muted">New invoices during this pause are voided. Collection resumes automatically on the selected date, using the existing billing schedule. Outstanding invoices must be resolved first.</p>
                  <button className="secondary-button" disabled={disabled || data.accountState !== 'active'} onClick={() => void change('freeze')}>Pause subscription collection</button>
                </>}
              </>}
              {!data.cancelAtPeriodEnd && (confirmCancel ? <div className="status-note"><p>Cancel renewal at the end of this billing period? This does not refund prior payments.</p><button className="danger-button" disabled={disabled} onClick={() => void change('cancel')}>Confirm cancellation</button><button className="secondary-button" disabled={disabled} onClick={() => setConfirmCancel(false)}>Keep subscription</button></div> : <button className="danger-button" disabled={disabled} onClick={() => setConfirmCancel(true)}>Cancel renewal</button>)}
            </>}
          </>}
        </section>
        {data.configured && !hasSubscription && <section className="panel">
          <h2>Choose a subscription</h2>
          <p>Stripe checkout shows the final recurring price and terms before you subscribe.</p>
          {!data.prices.length && <p className="status-note">No subscription tiers are configured yet.</p>}
          {data.prices.map(price => <div className="panel" key={price.tier}><h3>{price.tier}</h3><p>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price.amountCents / 100)} every {price.intervalCount} {price.interval}{price.intervalCount > 1 ? 's' : ''}</p><button className="primary-button" disabled={disabled || data.accountState !== 'active'} onClick={() => void hosted.open('/api/billing/checkout', { tier: price.tier })}>Continue with {price.tier}</button></div>)}
          {data.accountState !== 'active' && <p>Reactivate your account before starting a subscription.</p>}
        </section>}
        <Feedback error={actionError || hosted.error} success={message} />
        {(busy || hosted.busy) && <BillingLoading />}
        <button className="secondary-button" disabled={disabled} onClick={() => void refresh()}>Refresh provider status</button>
        <p className="muted">A checkout return is not proof of payment. The status above comes from Stripe.</p>
        <p><Link href="/profile/settings/payment">Payment methods and Driver payouts</Link></p>
      </>}
    </ResourceState>
  </AccountPage>
}
