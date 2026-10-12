import { NextRequest, NextResponse } from 'next/server'
import { BillingError, billingBody, billingResponse, billingUser, ensureBillingCustomer, getBillingStripe, requireActiveAccount, requireDriverPayouts, stripeId, withBillingLock } from '@/lib/billing'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const user = await billingUser(request, true)
    const { rideId } = await billingBody(request)
    if (typeof rideId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rideId)) throw new BillingError('Choose a valid accepted ride.', 400)
    const db = createServiceRoleClient()
    const { data: ride, error } = await db.from('rides').select('id,trip_id,rider_id,driver_id,amount_cents,currency_code,status').eq('id', rideId).eq('rider_id', user.id).maybeSingle()
    if (error) throw error
    if (!ride) throw new BillingError('Ride not found.', 404)
    if (!['accepted','in_progress','completed'].includes(ride.status)) throw new BillingError('Only an accepted ride can be paid.', 409)
    if (ride.currency_code !== 'USD' || !Number.isInteger(ride.amount_cents) || ride.amount_cents < 100 || ride.amount_cents > 99900 || ride.driver_id === user.id) {
      throw new BillingError('This ride is not eligible for USD payment.', 409)
    }
    const destination = await requireDriverPayouts(ride.driver_id)
    const result = await withBillingLock(`user:${user.id}`, async () => {
      await requireActiveAccount(user.id)
      const customer = await ensureBillingCustomer(user.id)
      return withBillingLock(`ride:${rideId}`, async () => {
      const stripe = getBillingStripe()
      const { error: reserveError } = await db.from('ride_payments').upsert({ ride_id: ride.id, rider_id: user.id, driver_id: ride.driver_id,
        amount_cents: ride.amount_cents, currency_code: 'USD', destination_account_id: destination, customer_id: customer }, { onConflict: 'ride_id', ignoreDuplicates: true })
      if (reserveError) throw reserveError
      const { data: payment, error: readError } = await db.from('ride_payments').select('*').eq('ride_id', ride.id).single()
      if (readError) throw readError
      if (payment.rider_id !== user.id || payment.driver_id !== ride.driver_id || payment.amount_cents !== ride.amount_cents || payment.destination_account_id !== destination) {
        throw new BillingError('The payment agreement needs review. Please contact support.', 409)
      }
      // Stripe can discard idempotency keys after 24 hours. Never recreate an
      // unresolved operation outside the retry window; reconcile it instead.
      if (!payment.payment_intent_id && Date.now() - Date.parse(payment.created_at) > 20 * 3600000) {
        throw new BillingError('An earlier payment attempt needs reconciliation. Please contact support.', 409)
      }
      const intent = payment.payment_intent_id ? await stripe.paymentIntents.retrieve(payment.payment_intent_id) :
        await stripe.paymentIntents.create({ amount: payment.amount_cents, currency: 'usd', customer: payment.customer_id,
          payment_method_types: ['card'], transfer_data: { destination: payment.destination_account_id },
          metadata: { seatbelt_ride_id: ride.id },
        }, { idempotencyKey: `seatbelt:ride:${ride.id}` })
      if (intent.amount !== payment.amount_cents || intent.currency !== 'usd' || stripeId(intent.customer) !== payment.customer_id || stripeId(intent.transfer_data?.destination) !== destination) {
        throw new BillingError('The payment provider agreement needs review. Please contact support.', 409)
      }
      if (!payment.payment_intent_id) {
        const { error: saveError } = await db.from('ride_payments').update({ payment_intent_id: intent.id }).eq('ride_id', ride.id)
        if (saveError) throw saveError
      }
      if (intent.status === 'canceled') throw new BillingError('This payment was canceled. Please contact support before retrying.', 409)
      return { clientSecret: ['succeeded','processing'].includes(intent.status) ? null : intent.client_secret,
        status: intent.status, amountCents: payment.amount_cents, currency: 'USD' }
      })
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return billingResponse(error) }
}
