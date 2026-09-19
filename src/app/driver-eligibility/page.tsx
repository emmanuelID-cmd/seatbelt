'use client'

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type DocumentStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected' | 'expired'
type OverallStatus = 'incomplete' | 'pending' | 'approved' | 'rejected' | 'expired'
type DocumentType = 'registration' | 'insurance'
type FieldKey = 'registrationExpiry' | 'registrationFile' | 'insuranceExpiry' | 'insuranceFile'
type FieldErrors = Partial<Record<FieldKey, string>>

type Eligibility = {
  overallStatus: OverallStatus
  registration: { status: DocumentStatus; expiresOn: string | null; submittedAt: string | null }
  insurance: { status: DocumentStatus; expiresOn: string | null; submittedAt: string | null }
}

type EligibilityResponse = {
  identityStatus: string
  eligibility: Eligibility | null
  error?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function statusColor(status: string) {
  if (status === 'approved') return '#6dba6d'
  if (status === 'rejected' || status === 'expired') return '#f87171'
  if (status === 'pending') return '#c8b86a'
  return '#888'
}

function tomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

function futureDateError(value: string) {
  if (!value) return 'Expiration date is required.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Enter a valid future expiration date.'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || date.getTime() <= todayUtc) {
    return 'Enter a future expiration date.'
  }
  return ''
}

function fileError(file: File | null) {
  if (!file) return 'Document upload is required.'
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return 'Use a document between 1 byte and 10 MB.'
  if (!ALLOWED_FILE_TYPES.includes(file.type)) return 'Use a PDF, JPEG, or PNG document.'
  return ''
}

export default function DriverEligibilityPage() {
  const router = useRouter()
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [identityStatus, setIdentityStatus] = useState('not_started')
  const [registrationExpiry, setRegistrationExpiry] = useState('')
  const [insuranceExpiry, setInsuranceExpiry] = useState('')
  const [registrationFile, setRegistrationFile] = useState<File | null>(null)
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<DocumentType | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [systemError, setSystemError] = useState('')

  const authorizedRequest = useCallback(async (body?: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sign in is required.')

    const response = await fetch('/api/driver-eligibility', {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const data = await response.json() as EligibilityResponse & { path?: string; token?: string; draftId?: string; saved?: boolean }
    if (!response.ok) throw new Error(data.error || 'Driver eligibility is temporarily unavailable. Please try again later.')
    return data
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const data = await authorizedRequest()
      setEligibility(data.eligibility)
      setIdentityStatus(data.identityStatus)
      setRegistrationExpiry(data.eligibility?.registration.expiresOn || '')
      setInsuranceExpiry(data.eligibility?.insurance.expiresOn || '')
    } catch (requestError) {
      setSystemError(requestError instanceof Error ? requestError.message : 'Driver eligibility is temporarily unavailable. Please try again later.')
    } finally {
      setLoading(false)
    }
  }, [authorizedRequest])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void refreshStatus() }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [refreshStatus])

  function setOrClearFieldError(field: FieldKey, message: string) {
    setFieldErrors(current => {
      const next = { ...current }
      if (message) next[field] = message
      else delete next[field]
      return next
    })
  }

  function onExpiryChange(field: 'registrationExpiry' | 'insuranceExpiry', value: string) {
    if (field === 'registrationExpiry') setRegistrationExpiry(value)
    else setInsuranceExpiry(value)

    const message = futureDateError(value)
    if (message && fieldErrors[field]) setOrClearFieldError(field, message)
    if (!message) setOrClearFieldError(field, '')
  }

  function onFileChange(field: 'registrationFile' | 'insuranceFile', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    if (field === 'registrationFile') setRegistrationFile(file)
    else setInsuranceFile(file)

    const message = fileError(file)
    if (message) setOrClearFieldError(field, message)
    else setOrClearFieldError(field, '')
  }

  async function uploadDocument(documentType: DocumentType, file: File, expiresOn: string) {
    setUploading(documentType)
    try {
      const upload = await authorizedRequest({
        action: 'create_upload',
        documentType,
        expiresOn,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      })
      if (!upload.path || !upload.token || !upload.draftId) throw new Error('The upload could not be prepared. Please try again.')

      const { error: uploadError } = await supabase.storage
        .from('driver-eligibility-documents')
        .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type })
      if (uploadError) throw uploadError

      await authorizedRequest({ action: 'complete_upload', documentType, expiresOn, path: upload.path, draftId: upload.draftId })
      return true
    } catch (uploadError) {
      setSystemError(uploadError instanceof Error ? uploadError.message : 'The document could not be uploaded. Please try again.')
      return false
    } finally {
      setUploading(null)
    }
  }

  const registration = eligibility?.registration
  const insurance = eligibility?.insurance
  const registrationNeedsUpload = !registration || !['pending', 'approved'].includes(registration.status)
  const insuranceNeedsUpload = !insurance || !['pending', 'approved'].includes(insurance.status)

  async function submitEligibility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: FieldErrors = {
      registrationExpiry: futureDateError(registrationExpiry),
      registrationFile: registrationNeedsUpload ? fileError(registrationFile) : '',
      insuranceExpiry: futureDateError(insuranceExpiry),
      insuranceFile: insuranceNeedsUpload ? fileError(insuranceFile) : '',
    }
    const validErrors = Object.fromEntries(Object.entries(nextErrors).filter(([, message]) => Boolean(message))) as FieldErrors
    setFieldErrors(validErrors)
    setSystemError('')
    if (Object.keys(validErrors).length) return

    setSubmitting(true)
    const registrationUploaded = !registrationFile || await uploadDocument('registration', registrationFile, registrationExpiry)
    const insuranceUploaded = registrationUploaded && (!insuranceFile || await uploadDocument('insurance', insuranceFile, insuranceExpiry))
    if (insuranceUploaded) {
      setRegistrationFile(null)
      setInsuranceFile(null)
      await refreshStatus()
    }
    setSubmitting(false)
  }
  const errorMessages = Object.values(fieldErrors)

  if (loading) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#111', color: '#777' }}>Loading Driver Eligibility...</main>

  return (
    <main style={{ minHeight: '100vh', background: '#111', color: '#e0e0e0', padding: '16px' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button type="button" onClick={() => router.push('/profile')} aria-label="Back to profile" style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '22px', cursor: 'pointer' }}>←</button>
          <h1 style={{ margin: 0, fontSize: '18px' }}>Driver Eligibility</h1>
        </header>

        <section style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '16px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: '16px' }}>New York Driver documents</h2>
          <p style={{ margin: '0 0 12px', color: '#aaa', fontSize: '13px', lineHeight: 1.5 }}>Upload your current New York vehicle registration and proof of insurance. Documents remain private and are not visible on your public profile.</p>
          <p style={{ margin: '0 0 18px', color: '#888', fontSize: '12px', lineHeight: 1.5 }}>PDF, JPEG, or PNG only. Maximum 10 MB per document. Your Driver access remains unavailable while verification is pending; Rider mode remains available.</p>
          <p style={{ margin: '0 0 18px', color: '#888', fontSize: '12px', lineHeight: 1.5 }}>Incomplete document uploads are automatically deleted within 24 hours. Submitted documents remain private while awaiting review.</p>
          {(errorMessages.length > 0 || systemError) && (
            <div role="alert" aria-live="assertive" style={{ marginBottom: '16px', border: '1px solid #f87171', borderRadius: '10px', background: '#2a1a1a', padding: '12px 14px', color: '#fecaca', fontSize: '13px', lineHeight: 1.5 }}>
              <strong>Please correct the following:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                {errorMessages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
                {systemError && <li>{systemError}</li>}
              </ul>
            </div>
          )}
          <p role="status" style={{ color: statusColor(identityStatus), fontSize: '13px' }}>Identity verification: {statusLabel(identityStatus)}</p>
          <p role="status" style={{ color: statusColor(eligibility?.overallStatus || 'incomplete'), fontSize: '13px', marginBottom: '20px' }}>Driver Eligibility: {statusLabel(eligibility?.overallStatus || 'incomplete')}</p>

          <form onSubmit={submitEligibility} noValidate>
            <DocumentUploadCard
              idPrefix="registration"
              title="Vehicle registration"
              status={registration?.status || 'not_submitted'}
              expiresOn={registrationExpiry}
              selectedFile={registrationFile}
              errors={{ expiry: fieldErrors.registrationExpiry, file: fieldErrors.registrationFile }}
              onExpiryChange={value => onExpiryChange('registrationExpiry', value)}
              onFileChange={event => onFileChange('registrationFile', event)}
              uploading={uploading === 'registration'}
              disabled={submitting}
            />
            <DocumentUploadCard
              idPrefix="insurance"
              title="Proof of insurance"
              status={insurance?.status || 'not_submitted'}
              expiresOn={insuranceExpiry}
              selectedFile={insuranceFile}
              errors={{ expiry: fieldErrors.insuranceExpiry, file: fieldErrors.insuranceFile }}
              onExpiryChange={value => onExpiryChange('insuranceExpiry', value)}
              onFileChange={event => onFileChange('insuranceFile', event)}
              uploading={uploading === 'insurance'}
              disabled={submitting}
            />

            <button type="submit" disabled={submitting} style={{ width: '100%', marginBottom: '10px', border: 'none', borderRadius: '10px', padding: '13px', background: '#c8b86a', color: '#111', fontWeight: '700', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'SUBMITTING DOCUMENTS...' : 'SUBMIT DRIVER ELIGIBILITY'}
            </button>
          </form>
          <button type="button" onClick={() => router.push('/feed')} style={{ width: '100%', marginTop: '4px', border: '0.5px solid #555', borderRadius: '10px', padding: '13px', background: 'transparent', color: '#ddd', fontWeight: '700', cursor: 'pointer' }}>USE RIDER MODE WHILE WAITING</button>
        </section>
      </div>
    </main>
  )
}

function DocumentUploadCard({ idPrefix, title, status, expiresOn, selectedFile, errors, onExpiryChange, onFileChange, uploading, disabled }: {
  idPrefix: string
  title: string
  status: DocumentStatus
  expiresOn: string
  selectedFile: File | null
  errors: { expiry?: string; file?: string }
  onExpiryChange: (value: string) => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  uploading: boolean
  disabled: boolean
}) {
  const expiryErrorId = `${idPrefix}-expiry-error`
  const fileErrorId = `${idPrefix}-file-error`
  const invalidBorder = '1px solid #f87171'
  const visibleDateStyle = { display: 'block', width: '100%', minHeight: '44px', marginTop: '6px', boxSizing: 'border-box' as const, background: '#2b2b2b', border: errors.expiry ? invalidBorder : '1px solid #777', borderRadius: '8px', padding: '10px 12px', color: '#fff', colorScheme: 'dark' as const, fontSize: '14px' }

  return (
    <section style={{ marginBottom: '16px', padding: '14px', background: '#222', border: '0.5px solid #333', borderRadius: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>{title}</h3>
        <span style={{ color: statusColor(status), fontSize: '11px', fontWeight: '700' }}>{statusLabel(status)}</span>
      </div>
      <label htmlFor={`${idPrefix}-expiry`} style={{ display: 'block', marginBottom: '10px', color: '#aaa', fontSize: '12px' }}>
        EXPIRATION DATE <span style={{ color: '#f87171' }}>*</span>
      </label>
      <input id={`${idPrefix}-expiry`} type="date" value={expiresOn} min={tomorrow()} onChange={event => onExpiryChange(event.target.value)} aria-invalid={Boolean(errors.expiry)} aria-describedby={errors.expiry ? expiryErrorId : undefined} disabled={disabled} style={visibleDateStyle} />
      {errors.expiry && <p id={expiryErrorId} role="alert" style={{ margin: '6px 0 10px', color: '#f87171', fontSize: '12px' }}>{errors.expiry}</p>}
      <label htmlFor={`${idPrefix}-file`} style={{ display: 'block', marginTop: errors.expiry ? 0 : '10px', color: '#aaa', fontSize: '12px', cursor: disabled ? 'wait' : 'pointer' }}>
        DOCUMENT <span style={{ color: '#f87171' }}>*</span>
      </label>
      <input id={`${idPrefix}-file`} type="file" accept="application/pdf,image/jpeg,image/png" onChange={onFileChange} aria-invalid={Boolean(errors.file)} aria-describedby={errors.file ? fileErrorId : undefined} disabled={disabled} style={{ display: 'block', width: '100%', marginTop: '6px', border: errors.file ? invalidBorder : '1px solid transparent', borderRadius: '8px', padding: '8px', boxSizing: 'border-box', background: '#1a1a1a', color: '#ccc', fontSize: '12px' }} />
      {selectedFile && <p style={{ margin: '7px 0 0', color: '#aaa', fontSize: '12px' }}>Selected: {selectedFile.name}</p>}
      {errors.file && <p id={fileErrorId} role="alert" style={{ margin: '6px 0 0', color: '#f87171', fontSize: '12px' }}>{errors.file}</p>}
      {uploading && <p role="status" style={{ margin: '10px 0 0', color: '#c8b86a', fontSize: '12px' }}>Uploading securely...</p>}
    </section>
  )
}