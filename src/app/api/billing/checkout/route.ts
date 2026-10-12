import { NextRequest, NextResponse } from 'next/server'
import { BillingError, BillingTier, billingBody, billingResponse, billingTiers, billingUrl, billingUser, currentSubscription, ensureBillingCustomer, getBillingStripe, requireActiveAccount, tierPrice, withBillingLock } from '@/lib/billing'
import { createServiceRoleClient } from '@/lib/supabaseServer'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const user = await billingUser(request, true)
    const body = await billingBody(request)
    if (typeof body.tier !== 'string' || !billingTiers.includes(body.tier as BillingTier)) throw new BillingError('Choose Bronze, Silver, or Gold.', 400)
    const tier = body.tier as BillingTier
    const priceId = tierPrice(tier)
    if (!priceId) throw new BillingError('This subscription tier is not configured yet.')
    const url = await withBillingLock(`user:${user.id}`, async () => {
      await requireActiveAccount(user.id)
      const stripe = getBillingStripe()
      const db = createServiceRoleClient()
      const customer = await ensureBillingCustomer(user.id)
      const sub = await currentSubscription(user.id)
      if (sub && !['canceled','incomplete_expired'].includes(sub.status)) throw new BillingError('You already have a subscription. Manage it before starting another.', 409)
      const price = await stripe.prices.retrieve(priceId)
      if (!price.active || !price.recurring || price.currency !== 'usd' || price.recurring.usage_type !== 'licensed' || price.unit_amount === null) {
        throw new BillingError('This subscription tier is not configured for USD recurring billing.')
      }
      const { data: existing, error: readError } = await db.from('billing_checkout_sessions').select('*').eq('user_id', user.id).maybeSingle()
      if (readError) throw readError
      if (existing?.session_id) {
        const session = await stripe.checkout.sessions.retrieve(existing.session_id)
        if (session.status === 'open' && existing.tier === tier && session.url) return session.url
        if (session.status === 'complete') throw new BillingError('Your completed checkout is being synchronized. Refresh your subscription shortly.', 409)
        if (session.status === 'open') await stripe.checkout.sessions.expire(session.id)
        const { error } = await db.from('billing_checkout_sessions').delete().eq('user_id', user.id)
        if (error) throw error
      } else if (existing && Date.now() - Date.parse(existing.created_at) > 20 * 3600000) {
        throw new BillingError('An earlier checkout needs reconciliation. Please contact support.', 409)
      }
      let operation = existing && !existing.session_id ? existing : null
      if (operation && operation.tier !== tier) throw new BillingError('Retry your previous tier to finish the pending checkout.', 409)
      if (!operation) {
        const { data, error } = await db.from('billing_checkout_sessions').insert({ user_id: user.id, tier }).select('*').single()
        if (error) throw error
        operation = data
      }
      const session = await stripe.checkout.sessions.create({ mode: 'subscription', customer,
        line_items: [{ price: priceId, quantity: 1 }], payment_method_types: ['card'],
        subscription_data: { metadata: { seatbelt_user_id: user.id } },
        success_url: billingUrl('/profile/settings/subscription?returned=checkout'),
        cancel_url: billingUrl('/profile/settings/subscription?returned=canceled'),
      }, { idempotencyKey: `seatbelt:subscription-checkout:${operation!.operation_id}` })
      const { error } = await db.from('billing_checkout_sessions').update({ session_id: session.id }).eq('user_id', user.id)
      if (error) throw error
      if (!session.url) throw new BillingError('Subscription checkout is temporarily unavailable.')
      return session.url
    })
    return NextResponse.json({ url })
  } catch (error) { return billingResponse(error) }
}
