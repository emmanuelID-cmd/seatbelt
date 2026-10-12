import {NextResponse,type NextRequest} from 'next/server'
import {createServiceRoleClient} from '@/lib/supabaseServer'
import {requireUser,readBody,RequestError,routeError} from '@/lib/platformServer'

export async function GET(request:NextRequest){
  try{
    const user=await requireUser(request)
    const db=createServiceRoleClient()
    const [items,unread]=await Promise.all([
      db.from('user_notifications').select('id,title,body,category,created_at,read_at').eq('user_id',user.id).eq('in_app_visible',true).order('created_at',{ascending:false}).limit(100),
      db.from('user_notifications').select('id',{head:true,count:'exact'}).eq('user_id',user.id).eq('in_app_visible',true).is('read_at',null),
    ])
    if(items.error||unread.error)throw items.error||unread.error
    return NextResponse.json({items:items.data,unreadCount:unread.count||0},{headers:{'Cache-Control':'no-store'}})
  }catch(error){return routeError(error)}
}
export async function PATCH(request:NextRequest){
  try{
    const user=await requireUser(request),body=await readBody(request)
    if(typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id))throw new RequestError('Choose a notification.')
    const {data,error}=await createServiceRoleClient().from('user_notifications').update({read_at:new Date().toISOString()}).eq('id',body.id).eq('user_id',user.id).eq('in_app_visible',true).select('id').maybeSingle()
    if(error)throw error
    if(!data)throw new RequestError('Notification not found.',404)
    return NextResponse.json({ok:true})
  }catch(error){return routeError(error)}
}
