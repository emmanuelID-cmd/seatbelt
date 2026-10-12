import {NextResponse,type NextRequest} from 'next/server'
import {createServiceRoleClient,requireAal2Admin} from '@/lib/supabaseServer'
import {readBody,RequestError,routeError} from '@/lib/platformServer'

export async function GET(request:NextRequest) {
  try {
    const admin=await requireAal2Admin(request)
    if(!admin) throw new RequestError('Administrator access with multi-factor authentication is required.',403)
    const db=createServiceRoleClient(),id=request.nextUrl.searchParams.get('id')
    if(id) {
      if(!/^[0-9a-f-]{36}$/i.test(id)) throw new RequestError('Choose a valid support request.')
      const {data,error}=await db.rpc('read_platform_support',{p_ticket_id:id,p_admin_id:admin.user.id})
      if(error) throw error
      if(!data) throw new RequestError('Support request not found.',404)
      return NextResponse.json({ticket:data},{headers:{'Cache-Control':'private, no-store'}})
    }
    const status=request.nextUrl.searchParams.get('status')||'open'
    if(!['open','in_review','resolved','closed'].includes(status)) throw new RequestError('Choose a valid request status.')
    // The overview excludes request messages, names, email and document details.
    const {data,error}=await db.from('support_tickets').select('id,category,status,created_at,updated_at').eq('status',status).order('created_at',{ascending:true}).limit(100)
    if(error) throw error
    return NextResponse.json({tickets:data},{headers:{'Cache-Control':'private, no-store'}})
  } catch(error) {return routeError(error)}
}

export async function PATCH(request:NextRequest) {
  try {
    const admin=await requireAal2Admin(request)
    if(!admin) throw new RequestError('Administrator access with multi-factor authentication is required.',403)
    const body=await readBody(request),id=typeof body.id==='string'?body.id:'',response=typeof body.response==='string'?body.response.trim():''
    if(!/^[0-9a-f-]{36}$/i.test(id)||!['open','in_review','resolved','closed'].includes(String(body.status))||!response||response.length>2000||typeof body.updatedAt!=='string'||!Number.isFinite(Date.parse(body.updatedAt))) throw new RequestError('Choose a request status and enter a response of 1–2,000 characters.')
    const {data,error}=await createServiceRoleClient().rpc('review_platform_support',{p_ticket_id:id,p_admin_id:admin.user.id,p_status:body.status,p_response:response,p_updated_at:body.updatedAt})
    if(error) throw error
    if(!data) throw new RequestError('This request changed. Reload it before responding.',409)
    return NextResponse.json({message:'Response saved. The account holder can read it after signing in.'})
  } catch(error) {return routeError(error)}
}
