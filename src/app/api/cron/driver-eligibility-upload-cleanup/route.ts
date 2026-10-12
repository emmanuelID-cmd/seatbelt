import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabaseServer'

const BUCKET = 'driver-eligibility-documents'
const BATCH_SIZE = 100
const MAX_BATCHES = 10
const CLEANUP_BUDGET_MS = 180_000

function isDue(value: string | null, now: number) {
  return Boolean(value && new Date(value).getTime() <= now)
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const serviceClient = createServiceRoleClient()
    const now = new Date()
    const nowIso = now.toISOString()
    let deleted = 0
    let retained = 0
    let retentionDeleted = 0
    const deadline = Date.now() + CLEANUP_BUDGET_MS

    for (let batch = 0; batch < MAX_BATCHES && Date.now() < deadline; batch += 1) {
      const { data: drafts, error: draftsError } = await serviceClient
        .from('driver_eligibility_upload_drafts')
        .select('id, user_id, path')
        .lte('expires_at', nowIso)
        .order('expires_at', { ascending: true })
        .limit(BATCH_SIZE)
      if (draftsError) throw draftsError
      if (!drafts?.length) break

      const userIds = [...new Set(drafts.map(draft => draft.user_id))]
      const { data: eligibility, error: eligibilityError } = await serviceClient
        .from('driver_eligibility')
        .select('registration_document_path, insurance_document_path')
        .in('user_id', userIds)
      if (eligibilityError) throw eligibilityError

      const retainedPaths = new Set(
        (eligibility || []).flatMap(item => [item.registration_document_path, item.insurance_document_path]).filter((path): path is string => Boolean(path)),
      )
      const retainedDrafts = drafts.filter(draft => retainedPaths.has(draft.path))
      const unretainedDrafts = drafts.filter(draft => !retainedPaths.has(draft.path))
      if (retainedDrafts.length) {
        const { error } = await serviceClient.from('driver_eligibility_upload_drafts').delete().in('id', retainedDrafts.map(draft => draft.id))
        if (error) throw error
        retained += retainedDrafts.length
      }
      if (unretainedDrafts.length) {
        const { error: storageError } = await serviceClient.storage.from(BUCKET).remove(unretainedDrafts.map(draft => draft.path))
        if (storageError) throw storageError
        const { error: deleteError } = await serviceClient.from('driver_eligibility_upload_drafts').delete().in('id', unretainedDrafts.map(draft => draft.id))
        if (deleteError) throw deleteError
        deleted += unretainedDrafts.length
      }
      if (drafts.length < BATCH_SIZE) break
    }

    for (let batch = 0; batch < MAX_BATCHES && Date.now() < deadline; batch += 1) {
      const { data: retentionRows, error: retentionError } = await serviceClient
        .from('driver_eligibility')
        .select('user_id, registration_document_path, insurance_document_path, registration_delete_after, insurance_delete_after, retention_hold')
        .eq('retention_hold', false)
        .or(`registration_delete_after.lte.${nowIso},insurance_delete_after.lte.${nowIso}`)
        .limit(BATCH_SIZE)
      if (retentionError) throw retentionError
      if (!retentionRows?.length) break

      for (const row of retentionRows) {
        const updates: Record<string, null> = {}
        const removePaths: string[] = []
        if (isDue(row.registration_delete_after, now.getTime())) {
          if (row.registration_document_path) removePaths.push(row.registration_document_path)
          updates.registration_document_path = null
          updates.registration_delete_after = null
        }
        if (isDue(row.insurance_delete_after, now.getTime())) {
          if (row.insurance_document_path) removePaths.push(row.insurance_document_path)
          updates.insurance_document_path = null
          updates.insurance_delete_after = null
        }
        if (Object.keys(updates).length) {
          if (removePaths.length) {
            const { error } = await serviceClient.storage.from(BUCKET).remove(removePaths)
            if (error) throw error
          }
          const { error } = await serviceClient.from('driver_eligibility').update(updates).eq('user_id', row.user_id)
          if (error) throw error
          retentionDeleted += removePaths.length
        }
      }
      if (retentionRows.length < BATCH_SIZE) break
    }

    const [{ count: draftBacklog, error: draftCountError }, { count: retentionBacklog, error: retentionCountError }] = await Promise.all([
      serviceClient.from('driver_eligibility_upload_drafts').select('id', { count: 'exact', head: true }).lte('expires_at', nowIso),
      serviceClient.from('driver_eligibility').select('user_id', { count: 'exact', head: true }).eq('retention_hold', false).or(`registration_delete_after.lte.${nowIso},insurance_delete_after.lte.${nowIso}`),
    ])
    if (draftCountError) throw draftCountError
    if (retentionCountError) throw retentionCountError
    const backlog = Boolean(draftBacklog || retentionBacklog)
    return NextResponse.json({ deleted, retained, retentionDeleted, backlog, draftBacklog: draftBacklog || 0, retentionBacklog: retentionBacklog || 0 })
  } catch {
    return NextResponse.json({ error: 'Cleanup is temporarily unavailable.' }, { status: 503 })
  }
}
