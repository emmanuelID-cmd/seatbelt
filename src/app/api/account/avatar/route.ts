import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
import { ensureAccount, requireUser, RequestError, routeError } from '@/lib/platformServer'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    if (Number(request.headers.get('content-length') || 0) > 4.2 * 1024 * 1024) throw new RequestError('Choose a portrait smaller than 4 MB.', 413)
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size > 4 * 1024 * 1024 || !file.size || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new RequestError('Choose a JPEG, PNG, or WebP portrait, up to 4 MB.')
    let image: Buffer
    try {
      const source = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16000000, animated: false })
      const metadata = await source.metadata()
      if (!['jpeg','png','webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) throw new Error('Unsupported image')
      image = await source.rotate().resize(512,512,{fit:'cover',position:'attention'}).jpeg({quality:85}).toBuffer()
    } catch { throw new RequestError('This image could not be read. Choose a clear JPEG, PNG, or WebP portrait.') }
    const db = await ensureAccount(user.id)
    const {data:previous,error:readError} = await db.from('account_details').select('avatar_path').eq('user_id',user.id).single()
    if(readError) throw readError
    const path = `${user.id}/${crypto.randomUUID()}.jpg`
    const {error:uploadError} = await db.storage.from('account-portraits').upload(path,image,{contentType:'image/jpeg',upsert:false})
    if(uploadError) throw uploadError
    const {error:saveError} = await db.from('account_details').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('user_id',user.id)
    if(saveError) { await db.storage.from('account-portraits').remove([path]); throw saveError }
    if(previous.avatar_path?.startsWith(`${user.id}/`)) await db.storage.from('account-portraits').remove([previous.avatar_path])
    const {data,error} = await db.storage.from('account-portraits').createSignedUrl(path,600)
    if(error) throw error
    return NextResponse.json({avatarUrl:data.signedUrl},{headers:{'Cache-Control':'no-store'}})
  } catch(error) { return routeError(error) }
}
