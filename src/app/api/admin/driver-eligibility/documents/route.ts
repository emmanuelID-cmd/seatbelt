import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient, requireAal2Admin } from '@/lib/supabaseServer'

const BUCKET = 'driver-eligibility-documents'
const documentTypes = ['registration', 'insurance'] as const

type DocumentType = typeof documentTypes[number]

export async function GET(request: NextRequest) {
  try {
    if (!await requireAal2Admin(request)) {
      return NextResponse.json({ error: 'Administrator MFA verification is required.' }, { status: 403 })
    }

    const userId = request.nextUrl.searchParams.get('userId')
    const documentType = request.nextUrl.searchParams.get('documentType') as DocumentType | null
    if (!userId || !documentType || !documentTypes.includes(documentType)) {
      return NextResponse.json({ error: 'A valid document request is required.' }, { status: 400 })
    }

    const column = documentType === 'registration' ? 'registration_document_path' : 'insurance_document_path'
    const client = createServiceRoleClient()
    const { data, error } = await client.from('driver_eligibility').select(column).eq('user_id', userId).maybeSingle()
    if (error) throw error

    const record = data as Record<string, unknown> | null
    const path = record?.[column]
    if (typeof path !== 'string' || !path) return NextResponse.json({ error: 'Document is not available.' }, { status: 404 })

    const { data: signed, error: signedError } = await client.storage.from(BUCKET).createSignedUrl(path, 600)
    if (signedError || !signed?.signedUrl) throw signedError || new Error('Document link could not be created.')

    return NextResponse.json({ signedUrl: signed.signedUrl, expiresInSeconds: 600 })
  } catch (error) {
    console.error('Admin Driver Eligibility document link failed', { message: error instanceof Error ? error.message : 'Unknown server error' })
    return NextResponse.json({ error: 'Document access is temporarily unavailable. Please try again later.' }, { status: 503 })
  }
}