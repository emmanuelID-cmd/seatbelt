import { NextResponse, type NextRequest } from 'next/server'
import { check, context, fail, RideError, session, tripColumns } from './_server'

export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request)
    const current = await session(ctx)
    const params = request.nextUrl.searchParams
    const role = params.get('role') || current.mode
    if (role !== 'rider' && role !== 'driver') throw new RideError('Choose Rider or Driver history.')
    if (role === 'driver' && current.accountRole !== 'driver' && current.accountRole !== 'both') throw new RideError('Driver history requires a Driver account.', 403)
    const from = params.get('from'), to = params.get('to')
    for (const date of [from, to]) {
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new RideError('Choose valid history dates.')
      if (date && date > new Date().toISOString().slice(0, 10)) throw new RideError('History dates cannot be in the future.')
    }
    if (from && to && from > to) throw new RideError('The end date must be on or after the start date.')
    const recent = params.get('recent') === 'true'
    const page = Number(params.get('page') || '0')
    if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw new RideError('Choose a valid history page.')
    let query = ctx.db.from('rides').select(`*,trip:trips(${tripColumns})`).eq(role === 'driver' ? 'driver_id' : 'rider_id', ctx.user.id)
    if (!recent && from) query = query.gte('created_at', `${from}T00:00:00Z`)
    if (!recent && to) query = query.lte('created_at', `${to}T23:59:59.999999Z`)
    const size = recent ? 10 : 50
    const offset = recent ? 0 : page * size
    const result = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + size)
    check(result.error)
    const rows = (result.data || []).slice(0, size)
    const reviews = rows.length ? await ctx.db.from('ride_reviews').select('ride_id').eq('reviewer_id', ctx.user.id).in('ride_id', rows.map(row => row.id)) : { data: [], error: null }
    check(reviews.error)
    const reviewed = new Set((reviews.data || []).map(row => row.ride_id))
    return NextResponse.json({ rides: rows.map(row => ({ ...row, reviewed: reviewed.has(row.id) })), session: current, role, hasMore: !recent && (result.data?.length || 0) > size })
  } catch (error) { return fail(error) }
}
