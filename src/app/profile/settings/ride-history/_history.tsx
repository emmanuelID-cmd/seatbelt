'use client'
import { useState } from 'react'
import Link from 'next/link'
import AccountPage, { Feedback } from '@/components/AccountPage'
import { ErrorSummary, FieldError, invalidProps, ResourceState, requestError, useResource } from '../_components'
import { apiRequest } from '@/lib/apiClient'
import { money, type Ride, type RideSession } from '@/lib/rides'

export function History({ travel = false }: { travel?: boolean }) {
  const [role, setRole] = useState<'rider' | 'driver'>('rider')
  const [recent, setRecent] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('recent=true')
  const [page, setPage] = useState(0)
  const [attempted, setAttempted] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const errors: Record<string, string> = {}
  if (attempted && !recent) {
    if (from > today) errors.from = 'Start date cannot be in the future.'
    if (to > today) errors.to = 'End date cannot be in the future.'
    if (from && to && from > to) errors.to = 'End date must be on or after start date.'
  }
  const resource = useResource<{ rides: Ride[]; session: RideSession; hasMore: boolean }>(`/api/rides?role=${role}&${query}&page=${page}`)
  function filter(event: React.FormEvent) {
    event.preventDefault(); setAttempted(true)
    if (!recent && (from > today || to > today || (from && to && from > to))) return
    setPage(0); setQuery(recent ? 'recent=true' : `from=${from}&to=${to}`)
  }
  const driverAccount = resource.data?.session.accountRole === 'driver' || resource.data?.session.accountRole === 'both'
  return <AccountPage title={travel ? 'Travel History' : 'Ride History'}>
    <p className="status-note">Your private ride records. Dates filter when rides were accepted (UTC). {travel ? 'Distance appears only when verified trip data is available.' : 'Completed rides can receive one optional review from each participant.'}</p>
    <div className="button-row"><button className="secondary-button" aria-pressed={role === 'rider'} onClick={() => { setRole('rider'); setPage(0) }}>Rider</button>{driverAccount && <button className="secondary-button" aria-pressed={role === 'driver'} onClick={() => { setRole('driver'); setPage(0) }}>Driver</button>}</div>
    <form className="panel" onSubmit={filter} noValidate><ErrorSummary errors={errors} /><label><input type="checkbox" checked={recent} onChange={e => setRecent(e.target.checked)} /> Most recent ten rides</label>
      {!recent && <div className="two-column">{[{ id: 'from', label: 'Start date', value: from, set: setFrom }, { id: 'to', label: 'End date', value: to, set: setTo }].map(field => <div className="form-field" key={field.id}><label htmlFor={field.id}>{field.label}</label><input id={field.id} type="date" max={today} value={field.value} onChange={e => field.set(e.target.value)} {...invalidProps(field.id, errors)} /><FieldError id={field.id} errors={errors} /></div>)}</div>}
      <button className="primary-button">Apply dates</button>
    </form>
    <ResourceState {...resource} retry={resource.refresh}>{resource.data?.rides.length === 0 && <p className="panel">No rides found for these dates.</p>}
      {resource.data?.rides.map(ride => <article className="panel" key={ride.id}><h2>{ride.trip?.origin || 'Ride'}{ride.trip?.destination ? ` → ${ride.trip.destination}` : ''}</h2><p><strong>{ride.status.replace('_', ' ')}</strong> · {money(ride.amount_cents, ride.currency_code)}</p><p>Accepted: {new Date(ride.created_at).toLocaleString()}</p>{ride.started_at && <p>Started: {new Date(ride.started_at).toLocaleString()}</p>}{ride.completed_at && <p>Completed: {new Date(ride.completed_at).toLocaleString()}</p>}{ride.canceled_at && <p>Canceled: {new Date(ride.canceled_at).toLocaleString()}</p>}
        {travel && <p>{ride.distance_meters === null ? 'Verified distance is not available for this ride.' : `Verified distance: ${(ride.distance_meters / 1000).toFixed(2)} km`}</p>}
        <Link className="secondary-button" href={`/messages/${ride.trip_id}?with=${role === 'driver' ? ride.rider_id : ride.driver_id}`}>Open ride conversation</Link>
        {!travel && ride.status === 'completed' && (ride.reviewed ? <p className="status-note">Your review was saved.</p> : <ReviewForm ride={ride} refresh={resource.refresh} />)}
      </article>)}
      <div className="button-row">{page > 0 && <button className="secondary-button" onClick={() => setPage(page - 1)}>Newer rides</button>}{resource.data?.hasMore && <button className="secondary-button" onClick={() => setPage(page + 1)}>Older rides</button>}</div>
    </ResourceState>
  </AccountPage>
}
function ReviewForm({ ride, refresh }: { ride: Ride; refresh: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState('')
  const [comment, setComment] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ratingId = `rating-${ride.id}`, commentId = `comment-${ride.id}`
  const errors: Record<string, string> = {}
  if (attempted && !/^[1-5]$/.test(rating)) errors[ratingId] = 'Choose a rating from 1 to 5.'
  if (attempted && Array.from(comment).length > 1000) errors[commentId] = 'Keep your comment within 1,000 characters.'
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setAttempted(true)
    if (!/^[1-5]$/.test(rating) || Array.from(comment).length > 1000) return
    setBusy(true); setError('')
    try { await apiRequest('/api/reviews', { method: 'POST', body: JSON.stringify({ ride_id: ride.id, rating: Number(rating), comment, anonymous }) }); await refresh() }
    catch (cause) { setError(requestError(cause)) } finally { setBusy(false) }
  }
  if (!open) return <button className="secondary-button" onClick={() => setOpen(true)}>Leave optional review</button>
  return <form onSubmit={submit} noValidate><h3>Review the other participant</h3><p className="status-note">Only the reviewed account can see this review. Anonymous reviews hide your name; your wording may still identify you.</p><ErrorSummary errors={errors} /><Feedback error={error} /><div className="form-field"><label htmlFor={ratingId}>Rating</label><select id={ratingId} value={rating} onChange={e => setRating(e.target.value)} {...invalidProps(ratingId, errors)}><option value="">Choose a rating</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select><FieldError id={ratingId} errors={errors} /></div><div className="form-field"><label htmlFor={commentId}>Comment (optional, up to 1,000 characters)</label><textarea id={commentId} value={comment} onChange={e => setComment(e.target.value)} {...invalidProps(commentId, errors)} /><FieldError id={commentId} errors={errors} /></div><label><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /> Hide my name</label><div className="button-row"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Submit review'}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div></form>
}
