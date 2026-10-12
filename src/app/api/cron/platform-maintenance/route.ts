import {NextResponse,type NextRequest} from 'next/server'
import {GET as cleanup} from '@/app/api/cron/driver-eligibility-upload-cleanup/route'
import {maintainPlatformAccounts} from '@/lib/platformMaintenance'
import {deliverPlatformNotifications} from '@/lib/platformNotifications'

export const runtime='nodejs'
export const maxDuration=300
export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized.'},{status:401})
  // A failed provider lane must not prevent document cleanup in the daily run.
  const results:Record<string,unknown>={}
  let unavailable=false
  try{const response=await cleanup(request),cleanupResult=await response.json() as {backlog?:boolean};results.cleanup={ok:response.ok,...cleanupResult};if(!response.ok||cleanupResult.backlog)unavailable=true}catch{results.cleanup={ok:false};unavailable=true}
  const [accounts,notifications]=await Promise.allSettled([maintainPlatformAccounts(),deliverPlatformNotifications()])
  if(accounts.status==='fulfilled'){results.accounts=accounts.value;if(accounts.value.failed>0)unavailable=true}else{results.accounts={ok:false,error:'Account maintenance is temporarily unavailable.'};unavailable=true}
  if(notifications.status==='fulfilled'){results.notifications=notifications.value;if(notifications.value.failed>0)unavailable=true}else{results.notifications={ok:false,error:'Notification delivery is temporarily unavailable.'};unavailable=true}
  return NextResponse.json(results,{status:unavailable?503:200,headers:{'Cache-Control':'no-store'}})
}
