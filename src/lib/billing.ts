import 'server-only'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, getAuthenticatedUser } from '@/lib/supabaseServer'

export class BillingError extends Error {
  constructor(message: string, public status = 503) { super(message) }
}
export function billingResponse(error: unknown) {
  return NextResponse.json({ error: error instanceof BillingError ? error.message : 'Billing is temporarily unavailable. Please try again.' },
    { status: error instanceof BillingError ? error.status : 503, headers: { 'Cache-Control': 'no-store' } })
}
export function billingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_BILLING_WEBHOOK_SECRET && process.env.BILLING_APP_URL)
}
export function getBillingStripe() {
  if (!billingConfigured()) throw new BillingError('Billing is not configured yet.')
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia', timeout: 20000, maxNetworkRetries: 1 })
}
export function billingUrl(path: string) {
  const value = process.env.BILLING_APP_URL
  if (!value) throw new BillingError('Billing return addresses are not configured yet.')
  const url = new URL(value)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) {
    throw new BillingError('Billing return addresses are not configured correctly.')
  }
  return new URL(path, url.origin).toString()
}
export async function billingUser(request: NextRequest, active = false) {
  const user = await getAuthenticatedUser(request)
  if (!user || user.is_anonymous) throw new BillingError('Please sign in again to continue.', 401)
  if (active) await requireActiveAccount(user.id)
  return user
}
export async function billingBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
    return body
  } catch { throw new BillingError('Submit a valid request.', 400) }
}
export async function requireActiveAccount(userId: string) {
  const { data, error } = await createServiceRoleClient().from('account_preferences').select('account_state').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) throw new BillingError('Set up your Account before starting a payment or subscription.', 409)
  if (data.account_state !== 'active') throw new BillingError('Reactivate your account before starting a payment or subscription.', 409)
}
export async function withBillingLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  const db = createServiceRoleClient()
  const token = randomUUID()
  const { data, error } = await db.rpc('claim_billing_operation', { p_key: key, p_token: token })
  if (error) throw error
  if (!data) throw new BillingError('A billing update is already in progress. Try again shortly.', 409)
  try { return await action() }
  finally { await db.from('billing_operation_locks').delete().eq('operation_key', key).eq('token', token) }
}
export async function billingAccount(userId: string) {
  const { data, error } = await createServiceRoleClient().from('billing_accounts')
    .select('user_id,customer_id,connect_account_id,payouts_enabled').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data as { user_id: string; customer_id: string | null; connect_account_id: string | null; payouts_enabled: boolean } | null
}
// Call inside the user billing lock; persist ownership before hosted redirects.
export async function ensureBillingCustomer(userId: string) {
  const existing = await billingAccount(userId)
  if (existing?.customer_id) return existing.customer_id
  const customer = await getBillingStripe().customers.create({ metadata: { seatbelt_user_id: userId } }, { idempotencyKey: `seatbelt:customer:${userId}` })
  const { error } = await createServiceRoleClient().from('billing_accounts').upsert({ user_id: userId, customer_id: customer.id }, { onConflict: 'user_id' })
  if (error) throw error
  return customer.id
}
export const billingTiers = ['BRONZE', 'SILVER', 'GOLD'] as const
export type BillingTier = typeof billingTiers[number]
export function tierPrice(tier: BillingTier) { return process.env[`STRIPE_PRICE_${tier}`]?.trim() || null }
export function tierForSubscription(subscription: Stripe.Subscription): BillingTier | null {
  const price = subscription.items.data[0]?.price.id
  return billingTiers.find(tier => tierPrice(tier) === price) || null
}
export function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id || null
}
export function isoTime(value: number | null | undefined) { return value ? new Date(value * 1000).toISOString() : null }
export async function currentSubscription(userId: string) {
  const account = await billingAccount(userId)
  const { data: saved, error } = await createServiceRoleClient().from('billing_subscriptions').select('subscription_id,status').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!account?.customer_id) {
    if (saved) throw new BillingError('Subscription ownership could not be verified. Please contact support.')
    return null
  }
  const subscriptions = await getBillingStripe().subscriptions.list({ customer: account.customer_id, status: 'all', limit: 100 })
  if (subscriptions.has_more) throw new BillingError('Subscription history needs review. Please contact support.')
  const active = subscriptions.data.filter(sub => !['canceled', 'incomplete_expired'].includes(sub.status))
  if (active.length > 1) throw new BillingError('Multiple subscriptions need review. Please contact support.')
  return active[0] || subscriptions.data[0] || null
}
export function subscriptionSnapshot(userId: string, subscription: Stripe.Subscription) {
  return {
    user_id: userId, subscription_id: subscription.id, tier: tierForSubscription(subscription), status: subscription.status,
    started_at: isoTime(subscription.start_date), renewal_at: isoTime(subscription.items.data[0]?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end, frozen_until: isoTime(subscription.pause_collection?.resumes_at),
  }
}
function freezeDate(until: string) {
  const date = new Date(until)
  const now = new Date()
  const max = new Date(now)
  max.setUTCMonth(max.getUTCMonth() + 6)
  if (!Number.isFinite(date.getTime()) || date <= now || date > max) throw new BillingError('Choose a freeze end date within the next six months.', 400)
  return Math.floor(date.getTime() / 1000)
}
async function changeCollection(userId: string, until: string | null, automaticResume = true) {
  const resumesAt = until === null ? null : freezeDate(until)
  const sub = await currentSubscription(userId)
  if (!sub || ['canceled', 'incomplete_expired'].includes(sub.status)) return null
  if (!['active', 'trialing'].includes(sub.status)) throw new BillingError('Resolve the subscription payment status before changing its freeze.', 409)
  if (sub.schedule) throw new BillingError('This subscription schedule must be managed through support.', 409)
  if (resumesAt && sub.cancel_at_period_end) throw new BillingError('This subscription is already scheduled to end.', 409)
  const stripe = getBillingStripe()
  if (resumesAt) {
    // Stripe can retry older invoices even while collection is paused.
    const invoices = await stripe.invoices.list({ subscription: sub.id, limit: 100 })
    if (invoices.has_more || invoices.data.some(invoice => ['open', 'draft'].includes(invoice.status || '') && invoice.amount_remaining > 0)) {
      throw new BillingError('Resolve outstanding invoices before freezing billing.', 409)
    }
  }
  const desiredResume = automaticResume ? resumesAt : null
  if ((resumesAt && sub.pause_collection?.behavior === 'void' && (sub.pause_collection.resumes_at || null) === desiredResume) || (!resumesAt && !sub.pause_collection)) return sub
  // This does not create an invoice or initiate a charge. Future billing follows
  // the existing cadence; invoices generated during the pause are voided.
  await stripe.subscriptions.update(sub.id, { pause_collection: resumesAt ? { behavior: 'void', ...(desiredResume ? { resumes_at: desiredResume } : {}) } : '' })
  const confirmed = await stripe.subscriptions.retrieve(sub.id)
  if (resumesAt ? confirmed.pause_collection?.behavior !== 'void' || (confirmed.pause_collection.resumes_at || null) !== desiredResume : Boolean(confirmed.pause_collection)) {
    throw new BillingError('The provider has not confirmed this billing change. Refresh your subscription and try again.', 409)
  }
  return confirmed
}
/** Server-only. Caller authorizes userId and awaits this before changing account
 * state. No subscription is a no-op; provider/configuration failures reject. */
export type AccountBillingPauseResult = { status: 'paused' | 'resumed' | 'no_subscription'; subscriptionId: string | null }
export async function setAccountBillingPause(userId: string, until: string | null, finalize?: (result: AccountBillingPauseResult) => Promise<void>): Promise<AccountBillingPauseResult> {
  return withBillingLock(`user:${userId}`, async () => {
    // Account freeze expiration is resumed by the account lifecycle worker.
    // No provider timer can restart billing after a deletion request.
    const sub = await changeCollection(userId, until, false)
    const result: AccountBillingPauseResult = { status: sub ? until ? 'paused' : 'resumed' : 'no_subscription', subscriptionId: sub?.id || null }
    try { await finalize?.(result) }
    catch (error) {
      if (sub && until === null) {
        try {
          const stripe = getBillingStripe()
          await stripe.subscriptions.update(sub.id, { pause_collection: { behavior: 'void' } })
          const restored = await stripe.subscriptions.retrieve(sub.id)
          if (restored.pause_collection?.behavior !== 'void' || restored.pause_collection.resumes_at) throw new Error('Pause not restored')
        } catch {
          throw new BillingError('Account reactivation could not be saved, and billing may have resumed. Review your subscription and contact support before retrying.')
        }
        throw new BillingError('Account reactivation could not be saved. Subscription collection remains paused. Please try again.')
      }
      throw error
    }
    return result
  })
}
export async function changeSubscription(userId: string, action: 'cancel' | 'freeze' | 'resume', until?: string) {
  return withBillingLock(`user:${userId}`, async () => {
    if (action !== 'cancel') {
      await requireActiveAccount(userId)
      if (action === 'freeze' && !until) throw new BillingError('Choose a freeze duration.', 400)
      const sub = await changeCollection(userId, action === 'freeze' ? until! : null)
      if (!sub) throw new BillingError('There is no current subscription to update.', 409)
      return subscriptionSnapshot(userId, sub)
    }
    const sub = await currentSubscription(userId)
    if (!sub || ['canceled', 'incomplete_expired'].includes(sub.status)) throw new BillingError('There is no current subscription to cancel.', 409)
    const updated = await getBillingStripe().subscriptions.update(sub.id, { cancel_at_period_end: true })
    return subscriptionSnapshot(userId, updated)
  })
}
export async function requireEligibleDriver(userId: string) {
  const db = createServiceRoleClient()
  const [profile, identity, eligibility] = await Promise.all([
    db.from('profiles').select('account_role,is_driver').eq('id', userId).maybeSingle(),
    db.from('driver_license_verifications').select('status,license_expires_on').eq('user_id', userId).maybeSingle(),
    db.from('driver_eligibility').select('overall_status,registration_status,insurance_status,registration_expires_on,insurance_expires_on').eq('user_id', userId).maybeSingle(),
  ])
  for (const result of [profile, identity, eligibility]) if (result.error) throw result.error
  const today = new Date().toISOString().slice(0,10)
  const e = eligibility.data
  if (!profile.data?.is_driver || !['driver','both'].includes(profile.data.account_role) || identity.data?.status !== 'verified' || !identity.data.license_expires_on || identity.data.license_expires_on < today ||
    e?.overall_status !== 'approved' || e.registration_status !== 'approved' || e.insurance_status !== 'approved' ||
    !e.registration_expires_on || e.registration_expires_on < today || !e.insurance_expires_on || e.insurance_expires_on < today) {
    throw new BillingError('Driver identity and current eligibility approval are required for payouts.', 409)
  }
  await requireActiveAccount(userId)
}
/** Call before enabling Driver offers or collecting ride payments. */
export async function requireDriverPayouts(userId: string): Promise<string> {
  await requireEligibleDriver(userId)
  if (process.env.STRIPE_CONNECT_ENABLED !== 'true') throw new BillingError('Driver payouts are not configured yet.')
  const account = await billingAccount(userId)
  if (!account?.connect_account_id) throw new BillingError('The driver must complete payout setup before receiving payments.', 409)
  const connected = await getBillingStripe().accounts.retrieve(account.connect_account_id)
  if (!connected.details_submitted || !connected.payouts_enabled || connected.capabilities?.transfers !== 'active') {
    throw new BillingError('Driver payouts are not ready. Complete the Stripe onboarding requirements.', 409)
  }
  return connected.id
}
