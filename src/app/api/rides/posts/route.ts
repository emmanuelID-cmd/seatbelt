import { NextResponse, type NextRequest } from 'next/server'
import { action, body, check, context, fail, postInput, session, tripColumns } from '../_server'
export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request), current = await session(ctx)
    let query = ctx.db.from('trips').select(tripColumns).eq('is_active', true)
    if (request.nextUrl.searchParams.get('mine') === 'true') query = query.or(`driver_id.eq.${ctx.user.id},rider_id.eq.${ctx.user.id}`)
    else query = query.eq('post_type', current.mode === 'rider' ? 'driver' : 'rider')
    const result = await query.order('created_at', { ascending: false }).limit(100)
    check(result.error)
    let trips = result.data || []
    if (request.nextUrl.searchParams.get('mine') !== 'true' && trips.length) {
      const ids = [...new Set(trips.map(trip => trip.post_type === 'driver' ? trip.driver_id : trip.rider_id).filter((id): id is string => Boolean(id)))]
      const active = await ctx.db.from('account_preferences').select('user_id').in('user_id', ids).eq('account_state', 'active')
      check(active.error)
      const allowed = new Set((active.data || []).map(row => row.user_id))
      if (current.mode === 'rider') {
        const eligible = await Promise.all([...allowed].map(async id => {
          const result = await ctx.db.rpc('seatbelt_driver_eligible', { p_user: id })
          check(result.error)
          return { id, allowed: result.data === true }
        }))
        eligible.forEach(item => { if (!item.allowed) allowed.delete(item.id) })
      }
      trips = trips.filter(trip => allowed.has(trip.post_type === 'driver' ? trip.driver_id : trip.rider_id))
    }
    return NextResponse.json({ trips, session: current })
  } catch (error) { return fail(error) }
}
export async function POST(request: NextRequest) {
  try {
    const ctx = await context(request), current = await session(ctx)
    return NextResponse.json({ trip: await action(ctx, 'create_post', { ...postInput(await body(request), current.mode) }) }, { status: 201 })
  } catch (error) { return fail(error) }
}
