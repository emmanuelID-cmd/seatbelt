import 'server-only'
import Stripe from 'stripe'

const API_VERSION = '2026-06-24.dahlia' as const

export function getIdentityStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('Stripe Identity is not configured.')
  return new Stripe(secretKey, { apiVersion: API_VERSION })
}

export function identityResultsConfigured() {
  return Boolean(process.env.STRIPE_IDENTITY_RESTRICTED_KEY)
}

export async function getVerifiedDriverLicenseExpiry(sessionId: string) {
  const restrictedKey = process.env.STRIPE_IDENTITY_RESTRICTED_KEY
  if (!restrictedKey) return null
  const stripe = new Stripe(restrictedKey, { apiVersion: API_VERSION })
  const session = await stripe.identity.verificationSessions.retrieve(sessionId, {
    expand: ['last_verification_report'],
  })
  const report = session.last_verification_report
  if (session.status !== 'verified' || !report || typeof report === 'string') return null
  if (report.document?.type !== 'driving_license') return null
  const expiration = report.document?.expiration_date
  if (!expiration?.year || !expiration.month || !expiration.day) return null
  const date = new Date(Date.UTC(expiration.year, expiration.month - 1, expiration.day))
  if (date.getUTCFullYear() !== expiration.year || date.getUTCMonth() !== expiration.month - 1 || date.getUTCDate() !== expiration.day) return null
  return date.toISOString().slice(0, 10)
}
