'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/apiClient'
import { supabase } from '@/lib/supabase'
import type { AccountData } from '@/lib/accountTypes'
import { Feedback } from '@/components/AccountPage'

export function requestError(error: unknown) {
  return error instanceof Error && !(error instanceof TypeError) ? error.message : 'This service is temporarily unavailable. Please try again.'
}

export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    controller.current?.abort()
    const next = new AbortController()
    controller.current = next
    setLoading(true)
    setError('')
    try {
      const result = await apiRequest<T>(path, { signal: next.signal })
      if (!next.signal.aborted) setData(result)
      return result
    } catch (cause) {
      if (!next.signal.aborted) { setError(requestError(cause)); setData(null) }
      return null
    } finally { if (!next.signal.aborted) setLoading(false) }
  }, [path])
  useEffect(() => {
    let userId: string | undefined
    const timer = window.setTimeout(() => void refresh(), 0)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') userId = session?.user.id
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && userId && userId !== session?.user.id)) {
        controller.current?.abort()
        setData(null)
        setLoading(false)
        setError('Your session changed. Sign in again to load your account.')
      }
    })
    return () => { window.clearTimeout(timer); controller.current?.abort(); subscription.unsubscribe() }
  }, [refresh])
  return { data, setData, loading, error, refresh }
}

export function useAccount() { return useResource<AccountData>('/api/account') }

export function ResourceState({ loading, error, retry, children }: { loading: boolean; error: string; retry: () => unknown; children: ReactNode }) {
  if (loading) return <p role="status" className="status-note">Loading…</p>
  if (error) return <section className="panel"><Feedback error={error} /><button type="button" className="secondary-button" onClick={() => void retry()}>Try again</button><p><Link href="/login">Sign in</Link></p></section>
  return <>{children}</>
}

export type FieldErrors = Record<string, string>
export function ErrorSummary({ errors }: { errors: FieldErrors }) {
  const entries = Object.entries(errors).filter(([, message]) => message)
  const summary = useRef<HTMLDivElement>(null)
  const count = entries.length
  const previousCount = useRef(0)
  useEffect(() => {
    if (count > previousCount.current) summary.current?.focus()
    previousCount.current = count
  }, [count])
  if (!entries.length) return null
  return <div ref={summary} className="form-error-summary" role="alert" tabIndex={-1}><p>Please correct the following:</p><ul>{entries.map(([id, message]) => <li key={id}><a href={`#${id}`}>{message}</a></li>)}</ul></div>
}
export function FieldError({ id, errors }: { id: string; errors: FieldErrors }) {
  return errors[id] ? <p id={`${id}-error`} className="field-error">{errors[id]}</p> : null
}
export function invalidProps(id: string, errors: FieldErrors) {
  return { 'aria-invalid': Boolean(errors[id]), 'aria-describedby': errors[id] ? `${id}-error` : undefined, style: errors[id] ? { borderColor: '#f87171', outlineColor: '#f87171' } : undefined }
}
export function clearValidField(setErrors: (update: (old: FieldErrors) => FieldErrors) => void, id: string, valid: boolean) {
  if (valid) setErrors(old => { if (!old[id]) return old; const next = { ...old }; delete next[id]; return next })
}

export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function signOut() {
    setBusy(true)
    setError('')
    try {
      await apiRequest('/api/location', { method: 'POST', body: JSON.stringify({ action: 'stop' }), signal: AbortSignal.timeout(5000) }).catch(() => undefined)
      const result = await supabase.auth.signOut()
      if (result.error) { setError('Sign out could not finish. Please try again.'); return }
      router.replace('/login')
      router.refresh()
    } catch { setError('Sign out could not finish. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="panel"><Feedback error={error} /><button className="secondary-button" type="button" onClick={() => void signOut()} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button></section>
}

function calendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const result = new Date(year, month - 1, day)
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null
}
function addCalendarMonths(date: Date, months: number) {
  const end = new Date(date.getFullYear(), date.getMonth() + months + 1, 0)
  return new Date(end.getFullYear(), end.getMonth(), Math.min(date.getDate(), end.getDate()))
}
export function DocumentNotices({ account }: { account: AccountData }) {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setToday(new Date()), 60000); return () => window.clearInterval(timer) }, [])
  if (!account.profile.is_driver) return null
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const month = addCalendarMonths(start, 1), year = addCalendarMonths(start, 12)
  const documents = [
    ...(account.eligibility ? [
      { name: 'Vehicle registration', date: account.eligibility.registration_expires_on, status: account.eligibility.registration_status, expiryUnconfirmed: false },
      { name: 'Vehicle insurance', date: account.eligibility.insurance_expires_on, status: account.eligibility.insurance_status, expiryUnconfirmed: false },
    ] : []),
    { name: 'Driver License', date: account.driverLicense?.license_expires_on || null, status: account.driverLicense?.status || 'not_started', expiryUnconfirmed: account.driverLicense?.status === 'verified' && !account.driverLicense.license_expires_on },
  ]
  return <>{documents.map(document => {
    const expiration = document.date ? calendarDate(document.date) : null
    const expired = document.status === 'expired' || Boolean(expiration && expiration < start)
    if (!expired && !document.expiryUnconfirmed && (!expiration || expiration > year)) return null
    const urgent = expired || Boolean(expiration && expiration <= month)
    return <aside key={document.name} className="status-note" role={urgent ? 'alert' : 'status'} style={{ border: `1px solid ${urgent ? '#f87171' : '#c8b86a'}`, padding: 12, borderRadius: 8 }}>
      <strong>{document.name}: {document.expiryUnconfirmed ? 'expiration not confirmed' : expired ? 'expired' : 'renewal approaching'}</strong>
      <p>{document.date && `Expiration: ${document.date}. `}{document.expiryUnconfirmed ? 'Stripe has not returned the expiration date, so Driver mode remains unavailable until results access is configured.' : expired ? 'Driver access requires current, reviewed documents.' : 'Arrange renewal before the expiration date.'} This notice remains until updated documentation is reviewed.</p>
      {document.name === 'Vehicle registration' || document.name === 'Driver License' ? <a href="https://www.usa.gov/state-motor-vehicle-services" target="_blank" rel="noopener noreferrer">Find your state motor vehicle services (opens a new tab)</a> : document.name === 'Vehicle insurance' ? <p>Contact your insurer to renew your coverage.</p> : null}
      <p><Link href="/driver-eligibility">Review or update Driver Eligibility documents</Link></p>
    </aside>
  })}</>
}
