'use client'

import { useState } from 'react'
import AccountPage, { Feedback } from '@/components/AccountPage'
import { apiRequest } from '@/lib/apiClient'
import { ErrorSummary, FieldError, ResourceState, clearValidField, invalidProps, requestError, useResource, type FieldErrors } from '../_components'

type Ticket = { id: string; category: string; subject: string; message: string; status: string; response: string | null; created_at: string; updated_at: string }

export default function SupportPage() {
  const requests = useResource<{ tickets: Ticket[] }>('/api/support')
  const [category, setCategory] = useState('general'), [subject, setSubject] = useState(''), [message, setMessage] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({}), [error, setError] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false)
  async function submit() {
    setError(''); setSuccess('')
    const next: FieldErrors = {}
    if (!subject.trim() || subject.trim().length > 120) next.subject = 'Enter a subject from 1 to 120 characters.'
    if (!message.trim() || message.trim().length > 2000) next.message = 'Enter a message from 1 to 2,000 characters.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const result = await apiRequest<{ id: string }>('/api/support', { method: 'POST', body: JSON.stringify({ category, subject: subject.trim(), message: message.trim() }) })
      setSubject(''); setMessage(''); setSuccess(`Your request was saved. Reference: ${result.id}. Check its status below.`)
      await requests.refresh()
    } catch (cause) { setError(requestError(cause)) } finally { setBusy(false) }
  }
  return <AccountPage title="Support, disputes & appeals">
    <p>For an emergency, contact local emergency services first. This inbox is not an emergency service.</p>
    <form className="panel" noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
      <ErrorSummary errors={errors} /><Feedback error={error} success={success} />
      <h2>Send a request</h2><p>For a payment dispute or appeal, include the ride or payment reference, relevant dates and the outcome you are requesting. Do not send passwords, full card numbers or identity-document images.</p>
      <fieldset disabled={busy} style={{ border: 0, padding: 0 }}><legend>Request details</legend>
        <label className="form-field" htmlFor="support-category">Category<select id="support-category" value={category} onChange={event => setCategory(event.target.value)}><option value="general">General help</option><option value="payment">Payment dispute or refund request</option><option value="appeal">Account, eligibility or refund appeal</option><option value="privacy">Privacy or data request</option></select></label>
        <label className="form-field" htmlFor="subject">Subject *<input id="subject" value={subject} required maxLength={120} {...invalidProps('subject', errors)} onChange={event => { setSubject(event.target.value); clearValidField(setErrors, 'subject', Boolean(event.target.value.trim()) && event.target.value.trim().length <= 120) }} /></label><FieldError id="subject" errors={errors} />
        <label className="form-field" htmlFor="message">Message *<textarea id="message" value={message} required rows={7} maxLength={2000} {...invalidProps('message', errors)} onChange={event => { setMessage(event.target.value); clearValidField(setErrors, 'message', Boolean(event.target.value.trim()) && event.target.value.trim().length <= 2000) }} /></label><FieldError id="message" errors={errors} /><p className="muted">Subject: up to 120 characters. Message: up to 2,000 characters. Attachments are unavailable.</p>
      </fieldset><button className="primary-button" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
    </form>
    <section className="panel"><h2>Your requests</h2><p>Submission records a request; it does not automatically approve a refund or change a decision.</p><button className="secondary-button" type="button" disabled={requests.loading} onClick={() => void requests.refresh()}>Refresh requests</button></section>
    <ResourceState loading={requests.loading} error={requests.error} retry={requests.refresh}>{requests.data && (requests.data.tickets.length ? requests.data.tickets.map(ticket => <article className="panel" key={ticket.id}><h2 style={{ overflowWrap: 'anywhere' }}>{ticket.subject}</h2><p>{ticket.status.replaceAll('_', ' ')} · {new Date(ticket.created_at).toLocaleDateString()}</p><p className="muted" style={{ overflowWrap: 'anywhere' }}>Reference: {ticket.id}</p><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{ticket.message}</p>{ticket.response ? <><h3>Response</h3><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{ticket.response}</p></> : <p>No response recorded yet.</p>}</article>) : <p className="status-note">You have no support requests.</p>)}</ResourceState>
  </AccountPage>
}
