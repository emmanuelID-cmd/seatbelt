import { NextRequest, NextResponse } from 'next/server'
import { BillingError, billingResponse, billingUser } from '@/lib/billing'
import { createServiceRoleClient } from '@/lib/supabaseServer'
export async function GET(request: NextRequest) {
  try {
    const user = await billingUser(request)
    const rideId = request.nextUrl.searchParams.get('rideId')
    if (!rideId || !/^[0-9a-f-]{36}$/i.test(rideId)) throw new BillingError('Choose a valid ride.', 400)
    const { data, error } = await createServiceRoleClient().from('ride_payments').select('status,amount_cents,currency_code,refunded_cents').eq('ride_id', rideId).eq('rider_id', user.id).maybeSingle()
    if (error) throw error
    if (!data) throw new BillingError('Payment not found.', 404)
    return NextResponse.json({ status: data.status, amountCents: data.amount_cents, currency: data.currency_code, refundedCents: data.refunded_cents }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return billingResponse(error) }
}
