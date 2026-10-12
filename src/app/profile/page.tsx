'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import AccountPage, { Feedback } from '@/components/AccountPage'
import { apiRequest } from '@/lib/apiClient'
import type { AccountData, AccountPreferences } from '@/lib/accountTypes'
import { DocumentNotices, ErrorSummary, FieldError, ResourceState, SignOutButton, clearValidField, invalidProps, requestError, useAccount, type FieldErrors } from './settings/_components'

const presenceColors = { online: '#6dba6d', away: '#e8bc59', busy: '#f87171', offline: '#aaa' }

function ProfileDetails({ data, update }: { data: AccountData; update: (data: AccountData) => void }) {
  const [presence, setPresence] = useState(data.preferences.presence_status)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<'presence' | 'portrait' | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const fileInput = useRef<HTMLInputElement>(null)
  function fileError(value: File | null) {
    if (!value) return 'Choose a portrait to upload.'
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.type)) return 'Choose a JPEG, PNG or WebP portrait.'
    if (!value.size || value.size > 4 * 1024 * 1024) return 'Portrait must be between 1 byte and 4 MB.'
    return ''
  }
  async function savePresence() {
    setBusy('presence'); setError(''); setSuccess('')
    try {
      await apiRequest('/api/account', { method: 'PATCH', body: JSON.stringify({ preferences: { presence_status: presence } }) })
      update({ ...data, preferences: { ...data.preferences, presence_status: presence } })
      setSuccess('Presence saved.')
    } catch (cause) { setError(requestError(cause)) } finally { setBusy(null) }
  }
  async function upload() {
    setSuccess(''); setError('')
    const message = fileError(file)
    setErrors(message ? { portrait: message } : {})
    if (message || !file) return
    setBusy('portrait')
    try {
      const form = new FormData(); form.append('file', file)
      const result = await apiRequest<{ avatarUrl: string }>('/api/account/avatar', { method: 'POST', body: form })
      update({ ...data, avatarUrl: result.avatarUrl }); setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      setSuccess('Portrait updated.')
    } catch (cause) { setError(requestError(cause)) } finally { setBusy(null) }
  }
  return <>
    <DocumentNotices account={data} />
    <section className="panel">
      <Feedback error={error} success={success} />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {data.avatarUrl ? <img src={data.avatarUrl} alt="Your portrait" width={88} height={88} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <div aria-label="No portrait uploaded" style={{ borderRadius: '50%', background: '#1a1a1a', border: '1px solid #c8b86a', padding: 24 }}>{data.profile.avatar_initials || 'You'}</div>}
        <div><h2>{data.profile.full_name || 'Your profile'}</h2><p>{data.email}</p><p><span aria-hidden="true" style={{ color: presenceColors[data.preferences.presence_status] }}>â— </span>{data.preferences.presence_status}</p></div>
      </div>
      <p className="muted">Your profile, portrait and presence.</p>
      <form onSubmit={event => { event.preventDefault(); void savePresence() }}>
        <label className="form-field" htmlFor="presence">Presence<select id="presence" value={presence} disabled={Boolean(busy)} onChange={event => setPresence(event.target.value as AccountPreferences['presence_status'])}>{Object.keys(presenceColors).map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
        <button className="primary-button" disabled={Boolean(busy)}>{busy === 'presence' ? 'Savingâ€¦' : 'Save presence'}</button>
      </form>
      <form noValidate onSubmit={event => { event.preventDefault(); void upload() }}>
        <ErrorSummary errors={errors} />
        <label className="form-field" htmlFor="portrait">Portrait<input ref={fileInput} id="portrait" type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} {...invalidProps('portrait', errors)} onChange={event => { const next = event.target.files?.[0] ?? null; setFile(next); clearValidField(setErrors, 'portrait', !fileError(next)) }} /></label>
        <FieldError id="portrait" errors={errors} />
        <p className="muted">Choose a selfie or portrait/bust image, not a full-body photo. JPEG, PNG or WebP, up to 4 MB.</p>
        <button className="primary-button" disabled={Boolean(busy)}>{busy === 'portrait' ? 'Uploadingâ€¦' : 'Upload portrait'}</button>
      </form>
    </section>
  </>
}

export default function ProfilePage() {
  const account = useAccount()
  return <AccountPage title="Your profile" showBack={false} action={<Link href="/profile/settings" className="settings-gear" aria-label="Settings" title="Settings"><span aria-hidden="true">âš™</span></Link>}><ResourceState loading={account.loading} error={account.error} retry={account.refresh}>{account.data && <ProfileDetails key={account.data.profile.id} data={account.data} update={account.setData} />}</ResourceState><SignOutButton /></AccountPage>
}
