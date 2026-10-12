'use client'
import { useState } from 'react'
import Link from 'next/link'
import AccountPage, { Feedback } from '@/components/AccountPage'
import { ResourceState, requestError, useResource, SignOutButton } from '@/app/profile/settings/_components'
import { apiRequest } from '@/lib/apiClient'
import type { Trip } from '@/lib/supabase'
import { money, type RideSession } from '@/lib/rides'

export default function FeedPage() {
  const [mine, setMine] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const resource = useResource<{ trips: Trip[]; session: RideSession }>(`/api/rides/posts?mine=${mine}`)
  async function remove(id: string) {
    if (!window.confirm('Close this post? Pending offers will no longer be available.')) return
    setBusy(id); setError('')
    try { await apiRequest(`/api/rides/posts/${id}`, { method: 'DELETE' }); await resource.refresh() }
    catch (cause) { setError(requestError(cause)) } finally { setBusy('') }
  }
  return <AccountPage title="Feed" showBack={false}><div className="button-row"><Link className="primary-button" href="/post">Create post</Link><button className="secondary-button" aria-pressed={mine} onClick={() => setMine(!mine)}>{mine ? 'Browse posts' : 'My open posts'}</button><Link className="secondary-button" href="/profile/settings/ride-history">My rides</Link></div>
    <Feedback error={error} /><ResourceState {...resource} retry={resource.refresh}>
      <p className="status-note">{mine ? 'Your open posts' : resource.data?.session.mode === 'driver' ? 'Rider requests' : 'Available Driver posts'}</p>
      {resource.data?.trips.length === 0 && <section className="panel">No open posts found.</section>}
      {resource.data?.trips.map(trip => <article className="panel" key={trip.id}><h2>{trip.post_type === 'driver' ? 'Driver available' : `${trip.origin} → ${trip.destination}`}</h2>
        <p>{trip.seats_available} seat{trip.seats_available === 1 ? '' : 's'} · {trip.departure_time ? new Date(trip.departure_time).toLocaleString() : 'Available now'}</p>
        {trip.price_min != null && trip.price_max != null && <p>Estimated Wager Price: {money(Number(trip.price_min) * 100, 'USD')}–{money(Number(trip.price_max) * 100, 'USD')}</p>}
        {trip.notes && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{trip.notes}</p>}
        {mine ? <div className="button-row"><Link className="secondary-button" href={`/post?edit=${trip.id}`}>Edit post</Link><button className="secondary-button" disabled={busy === trip.id} onClick={() => void remove(trip.id)}>Close post</button><Link href="/dms">View conversations</Link></div> : <Link className="primary-button" href={`/messages/${trip.id}`}>{trip.post_type === 'driver' ? 'Message Driver' : 'Message Rider'}</Link>}
      </article>)}
    </ResourceState><SignOutButton /></AccountPage>
}
