'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { apiRequest } from '@/lib/apiClient'
import { Feedback } from '@/components/AccountPage'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = publishableKey ? loadStripe(publishableKey) : null
type PaymentIntent = { clientSecret: string | null; amountCents: number; currency: string; status: string }

function CheckoutForm({ amountCents, onSubmitted, setBusy }: { amountCents: number; onSubmitted: () => Promise<void>; setBusy: (busy: boolean) => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!stripe || !elements || loading || submitted) return
    setLoading(true); setBusy(true); setError('')
    try {
      const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.origin + '/profile/settings/ride-history' }, redirect: 'if_required' })
      if (result.error) setError(result.error.message || 'Payment could not be submitted. Review your payment details and try again.')
      else { setSubmitted(true); await onSubmitted() }
    } catch { setError('Payment confirmation is temporarily unavailable. Check the payment status before trying again.') }
    finally { setLoading(false); setBusy(false) }
  }
  return <form onSubmit={submit}>
    <p>Agreed ride total: <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100)}</strong></p>
    {!submitted && <PaymentElement />}
    <Feedback error={error} />
    {!submitted && <button type="submit" className="primary-button" disabled={loading || !stripe || !elements}>{loading ? <><span className="loading-indicator" aria-hidden="true" />Submitting payment…</> : 'Pay $' + (amountCents / 100).toFixed(2)}</button>}
  </form>
}

export default function PaymentModal({ rideId, onSuccess, onCancel }: { rideId: string; onSuccess: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  async function checkStatus() {
    setBusy(true); setError('')
    try {
      const payment = await apiRequest<{ status: string }>('/api/billing/payment-status?rideId=' + encodeURIComponent(rideId))
      if (payment.status === 'succeeded') { onSuccess(); return }
      setMessage(['refunded', 'partially_refunded'].includes(payment.status) ? 'This payment has a recorded refund. Review your ride history.' : payment.status === 'canceled' ? 'This payment was canceled. Contact support before retrying.' : 'Payment is awaiting provider confirmation. You can close this window and check your ride history, or refresh the status shortly.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Payment status is temporarily unavailable.') }
    finally { setBusy(false) }
  }
  async function initialize() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const payment = await apiRequest<PaymentIntent>('/api/create-payment-intent', { method: 'POST', body: JSON.stringify({ rideId }) })
      setIntent(payment)
      if (!payment.clientSecret) { setSubmitted(true); await checkStatus() }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Payment setup is temporarily unavailable.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} aria-labelledby="payment-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel() }} style={{ position: 'fixed', inset: 0, margin: 'auto', width: 'min(440px, calc(100% - 32px))', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #777', borderRadius: 16, padding: 24 }}>
    <h2 id="payment-title">Pay for your accepted ride</h2>
    <p className="muted">The amount comes from your accepted ride agreement. Payment is recorded only after provider confirmation.</p>
    {!stripePromise ? <p className="status-note">Payment checkout is not configured yet.</p> : <>
      {!intent && <button className="primary-button" disabled={busy} onClick={() => void initialize()}>Review payment</button>}
      {intent?.clientSecret && <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#c8b86a' } } }}>
        <CheckoutForm amountCents={intent.amountCents} setBusy={setBusy} onSubmitted={async () => { setSubmitted(true); await checkStatus() }} />
      </Elements>}
      {submitted && <button className="secondary-button" disabled={busy} onClick={() => void checkStatus()}>Check payment status</button>}
    </>}
    {busy && <p role="status"><span className="loading-indicator" aria-hidden="true" />Contacting payment provider…</p>}
    <Feedback error={error} />
    {message && <p className="status-note" role="status">{message}</p>}
    <button className="secondary-button" disabled={busy} onClick={onCancel}>Close</button>
  </dialog>
}
