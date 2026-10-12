import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { BillingError, billingResponse, currentSubscription, getBillingStripe, isoTime, stripeId, subscriptionSnapshot, withBillingLock } from '@/lib/billing'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
type LedgerEntry = { user_id: string; ride_id: string | null; type: 'payment' | 'expense' | 'refund'; amount_cents: number; source_object_id: string; occurred_at: string }

async function ownerForCustomer(customer: string | null) {
  if (!customer) return null
  const { data, error } = await createServiceRoleClient().from('billing_accounts').select('user_id').eq('customer_id', customer).maybeSingle()
  if (error) throw error
  return data?.user_id as string | undefined
}
async function applyEvent(eventId: string, payment: Record<string, unknown> | null, subscription: Record<string, unknown> | null, ledger: LedgerEntry[] = []) {
  const { error } = await createServiceRoleClient().rpc('apply_billing_event', {
    p_event_id: eventId, p_payment: payment, p_subscription: subscription, p_ledger: ledger,
  })
  if (error) throw error
}

async function paymentEvent(event: Stripe.Event, intentId: string, refundId?: string) {
  await withBillingLock(`intent:${intentId}`, async () => {
    const stripe = getBillingStripe()
    const intent = await stripe.paymentIntents.retrieve(intentId)
    const { data: payment, error } = await createServiceRoleClient().from('ride_payments').select('*').eq('payment_intent_id', intentId).maybeSingle()
    if (error) throw error
    if (!payment) {
      if (intent.metadata.seatbelt_ride_id) throw new BillingError('Payment mapping is awaiting synchronization.')
      return // Another product's Stripe payment, outside this billing integration.
    }
    if (intent.amount !== payment.amount_cents || intent.currency !== 'usd' || stripeId(intent.customer) !== payment.customer_id ||
      stripeId(intent.transfer_data?.destination) !== payment.destination_account_id) throw new BillingError('Payment agreement mismatch.')
    const chargeId = stripeId(intent.latest_charge)
    const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null
    const refunded = charge?.amount_refunded || 0
    const ledger: LedgerEntry[] = []
    if (intent.status === 'succeeded') {
      const common = { ride_id: payment.ride_id, amount_cents: intent.amount_received, source_object_id: intent.id, occurred_at: isoTime(charge?.created || intent.created)! }
      ledger.push({ ...common, user_id: payment.driver_id, type: 'payment' }, { ...common, user_id: payment.rider_id, type: 'expense' })
    }
    if (refundId) {
      const refund = await stripe.refunds.retrieve(refundId)
      if (stripeId(refund.payment_intent) !== intent.id || refund.currency !== 'usd') throw new BillingError('Refund agreement mismatch.')
      if (refund.status === 'succeeded') {
        const common = { ride_id: payment.ride_id, type: 'refund' as const, amount_cents: refund.amount, source_object_id: refund.id, occurred_at: isoTime(refund.created)! }
        ledger.push({ ...common, user_id: payment.driver_id }, { ...common, user_id: payment.rider_id })
      }
    }
    await applyEvent(event.id, { payment_intent_id: intent.id, status: refunded >= intent.amount ? 'refunded' : refunded > 0 ? 'partially_refunded' : intent.status, refunded_cents: refunded }, null, ledger)
  })
}

async function subscriptionEvent(event: Stripe.Event, customer: string | null, invoiceId?: string) {
  const userId = await ownerForCustomer(customer)
  if (!userId) return
  await withBillingLock(`user:${userId}`, async () => {
    // Retrieve current provider state, so delayed events cannot restore old state.
    let sub = await currentSubscription(userId)
    const db = createServiceRoleClient()
    const { data: preferences, error } = await db.from('account_preferences').select('account_state,frozen_until').eq('user_id', userId).maybeSingle()
    if (error) throw error
    // A hosted checkout may finish just as an account freeze commits. Enforce
    // that freeze on the resulting subscription as part of webhook reconciliation.
    if (sub && ['active','trialing'].includes(sub.status) && preferences && preferences.account_state !== 'active') {
      if (sub.pause_collection?.behavior !== 'void' || sub.pause_collection.resumes_at) {
        const stripe = getBillingStripe()
        await stripe.subscriptions.update(sub.id, { pause_collection: { behavior: 'void' } })
        sub = await stripe.subscriptions.retrieve(sub.id)
        if (sub.pause_collection?.behavior !== 'void' || sub.pause_collection.resumes_at) throw new BillingError('Account billing pause is not confirmed.')
      }
    }
    const ledger: LedgerEntry[] = []
    if (invoiceId) {
      const invoice = await getBillingStripe().invoices.retrieve(invoiceId)
      if (stripeId(invoice.customer) !== customer) throw new BillingError('Invoice ownership mismatch.')
      if (invoice.status === 'paid' && invoice.currency === 'usd' && invoice.amount_paid > 0) {
        ledger.push({ user_id: userId, ride_id: null, type: 'expense', amount_cents: invoice.amount_paid,
          source_object_id: invoice.id, occurred_at: isoTime(invoice.status_transitions.paid_at || invoice.created)! })
      }
    }
    await applyEvent(event.id, null, sub ? subscriptionSnapshot(userId, sub) : null, ledger)
    if (sub && !['canceled','incomplete_expired'].includes(sub.status)) {
      const { error: cleanupError } = await db.from('billing_checkout_sessions').delete().eq('user_id', userId)
      if (cleanupError) throw cleanupError
    }
  })
}

export async function POST(request: NextRequest) {
  let event: Stripe.Event
  try {
    const stripe = getBillingStripe()
    const signature = request.headers.get('stripe-signature')
    if (!signature) return NextResponse.json({ error: 'Missing webhook signature.' }, { status: 400 })
    const body = await request.text()
    const secrets = [process.env.STRIPE_BILLING_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter((value): value is string => Boolean(value))
    let verified: Stripe.Event | undefined
    for (const secret of secrets) {
      try { verified = stripe.webhooks.constructEvent(body, signature, secret); break } catch { /* Try the other endpoint signing secret. */ }
    }
    if (!verified) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 })
    event = verified
  } catch (error) { return billingResponse(error) }
  try {
    if (event.type === 'account.updated') {
      const account = event.data.object
      await withBillingLock(`connect:${account.id}`, async () => {
        const current = await getBillingStripe().accounts.retrieve(account.id)
        const { error } = await createServiceRoleClient().from('billing_accounts').update({
          payouts_enabled: current.payouts_enabled && current.details_submitted && current.capabilities?.transfers === 'active',
        }).eq('connect_account_id', current.id)
        if (error) throw error
      })
    } else if (!event.account) {
      switch (event.type) {
        case 'payment_intent.succeeded':
        case 'payment_intent.processing':
        case 'payment_intent.payment_failed':
        case 'payment_intent.canceled':
          await paymentEvent(event, event.data.object.id)
          break
        case 'refund.created':
        case 'refund.updated': {
          const intentId = stripeId(event.data.object.payment_intent)
          if (intentId) await paymentEvent(event, intentId, event.data.object.id)
          break
        }
        case 'charge.refunded': {
          const intentId = stripeId(event.data.object.payment_intent)
          if (intentId) await paymentEvent(event, intentId)
          break
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await subscriptionEvent(event, stripeId(event.data.object.customer))
          break
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          if (event.data.object.mode === 'subscription') await subscriptionEvent(event, stripeId(event.data.object.customer))
          break
        case 'invoice.paid':
        case 'invoice.payment_failed':
          if (event.data.object.parent?.subscription_details) await subscriptionEvent(event, stripeId(event.data.object.customer), event.data.object.id)
          break
      }
    }
    return NextResponse.json({ received: true })
  } catch {
    // Non-2xx causes Stripe retry; raw provider/database details never escape.
    return NextResponse.json({ error: 'Billing event processing is temporarily unavailable.' }, { status: 503 })
  }
}
