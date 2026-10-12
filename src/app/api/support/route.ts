import {NextResponse,type NextRequest} from 'next/server'
import {createServiceRoleClient} from '@/lib/supabaseServer'
import {requireUser,readBody,RequestError,routeError} from '@/lib/platformServer'
export async function GET(request:NextRequest){
  try{
    const user=await requireUser(request)
    const {data,error}=await createServiceRoleClient().from('support_tickets').select('id,category,subject,message,status,response,created_at,updated_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100)
    if(error)throw error
    return NextResponse.json({tickets:data},{headers:{'Cache-Control':'no-store'}})
  }catch(error){return routeError(error)}
}
export async function POST(request:NextRequest){
  try{
    const user=await requireUser(request),body=await readBody(request)
    const category=String(body.category||''),subject=typeof body.subject==='string'?body.subject.trim():'',message=typeof body.message==='string'?body.message.trim():''
    if(!['general','payment','appeal','privacy'].includes(category)||!subject||subject.length>120||!message||message.length>2000)throw new RequestError('Choose a category and enter a subject (1–120 characters) and message (1–2,000 characters).')
    const db=createServiceRoleClient()
    const {data,error}=await db.rpc('create_platform_support',{p_user_id:user.id,p_category:category,p_subject:subject,p_message:message})
    if(error)throw error
    if(!data)throw new RequestError('You have sent several requests. Please wait before sending another.',429)
    return NextResponse.json({id:data,message:'Your request is saved.'},{status:201})
  }catch(error){return routeError(error)}
}
