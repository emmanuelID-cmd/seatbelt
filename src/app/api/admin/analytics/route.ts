import {NextResponse,type NextRequest} from 'next/server'
import {createServiceRoleClient,requireAal2Admin} from '@/lib/supabaseServer'
import {RequestError,routeError} from '@/lib/platformServer'

export async function GET(request:NextRequest) {
  try {
    if(!await requireAal2Admin(request)) throw new RequestError('Administrator access with multi-factor authentication is required.',403)
    const endInput=request.nextUrl.searchParams.get('until')
    const startInput=request.nextUrl.searchParams.get('since')
    const until=endInput?new Date(endInput):new Date()
    const since=startInput?new Date(startInput):new Date(until.getTime()-30*86400000)
    if(!Number.isFinite(since.getTime())||!Number.isFinite(until.getTime())||since>until||until.getTime()>Date.now()+1000||until.getTime()-since.getTime()>366*86400000) throw new RequestError('Choose a valid past date range of up to 366 days.')
    const db=createServiceRoleClient()
    const [operations,finance,trust]=await Promise.all([
      db.rpc('platform_operations_summary',{since_time:since.toISOString(),until_time:until.toISOString()}),
      db.rpc('platform_finance_summary',{since_time:since.toISOString(),until_time:until.toISOString()}),
      db.rpc('platform_trust_summary',{since_time:since.toISOString(),until_time:until.toISOString()}),
    ])
    if(operations.error||trust.error) throw operations.error||trust.error
    return NextResponse.json({since:since.toISOString(),until:until.toISOString(),operations:operations.data,trust:trust.data,
      finance:finance.error?null:finance.data,financeUnavailable:Boolean(finance.error),
      providers:{payments:Boolean(process.env.STRIPE_SECRET_KEY),email:Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL),backgroundChecks:false,cameras:false},
    },{headers:{'Cache-Control':'private, no-store',Vary:'Authorization'}})
  } catch(error) {return routeError(error)}
}
