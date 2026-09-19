'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Profile } from '@/lib/supabase'

type SessionMode = 'rider' | 'driver'

export default function ProfileSettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mode, setMode] = useState<SessionMode>('rider')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileError || !data) {
        setError(profileError?.message || 'Your profile could not be loaded.')
        setLoading(false)
        return
      }

      const loadedProfile = data as Profile
      setProfile(loadedProfile)
      setMode(loadedProfile.last_session_mode === 'driver' && loadedProfile.is_driver ? 'driver' : 'rider')
      setLoading(false)
    })
  }, [router])

  async function saveMode() {
    if (!profile) return
    if (mode === 'driver' && !profile.is_driver) {
      setError('Driver mode is not enabled for this account.')
      return
    }

    setSaving(true)
    setError('')
    if (mode === 'driver') {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setSaving(false)
        setError('Sign in is required.')
        return
      }
      const response = await fetch('/api/driver-eligibility', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate_driver_mode' }),
      })
      const activation = await response.json() as { activated?: boolean; error?: string }
      setSaving(false)
      if (!response.ok) {
        setError(activation.error || 'Driver mode is temporarily unavailable. Please try again later.')
        return
      }
      router.push(activation.activated ? '/feed' : '/verify-identity')
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ last_session_mode: 'rider' })
      .eq('id', profile.id)
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push('/feed')
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#111', color: '#777' }}>Loading settings...</div>

  return (
    <main style={{ minHeight: '100vh', background: '#111', color: '#e0e0e0', padding: '16px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button type="button" onClick={() => router.push('/profile')} aria-label="Back to profile" style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '22px', cursor: 'pointer' }}>←</button>
          <h1 style={{ margin: 0, fontSize: '18px' }}>Settings</h1>
        </header>
        <section style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '16px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '16px' }}>Session mode</h2>
          <p style={{ margin: '0 0 18px', color: '#888', fontSize: '13px', lineHeight: 1.5 }}>Choose which side of Seatbelt you want to use right now. You will choose again whenever you sign in.</p>
          {error && <p role="alert" style={{ color: '#f87171', fontSize: '13px' }}>{error}</p>}
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ color: '#777', fontSize: '11px', letterSpacing: '0.5px' }}>USE SEATBELT AS</legend>
            <label style={{ display: 'flex', gap: '10px', padding: '12px 0', cursor: 'pointer' }}><input type="radio" name="settings-mode" checked={mode === 'rider'} onChange={() => setMode('rider')} /> Rider</label>
            <label style={{ display: 'flex', gap: '10px', padding: '12px 0', cursor: profile?.is_driver ? 'pointer' : 'not-allowed', color: profile?.is_driver ? '#e0e0e0' : '#666' }}><input type="radio" name="settings-mode" disabled={!profile?.is_driver} checked={mode === 'driver'} onChange={() => setMode('driver')} /> Driver {!profile?.is_driver && '(not enabled for this account)'}</label>
          </fieldset>
          <button type="button" onClick={() => void saveMode()} disabled={saving} style={{ width: '100%', marginTop: '12px', border: 0, borderRadius: '10px', padding: '13px', background: '#c8b86a', color: '#111', fontWeight: '700', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'SAVING...' : 'SAVE SESSION MODE'}</button>
        </section>
      </div>
    </main>
  )
}