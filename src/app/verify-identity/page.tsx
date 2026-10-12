'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
type IdentityStatus = 'not_started' | 'requires_input' | 'processing' | 'verified' | 'canceled'
type Method = 'document' | 'id_number'
type SessionResult = { status?: IdentityStatus; clientSecret?: string; isDriver?: boolean; country?: string | null; error?: string }

export default function VerifyIdentityPage() {
  const searchParams = useSearchParams()
  const driverEligibilityContext = searchParams.get('context') === 'driver-eligibility'
  const licensePurpose = searchParams.get('purpose') === 'driver_license'
  const [status, setStatus] = useState<IdentityStatus>('not_started')
  const [method, setMethod] = useState<Method>('document')
  const [isDriver, setIsDriver] = useState(false)
  const [isUsAccount, setIsUsAccount] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  const authorizedRequest = useCallback(async (path: string, methodName = 'GET', payload?: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sign in is required.')
    const response = await fetch(path, {
      method: methodName,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(payload ? { 'Content-Type': 'application/json' } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    })
    const data = await response.json() as SessionResult
    if (!response.ok) throw new Error(data.error || 'Identity verification is temporarily unavailable. Please try again later.')
    return data
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const data = await authorizedRequest(`/api/identity/session?purpose=${licensePurpose ? 'driver_license' : driverEligibilityContext ? 'driver_eligibility' : 'identity'}`)
      setStatus(data.status || 'not_started')
      setIsDriver(Boolean(data.isDriver))
      setIsUsAccount(data.country === 'US')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Identity verification is temporarily unavailable. Please try again later.')
    } finally {
      setLoading(false)
    }
  }, [authorizedRequest, driverEligibilityContext, licensePurpose])

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
      const data = await authorizedRequest('/api/identity/session', 'POST', {
        purpose: licensePurpose ? 'driver_license' : driverEligibilityContext ? 'driver_eligibility' : 'identity',
        method: licensePurpose ? 'document' : driverEligibilityContext ? 'id_number' : method,
        context: driverEligibilityContext ? 'driver_eligibility' : 'identity',
      })
      if (data.status === 'verified') { setStatus('verified'); return }
      if (data.status === 'processing') { setStatus('processing'); return }
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

  if (loading) return <main className="main-content"><p>Loading identity verification...</p></main>
  const verified = status === 'verified'
  const processing = status === 'processing'
  const canUseIdNumber = driverEligibilityContext && isDriver && isUsAccount

  return <main className="main-content" style={{ maxWidth: 680, margin: '0 auto', padding: 20 }}>
    <header><h1>{licensePurpose ? 'Verify Driver License' : driverEligibilityContext ? 'Driver Eligibility identity check' : 'Verify your identity'}</h1></header>
    <section className="panel">
      <h2>{driverEligibilityContext ? 'Secure identity options' : 'Identity verification'}</h2>
      <p>Stripe securely verifies government-issued identity documents. You can use a Driver License, state ID card, or passport where supported. Seatbelt does not receive or store your document image or ID number.</p>
      {licensePurpose && <p>This check verifies your Driver License and its expiration date. General identity verification and any Driver Eligibility identity-number check are separate.</p>}
      {driverEligibilityContext && <p>Driver mode separately requires a valid Driver License. An identity check by itself does not satisfy the Driver License requirement.</p>}
      {!driverEligibilityContext && <p>Riders and Drivers can verify here. Rider trip posting and ride acceptance require a verified identity.</p>}
      {error && <p role="alert">{error}</p>}
      {verified && <p role="status">Your identity is verified.</p>}
      {processing && <p role="status">Your verification is being processed. This page will update automatically.</p>}
      {!verified && !processing && <>
        {driverEligibilityContext ? <p>The U.S. ID-number check is completed inside Stripe. Seatbelt does not ask you to enter or store an SSN.</p> : <fieldset disabled={starting} style={{ border: 0, padding: 0, margin: '16px 0' }}>
          <legend>Choose a verification method</legend>
          <label style={{ display: 'block', margin: '10px 0' }}><input type="radio" name="verification-method" checked={method === 'document'} onChange={() => setMethod('document')} /> Government ID document (Driver License, ID card, or passport)</label>
        </fieldset>}
        {driverEligibilityContext && !canUseIdNumber && <p role="status">This check is available only to U.S. Driver accounts. General identity verification remains available from Settings.</p>}
        <button type="button" onClick={() => void startVerification()} disabled={starting || (driverEligibilityContext && !canUseIdNumber)}>{starting ? 'Opening secure verification...' : 'Continue to Stripe'}</button>
      </>}
      {processing && <button type="button" onClick={() => void refreshStatus()}>Refresh status</button>}
      {verified && (driverEligibilityContext || licensePurpose) && <p><a href="/driver-eligibility">Continue to Driver Eligibility</a></p>}
      {verified && !driverEligibilityContext && <p><a href="/feed">Continue to Seatbelt</a></p>}
    </section>
  </main>
}
