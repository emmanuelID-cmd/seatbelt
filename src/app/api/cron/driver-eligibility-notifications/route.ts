import {NextResponse,type NextRequest} from 'next/server'
import {deliverPlatformNotifications} from '@/lib/platformNotifications'

export const runtime='nodejs'
export const maxDuration=300
export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized.'},{status:401})
  try{
    const result=await deliverPlatformNotifications()
    return NextResponse.json(result,{status:result.available?200:503,headers:{'Cache-Control':'no-store'}})
  }catch{return NextResponse.json({error:'Notification delivery is temporarily unavailable.'},{status:503})}
}
