'use client'

import { useState } from 'react'
import AccountPage, { Feedback, SettingsLink } from '@/components/AccountPage'
import { supabase } from '@/lib/supabase'
import { PASSWORD_ALLOWED_SYMBOLS, sanitizePassword, validatePassword } from '@/lib/inputValidation'
import { ErrorSummary, FieldError, clearValidField, invalidProps, type FieldErrors } from '../_components'

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState(''), [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState(''), [nonce, setNonce] = useState('')
  const [sent, setSent] = useState(false), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [success, setSuccess] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  async function sendCode() {
    setBusy(true); setError(''); setSuccess('')
    try {
      const { error: authError } = await supabase.auth.reauthenticate()
      if (authError) { setError('A verification code could not be sent. Check your sign-in session and try again.'); return }
      setSent(true); setNonce(''); setSuccess('Check your verified email or phone for the verification code.')
    } catch { setError('Verification is temporarily unavailable. Try again.') } finally { setBusy(false) }
  }
  async function changePassword() {
    setError(''); setSuccess('')
    const next: FieldErrors = {}
    if (!currentPassword) next['current-password'] = 'Enter your current password.'
    const passwordError = validatePassword(password)
    if (passwordError) next['new-password'] = passwordError
    else if (password === currentPassword) next['new-password'] = 'Choose a password different from your current password.'
    if (!confirmation || confirmation !== password) next['confirm-password'] = 'Confirm your new password exactly.'
    if (!sent || !nonce.trim()) next.nonce = 'Request a verification code, then enter it.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const { error: authError } = await supabase.auth.updateUser({ password, current_password: currentPassword, nonce: nonce.trim() })
      if (authError) { setError('Password was not changed. Check your current password and verification code, or request a new code.'); return }
      setCurrentPassword(''); setPassword(''); setConfirmation(''); setNonce(''); setSent(false)
      setSuccess('Your password has been changed.')
    } catch { setError('Password change is temporarily unavailable. Try again.') } finally { setBusy(false) }
  }
  return <AccountPage title="Privacy & Security">
    <form className="panel" noValidate onSubmit={event => { event.preventDefault(); void changePassword() }}>
      <ErrorSummary errors={errors} /><Feedback error={error} success={success} />
      <h2>Change password</h2>
      <fieldset disabled={busy} style={{ border: 0, padding: 0 }}><legend>Verify it is you</legend>
        <label className="form-field" htmlFor="current-password">Current password<input id="current-password" type="password" autoComplete="current-password" value={currentPassword} {...invalidProps('current-password', errors)} onChange={event => { setCurrentPassword(event.target.value); clearValidField(setErrors, 'current-password', Boolean(event.target.value)) }} /></label><FieldError id="current-password" errors={errors} />
        <label className="form-field" htmlFor="new-password">New password<input id="new-password" type="password" autoComplete="new-password" maxLength={32} value={password} {...invalidProps('new-password', errors)} onChange={event => { const value = sanitizePassword(event.target.value); setPassword(value); clearValidField(setErrors, 'new-password', !validatePassword(value) && value !== currentPassword) }} /></label><FieldError id="new-password" errors={errors} />
        <p className="muted">8–32 characters with uppercase, lowercase, a number and a symbol from {PASSWORD_ALLOWED_SYMBOLS}. Spaces and other symbols are not accepted.</p>
        <label className="form-field" htmlFor="confirm-password">Confirm new password<input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} maxLength={32} {...invalidProps('confirm-password', errors)} onChange={event => { setConfirmation(event.target.value); clearValidField(setErrors, 'confirm-password', Boolean(event.target.value) && event.target.value === password) }} /></label><FieldError id="confirm-password" errors={errors} />
        <button type="button" className="secondary-button" onClick={() => void sendCode()}>{sent ? 'Send a new verification code' : 'Send verification code'}</button>
        <label className="form-field" htmlFor="nonce">Verification code<input id="nonce" type="text" autoComplete="one-time-code" value={nonce} {...invalidProps('nonce', errors)} onChange={event => { setNonce(event.target.value); clearValidField(setErrors, 'nonce', sent && Boolean(event.target.value.trim())) }} /></label><FieldError id="nonce" errors={errors} />
      </fieldset>
      <button className="primary-button" disabled={busy}>{busy ? 'Processing…' : 'Change password'}</button>
    </form>
    <section className="panel"><h2>Additional sign-in options</h2><p>Passkeys and SMS authentication are not available yet. They require configured services before they can be enabled.</p><p>Administrator authenticator enrollment is available through Administrator security for authorized accounts. Ordinary email codes do not replace administrator MFA.</p></section>
    <SettingsLink href="/profile/settings/privacy" title="Privacy & data controls" />
    <SettingsLink href="/profile/settings/support" title="Get help with account security" />
  </AccountPage>
}
