'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AccountPage, { Feedback, SettingsLink } from '@/components/AccountPage'
import { apiRequest } from '@/lib/apiClient'
import { supabase } from '@/lib/supabase'
import { ResourceState, SignOutButton, requestError, useAccount } from './_components'

export default function ProfileSettingsPage() {
  const router = useRouter()
  const account = useAccount()
  const [mode, setMode] = useState<'rider' | 'driver' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminError, setAdminError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const result = await fetch('/api/admin/security', { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal })
      if (!controller.signal.aborted) {
        setIsAdmin(result.ok)
        if (!result.ok && result.status !== 403 && result.status !== 401) setAdminError('Administrator access could not be checked. Reload to try again.')
      }
    }).catch(() => { if (!controller.signal.aborted) setAdminError('Administrator access could not be checked. Reload to try again.') })
    return () => controller.abort()
  }, [])
  const profile = account.data?.profile
  const chosenMode = mode ?? (profile?.is_driver && profile.last_session_mode === 'driver' ? 'driver' : 'rider')
  async function saveMode() {
    if (!profile) return
    setError('')
    if (chosenMode === 'driver' && !profile.is_driver) { setError('Driver mode is not enabled for this account.'); return }
    setSaving(true)
    try {
      if (chosenMode === 'driver') {
        const result = await apiRequest<{ activated?: boolean; identityStatus?: string; driverLicenseStatus?: string; driverLicenseExpiresOn?: string | null }>('/api/driver-eligibility', { method: 'POST', body: JSON.stringify({ action: 'activate_driver_mode' }) })
        router.push(result.activated ? '/feed' : result.identityStatus !== 'verified' ? '/verify-identity' : result.driverLicenseStatus !== 'verified' || !result.driverLicenseExpiresOn ? '/verify-identity?purpose=driver_license' : '/driver-eligibility')
      } else {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user || user.id !== profile.id) throw new Error('Sign in again to change session mode.')
        const { error: updateError } = await supabase.from('profiles').update({ last_session_mode: 'rider' }).eq('id', user.id)
        if (updateError) throw new Error('Session mode could not be saved. Please try again.')
        router.push('/feed')
      }
    } catch (cause) { setError(requestError(cause)) }
    finally { setSaving(false) }
  }
  return <AccountPage title="Settings" back="/profile">
    <nav aria-label="Account settings" className="panel">
      <SettingsLink href="/profile/settings/account" title="Account" description="Personal details, identification and account status" />
      <SettingsLink href="/profile/settings/security" title="Privacy & Security" description="Change password and manage privacy" />
      <SettingsLink href="/profile/settings/notifications" title="Notifications" description="Message channels and updates" />
      <SettingsLink href="/profile/settings/payment" title="Payment" description="Payment methods and Driver payouts" />
      <SettingsLink href="/profile/settings/subscription" title="Subscription & billing" description="View your actual plan and billing status" />
      <SettingsLink href="/profile/settings/ride-history" title="Ride History" description="Your private ride agreements and reviews" />
      <SettingsLink href="/profile/settings/travel-history" title="Travel History" description="Your completed travel records" />
      <SettingsLink href="/profile/settings/support" title="Support" description="Questions, payment issues and appeals" />
      <SettingsLink href="/profile/settings/privacy" title="Privacy & data" description="Location sharing, export and account deletion requests" />
      <SettingsLink href="/profile/settings/guidance" title="Guidance" description="FAQs, DOs / DON'Ts and General Information" />
      <SettingsLink href="/profile/settings/data-usage" title="Data Usage" description="Data processing and privacy controls" />
    </nav>
    <ResourceState loading={account.loading} error={account.error} retry={account.refresh}>
      {profile && <form className="panel" noValidate onSubmit={event => { event.preventDefault(); void saveMode() }}>
        <h2>Session mode</h2><Feedback error={error} />
        <p className="muted">Choose how to use Seatbelt now. You will choose again when signing in.</p>
        <fieldset disabled={saving}><legend>Use Seatbelt as</legend>
          <label className="form-field"><input type="radio" name="mode" checked={chosenMode === 'rider'} onChange={() => setMode('rider')} /> Rider</label>
          <label className="form-field"><input type="radio" name="mode" disabled={!profile.is_driver} checked={chosenMode === 'driver'} onChange={() => setMode('driver')} /> Driver{!profile.is_driver && ' (not enabled for this account)'}</label>
        </fieldset>
        <button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save session mode'}</button>
      </form>}
      <Feedback error={adminError} />
      {isAdmin && <nav className="panel" aria-label="Administrator tools">
        <SettingsLink href="/admin/security" title="Administrator security" />
        <SettingsLink href="/admin/driver-eligibility" title="Driver eligibility review" />
        <SettingsLink href="/admin/analytics" title="Analytics" />
        <SettingsLink href="/admin/support" title="Support requests" />
      </nav>}
    </ResourceState>
    <SignOutButton />
  </AccountPage>
}
