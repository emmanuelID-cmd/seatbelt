import { NextRequest, NextResponse } from 'next/server'
import { billingAccount, billingConfigured, billingResponse, billingTiers, billingUser, currentSubscription, getBillingStripe, isoTime, tierForSubscription, tierPrice } from '@/lib/billing'
import { createServiceRoleClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  try {
    const user = await billingUser(request)
    const db = createServiceRoleClient()
    const { data: profile, error } = await db.from('profiles').select('account_role').eq('id', user.id).maybeSingle()
    if (error) throw error
    const { data: preferences, error: preferencesError } = await db.from('account_preferences').select('account_state,frozen_until').eq('user_id', user.id).maybeSingle()
    if (preferencesError) throw preferencesError
    const base = { tier: null, status: 'not_configured', renewalAt: null, startedAt: null, configured: billingConfigured(),
      payoutsEnabled: false, paymentMethods: [] as { type: string; label: string; last4: string | null; expires: string | null }[],
      canSetUpPayouts: ['driver','both'].includes(profile?.account_role), connectConfigured: process.env.STRIPE_CONNECT_ENABLED === 'true',
      bankConfigured: process.env.STRIPE_BANK_PAYMENTS_ENABLED === 'true', portalConfigured: Boolean(process.env.STRIPE_PORTAL_CONFIGURATION_ID),
      availableTiers: [] as string[], prices: [] as { tier: string; amountCents: number; interval: string; intervalCount: number }[],
      mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') || process.env.STRIPE_SECRET_KEY?.startsWith('rk_live_') ? 'live' : 'test',
      accountState: preferences?.account_state || 'active', accountFrozenUntil: preferences?.frozen_until || null,
      cancelAtPeriodEnd: false, collectionPaused: false, frozenUntil: null }
    if (!base.configured) return NextResponse.json(base, { headers: { 'Cache-Control': 'no-store' } })
    const stripe = getBillingStripe()
    for (const tier of billingTiers) {
      const id = tierPrice(tier)
      if (!id) continue
      const price = await stripe.prices.retrieve(id)
      if (price.active && price.currency === 'usd' && price.recurring?.usage_type === 'licensed' && price.unit_amount !== null) {
        base.availableTiers.push(tier)
        base.prices.push({ tier, amountCents: price.unit_amount, interval: price.recurring.interval, intervalCount: price.recurring.interval_count })
      }
    }
    const account = await billingAccount(user.id)
    const sub = await currentSubscription(user.id)
    if (account?.customer_id) {
      const methods = await stripe.paymentMethods.list({ customer: account.customer_id, limit: 100 })
      base.paymentMethods = methods.data.flatMap((method): { type: string; label: string; last4: string | null; expires: string | null }[] => {
        if (method.card) return [{ type: 'card', label: method.card.brand, last4: method.card.last4, expires: `${method.card.exp_month}/${method.card.exp_year}` }]
        if (method.us_bank_account) return [{ type: 'bank', label: method.us_bank_account.bank_name || 'US bank', last4: method.us_bank_account.last4, expires: null }]
        return []
      })
    }
    if (account?.connect_account_id && base.connectConfigured) {
      const connect = await stripe.accounts.retrieve(account.connect_account_id)
      base.payoutsEnabled = connect.payouts_enabled && connect.details_submitted && connect.capabilities?.transfers === 'active'
    }
    return NextResponse.json({ ...base, tier: sub ? tierForSubscription(sub) : null, status: sub?.status || 'none',
      renewalAt: isoTime(sub?.items.data[0]?.current_period_end), startedAt: isoTime(sub?.start_date),
      cancelAtPeriodEnd: sub?.cancel_at_period_end || false, collectionPaused: Boolean(sub?.pause_collection), frozenUntil: isoTime(sub?.pause_collection?.resumes_at),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return billingResponse(error) }
}
