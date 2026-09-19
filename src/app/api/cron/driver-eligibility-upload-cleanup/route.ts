import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

const BUCKET = 'driver-eligibility-documents'
const BATCH_SIZE = 100

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const serviceClient = createServiceRoleClient()
    const { data: drafts, error: draftsError } = await serviceClient
      .from('driver_eligibility_upload_drafts')
      .select('id, user_id, path')
      .lte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
      .limit(BATCH_SIZE)
    if (draftsError) throw draftsError
    if (!drafts?.length) return NextResponse.json({ deleted: 0, retained: 0 })

    const userIds = [...new Set(drafts.map(draft => draft.user_id))]
    const { data: eligibility, error: eligibilityError } = await serviceClient
      .from('driver_eligibility')
      .select('registration_document_path, insurance_document_path')
      .in('user_id', userIds)
    if (eligibilityError) throw eligibilityError

    const retainedPaths = new Set(
      (eligibility || []).flatMap(item => [item.registration_document_path, item.insurance_document_path]).filter((path): path is string => Boolean(path)),
    )
    let deleted = 0
    let retained = 0

    for (const draft of drafts) {
      if (retainedPaths.has(draft.path)) {
        const { error } = await serviceClient.from('driver_eligibility_upload_drafts').delete().eq('id', draft.id)
        if (error) throw error
        retained += 1
        continue
      }

      const { error: storageError } = await serviceClient.storage.from(BUCKET).remove([draft.path])
      if (storageError) throw storageError
      const { error: deleteError } = await serviceClient.from('driver_eligibility_upload_drafts').delete().eq('id', draft.id)
      if (deleteError) throw deleteError
      deleted += 1
    }

    return NextResponse.json({ deleted, retained })
  } catch {
    return NextResponse.json({ error: 'Cleanup is temporarily unavailable.' }, { status: 503 })
  }
}