import { NextRequest, NextResponse } from 'next/server'
import { BillingError, billingBody, billingResponse, billingUser, changeSubscription, requireActiveAccount } from '@/lib/billing'
export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  try {
    const user = await billingUser(request)
    const { action, months } = await billingBody(request)
    if (action !== 'cancel' && action !== 'freeze' && action !== 'resume') throw new BillingError('Choose cancel, freeze, or resume.', 400)
    if (action !== 'cancel') await requireActiveAccount(user.id)
    let until: string | undefined
    if (action === 'freeze') {
      if (typeof months !== 'number' || !Number.isInteger(months) || months < 1 || months > 6) throw new BillingError('Choose a freeze duration from one to six months.', 400)
      const date = new Date()
      const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months)
      date.setUTCDate(Math.min(day,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()))
      until = date.toISOString()
    }
    const subscription = await changeSubscription(user.id, action, until)
    return NextResponse.json({ status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end, frozenUntil: subscription.frozen_until })
  } catch (error) { return billingResponse(error) }
}
