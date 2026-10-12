import { NextResponse, type NextRequest } from 'next/server'
import { action, body, check, context, fail, RideError, uuid } from '../rides/_server'
export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request)
    // No user-id parameter: only the current reviewee may read private reviews.
    const result = await ctx.db.from('ride_reviews').select('id,rating,comment,anonymous,reviewer_id,created_at').eq('reviewee_id', ctx.user.id).order('created_at', { ascending: false })
    check(result.error)
    const rows = result.data || []
    const namedIds = [...new Set(rows.filter(row => !row.anonymous).map(row => row.reviewer_id))]
    const profiles = namedIds.length ? await ctx.db.from('profiles').select('id,full_name').in('id', namedIds) : { data: [], error: null }
    check(profiles.error)
    const names = new Map((profiles.data || []).map(profile => [profile.id, profile.full_name]))
    return NextResponse.json({ reviews: rows.map(row => ({ id: row.id, rating: row.rating, comment: row.comment,
      anonymous: row.anonymous, reviewer_name: row.anonymous ? null : names.get(row.reviewer_id) || 'Participant', created_at: row.created_at })),
      average: rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : null })
  } catch (error) { return fail(error) }
}
export async function POST(request: NextRequest) {
  try {
    const ctx = await context(request), input = await body(request)
    const errors: string[] = []
    if (typeof input.rating !== 'number' || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.push('Choose a rating from 1 to 5.')
    if (input.comment !== undefined && (typeof input.comment !== 'string' || Array.from(input.comment).length > 1000)) errors.push('Comments can be up to 1,000 characters.')
    if (input.anonymous !== undefined && typeof input.anonymous !== 'boolean') errors.push('Choose a valid anonymity preference.')
    if (errors.length) throw new RideError(errors.join(' '))
    return NextResponse.json({ review: await action(ctx, 'review', { ride_id: uuid(input.ride_id), rating: input.rating, comment: input.comment || '', anonymous: input.anonymous === true }) }, { status: 201 })
  } catch (error) { return fail(error) }
}
