'use client'
import { useState } from 'react'
import Link from 'next/link'
import AccountPage from '@/components/AccountPage'
import { ResourceState, useResource } from '@/app/profile/settings/_components'

type Thread = { id: string; trip_id: string; other_id: string; other_name: string; content: string; created_at: string; trip: { origin: string | null; destination: string | null } | null }
export default function DMsPage() {
  const [page, setPage] = useState(0)
  const resource = useResource<{ conversations: Thread[]; hasMore: boolean }>(`/api/rides/conversations?page=${page}`)
  return <AccountPage title="Messages" back="/feed" showBack={false}><ResourceState {...resource} retry={resource.refresh}>
    <p className="status-note">Each conversation is private to its two participants.</p>
    {resource.data?.conversations.length === 0 && <section className="panel">No conversations yet. Open a post in the feed to send a message.</section>}
    {resource.data?.conversations.map(thread => <Link className="settings-link" key={`${thread.trip_id}:${thread.other_id}`} href={`/messages/${thread.trip_id}?with=${thread.other_id}`}><span><strong>{thread.other_name}</strong><small>{thread.trip?.origin || 'Driver availability'}{thread.trip?.destination ? ` → ${thread.trip.destination}` : ''}</small><small>{thread.content}</small><small>{new Date(thread.created_at).toLocaleString()}</small></span><span aria-hidden="true">›</span></Link>)}
    <div className="button-row">{page > 0 && <button className="secondary-button" onClick={() => setPage(page - 1)}>Newer messages</button>}{resource.data?.hasMore && <button className="secondary-button" onClick={() => setPage(page + 1)}>Older messages</button>}</div>
  </ResourceState></AccountPage>
}
