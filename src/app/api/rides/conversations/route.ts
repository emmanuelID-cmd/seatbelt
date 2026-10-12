import { NextResponse, type NextRequest } from 'next/server'
import { check, context, fail, RideError } from '../_server'
export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request)
    const page = Number(request.nextUrl.searchParams.get('page') || '0')
    if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw new RideError('Choose a valid message page.')
    const result = await ctx.db.from('messages').select('id,trip_id,sender_id,receiver_id,content,created_at')
      .or(`sender_id.eq.${ctx.user.id},receiver_id.eq.${ctx.user.id}`).order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 100, page * 100 + 100)
    check(result.error)
    const seen = new Set<string>()
    const rows = (result.data || []).slice(0, 100).filter(row => {
      const other = row.sender_id === ctx.user.id ? row.receiver_id : row.sender_id
      const key = `${row.trip_id}:${other}`
      if (!row.trip_id || !other || seen.has(key)) return false
      seen.add(key); return true
    })
    const conversations = await Promise.all(rows.map(async row => {
      const otherId = row.sender_id === ctx.user.id ? row.receiver_id : row.sender_id
      const [profile, trip] = await Promise.all([
        ctx.db.from('profiles').select('full_name').eq('id', otherId).maybeSingle(),
        ctx.db.from('trips').select('origin,destination').eq('id', row.trip_id).maybeSingle(),
      ])
      check(profile.error); check(trip.error)
      return { ...row, other_id: otherId, other_name: profile.data?.full_name || 'Participant', trip: trip.data }
    }))
    return NextResponse.json({ conversations, hasMore: (result.data?.length || 0) > 100 })
  } catch (error) { return fail(error) }
}
