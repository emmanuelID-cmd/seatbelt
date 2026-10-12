'use client'

import AccountPage, { SettingsLink } from '@/components/AccountPage'
import { ResourceState, useResource } from '../_components'

type Reviews = { reviews: { id: string; rating: number; comment: string; anonymous: boolean; reviewer_name: string | null; created_at: string }[]; average: number | null }

export default function ReviewsPage() {
  const reviews = useResource<Reviews>('/api/reviews')
  return <AccountPage title="My reviews"><p className="muted">Feedback received from your completed rides is private to your account.</p><ResourceState loading={reviews.loading} error={reviews.error} retry={reviews.refresh}>
    {reviews.data && <><section className="panel"><h2>Received feedback</h2><p>{reviews.data.average === null ? 'No reviews received yet.' : `Average rating: ${reviews.data.average.toFixed(1)} out of 5 (${reviews.data.reviews.length} reviews).`}</p></section>
      {reviews.data.reviews.map(review => <article className="panel" key={review.id}><h2>{review.rating} out of 5</h2><p>{review.anonymous ? 'Anonymous participant' : review.reviewer_name || 'Participant'} · <time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString()}</time></p><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{review.comment || 'No written comment.'}</p></article>)}</>}
  </ResourceState><SettingsLink href="/profile/settings/ride-history" title="Review a completed ride" /><SettingsLink href="/profile/settings/support" title="Get help with a review" /></AccountPage>
}
