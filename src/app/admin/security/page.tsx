'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TotpFactor = {
  id: string
  friendly_name?: string
}

type Enrollment = {
  factorId: string
  qrCode: string
  secret: string
  name: string
}

export default function AdminSecurityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [assuranceLevel, setAssuranceLevel] = useState<string | null>(null)
  const [factors, setFactors] = useState<TotpFactor[]>([])
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')

  const loadSecurity = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.replace('/login')
      return
    }

    const response = await fetch('/api/admin/security', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const status = await response.json() as { assuranceLevel?: string | null; error?: string }
    if (response.status === 403) {
      setAccessDenied(true)
      return
    }
    if (!response.ok) throw new Error(status.error || 'Administrator security is temporarily unavailable. Please try again later.')
    setAccessDenied(false)

    const [{ data: factorData, error: factorError }, { data: levelData, error: levelError }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
    if (factorError) throw factorError
    if (levelError) throw levelError

    setFactors(factorData.totp.map((factor) => ({ id: factor.id, friendly_name: factor.friendly_name })))
    setAssuranceLevel(levelData.currentLevel || status.assuranceLevel || null)
  }, [router])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSecurity().catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Administrator security is temporarily unavailable. Please try again later.')
      }).finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadSecurity])

  const primaryFactor = factors.find((factor) => factor.friendly_name === 'Seatbelt admin primary')
  const backupFactor = factors.find((factor) => factor.friendly_name === 'Seatbelt admin backup')
  const nextFactorName = primaryFactor ? 'Seatbelt admin backup' : 'Seatbelt admin primary'

  async function beginEnrollment() {
    setSaving(true)
    setError('')
    setCode('')
    setCodeError('')
    try {
      const { data: existingFactors, error: factorListError } = await supabase.auth.mfa.listFactors()
      if (factorListError) throw factorListError

      const abandonedFactor = existingFactors.all.find((factor) => (
        factor.status === 'unverified' && factor.friendly_name === nextFactorName
      ))
      if (abandonedFactor) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: abandonedFactor.id })
        if (unenrollError) throw unenrollError
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: nextFactorName,
      })
      if (enrollError || !data.totp) throw enrollError || new Error('Authenticator enrollment could not be started.')
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        name: nextFactorName === 'Seatbelt admin primary' ? 'Primary authenticator' : 'Backup authenticator',
      })
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : 'Authenticator enrollment could not be started.')
    } finally {
      setSaving(false)
    }
  }

  async function cancelEnrollment() {
    if (!enrollment) return
    setSaving(true)
    setError('')
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId })
      if (unenrollError) throw unenrollError
      setEnrollment(null)
      setCode('')
      setCodeError('')
      await loadSecurity()
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'The pending authenticator could not be removed.')
    } finally {
      setSaving(false)
    }
  }

  async function verifyAuthenticator(factorId: string, completesEnrollment: boolean) {
    const normalizedCode = code.replace(/\D/g, '')
    if (!/^\d{6}$/.test(normalizedCode)) {
      setCodeError('Enter the six-digit code from your authenticator app.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: normalizedCode,
      })
      if (verifyError) throw verifyError
      if (completesEnrollment) setEnrollment(null)
      setCode('')
      setCodeError('')
      await loadSecurity()
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'The authenticator code could not be verified.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#111', color: '#777' }}>Loading administrator security...</main>

  if (accessDenied) {
    return (
      <main style={{ minHeight: '100vh', background: '#111', color: '#e0e0e0', padding: '16px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <button type="button" onClick={() => router.push('/profile/settings')} aria-label="Back to settings" style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '22px', cursor: 'pointer' }}>←</button>
            <h1 style={{ margin: 0, fontSize: '18px' }}>Administrator security</h1>
          </header>
          <section style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '16px', padding: '20px' }}>
            <p role="alert" style={{ margin: 0, color: '#f87171', fontSize: '13px' }}>Administrator access is required.</p>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#111', color: '#e0e0e0', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button type="button" onClick={() => router.push('/profile/settings')} aria-label="Back to settings" style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '22px', cursor: 'pointer' }}>←</button>
          <h1 style={{ margin: 0, fontSize: '18px' }}>Administrator security</h1>
        </header>

        <section style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '16px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '16px' }}>Multi-factor authentication</h2>
          <p style={{ margin: '0 0 16px', color: '#888', fontSize: '13px', lineHeight: 1.5 }}>Administrator actions require a current password session plus a verified authenticator app code. Set up a primary authenticator and a backup authenticator stored separately.</p>

          {error && <p role="alert" style={{ margin: '0 0 14px', color: '#f87171', fontSize: '13px' }}>{error}</p>}

          <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
            <p style={{ margin: 0, color: assuranceLevel === 'aal2' ? '#6dba6d' : '#f8c96a', fontSize: '13px' }}>Current session: {assuranceLevel === 'aal2' ? 'MFA verified' : 'MFA verification required'}</p>
            <p style={{ margin: 0, color: primaryFactor ? '#6dba6d' : '#f87171', fontSize: '13px' }}>Primary authenticator: {primaryFactor ? 'verified' : 'not set up'}</p>
            <p style={{ margin: 0, color: backupFactor ? '#6dba6d' : '#f8c96a', fontSize: '13px' }}>Backup authenticator: {backupFactor ? 'verified' : 'not set up'}</p>
          </div>

          {!enrollment && !primaryFactor && (
            <button type="button" onClick={() => void beginEnrollment()} disabled={saving} style={{ width: '100%', border: 0, borderRadius: '10px', padding: '13px', background: '#c8b86a', color: '#111', fontWeight: '700', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'STARTING...' : 'SET UP PRIMARY AUTHENTICATOR'}
            </button>
          )}

          {!enrollment && primaryFactor && assuranceLevel !== 'aal2' && (
            <div style={{ borderTop: '0.5px solid #333', marginTop: '20px', paddingTop: '20px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '15px' }}>Verify this session</h3>
              <p style={{ margin: '0 0 14px', color: '#888', fontSize: '13px', lineHeight: 1.5 }}>Enter a code from your primary authenticator before accessing administrator-only actions.</p>
              <label htmlFor="session-authenticator-code" style={{ display: 'block', marginBottom: '5px', color: '#777', fontSize: '11px', letterSpacing: '0.5px' }}>AUTHENTICATOR CODE</label>
              <input id="session-authenticator-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => { const value = event.target.value.replace(/\D/g, '').slice(0, 6); setCode(value); if (/^\d{6}$/.test(value)) setCodeError('') }} aria-invalid={Boolean(codeError)} aria-describedby={codeError ? 'session-authenticator-code-error' : undefined} placeholder="6-digit code" maxLength={6} style={{ width: '100%', boxSizing: 'border-box', background: '#222', border: `0.5px solid ${codeError ? '#f87171' : '#333'}`, borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#e0e0e0', outline: 'none' }} />
              {codeError && <p id="session-authenticator-code-error" role="alert" style={{ margin: '6px 0 0', color: '#f87171', fontSize: '12px' }}>{codeError}</p>}
              <button type="button" onClick={() => void verifyAuthenticator(primaryFactor.id, false)} disabled={saving} style={{ width: '100%', marginTop: '14px', border: 0, borderRadius: '10px', padding: '13px', background: '#c8b86a', color: '#111', fontWeight: '700', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'VERIFYING...' : 'VERIFY CURRENT SESSION'}</button>
            </div>
          )}

          {!enrollment && primaryFactor && !backupFactor && assuranceLevel === 'aal2' && (
            <button type="button" onClick={() => void beginEnrollment()} disabled={saving} style={{ width: '100%', marginTop: '14px', border: 0, borderRadius: '10px', padding: '13px', background: '#c8b86a', color: '#111', fontWeight: '700', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'STARTING...' : 'ADD BACKUP AUTHENTICATOR'}
            </button>
          )}

          {enrollment && (
            <div style={{ borderTop: '0.5px solid #333', marginTop: '20px', paddingTop: '20px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '15px' }}>Set up your {enrollment.name.toLowerCase()}</h3>
              <p style={{ margin: '0 0 14px', color: '#888', fontSize: '13px', lineHeight: 1.5 }}>Scan this QR code with an authenticator app. Use a separate app or device for the backup authenticator where possible.</p>
              <div style={{ display: 'grid', placeItems: 'center', padding: '14px', marginBottom: '14px', background: '#fff', borderRadius: '10px' }}>
                {/* Supabase returns this enrollment QR code as an in-memory SVG data URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrollment.qrCode} alt={`QR code for ${enrollment.name.toLowerCase()}`} width={180} height={180} />
              </div>
              <p style={{ margin: '0 0 14px', color: '#888', fontSize: '12px', lineHeight: 1.5 }}>If scanning is unavailable, enter this setup key manually: <code style={{ color: '#e0e0e0', overflowWrap: 'anywhere' }}>{enrollment.secret}</code></p>
              <label htmlFor="authenticator-code" style={{ display: 'block', marginBottom: '5px', color: '#777', fontSize: '11px', letterSpacing: '0.5px' }}>AUTHENTICATOR CODE</label>
              <input id="authenticator-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => { const value = event.target.value.replace(/\D/g, '').slice(0, 6); setCode(value); if (/^\d{6}$/.test(value)) setCodeError('') }} aria-invalid={Boolean(codeError)} aria-describedby={codeError ? 'authenticator-code-error' : undefined} placeholder="6-digit code" maxLength={6} style={{ width: '100%', boxSizing: 'border-box', background: '#222', border: `0.5px solid ${codeError ? '#f87171' : '#333'}`, borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#e0e0e0', outline: 'none' }} />
              {codeError && <p id="authenticator-code-error" role="alert" style={{ margin: '6px 0 0', color: '#f87171', fontSize: '12px' }}>{codeError}</p>}
              <button type="button" onClick={() => void verifyAuthenticator(enrollment.factorId, true)} disabled={saving} style={{ width: '100%', marginTop: '14px', border: 0, borderRadius: '10px', padding: '13px', background: '#c8b86a', color: '#111', fontWeight: '700', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'VERIFYING...' : 'VERIFY AUTHENTICATOR'}</button>
              <button type="button" onClick={() => void cancelEnrollment()} disabled={saving} style={{ width: '100%', marginTop: '10px', border: '0.5px solid #555', borderRadius: '10px', padding: '11px', background: 'transparent', color: '#aaa', fontWeight: '700', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>CANCEL SETUP</button>
            </div>
          )}

          {backupFactor && <p style={{ margin: '18px 0 0', color: '#6dba6d', fontSize: '13px' }}>Both required authenticators are verified. Future administrator-only operations will require an MFA-verified session.</p>}
        </section>
      </div>
    </main>
  )
}