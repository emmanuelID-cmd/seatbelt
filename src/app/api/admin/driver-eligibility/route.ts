import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient, requireAal2Admin } from '@/lib/supabaseServer'

const documentTypes = ['registration', 'insurance'] as const
const actions = ['approved', 'rejected', 'needs_update'] as const
const reasonCodes = ['missing_document', 'expired_document', 'unreadable_document', 'unsupported_document', 'information_mismatch', 'manual_review_required'] as const
const DEFAULT_DOCUMENT_RETENTION_DAYS = 30

function documentDeleteAfter(reviewedAt: Date) {
  const configuredDays = Number(process.env.DRIVER_ELIGIBILITY_DOCUMENT_RETENTION_DAYS || DEFAULT_DOCUMENT_RETENTION_DAYS)
  const retentionDays = Number.isInteger(configuredDays) && configuredDays >= 1 && configuredDays <= 365
    ? configuredDays
    : DEFAULT_DOCUMENT_RETENTION_DAYS
  return new Date(reviewedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString()
}

type DocumentType = typeof documentTypes[number]
type ReviewAction = typeof actions[number]
type ReasonCode = typeof reasonCodes[number]

type ReviewRequest = {
  subjectUserId?: unknown
  documentType?: unknown
  action?: unknown
  reasonCode?: unknown
}

function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && documentTypes.includes(value as DocumentType)
}

function isReviewAction(value: unknown): value is ReviewAction {
  return typeof value === 'string' && actions.includes(value as ReviewAction)
}

function isReasonCode(value: unknown): value is ReasonCode {
  return typeof value === 'string' && reasonCodes.includes(value as ReasonCode)
}

export async function GET(request: NextRequest) {
  try {
    if (!await requireAal2Admin(request)) {
      return NextResponse.json({ error: 'Administrator MFA verification is required.' }, { status: 403 })
    }

    const client = createServiceRoleClient()
    const { data, error } = await client
      .from('driver_eligibility')
      .select('user_id, registration_status, registration_expires_on, registration_document_path, registration_rejection_code, insurance_status, insurance_expires_on, insurance_document_path, insurance_rejection_code, overall_status, updated_at')
      .in('overall_status', ['pending', 'rejected', 'expired'])
      .order('updated_at', { ascending: true })
    if (error) throw error

    const submissions = (data || []).map(item => ({
      user_id: item.user_id,
      registration_status: item.registration_status,
      registration_expires_on: item.registration_expires_on,
      registration_rejection_code: item.registration_rejection_code,
      has_registration_document: Boolean(item.registration_document_path),
      insurance_status: item.insurance_status,
      insurance_expires_on: item.insurance_expires_on,
      insurance_rejection_code: item.insurance_rejection_code,
      has_insurance_document: Boolean(item.insurance_document_path),
      overall_status: item.overall_status,
      updated_at: item.updated_at,
    }))
    return NextResponse.json({ submissions })

  } catch (error) {
    console.error('Admin Driver Eligibility queue failed', { message: error instanceof Error ? error.message : 'Unknown server error' })
    return NextResponse.json({ error: 'Driver eligibility review is temporarily unavailable. Please try again later.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAal2Admin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Administrator MFA verification is required.' }, { status: 403 })
    }

    const body = await request.json() as ReviewRequest
    if (typeof body.subjectUserId !== 'string' || !isDocumentType(body.documentType) || !isReviewAction(body.action)) {
      return NextResponse.json({ error: 'A subject, document type, and valid review action are required.' }, { status: 400 })
    }
    if (body.action !== 'approved' && !isReasonCode(body.reasonCode)) {
      return NextResponse.json({ error: 'A valid reason is required for this review action.' }, { status: 400 })
    }

    const client = createServiceRoleClient()
    const reviewedAt = new Date()
    const deleteAfter = documentDeleteAfter(reviewedAt)
    const { data: overallStatus, error: reviewError } = await client.rpc('review_driver_eligibility_document', {
      p_subject_user_id: body.subjectUserId,
      p_reviewer_user_id: admin.user.id,
      p_document_type: body.documentType,
      p_action: body.action,
      p_reason_code: body.action === 'approved' ? null : body.reasonCode,
      p_delete_after: deleteAfter,
    })
    if (reviewError?.code === 'P0002') return NextResponse.json({ error: 'Eligibility submission was not found.' }, { status: 404 })
    if (reviewError) throw reviewError

    const { error: notificationError } = await client.from('driver_eligibility_notification_events').insert({
      user_id: body.subjectUserId,
      event_type: body.action,
      document_type: body.documentType,
      dedupe_key: body.subjectUserId + ':' + body.documentType + ':' + body.action + ':' + reviewedAt.toISOString(),
    })
    if (notificationError) {
      console.error('Driver Eligibility notification event failed', { message: notificationError.message })
    }

    return NextResponse.json({ saved: true, overallStatus })
  } catch (error) {
    console.error('Admin Driver Eligibility review failed', { message: error instanceof Error ? error.message : 'Unknown server error' })
    return NextResponse.json({ error: 'Driver eligibility review is temporarily unavailable. Please try again later.' }, { status: 503 })
  }
}
