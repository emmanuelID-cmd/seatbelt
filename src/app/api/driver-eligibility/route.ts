import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient, getAuthenticatedUser } from '@/lib/supabaseServer'
import {ensureAccount} from '@/lib/platformServer'
import { getVerifiedDriverLicenseExpiry, identityResultsConfigured } from '@/lib/stripeIdentity'

const BUCKET = 'driver-eligibility-documents'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_FILE_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const

type DocumentType = 'registration' | 'insurance'
type UploadAction = 'create_upload' | 'complete_upload' | 'activate_driver_mode'

type UploadRequest = {
  action: UploadAction
  documentType: DocumentType
  expiresOn: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  path?: string
  draftId?: string
}

function isDocumentType(value: unknown): value is DocumentType {
  return value === 'registration' || value === 'insurance'
}

function isValidFutureDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return date.getTime() > todayUtc
}

function responseForEligibility(eligibility: {
  registration_status: string
  registration_expires_on: string | null
  registration_submitted_at: string | null
  registration_rejection_code: string | null
  insurance_status: string
  insurance_expires_on: string | null
  insurance_submitted_at: string | null
  insurance_rejection_code: string | null
  overall_status: string
} | null, identityStatus: string | null, driverLicense: { status: string; license_expires_on: string | null } | null) {
  return NextResponse.json({
    identityStatus: identityStatus || 'not_started',
    driverLicense: {
      status: driverLicense?.status || 'not_started',
      expiresOn: driverLicense?.license_expires_on || null,
      expiryConfigured: identityResultsConfigured(),
    },
    eligibility: eligibility && {
      overallStatus: eligibility.overall_status,
      registration: {
        status: eligibility.registration_status,
        expiresOn: eligibility.registration_expires_on,
        submittedAt: eligibility.registration_submitted_at,
        rejectionCode: eligibility.registration_rejection_code,
      },
      insurance: {
        status: eligibility.insurance_status,
        expiresOn: eligibility.insurance_expires_on,
        submittedAt: eligibility.insurance_submitted_at,
        rejectionCode: eligibility.insurance_rejection_code,
      },
    },
  })
}

async function requireDriverAccount(userId: string) {
  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('profiles')
    .select('is_driver')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.is_driver)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || user.is_anonymous) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 })

    const serviceClient = createServiceRoleClient()
    const [{ data: eligibility, error: eligibilityError }, { data: identity, error: identityError }, { data: driverLicense, error: licenseError }] = await Promise.all([
      serviceClient
        .from('driver_eligibility')
        .select('registration_status, registration_expires_on, registration_submitted_at, registration_rejection_code, insurance_status, insurance_expires_on, insurance_submitted_at, insurance_rejection_code, overall_status')
        .eq('user_id', user.id)
        .maybeSingle(),
      serviceClient
        .from('identity_verifications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle(),
      serviceClient.from('driver_license_verifications')
        .select('status,stripe_verification_session_id,license_expires_on')
        .eq('user_id', user.id).maybeSingle(),
    ])
    if (eligibilityError) throw eligibilityError
    if (identityError) throw identityError
    if (licenseError) throw licenseError

    let licenseExpiry = driverLicense?.license_expires_on || null
    if (driverLicense?.status === 'verified' && !licenseExpiry && driverLicense.stripe_verification_session_id) {
      try {
        licenseExpiry = await getVerifiedDriverLicenseExpiry(driverLicense.stripe_verification_session_id)
        if (licenseExpiry) await serviceClient.from('driver_license_verifications').update({ license_expires_on: licenseExpiry, updated_at: new Date().toISOString() }).eq('user_id', user.id)
      } catch { /* Missing restricted results access remains an honest pending eligibility state. */ }
    }

    return responseForEligibility(eligibility, identity?.status || null, driverLicense ? { status: driverLicense.status, license_expires_on: licenseExpiry } : null)
  } catch (error) {
    console.error('Driver eligibility GET failed', {
      message: error instanceof Error ? error.message : 'Unknown server error',
    })
    return NextResponse.json({ error: 'Driver eligibility is temporarily unavailable. Please try again later.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || user.is_anonymous) return NextResponse.json({ error: 'Sign in is required.' }, { status: 401 })
    if (!(await requireDriverAccount(user.id))) {
      return NextResponse.json({ error: 'Driver eligibility is only available for Driver accounts.' }, { status: 403 })
    }

    const accountClient=await ensureAccount(user.id)
    const {data:account,error:accountError}=await accountClient.from('account_preferences').select('account_state').eq('user_id',user.id).single()
    if(accountError) throw accountError
    if(account.account_state!=='active') return NextResponse.json({error:'Your account must be active before changing Driver eligibility or session mode.'},{status:403})

    const body = await request.json() as UploadRequest
    const serviceClient = createServiceRoleClient()

    if (body.action === 'activate_driver_mode') {
      const {data:details,error:detailsError}=await serviceClient.from('account_details').select('legal_name,address_line1,city,postal_code,date_of_birth').eq('user_id',user.id).single()
      if(detailsError) throw detailsError
      if(!details.legal_name||!details.address_line1||!details.city||!details.postal_code||!details.date_of_birth) return NextResponse.json({error:'Complete your private Account details before choosing Driver mode.'},{status:409})
      const [{ data: identity, error: identityError }, { data: license, error: licenseError }, { data: eligibility, error: eligibilityError }] = await Promise.all([
        serviceClient.from('identity_verifications').select('status').eq('user_id', user.id).maybeSingle(),
        serviceClient.from('driver_license_verifications').select('status,stripe_verification_session_id,license_expires_on').eq('user_id', user.id).maybeSingle(),
        serviceClient.from('driver_eligibility').select('overall_status,registration_status,insurance_status,registration_expires_on,insurance_expires_on').eq('user_id', user.id).maybeSingle(),
      ])
      if (identityError) throw identityError
      if (licenseError) throw licenseError
      if (eligibilityError) throw eligibilityError

      let licenseExpiresOn = license?.license_expires_on || null
      if (license?.status === 'verified' && !licenseExpiresOn && license.stripe_verification_session_id) {
        try {
          licenseExpiresOn = await getVerifiedDriverLicenseExpiry(license.stripe_verification_session_id)
          if (licenseExpiresOn) await serviceClient.from('driver_license_verifications').update({ license_expires_on: licenseExpiresOn, updated_at: new Date().toISOString() }).eq('user_id', user.id)
        } catch { /* Missing restricted results access keeps Driver mode unavailable. */ }
      }

      const today=new Date().toISOString().slice(0,10)
      const activated = identity?.status === 'verified' && license?.status === 'verified' && Boolean(licenseExpiresOn && licenseExpiresOn >= today) && eligibility?.overall_status === 'approved'
        && eligibility.registration_status==='approved' && eligibility.insurance_status==='approved'
        && Boolean(eligibility.registration_expires_on&&eligibility.registration_expires_on>=today)
        && Boolean(eligibility.insurance_expires_on&&eligibility.insurance_expires_on>=today)
      const { error: profileError } = await serviceClient
        .from('profiles')
        .update({ last_session_mode: activated ? 'driver' : 'rider', session_mode_reassignment_seen: true })
        .eq('id', user.id)
      if (profileError) throw profileError

      return NextResponse.json({
        activated,
        identityStatus: identity?.status || 'not_started',
        driverLicenseStatus: license?.status || 'not_started',
        driverLicenseExpiresOn: licenseExpiresOn,
        eligibilityStatus: eligibility?.overall_status || 'incomplete',
      })
    }

    if (!isDocumentType(body.documentType) || !isValidFutureDate(body.expiresOn)) {
      return NextResponse.json({ error: 'Choose a document type and a valid future expiration date.' }, { status: 400 })
    }

    if (body.action === 'create_upload') {
      if (typeof body.fileName !== 'string' || !body.fileName.trim() || typeof body.fileSize !== 'number' || !Number.isInteger(body.fileSize)) {
        return NextResponse.json({ error: 'Choose a document to upload.' }, { status: 400 })
      }
      if (body.fileSize <= 0 || body.fileSize > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Documents must be between 1 byte and 10 MB.' }, { status: 400 })
      }
      if (typeof body.mimeType !== 'string' || !(body.mimeType in ALLOWED_FILE_TYPES)) {
        return NextResponse.json({ error: 'Use a PDF, JPEG, or PNG document.' }, { status: 400 })
      }

      const extension = ALLOWED_FILE_TYPES[body.mimeType as keyof typeof ALLOWED_FILE_TYPES]
      const path = `${user.id}/${body.documentType}/${crypto.randomUUID()}.${extension}`
      const { data: draft, error: draftError } = await serviceClient
        .from('driver_eligibility_upload_drafts')
        .insert({ user_id: user.id, document_type: body.documentType, path })
        .select('id')
        .single()
      if (draftError || !draft) throw draftError || new Error('Upload could not be prepared.')

      const { data, error } = await serviceClient.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error || !data?.token) {
        await serviceClient.from('driver_eligibility_upload_drafts').delete().eq('id', draft.id)
        throw error || new Error('Upload could not be prepared.')
      }

      return NextResponse.json({ path, token: data.token, draftId: draft.id })
    }

    if (body.action === 'complete_upload') {
      if (typeof body.path !== 'string' || typeof body.draftId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.draftId)) {
        return NextResponse.json({ error: 'Upload details are missing.' }, { status: 400 })
      }

      const { data: draft, error: draftLookupError } = await serviceClient
        .from('driver_eligibility_upload_drafts')
        .select('id')
        .eq('id', body.draftId)
        .eq('user_id', user.id)
        .eq('document_type', body.documentType)
        .eq('path', body.path)
        .maybeSingle()
      if (draftLookupError) throw draftLookupError
      if (!draft) return NextResponse.json({ error: 'This upload has expired or is invalid. Please choose the document again.' }, { status: 400 })

      const prefix = `${user.id}/${body.documentType}/`
      const fileName = body.path.startsWith(prefix) ? body.path.slice(prefix.length) : ''
      if (!fileName || !/^[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(fileName)) {
        return NextResponse.json({ error: 'Upload details are invalid.' }, { status: 400 })
      }

      const { data: files, error: filesError } = await serviceClient.storage.from(BUCKET).list(`${user.id}/${body.documentType}`, { search: fileName })
      if (filesError || !files?.some(file => file.name === fileName)) {
        return NextResponse.json({ error: 'The document upload could not be confirmed. Please try again.' }, { status: 400 })
      }

      const { data: existing, error: existingError } = await serviceClient
        .from('driver_eligibility')
        .select('registration_document_path, registration_expires_on, registration_status, registration_submitted_at, insurance_document_path, insurance_expires_on, insurance_status, insurance_submitted_at, overall_status')
        .eq('user_id', user.id)
        .maybeSingle()
      if (existingError) throw existingError

      const previousPath = body.documentType === 'registration'
        ? existing?.registration_document_path
        : existing?.insurance_document_path
      const otherDocumentExists = body.documentType === 'registration'
        ? Boolean(existing?.insurance_document_path)
        : Boolean(existing?.registration_document_path)
      const now = new Date().toISOString()
      const update = {
        user_id: user.id,
        registration_document_path: existing?.registration_document_path || null,
        registration_expires_on: existing?.registration_expires_on || null,
        registration_status: existing?.registration_status || 'not_submitted',
        registration_submitted_at: existing?.registration_submitted_at || null,
        insurance_document_path: existing?.insurance_document_path || null,
        insurance_expires_on: existing?.insurance_expires_on || null,
        insurance_status: existing?.insurance_status || 'not_submitted',
        insurance_submitted_at: existing?.insurance_submitted_at || null,
        overall_status: otherDocumentExists ? 'pending' : 'incomplete',
        updated_at: now,
      }
      if (body.documentType === 'registration') {
        update.registration_document_path = body.path
        update.registration_expires_on = body.expiresOn
        update.registration_status = 'pending'
        update.registration_submitted_at = now
      } else {
        update.insurance_document_path = body.path
        update.insurance_expires_on = body.expiresOn
        update.insurance_status = 'pending'
        update.insurance_submitted_at = now
      }
      const { error: saveError } = await serviceClient.from('driver_eligibility').upsert(update, { onConflict: 'user_id' })
      if (saveError) {
        await serviceClient.storage.from(BUCKET).remove([body.path])
        throw saveError
      }

      await serviceClient.from('driver_eligibility_upload_drafts').delete().eq('id', draft.id)

      if (previousPath && previousPath !== body.path) {
        await serviceClient.storage.from(BUCKET).remove([previousPath])
      }

      return NextResponse.json({ saved: true })
    }

    return NextResponse.json({ error: 'Unsupported Driver Eligibility request.' }, { status: 400 })
  } catch (error) {
    console.error('Driver eligibility POST failed', {
      message: error instanceof Error ? error.message : 'Unknown server error',
    })
    return NextResponse.json({ error: 'Driver eligibility is temporarily unavailable. Please try again later.' }, { status: 503 })
  }
}
