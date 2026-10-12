'use client'

import { useState } from 'react'
import AccountPage, { Feedback, SettingsLink } from '@/components/AccountPage'
import { apiRequest } from '@/lib/apiClient'
import { ErrorSummary, FieldError, ResourceState, clearValidField, invalidProps, requestError, useAccount, type FieldErrors } from '../_components'

export default function PrivacyPage() {
  const account = useAccount()
  const [confirmation, setConfirmation] = useState(''), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [errors, setErrors] = useState<FieldErrors>({})
  async function stopSharing() {
    setBusy(true); setError(''); setSuccess('')
    try {
      await apiRequest('/api/location', { method: 'POST', body: JSON.stringify({ action: 'stop' }) })
      setSuccess('Location sharing stopped.'); await account.refresh()
    } catch (cause) { setError(requestError(cause)) } finally { setBusy(false) }
  }
  async function download() {
    setBusy(true); setError(''); setSuccess('')
    try {
      const data = await apiRequest<unknown>('/api/account/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'seatbelt-account-export.json'; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setSuccess('Your export is ready. Check your browser downloads.')
    } catch (cause) { setError(requestError(cause)) } finally { setBusy(false) }
  }
  async function requestDeletion() {
    setError(''); setSuccess('')
    if (confirmation !== 'DELETE') { setErrors({ confirmation: 'Type DELETE exactly to confirm your request.' }); return }
    setErrors({}); setBusy(true)
    try {
      const result = await apiRequest<{ message: string }>('/api/account', { method: 'POST', body: JSON.stringify({ action: 'request_deletion', confirmation }) })
      setSuccess(result.message); setConfirmation(''); await account.refresh()
    } catch (cause) { setError(requestError(cause)) } finally { setBusy(false) }
  }
  return <AccountPage title="Privacy & data"><Feedback error={error} success={success} /><ResourceState loading={account.loading} error={account.error} retry={account.refresh}>{account.data && <>
    <section className="panel"><h2>Location sharing</h2><p>Sharing preference: {account.data.preferences.location_sharing ? 'enabled' : 'off'}. A preference alone does not mean your device is currently sending a location.</p><button className="secondary-button" disabled={busy} onClick={() => void stopSharing()}>Stop location sharing</button><SettingsLink href="/nearby" title="Manage location on Nearby" /></section>
    <section className="panel"><h2>Download account data</h2><p>Download account details, preferences, and up to 1,000 recent rides and support requests as JSON. This file contains personal information. Request older records or other categories through privacy support.</p><button className="primary-button" disabled={busy} onClick={() => void download()}>{busy ? 'Processing…' : 'Download account export'}</button></section>
    <form className="panel" noValidate onSubmit={event => { event.preventDefault(); void requestDeletion() }}><ErrorSummary errors={errors} /><h2>Request account deletion</h2><p>A deletion request stops location sharing and awaits review and required retention checks. It does not immediately erase your data or cancel billing. Manage your subscription separately before requesting deletion.</p><SettingsLink href="/profile/settings/subscription" title="Manage subscription" />
      {account.data.preferences.account_state === 'deletion_requested' ? <p role="status">Your deletion request is recorded. Contact privacy support to check its progress.</p> : <><label className="form-field" htmlFor="confirmation">Type DELETE to confirm<input id="confirmation" value={confirmation} autoComplete="off" disabled={busy} {...invalidProps('confirmation', errors)} onChange={event => { setConfirmation(event.target.value); clearValidField(setErrors, 'confirmation', event.target.value === 'DELETE') }} /></label><FieldError id="confirmation" errors={errors} /><button className="secondary-button" disabled={busy}>{busy ? 'Processing…' : 'Request deletion'}</button></>}
    </form>
  </>}</ResourceState><SettingsLink href="/profile/settings/data-usage" title="How Seatbelt uses data" /><SettingsLink href="/profile/settings/support" title="Contact privacy support" /></AccountPage>
}
