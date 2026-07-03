'use client'
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutForm({ amount, onSuccess, onCancel }: { amount: number, onSuccess: () => void, onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!stripe || !elements) return
    setLoading(true)
    setError('')

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/feed`,
      },
      redirect: 'if_required',
    })

    if (error) {
      setError(error.message || 'Payment failed')
      setLoading(false)
    } else {
      onSuccess()
    }
  }

  const fee = (amount * 0.025).toFixed(2)
  const total = (amount * 1.025).toFixed(2)

  return (
    <div>
      <div style={{ background: '#222', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#777', fontSize: '13px' }}>Ride price</span>
          <span style={{ color: '#e0e0e0', fontSize: '13px' }}>${amount.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#777', fontSize: '13px' }}>SeatBelt fee (2.5%)</span>
          <span style={{ color: '#777', fontSize: '13px' }}>${fee}</span>
        </div>
        <div style={{ borderTop: '0.5px solid #333', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#e0e0e0', fontSize: '14px', fontWeight: '600' }}>Total</span>
          <span style={{ color: '#c8b86a', fontSize: '14px', fontWeight: '600' }}>${total}</span>
        </div>
      </div>

      <PaymentElement />

      {error && (
        <div style={{ background: '#2a1a1a', border: '0.5px solid #5a2a2a', borderRadius: '8px', padding: '10px', marginTop: '12px', fontSize: '13px', color: '#f87171' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button onClick={onCancel}
          style={{ flex: 1, background: 'transparent', border: '0.5px solid #333', borderRadius: '10px', padding: '12px', color: '#666', fontSize: '14px', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={loading || !stripe}
          style={{ flex: 2, background: '#c8b86a', color: '#111', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', opacity: loading || !stripe ? 0.7 : 1 }}>
          {loading ? 'Processing...' : `Pay $${total}`}
        </button>
      </div>
    </div>
  )
}

export default function PaymentModal({ amount, tripId, driverId, onSuccess, onCancel }: {
  amount: number
  tripId: string
  driverId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [clientSecret, setClientSecret] = useState('')
  const [loadingIntent, setLoadingIntent] = useState(false)
  const [error, setError] = useState('')

  async function initPayment() {
    setLoadingIntent(true)
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, tripId, driverId }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoadingIntent(false); return }
      setClientSecret(data.clientSecret)
    } catch (e) {
      setError('Failed to initialize payment')
    }
    setLoadingIntent(false)
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
      <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', border: '0.5px solid #2a2a2a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ color: '#e0e0e0', fontSize: '17px', fontWeight: '600' }}>Confirm & Pay</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#555', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        {!clientSecret && !loadingIntent && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🚗</div>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>Ride price agreed: <span style={{ color: '#c8b86a', fontWeight: '700' }}>${amount.toFixed(2)}</span></p>
            <p style={{ color: '#555', fontSize: '12px', marginBottom: '20px' }}>A 2.5% SeatBelt fee will be added</p>
            <button onClick={initPayment}
              style={{ width: '100%', background: '#c8b86a', color: '#111', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
              PROCEED TO PAYMENT
            </button>
          </div>
        )}

        {loadingIntent && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#444' }}>Setting up payment...</div>
        )}

        {error && (
          <div style={{ background: '#2a1a1a', border: '0.5px solid #5a2a2a', borderRadius: '8px', padding: '12px', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#c8b86a' } } }}>
            <CheckoutForm amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
          </Elements>
        )}
      </div>
    </div>
  )
}