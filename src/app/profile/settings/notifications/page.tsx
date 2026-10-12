'use client'

import { useState } from 'react'
import AccountPage, { Feedback, SettingsLink } from '@/components/AccountPage'
import type { AccountData, NotificationPreferences } from '@/lib/accountTypes'
import { apiRequest } from '@/lib/apiClient'
import { ResourceState, requestError, useAccount } from '../_components'

const groups: { title: string; options: { key: keyof NotificationPreferences; label: string; unavailable?: boolean }[] }[] = [
  { title: 'Rider messages', options: [{ key: 'rider_messages_in_app', label: 'In-app alerts' }, { key: 'rider_messages_email', label: 'Email alerts' }, { key: 'rider_messages_sms', label: 'Text alerts — unavailable', unavailable: true }] },
  { title: 'Driver messages', options: [{ key: 'driver_messages_in_app', label: 'In-app alerts' }, { key: 'driver_messages_email', label: 'Email alerts' }, { key: 'driver_messages_sms', label: 'Text alerts — unavailable', unavailable: true }] },
  { title: 'Optional communications', options: [{ key: 'newsletter', label: 'Newsletter' }, { key: 'updates', label: 'Product updates' }, { key: 'promotions', label: 'Promotions' }, { key: 'payment_reminders', label: 'Payment and renewal reminders' }] },
]

function Preferences({ data }: { data: AccountData }) {
  const [preferences, setPreferences] = useState({ ...data.notifications, rider_messages_sms: false, driver_messages_sms: false })
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  async function save() {
    setBusy(true); setError(''); setSuccess('')
    try {
      await apiRequest('/api/account', { method: 'PATCH', body: JSON.stringify({ notifications: preferences }) })
      setSuccess('Notification preferences saved. Delivery depends on the available channels.')
    } catch (cause) { setError(requestError(cause)) } finally { setBusy(false) }
  }
  return <form className="panel" onSubmit={event => { event.preventDefault(); void save() }}>
    <Feedback error={error} success={success} />
    <p>Choose the optional notices you want to receive. Essential account, security and service notices may still be sent.</p>
    {groups.map(group => <fieldset key={group.title} disabled={busy}><legend>{group.title}</legend>{group.options.map(option => <label className="form-field" key={option.key}><input type="checkbox" checked={preferences[option.key]} disabled={option.unavailable} onChange={event => { setPreferences(old => ({ ...old, [option.key]: event.target.checked })); setSuccess('') }} />{option.label}</label>)}</fieldset>)}
    <p className="muted">Text messaging is not configured. Email delivery requires an active sender service. Saving a preference does not confirm delivery.</p>
    <p className="status-note">Browser push alerts are not available yet. Use the in-app notification inbox.</p>
    <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
  </form>
}

export default function NotificationsSettingsPage() {
  const account = useAccount()
  return <AccountPage title="Notifications"><ResourceState loading={account.loading} error={account.error} retry={account.refresh}>{account.data && <Preferences key={account.data.profile.id} data={account.data} />}</ResourceState><SettingsLink href="/notifications" title="Open notification inbox" /></AccountPage>
}
