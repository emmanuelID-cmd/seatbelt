import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const admin = await getAuthenticatedAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 })

    return NextResponse.json({
      assuranceLevel: admin.assuranceLevel,
      requiresStepUp: admin.assuranceLevel !== 'aal2',
    })
  } catch (error) {
    console.error('Admin security status failed', {
      message: error instanceof Error ? error.message : 'Unknown server error',
    })
    return NextResponse.json({ error: 'Administrator security is temporarily unavailable. Please try again later.' }, { status: 503 })
  }
}