'use client'

import { useState } from 'react'
import Link from 'next/link'
import AccountPage, { Feedback, SettingsLink } from '@/components/AccountPage'
import type { AccountData, AccountDetails } from '@/lib/accountTypes'
import { apiRequest } from '@/lib/apiClient'
import { formatUsPhoneDisplay, formatUsPhoneInput } from '@/lib/phone'
import { ErrorSummary, FieldError, ResourceState, SignOutButton, clearValidField, invalidProps, requestError, useAccount, type FieldErrors } from '../_components'

type EditableDetails = Omit<AccountDetails, 'user_id' | 'avatar_path'>
type DetailKey = keyof EditableDetails
const fields: { key: DetailKey; label: string; limit: number; required?: boolean; type?: string; autoComplete?: string }[] = [
  { key: 'legal_name', label: 'Legal name', limit: 32, required: true, autoComplete: 'name' },
  { key: 'address_line1', label: 'Address line 1', limit: 200, required: true, autoComplete: 'address-line1' },
  { key: 'address_line2', label: 'Address line 2', limit: 200, autoComplete: 'address-line2' },
  { key: 'city', label: 'City', limit: 100, required: true, autoComplete: 'address-level2' },
  { key: 'region', label: 'State / region', limit: 100, autoComplete: 'address-level1' },
  { key: 'postal_code', label: 'Postal code', limit: 20, required: true, autoComplete: 'postal-code' },
  { key: 'country', label: 'Country code', limit: 2, required: true, autoComplete: 'country' },
  { key: 'date_of_birth', label: 'Date of birth', limit: 10, required: true, type: 'date', autoComplete: 'bday' },
  { key: 'gender', label: 'Gender', limit: 64 },
  { key: 'phone', label: 'Phone number', limit: 14, type: 'tel', autoComplete: 'tel' },
  { key: 'social_handle', label: 'Social handle', limit: 100 },
]
const addressFieldKeys: DetailKey[] = ['address_line1', 'address_line2', 'city', 'region', 'postal_code', 'country']
const personalFields = fields.filter(field => !addressFieldKeys.includes(field.key))
const addressFields = fields.filter(field => addressFieldKeys.includes(field.key))

function validateDetails(value: EditableDetails): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of fields) {
    if (field.required && !value[field.key].trim()) errors[field.key] = `${field.label} is required.`
    else if (value[field.key].length > field.limit) errors[field.key] = `${field.label} must be at most ${field.limit} characters.`
  }
  if (value.legal_name && (!/^[\p{L}\p{M}\p{N}' -]{1,32}$/u.test(value.legal_name) || value.legal_name.trim().split(/\s+/).length > 4)) errors.legal_name = 'Legal name allows up to four name parts and 32 letters, numbers, spaces, apostrophes or hyphens.'
  if (value.country && !/^[A-Z]{2}$/.test(value.country)) errors.country = 'Enter a two-letter country code, such as US.'
  if (value.country === 'US') {
    if (!value.region.trim()) errors.region = 'State is required for a US address.'
    if (!/^\d{5}(-\d{4})?$/.test(value.postal_code)) errors.postal_code = 'Enter a five-digit ZIP code or ZIP+4.'
  }
  if (value.date_of_birth) {
    const dob = new Date(`${value.date_of_birth}T00:00:00Z`), adult = new Date()
    adult.setUTCFullYear(adult.getUTCFullYear() - 18)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date_of_birth) || !Number.isFinite(dob.getTime()) || dob.toISOString().slice(0, 10) !== value.date_of_birth || dob > adult || dob.getUTCFullYear() < 1900) errors.date_of_birth = 'Enter a valid birth date from 1900 onward. You must be at least 18.'
  }
  if (value.phone && !/^\(\d{3}\)-\d{3}-\d{4}$/.test(value.phone)) errors.phone = 'Enter a 10-digit U.S. phone number formatted as (XXX)-XXX-XXXX.'
  return errors
}

function AccountForm({ data, refresh }: { data: AccountData; refresh: () => Promise<AccountData | null> }) {
  const [details, setDetails] = useState<EditableDetails>(() => ({ legal_name: data.details.legal_name, address_line1: data.details.address_line1, address_line2: data.details.address_line2, city: data.details.city, region: data.details.region, postal_code: data.details.postal_code, country: data.details.country, date_of_birth: data.details.date_of_birth, phone: data.details.phone, social_handle: data.details.social_handle, gender: data.details.gender || '' }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState(''), [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false), [months, setMonths] = useState(1)
  const [confirmFreeze, setConfirmFreeze] = useState(false), [saved, setSaved] = useState(false), [editing, setEditing] = useState(false)
  const [addressOpen, setAddressOpen] = useState(false)
  async function save() {
    setError(''); setSuccess(''); setSaved(false)
    const trimmed = Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value.trim()])) as EditableDetails
    const next = validateDetails(trimmed); setErrors(next)
    if (Object.keys(next).length) {
      if (Object.keys(next).some(key => addressFieldKeys.includes(key as DetailKey))) setAddressOpen(true)
      return
    }
    setBusy(true)
    try {
      const submittedDetails = addressOpen ? trimmed : Object.fromEntries(Object.entries(trimmed).filter(([key]) => !addressFieldKeys.includes(key as DetailKey)))
      await apiRequest('/api/account', { method: 'PATCH', body: JSON.stringify({ details: submittedDetails }) })
      setDetails(trimmed); setAddressOpen(false); setEditing(false); setSuccess('Your account details are saved.'); setSaved(true)
    } catch (cause) { setError(requestError(cause)) } finally { setBusy(false) }
  }
  async function changeStatus(action: 'freeze' | 'resume') {
    setBusy(true); setError(''); setSuccess('')
    try {
      const result = await apiRequest<{ message: string }>('/api/account', { method: 'POST', body: JSON.stringify({ action, ...(action === 'freeze' ? { months } : {}) }) })
      setSuccess(result.message); setConfirmFreeze(false)
      await refresh()
    } catch (cause) { setError(requestError(cause)) } finally { setBusy(false) }
  }
  const savedPhone = formatUsPhoneDisplay(details.phone)
  const addressSaved = Boolean(details.address_line1)
  const addressSummary = [details.address_line1, details.address_line2, [details.city, details.region, details.postal_code].filter(Boolean).join(' '), details.country].filter(Boolean).join(', ')
  const visibleDetails = [
    data.email && { label: 'Email', value: data.email },
    details.legal_name && { label: 'Legal name', value: details.legal_name },
    details.date_of_birth && { label: 'Date of birth', value: details.date_of_birth },
    details.gender && { label: '⚧', value: details.gender, accessibleLabel: 'Gender' },
    savedPhone && { label: 'Phone', value: savedPhone },
    details.social_handle && { label: 'Social handle', value: details.social_handle },
    addressSaved && { label: 'Address', value: addressSummary },
  ].filter((item): item is { label: string; value: string; accessibleLabel?: string } => Boolean(item))
  return <>
    <section className="panel" aria-labelledby="account-personal-details-heading">
      <h2 id="account-personal-details-heading">Personal details</h2>
      {!editing && <Feedback error={error} success={success} />}
      {visibleDetails.length ? <dl className="personal-info-grid">{visibleDetails.map(item => <div className="personal-info-card" key={item.accessibleLabel || item.label}><dt>{item.accessibleLabel ? <span role="img" aria-label={item.accessibleLabel}>{item.label}</span> : item.label}</dt><dd>{item.value}</dd></div>)}</dl> : <p className="muted">No personal details have been added yet.</p>}
      <button type="button" className="secondary-button" aria-expanded={editing} aria-controls="account-details-editor" onClick={() => setEditing(open => !open)}>{editing ? 'Close editor' : visibleDetails.length ? 'Edit personal details' : 'Add personal details'}</button>
    </section>
    {editing && <form id="account-details-editor" className="panel" noValidate onSubmit={event => { event.preventDefault(); void save() }}>
      <ErrorSummary errors={errors} /><Feedback error={error} success={success} />
      <h2>Edit personal details</h2><p className="muted">Your sign-in email is {data.email}. Address details stay closed until you choose Change Address.</p>
      <fieldset disabled={busy} style={{ border: 0, padding: 0 }}><legend className="muted">Required fields are marked *</legend>
        {personalFields.map(field => <div key={field.key}>
          <label className="form-field" htmlFor={field.key}>{field.label}{field.required || (field.key === 'region' && details.country === 'US') ? ' *' : ''}
            <input id={field.key} type={field.type || 'text'} value={details[field.key]} maxLength={field.limit} autoComplete={field.autoComplete} required={field.required || (field.key === 'region' && details.country === 'US')} {...invalidProps(field.key, errors)} onChange={event => {
              const value = field.key === 'country' ? event.target.value.toUpperCase() : field.key === 'phone' ? formatUsPhoneInput(event.target.value) : event.target.value
              const next = { ...details, [field.key]: value }; setDetails(next); setSuccess(''); setSaved(false)
              clearValidField(setErrors, field.key, !validateDetails(next)[field.key])
            }} />
          </label>
          {field.key === 'country' && <p className="muted">Use a two-letter country code, such as US.</p>}
          {field.key === 'legal_name' && <p className="muted">Up to four name parts and 32 characters.</p>}
          {field.key === 'gender' && <p className="muted">Optional. Enter how you describe your gender; this stays private to your account.</p>}
          {field.key === 'phone' && <p className="muted">Use a 10-digit U.S. number. We format it as (XXX)-XXX-XXXX.</p>}
          <FieldError id={field.key} errors={errors} />
        </div>)}
      </fieldset>
      <section className="address-edit-section" aria-labelledby="account-address-heading">
        <div className="address-edit-heading"><div><h3 id="account-address-heading">Address</h3><p className="muted">{details.address_line1 ? 'An address is saved privately on your account.' : 'No address is saved yet.'}</p></div>
          <button type="button" className="secondary-button" aria-expanded={addressOpen} aria-controls="account-address-fields" onClick={() => setAddressOpen(open => !open)}>{addressOpen ? 'Hide Address' : 'Change Address'}</button>
        </div>
        <div id="account-address-fields" hidden={!addressOpen}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0 }}><legend className="muted">Address details</legend>
          {addressFields.map(field => <div key={field.key}>
            <label className="form-field" htmlFor={field.key}>{field.label}{field.required || (field.key === 'region' && details.country === 'US') ? ' *' : ''}
              <input id={field.key} type={field.type || 'text'} value={details[field.key]} maxLength={field.limit} autoComplete={field.autoComplete} required={field.required || (field.key === 'region' && details.country === 'US')} {...invalidProps(field.key, errors)} onChange={event => {
                const value = field.key === 'country' ? event.target.value.toUpperCase() : event.target.value
                const next = { ...details, [field.key]: value }; setDetails(next); setSuccess(''); setSaved(false)
                clearValidField(setErrors, field.key, !validateDetails(next)[field.key])
              }} />
            </label>
            {field.key === 'country' && <p className="muted">Use a two-letter country code, such as US.</p>}
            <FieldError id={field.key} errors={errors} />
          </div>)}
        </fieldset>
        </div>
      </section>
      <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save account details'}</button>
      {saved && <p><Link className="primary-button" href="/profile/settings">Continue — choose your session mode</Link></p>}
    </form>}
    <nav className="panel" aria-label="Account controls">
      <SettingsLink href="/profile/settings/account/identification" title="Profile & Identification" description="Your verification and Driver Eligibility documents" />
      <SettingsLink href="/profile" title="Portrait & presence" />
      <SettingsLink href="/profile/settings/security" title="Privacy & Security" />
      <SettingsLink href="/profile/settings/subscription" title="Subscription & billing" />
    </nav>
    <section className="panel"><h2>Account status</h2><p>{data.preferences.account_state.replaceAll('_', ' ')}</p>
      {data.preferences.frozen_until && <p>Frozen until {new Date(data.preferences.frozen_until).toLocaleDateString()}.</p>}
      {data.preferences.account_state === 'active' && <>
        <label className="form-field" htmlFor="freeze-months">Freeze duration<select id="freeze-months" value={months} disabled={busy} onChange={event => { setMonths(Number(event.target.value)); setConfirmFreeze(false) }}>{[1, 2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value} {value === 1 ? 'month' : 'months'}</option>)}</select></label>
        <p>Freezing requests a pause in subscription collection, stops location sharing and sets your presence to offline.</p>
        {!confirmFreeze ? <button className="secondary-button" disabled={busy} onClick={() => setConfirmFreeze(true)}>Review account freeze</button> : <div><p>Freeze your account for {months} {months === 1 ? 'month' : 'months'}?</p><button className="primary-button" disabled={busy} onClick={() => void changeStatus('freeze')}>Confirm freeze</button> <button className="secondary-button" disabled={busy} onClick={() => setConfirmFreeze(false)}>Cancel</button></div>}
      </>}
      {data.preferences.account_state === 'frozen' && <><p>Resuming also resumes subscription collection.</p><button className="primary-button" disabled={busy} onClick={() => void changeStatus('resume')}>{busy ? 'Resuming…' : 'Resume account and billing'}</button></>}
      {data.preferences.account_state === 'deletion_requested' && <p>Your deletion request is awaiting review. Contact privacy support for updates.</p>}
      <SettingsLink href="/profile/settings/privacy" title="Request account deletion" />
    </section>
  </>
}

export default function AccountSettingsPage() {
  const account = useAccount()
  return <AccountPage title="Account"><ResourceState loading={account.loading} error={account.error} retry={account.refresh}>{account.data && <AccountForm key={account.data.profile.id} data={account.data} refresh={account.refresh} />}</ResourceState><SignOutButton /></AccountPage>
}
