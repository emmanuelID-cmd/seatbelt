'use client'

import { useState } from 'react'
import { apiRequest } from '@/lib/apiClient'
import { requestError, useResource } from '../_components'

export type BillingStatus = {
  configured: boolean; mode: 'test' | 'live'; accountState: string; accountFrozenUntil: string | null
  status: string; tier: string | null; renewalAt: string | null; startedAt: string | null
  cancelAtPeriodEnd: boolean; collectionPaused: boolean; frozenUntil: string | null
  payoutsEnabled: boolean; canSetUpPayouts: boolean; connectConfigured: boolean
  bankConfigured: boolean; portalConfigured: boolean; availableTiers: string[]
  prices: { tier: string; amountCents: number; interval: string; intervalCount: number }[]
  paymentMethods: { type: string; label: string; last4: string; expires: string | null }[]
}
export function useBilling() { return useResource<BillingStatus>('/api/billing') }
export function billingDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not available'
}
export function useHostedBilling() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function open(path: string, body?: Record<string, unknown>) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const { url } = await apiRequest<{ url: string }>(path, { method: 'POST', body: JSON.stringify(body || {}) })
      const destination = new URL(url)
      if (destination.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com', 'connect.stripe.com'].includes(destination.hostname)) {
        throw new Error('The payment destination could not be verified. Please try again.')
      }
      window.location.assign(destination.toString())
    } catch (cause) { setError(requestError(cause)); setBusy(false) }
  }
  return { busy, error, open }
}
export function BillingLoading() {
  return <p role="status"><span className="loading-indicator" aria-hidden="true" />Contacting billing service…</p>
}
