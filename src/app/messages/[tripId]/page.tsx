'use client'
import { Suspense, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AccountPage, { Feedback } from '@/components/AccountPage'
import { ErrorSummary, FieldError, invalidProps, ResourceState, requestError, useResource } from '@/app/profile/settings/_components'
import PaymentModal from '@/app/components/PaymentModal'
import FieldHelp from '@/components/FieldHelp'
import { apiRequest } from '@/lib/apiClient'
import { validateMessage } from '@/lib/inputValidation'
import { money, offerCents, type Conversation } from '@/lib/rides'

export default function MessagesPage() { return <Suspense fallback={<p role="status">Loading…</p>}><ConversationPage /></Suspense> }
function ConversationPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const other = useSearchParams().get('with')
  const [page, setPage] = useState(0)
  const resource = useResource<Conversation & { hasMore: boolean }>(`/api/rides/conversations/${encodeURIComponent(tripId)}?page=${page}${other ? `&with=${encodeURIComponent(other)}` : ''}`)
  const [message, setMessage] = useState('')
  const [amount, setAmount] = useState('')
  const [attempted, setAttempted] = useState<'message' | 'offer' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pay, setPay] = useState(false)
  const messageError = validateMessage(message)
  const cents = offerCents(amount)
  const errors: Record<string, string> = attempted === 'message' && messageError ? { message: messageError } : attempted === 'offer' && cents === null ? { amount: 'Enter a Wager Price of $1.00–$999.00 with up to two decimal places.' } : {}
  async function perform(path: string, payload: object, method = 'POST', completed = 'Saved.') {
    setBusy(true); setError(''); setSuccess('')
    try { await apiRequest(path, { method, body: JSON.stringify(payload) }); setSuccess(completed); await resource.refresh(); return true }
    catch (cause) { setError(requestError(cause)); return false } finally { setBusy(false) }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault(); setAttempted('message')
    if (messageError || !resource.data) return
    if (await perform(`/api/rides/conversations/${tripId}`, { other_id: resource.data.other.id, content: message }, 'POST', 'Message sent.')) { setMessage(''); setAttempted(null) }
  }
  async function offer(event: React.FormEvent) {
    event.preventDefault(); setAttempted('offer')
    if (cents === null || !resource.data) return
    if (await perform('/api/rides/offers', { trip_id: tripId, other_id: resource.data.other.id, amount_cents: cents }, 'POST', 'Offer sent. The Rider can accept it.')) setAttempted(null)
  }
  const data = resource.data
  return <AccountPage title={data?.other.full_name || 'Conversation'} back="/dms"><Feedback error={error} success={success} /><ResourceState {...resource} retry={resource.refresh}>
    {data && <>
      <section className="panel"><h2>{data.trip.origin || 'Driver availability'}{data.trip.destination ? ` → ${data.trip.destination}` : ''}</h2><button type="button" className="secondary-button" disabled={busy} onClick={() => void resource.refresh()}>Refresh conversation</button>
      {data.ride ? <><p>Ride: <strong>{data.ride.status.replace('_', ' ')}</strong> · Agreed Wager Price {money(data.ride.amount_cents, data.ride.currency_code)}</p><p>Accepted terms are locked.</p><div className="button-row">
        {data.isDriver && data.ride.status === 'accepted' && <button disabled={busy} className="primary-button" onClick={() => void perform(`/api/rides/${data.ride!.id}`, { action: 'start' }, 'PATCH', 'Ride started.')}>Start ride</button>}
        {data.isDriver && data.ride.status === 'in_progress' && <button disabled={busy} className="primary-button" onClick={() => void perform(`/api/rides/${data.ride!.id}`, { action: 'complete' }, 'PATCH', 'Ride completed.')}>Complete ride</button>}
        {data.ride.status === 'accepted' && <button disabled={busy} className="secondary-button" onClick={() => { if (window.confirm('Cancel this accepted ride?')) void perform(`/api/rides/${data.ride!.id}`, { action: 'cancel' }, 'PATCH', 'Ride canceled.') }}>Cancel ride</button>}
        {!data.isDriver && data.ride.status !== 'canceled' && <button disabled={busy} className="primary-button" onClick={() => setPay(true)}>Payment</button>}
        <Link href="/profile/settings/ride-history">History and optional review</Link>
      </div></> : <>
        {!data.trip.is_active && <p>This post is closed.</p>}
        {data.offers.map(item => <div key={item.id}><p>Driver offer: <strong>{money(item.amount_cents, item.currency_code)}</strong> · {item.status}</p>{!data.isDriver && item.status === 'pending' && data.trip.is_active && <button className="primary-button" disabled={busy} onClick={() => { if (window.confirm(`Accept the Driver's ${money(item.amount_cents, item.currency_code)} offer and confirm this ride?`)) void perform('/api/rides/accept', { trip_id: tripId, offer_id: item.id }, 'POST', 'Ride confirmed. The agreed price is locked.') }}>Accept Driver offer</button>}</div>)}
        {data.isDriver && data.trip.is_active && <form onSubmit={offer} noValidate><ErrorSummary errors={attempted === 'offer' ? errors : {}} /><div className="form-field"><label htmlFor="amount">Driver Wager Price offer (USD)</label><input id="amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} {...invalidProps('amount', errors)} /><small>$1.00–$999.00. Send a message first to establish this conversation.</small><FieldError id="amount" errors={errors} /></div><button className="primary-button" disabled={busy}>Send offer</button></form>}
      </>}
      </section>
      <section className="panel" aria-label="Messages">{data.messages.length === 0 && <p>No messages yet.</p>}{data.messages.map(item => <article key={item.id} style={{ padding: '10px 0', overflowWrap: 'anywhere' }}><strong>{item.sender_id === data.userId ? 'You' : data.other.full_name || 'Participant'}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{item.content}</p><small>{new Date(item.created_at).toLocaleString()}</small></article>)}
        <div className="button-row">{page > 0 && <button className="secondary-button" onClick={() => setPage(page - 1)}>Newer</button>}{data.hasMore && <button className="secondary-button" onClick={() => setPage(page + 1)}>Older</button>}</div>
      </section>
      <form className="panel" onSubmit={send} noValidate><ErrorSummary errors={attempted === 'message' ? errors : {}} /><div className="form-field"><label htmlFor="message">Message<FieldHelp fieldName="Message">Required. Up to 140 characters, including emoji.</FieldHelp></label><textarea id="message" value={message} onChange={e => setMessage(e.target.value)} {...invalidProps('message', errors)} /><FieldError id="message" errors={errors} /></div><button disabled={busy} className="primary-button">{busy ? 'Sending…' : 'Send message'}</button></form>
      {pay && data.ride && <PaymentModal rideId={data.ride.id} onCancel={() => setPay(false)} onSuccess={() => { setPay(false); setSuccess('Payment confirmed.'); void resource.refresh() }} />}
    </>}
  </ResourceState></AccountPage>
}
