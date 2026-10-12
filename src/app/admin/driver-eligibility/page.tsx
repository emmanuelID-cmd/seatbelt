'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type DocumentType = 'registration' | 'insurance'
type ReviewAction = 'approved' | 'rejected' | 'needs_update'
type ReasonCode = 'missing_document' | 'expired_document' | 'unreadable_document' | 'unsupported_document' | 'information_mismatch' | 'manual_review_required'

type Submission = {
  user_id: string
  registration_status: string
  registration_expires_on: string | null
  has_registration_document: boolean
  registration_rejection_code: ReasonCode | null
  insurance_status: string
  insurance_expires_on: string | null
  has_insurance_document: boolean
  insurance_rejection_code: ReasonCode | null
  overall_status: string
  updated_at: string
}

const reasonOptions: { value: ReasonCode; label: string }[] = [
  { value: 'missing_document', label: 'Missing document' },
  { value: 'expired_document', label: 'Expired document' },
  { value: 'unreadable_document', label: 'Unreadable document' },
  { value: 'unsupported_document', label: 'Unsupported document' },
  { value: 'information_mismatch', label: 'Information mismatch' },
  { value: 'manual_review_required', label: 'Manual review required' },
]

function statusLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function statusColor(value: string) {
  if (value === 'approved') return '#6dba6d'
  if (value === 'rejected' || value === 'expired') return '#f87171'
  return '#c8b86a'
}

export default function DriverEligibilityReviewPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [reasonCode, setReasonCode] = useState<ReasonCode>('unreadable_document')
  const [documentUrl, setDocumentUrl] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const authorizedRequest = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sign in is required.')
    const response = await fetch(path, {
      ...init,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(init?.headers || {}) },
    })
    const data = await response.json() as { error?: string; submissions?: Submission[]; signedUrl?: string }
    if (!response.ok) throw new Error(data.error || 'Administrator review is temporarily unavailable.')
    return data
  }, [])

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await authorizedRequest('/api/admin/driver-eligibility')
      setSubmissions(data.submissions || [])
      setSelectedId(current => data.submissions?.some(item => item.user_id === current) ? current : data.submissions?.[0]?.user_id || '')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Administrator review is temporarily unavailable.')
    } finally {
      setLoading(false)
    }
  }, [authorizedRequest])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadQueue() }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadQueue])

  const selected = submissions.find(item => item.user_id === selectedId) || null

  async function openDocument(type: DocumentType) {
    if (!selected) return
    setWorking(true)
    setError('')
    try {
      const data = await authorizedRequest(`/api/admin/driver-eligibility/documents?userId=${encodeURIComponent(selected.user_id)}&documentType=${type}`)
      setDocumentUrl(data.signedUrl || '')
      setDocumentType(type)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Document access is temporarily unavailable.')
    } finally {
      setWorking(false)
    }
  }

  async function review(type: DocumentType, action: ReviewAction) {
    if (!selected) return
    setWorking(true)
    setError('')
    setMessage('')
    try {
      await authorizedRequest('/api/admin/driver-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectUserId: selected.user_id, documentType: type, action, reasonCode: action === 'approved' ? undefined : reasonCode }),
      })
      setMessage(`${statusLabel(action)} review saved.`)
      setDocumentUrl('')
      setDocumentType(null)
      await loadQueue()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The review could not be saved.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#111', color: '#e0e0e0', padding: '16px' }}>
      <div style={{ maxWidth: '920px', margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button type="button" onClick={() => router.push('/profile/settings')} aria-label="Back to settings" style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '22px', cursor: 'pointer' }}>←</button>
          <h1 style={{ margin: 0, fontSize: '20px' }}>Driver Eligibility Review</h1>
        </header>

        {(error || message) && <div role={error ? 'alert' : 'status'} style={{ marginBottom: '16px', border: `1px solid ${error ? '#f87171' : '#6dba6d'}`, borderRadius: '10px', background: error ? '#2a1a1a' : '#1a2a1a', padding: '12px 14px', color: error ? '#fecaca' : '#b8e0b8' }}>{error || message}</div>}

        {loading ? <p role="status">Loading review queue...</p> : submissions.length === 0 ? <section style={{ background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '14px', padding: '20px' }}>No pending Driver Eligibility submissions.</section> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.8fr) minmax(320px, 1.2fr)', gap: '16px' }}>
            <section style={{ background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '14px', padding: '14px' }}>
              <h2 style={{ margin: '0 0 12px', fontSize: '15px' }}>Submissions</h2>
              {submissions.map(item => <button key={item.user_id} type="button" onClick={() => { setSelectedId(item.user_id); setDocumentUrl(''); setDocumentType(null) }} style={{ display: 'block', width: '100%', marginBottom: '8px', padding: '12px', textAlign: 'left', border: item.user_id === selectedId ? '1px solid #c8b86a' : '1px solid #333', borderRadius: '9px', background: item.user_id === selectedId ? '#292617' : '#222', color: '#ddd', cursor: 'pointer' }}><strong>{item.user_id}</strong><br /><span style={{ color: statusColor(item.overall_status), fontSize: '12px' }}>{statusLabel(item.overall_status)}</span></button>)}
            </section>

            {selected && <section style={{ background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '14px', padding: '18px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '15px' }}>Submission details</h2>
              <p style={{ color: '#888', fontSize: '12px', marginTop: 0 }}>Private review for account {selected.user_id}</p>
              {(['registration', 'insurance'] as const).map(type => {
                const prefix = type === 'registration' ? 'registration' : 'insurance'
                const status = selected[`${prefix}_status` as 'registration_status' | 'insurance_status']
                const expires = selected[`${prefix}_expires_on` as 'registration_expires_on' | 'insurance_expires_on']
                const hasDocument = prefix === 'registration' ? selected.has_registration_document : selected.has_insurance_document
                return <div key={type} style={{ borderTop: '1px solid #333', padding: '14px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}><strong>{statusLabel(type)}</strong><span style={{ color: statusColor(status), fontSize: '12px' }}>{statusLabel(status)}</span></div><p style={{ color: '#999', fontSize: '12px' }}>Expiration: {expires || 'Not provided'}</p><button type="button" disabled={!hasDocument || working} onClick={() => void openDocument(type)} style={{ marginRight: '8px', border: '1px solid #777', borderRadius: '8px', padding: '8px 10px', background: 'transparent', color: '#ddd', cursor: hasDocument ? 'pointer' : 'not-allowed', opacity: hasDocument ? 1 : 0.5 }}>Open private preview</button><button type="button" disabled={working} onClick={() => void review(type, 'approved')} style={{ marginRight: '8px', border: 'none', borderRadius: '8px', padding: '8px 10px', background: '#6dba6d', color: '#111', cursor: 'pointer' }}>Approve</button><button type="button" disabled={working} onClick={() => void review(type, 'needs_update')} style={{ border: '1px solid #c8b86a', borderRadius: '8px', padding: '8px 10px', background: 'transparent', color: '#c8b86a', cursor: 'pointer' }}>Request update</button></div>
              })}
              <label style={{ display: 'block', marginTop: '8px', color: '#aaa', fontSize: '12px' }}>Reason for rejection or requested update<select value={reasonCode} onChange={event => setReasonCode(event.target.value as ReasonCode)} style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px', background: '#222', color: '#eee', border: '1px solid #555', borderRadius: '8px' }}>{reasonOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              {documentUrl && <div style={{ marginTop: '16px' }}>
                <p style={{ color: '#c8b86a', fontSize: '12px' }}>Private preview expires in 10 minutes.</p>
                <iframe src={documentUrl} title={`${documentType || 'Document'} private preview`} style={{ display: 'block', width: '100%', height: '520px', border: '1px solid #555', borderRadius: '8px', background: '#111' }} />
              </div>}
            </section>}
          </div>
        )}
      </div>
    </main>
  )
}
