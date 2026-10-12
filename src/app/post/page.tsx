'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AccountPage, { Feedback } from '@/components/AccountPage'
import { ErrorSummary, FieldError, invalidProps, ResourceState, requestError, useResource } from '@/app/profile/settings/_components'
import { apiRequest } from '@/lib/apiClient'
import { postErrors, type PostInput, type RideSession } from '@/lib/rides'
import type { Trip } from '@/lib/supabase'

export default function PostPage() { return <Suspense fallback={<p role="status">Loading…</p>}><PostLoader /></Suspense> }
function PostLoader() {
  const edit = useSearchParams().get('edit')
  const resource = useResource<{ session?: RideSession; trip?: Trip; locked?: boolean }>(edit ? `/api/rides/posts/${encodeURIComponent(edit)}` : '/api/rides/posts?mine=true')
  return <AccountPage title={edit ? 'Edit post' : 'Create post'} showBack={false}><ResourceState {...resource} retry={resource.refresh}>
    {resource.data?.locked ? <p className="panel">This post has an accepted ride. Its terms are locked.</p> : resource.data && <PostForm key={edit || 'new'} trip={resource.data.trip} mode={resource.data.trip?.post_type || resource.data.session?.mode || 'rider'} />}
  </ResourceState></AccountPage>
}
function PostForm({ trip, mode }: { trip?: Trip; mode: 'driver' | 'rider' }) {
  const router = useRouter()
  const initialDate = trip?.departure_time ? new Date(trip.departure_time) : null
  const scheduled = Boolean(initialDate)
  const localDate = initialDate ? new Date(initialDate.getTime() - initialDate.getTimezoneOffset() * 60000).toISOString() : ''
  const [origin, setOrigin] = useState(trip?.origin || '')
  const [destination, setDestination] = useState(trip?.destination || '')
  const [asap, setAsap] = useState(!scheduled)
  const [date, setDate] = useState(scheduled ? localDate.slice(0, 10) : '')
  const [time, setTime] = useState(scheduled ? localDate.slice(11, 16) : '')
  const [seats, setSeats] = useState(String(trip?.seats_available || 1))
  const [minimum, setMinimum] = useState(String(trip?.price_min ?? '1.00'))
  const [maximum, setMaximum] = useState(String(trip?.price_max ?? '1.00'))
  const [notes, setNotes] = useState(trip?.notes || '')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const departure = !asap && date && time ? new Date(`${date}T${time}`) : null
  const input: PostInput = { origin, destination, departure_time: asap ? null : departure && Number.isFinite(departure.getTime()) ? departure.toISOString() : '', seats_available: Number(seats), price_min: minimum.trim() ? Number(minimum) : null, price_max: maximum.trim() ? Number(maximum) : null, notes }
  const validation = postErrors(input, mode)
  const errors = attempted ? validation : {}
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setAttempted(true)
    if (Object.keys(validation).length) return
    setBusy(true); setError('')
    try { await apiRequest(trip ? `/api/rides/posts/${trip.id}` : '/api/rides/posts', { method: trip ? 'PATCH' : 'POST', body: JSON.stringify(input) }); router.push('/feed') }
    catch (cause) { setError(requestError(cause)) } finally { setBusy(false) }
  }
  return <form className="panel" onSubmit={submit} noValidate><h2>{mode === 'driver' ? 'Driver availability' : 'Rider request'}</h2><ErrorSummary errors={errors} /><Feedback error={error} />
    {mode === 'rider' && <>
      <div className="form-field"><label htmlFor="origin">Departure</label><input id="origin" value={origin} maxLength={200} onChange={e => setOrigin(e.target.value)} {...invalidProps('origin', errors)} /><FieldError id="origin" errors={errors} /></div>
      <div className="form-field"><label htmlFor="destination">Arrival</label><input id="destination" value={destination} maxLength={200} onChange={e => setDestination(e.target.value)} {...invalidProps('destination', errors)} /><FieldError id="destination" errors={errors} /></div>
      <label><input type="checkbox" checked={asap} onChange={e => setAsap(e.target.checked)} /> Present / ASAP</label>
      {!asap && <fieldset id="departure_time"><legend>Scheduled departure (your local time)</legend><div className="two-column"><div className="form-field"><label htmlFor="departure-date">Date</label><input id="departure-date" type="date" value={date} onChange={e => setDate(e.target.value)} {...invalidProps('departure_time', errors)} /></div><div className="form-field"><label htmlFor="departure-time">Time</label><input id="departure-time" type="time" value={time} onChange={e => setTime(e.target.value)} {...invalidProps('departure_time', errors)} /></div></div><FieldError id="departure_time" errors={errors} /></fieldset>}
      <p className="status-note">Estimated Wager Price: $1.00–$999.00. A Driver can offer above or below your estimate within these limits. You choose whether to accept.</p>
      <div className="two-column">{[{ id: 'price_min', label: 'Minimum Wager Price (USD)', value: minimum, set: setMinimum }, { id: 'price_max', label: 'Maximum Wager Price (USD)', value: maximum, set: setMaximum }].map(field => <div className="form-field" key={field.id}><label htmlFor={field.id}>{field.label}</label><input id={field.id} type="number" min="1" max="999" step="1" value={field.value} onChange={e => field.set(e.target.value)} {...invalidProps(field.id, errors)} /><FieldError id={field.id} errors={errors} /></div>)}</div>
    </>}
    <div className="form-field"><label htmlFor="seats_available">{mode === 'driver' ? 'Available seats' : 'Seats needed'}</label><input id="seats_available" type="number" min="1" max="4" step="1" value={seats} onChange={e => setSeats(e.target.value)} {...invalidProps('seats_available', errors)} /><FieldError id="seats_available" errors={errors} /></div>
    <div className="form-field"><label htmlFor="notes">Notes (optional, up to 280 characters)</label><textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} {...invalidProps('notes', errors)} /><FieldError id="notes" errors={errors} /></div>
    <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : trip ? 'Save changes' : 'Post'}</button>
  </form>
}
