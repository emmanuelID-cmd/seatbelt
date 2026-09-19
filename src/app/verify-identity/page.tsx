'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
type IdentityStatus = 'not_started' | 'requires_input' | 'processing' | 'verified' | 'canceled'

type Verification = {
  status: Exclude<IdentityStatus, 'not_started'>
  last_error_message: string | null
}

export default function VerifyIdentityPage() {
  const router = useRouter()
  const [status, setStatus] = useState<IdentityStatus>('not_started')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  const authorizedRequest = useCallback(async (path: string, method = 'GET') => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sign in is required.')
    const response = await fetch(path, { method, headers: { Authorization: `Bearer ${session.access_token}` } })
    const data = await response.json() as { verification?: Verification | null; status?: IdentityStatus; clientSecret?: string; error?: string }
    if (!response.ok) throw new Error(data.error || 'Identity verification is temporarily unavailable. Please try again later.')
    return data
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const data = await authorizedRequest('/api/identity/session')
      setStatus(data.verification?.status || 'not_started')
      if (data.verification?.last_error_message) setError(data.verification.last_error_message)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Identity verification is temporarily unavailable. Please try again later.')
    } finally {
      setLoading(false)
    }
  }, [authorizedRequest])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void refreshStatus(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [refreshStatus])
  useEffect(() => {
    if (status !== 'processing') return
    const intervalId = window.setInterval(() => void refreshStatus(), 5000)
    return () => window.clearInterval(intervalId)
  }, [refreshStatus, status])

  async function startVerification() {
    setStarting(true)
    setError('')
    try {
      const data = await authorizedRequest('/api/identity/session', 'POST')
      if (data.status === 'verified') {
        setStatus('verified')
        return
      }
      if (data.status === 'processing') {
        setStatus('processing')
        return
      }
      if (!data.clientSecret) throw new Error('Verification could not be started. Please try again.')

      const stripe = await stripePromise
      if (!stripe) throw new Error('Identity verification is temporarily unavailable. Please try again later.')
      const result = await stripe.verifyIdentity(data.clientSecret)
      if (result.error) throw new Error(result.error.message || 'Identity verification did not start. Please try again.')

      setStatus('processing')
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : 'Identity verification is temporarily unavailable. Please try again later.')
    } finally {
      setStarting(false)
    }
  }

  async function continueAsRider() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ last_session_mode: 'rider' })
      .eq('id', user.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    router.push('/feed')
  }
  if (loading) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#111', color: '#777' }}>Loading identity verification...</main>

  const isVerified = status === 'verified'
  const isProcessing = status === 'processing'
  const actionLabel = status === 'requires_input' || status === 'canceled' ? 'CONTINUE VERIFICATION' : 'VERIFY IDENTITY'

  return (
    <main style={{ minHeight: '100vh', background: '#111', color: '#e0e0e0', padding: '16px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button type="button" onClick={() => router.push('/profile')} aria-label="Back to profile" style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '22px', cursor: 'pointer' }}>←</button>
          <h1 style={{ margin: 0, fontSize: '18px' }}>Verify identity</h1>
        </header>
        <section style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '16px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: '16px' }}>Driver identity verification</h2>
          <p style={{ margin: '0 0 18px', color: '#aaa', fontSize: '13px', lineHeight: 1.5 }}>Stripe securely captures and verifies your government-issued ID. Seatbelt does not receive or store your ID image or ID number.</p>
          {error && <p role="alert" style={{ color: '#f87171', fontSize: '13px', lineHeight: 1.5 }}>{error}</p>}
          {isVerified && <p role="status" style={{ color: '#6dba6d', fontSize: '14px', lineHeight: 1.5 }}>✓ Your identity is verified. Upload your Driver Eligibility documents to complete Driver setup.</p>}
          {isProcessing && <p role="status" style={{ color: '#c8b86a', fontSize: '14px', lineHeight: 1.5 }}>Your document was submitted and is being processed. This page will update automatically.</p>}
          {!isVerified && !isProcessing && <button type="button" onClick={() => void startVerification()} disabled={starting} style={{ width: '100%', border: 0, borderRadius: '10px', padding: '13px', background: '#c8b86a', color: '#111', fontWeight: '700', cursor: 'pointer', opacity: starting ? 0.7 : 1 }}>{starting ? 'OPENING STRIPE...' : actionLabel}</button>}
          {isVerified && <button type="button" onClick={() => router.push('/driver-eligibility')} style={{ width: '100%', marginTop: '12px', border: 0, borderRadius: '10px', padding: '13px', background: '#c8b86a', color: '#111', fontWeight: '700', cursor: 'pointer' }}>CONTINUE TO DRIVER ELIGIBILITY</button>}
          {isProcessing && <button type="button" onClick={() => void continueAsRider()} style={{ width: '100%', marginTop: '12px', border: 0, borderRadius: '10px', padding: '13px', background: '#c8b86a', color: '#111', fontWeight: '700', cursor: 'pointer' }}>USE RIDER MODE WHILE WAITING</button>}
          {!isVerified && <button type="button" onClick={() => void refreshStatus()} disabled={starting} style={{ width: '100%', marginTop: '12px', border: '0.5px solid #555', borderRadius: '10px', padding: '11px', background: 'transparent', color: '#ccc', fontWeight: '600', cursor: 'pointer' }}>REFRESH STATUS</button>}
        </section>
      </div>
    </main>
  )
}