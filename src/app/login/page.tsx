'use client'

import { useEffect, useState } from 'react'
import { supabase, type Profile } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import FieldHelp from '@/components/FieldHelp'
import { sanitizeFullName, sanitizePassword, validateEmail, validateFullName, validatePassword } from '@/lib/inputValidation'

type AccountRole = '' | 'rider' | 'driver' | 'both'
type SessionMode = 'rider' | 'driver'
type VehicleOption = { id: string; name: string }

function SeatBeltLogo({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" aria-hidden="true">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6a6a6a"/><stop offset="25%" stopColor="#a0a0a0"/><stop offset="50%" stopColor="#787878"/><stop offset="75%" stopColor="#b0b0b0"/><stop offset="100%" stopColor="#505050"/></linearGradient>
        <linearGradient id="bk" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#888"/><stop offset="40%" stopColor="#bbb"/><stop offset="100%" stopColor="#555"/></linearGradient>
        <linearGradient id="wh" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#4a4a4a"/><stop offset="50%" stopColor="#6a6a6a"/><stop offset="100%" stopColor="#282828"/></linearGradient>
      </defs>
      <path d="M 200 62 C 240 62 275 80 275 118 C 275 158 240 172 200 182 C 160 192 125 208 125 248 C 125 286 158 308 200 310" fill="none" stroke="#222" strokeWidth="48" strokeLinecap="round" opacity="0.4"/>
      <path d="M 200 62 C 240 62 275 80 275 118 C 275 158 240 172 200 182 C 160 192 125 208 125 248 C 125 286 158 308 200 310" fill="none" stroke="url(#bg)" strokeWidth="42" strokeLinecap="round"/>
      <rect x="170" y="28" width="60" height="46" rx="7" fill="url(#bk)"/><rect x="170" y="308" width="60" height="46" rx="7" fill="url(#bk)"/>
      <circle cx="200" cy="196" r="46" fill="url(#wh)" stroke="#777" strokeWidth="1.5"/><circle cx="200" cy="196" r="36" fill="none" stroke="#888" strokeWidth="9"/><circle cx="200" cy="196" r="12" fill="url(#bk)"/><circle cx="200" cy="196" r="7" fill="#1a1a1a"/>
    </svg>
  )
}

const fieldStyle = { width: '100%', background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#e0e0e0', outline: 'none' }
const labelStyle = { fontSize: '11px', color: '#555', display: 'block', marginBottom: '5px', letterSpacing: '0.5px' }

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [accountRole, setAccountRole] = useState<AccountRole>('')
  const [hasAgreed, setHasAgreed] = useState(false)
  const [carMake, setCarMake] = useState('')
  const [carMakeId, setCarMakeId] = useState('')
  const [carModel, setCarModel] = useState('')
  const [carYear, setCarYear] = useState('')
  const [makes, setMakes] = useState<VehicleOption[]>([])
  const [models, setModels] = useState<VehicleOption[]>([])
  const [vehicleLoading, setVehicleLoading] = useState(false)
  const [vehicleError, setVehicleError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionProfile, setSessionProfile] = useState<Profile | null>(null)
  const [sessionUserId, setSessionUserId] = useState('')
  const [sessionMode, setSessionMode] = useState<SessionMode | ''>('')
  const [showSessionChoice, setShowSessionChoice] = useState(false)
  const [isExistingReassignment, setIsExistingReassignment] = useState(false)

  const driverCapable = accountRole === 'driver' || accountRole === 'both'
  const years = Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, index) => String(new Date().getFullYear() - index))

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) void openSessionChoice(session.user.id)
    })
  }, [])

  async function loadMakes() {
    if (makes.length > 0) return
    setVehicleLoading(true)
    setVehicleError('')
    try {
      const response = await fetch('/api/vehicles?type=makes')
      const data = await response.json() as { makes?: VehicleOption[]; error?: string }
      if (!response.ok || !data.makes) throw new Error(data.error || 'Vehicle makes are unavailable.')
      setMakes(data.makes)
    } catch (vehicleLoadError) {
      setVehicleError(vehicleLoadError instanceof Error ? vehicleLoadError.message : 'Vehicle makes are unavailable.')
    } finally {
      setVehicleLoading(false)
    }
  }

  async function loadModels(year: string, makeId: string) {
    if (!year || !makeId) return
    setVehicleLoading(true)
    setVehicleError('')
    try {
      const response = await fetch(`/api/vehicles?type=models&year=${encodeURIComponent(year)}&makeId=${encodeURIComponent(makeId)}`)
      const data = await response.json() as { models?: VehicleOption[]; error?: string }
      if (!response.ok || !data.models) throw new Error(data.error || 'Vehicle models are unavailable.')
      setModels(data.models)
    } catch (vehicleLoadError) {
      setVehicleError(vehicleLoadError instanceof Error ? vehicleLoadError.message : 'Vehicle models are unavailable.')
    } finally {
      setVehicleLoading(false)
    }
  }

  async function openSessionChoice(userId: string, newProfile?: Profile) {
    setLoading(true)
    const profile = newProfile || (await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()).data as Profile | null
    setLoading(false)
    if (!profile) {
      setError('Your account profile could not be loaded. Please try again.')
      return
    }

    const canDrive = profile.is_driver
    const savedMode = profile.last_session_mode
    setSessionProfile(profile)
    setSessionUserId(userId)
    setSessionMode(savedMode && (savedMode === 'rider' || canDrive) ? savedMode : canDrive && profile.account_role === 'driver' ? 'driver' : 'rider')
    setIsExistingReassignment(!profile.session_mode_reassignment_seen)
    setShowSessionChoice(true)
  }

  async function confirmSessionMode() {
    if (!sessionProfile || !sessionUserId || !sessionMode) return
    if (sessionMode === 'driver' && !sessionProfile.is_driver) {
      setError('Driver mode is not available for this account.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ last_session_mode: sessionMode, session_mode_reassignment_seen: true })
      .eq('id', sessionUserId)
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    router.push('/feed')
  }

  async function handleAuth() {
    setLoading(true)
    setError('')
    const emailError = validateEmail(email)
    if (emailError) { setError(emailError); setLoading(false); return }

    if (isSignUp) {
      if (!hasAgreed) { setError('Please agree to the Terms of Service and Privacy Policy.'); setLoading(false); return }
      const nameError = validateFullName(fullName)
      if (nameError) { setError(nameError); setLoading(false); return }
      const passwordError = validatePassword(password)
      if (passwordError) { setError(passwordError); setLoading(false); return }
      if (!accountRole) { setError('Choose whether you will use Seatbelt as a Rider, Driver, or Both.'); setLoading(false); return }
      if (driverCapable && (!carYear || !carMake || !carModel)) { setError('Choose your vehicle year, make, and model.'); setLoading(false); return }

      const normalizedName = fullName.trim()
      const initials = normalizedName.split(' ').map(name => name[0]).join('').toUpperCase().slice(0, 2)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: normalizedName,
            account_role: accountRole,
            car_make: driverCapable ? carMake : '',
            car_model: driverCapable ? carModel : '',
            car_year: driverCapable ? carYear : '',
          },
        },
      })
      if (signUpError || !data.user) { setError(signUpError?.message || 'Account creation did not complete.'); setLoading(false); return }

      if (!data.session) {
        setError('Account created. Confirm your email, then sign in to choose how this session starts.')
        setLoading(false)
        setIsSignUp(false)
        return
      }

      const newProfile: Profile = {
        id: data.user.id, full_name: normalizedName, avatar_initials: initials, car_make: driverCapable ? carMake : '', car_model: driverCapable ? carModel : '', car_year: driverCapable ? carYear : '', rating: 0, total_rides: 0, is_driver: driverCapable, account_role: accountRole, last_session_mode: null, session_mode_reassignment_seen: true,
      }
      setLoading(false)
      await openSessionChoice(data.user.id, newProfile)
      return
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError || !data.user) { setError(signInError?.message || 'Sign in did not complete.'); setLoading(false); return }
    setLoading(false)
    await openSessionChoice(data.user.id)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#111' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}><div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}><SeatBeltLogo size={100} /></div><h1 style={{ fontSize: '28px', fontWeight: '700', color: '#e0e0e0', margin: '0 0 6px', letterSpacing: '4px' }}>SEATBELT</h1><p style={{ color: '#444', fontSize: '11px', margin: 0, letterSpacing: '3px' }}>The Way Rideshare Should Be.</p></div>
        <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '28px', border: '0.5px solid #2a2a2a' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '500', margin: '0 0 20px', color: '#ccc' }}>{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
          {error && <div role="alert" style={{ background: '#2a1a1a', border: '0.5px solid #5a2a2a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#f87171' }}>{error}</div>}
          {isSignUp && <div style={{ marginBottom: '14px' }}><label style={labelStyle}>FULL NAME <span style={{ color: '#f87171' }}>*</span><FieldHelp fieldName="full name">Required. Use 1–32 characters and up to four name parts. Letters, numbers, spaces, hyphens, and apostrophes are accepted. Example: Jordan A. Lee</FieldHelp></label><input type="text" value={fullName} onChange={event => setFullName(sanitizeFullName(event.target.value))} placeholder="Your full name (required)" maxLength={32} autoComplete="name" style={fieldStyle} /></div>}
          <div style={{ marginBottom: '14px' }}><label style={labelStyle}>EMAIL<FieldHelp fieldName="email">Required. Enter a standard personal, school, work, or business email address. Spaces and incomplete addresses are rejected. Example: you@example.com</FieldHelp></label><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@email.com" autoComplete="email" style={fieldStyle} /></div>
          <div style={{ marginBottom: '20px' }}><label style={labelStyle}>PASSWORD<FieldHelp fieldName="password">Required for signup. Use 8–32 characters with uppercase, lowercase, a number, and one of !.@,#$%&amp;*_-+. Spaces and other symbols are rejected. Example: Seatbelt7!</FieldHelp></label><input type="password" value={password} onChange={event => setPassword(isSignUp ? sanitizePassword(event.target.value) : event.target.value)} placeholder={isSignUp ? '8–32 characters' : 'Your password'} maxLength={isSignUp ? 32 : undefined} autoComplete={isSignUp ? 'new-password' : 'current-password'} style={fieldStyle} /></div>
          {isSignUp && <><div style={{ marginBottom: '14px' }}><label htmlFor="account-role" style={labelStyle}>WHAT ARE YOU? <span style={{ color: '#f87171' }}>*</span></label><select id="account-role" value={accountRole} onChange={event => { const role = event.target.value as AccountRole; setAccountRole(role); setCarMake(''); setCarMakeId(''); setCarModel(''); setCarYear(''); setModels([]); setVehicleError(''); if (role === 'driver' || role === 'both') void loadMakes() }} style={fieldStyle}><option value="">Choose one</option><option value="rider">Rider</option><option value="driver">Driver</option><option value="both">Both</option></select></div>
          {driverCapable && <div style={{ background: '#222', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '0.5px solid #333' }}><p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 10px', letterSpacing: '0.5px' }}>DRIVER EXTENDED — YOUR VEHICLE</p>{vehicleError && <p role="alert" style={{ color: '#f87171', fontSize: '12px', margin: '0 0 10px' }}>{vehicleError} <button type="button" onClick={() => void loadMakes()} style={{ color: '#c8b86a', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Retry</button></p>}<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}><select value={carYear} onChange={event => { const year = event.target.value; setCarYear(year); setCarModel(''); setModels([]); if (year && carMakeId) void loadModels(year, carMakeId) }} style={fieldStyle}><option value="">Vehicle year</option>{years.map(year => <option key={year} value={year}>{year}</option>)}</select><select value={carMakeId} disabled={vehicleLoading || makes.length === 0} onChange={event => { const makeId = event.target.value; const selectedMake = makes.find(make => make.id === makeId); setCarMakeId(makeId); setCarMake(selectedMake?.name || ''); setCarModel(''); setModels([]); if (carYear && makeId) void loadModels(carYear, makeId) }} style={{ ...fieldStyle, opacity: vehicleLoading || makes.length === 0 ? 0.7 : 1 }}><option value="">{vehicleLoading ? 'Loading makes…' : 'Vehicle make'}</option>{makes.map(make => <option key={make.id} value={make.id}>{make.name}</option>)}</select><select value={carModel} disabled={vehicleLoading || !carYear || !carMakeId} onChange={event => setCarModel(event.target.value)} style={{ ...fieldStyle, opacity: vehicleLoading || !carYear || !carMakeId ? 0.7 : 1 }}><option value="">{vehicleLoading ? 'Loading models…' : 'Vehicle model'}</option>{models.map(model => <option key={model.id} value={model.name}>{model.name}</option>)}</select></div></div>}</>}
          {isSignUp && <div style={{ marginBottom: '20px' }}><label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '12px', lineHeight: '1.5', color: '#aaa' }}><input type="checkbox" checked={hasAgreed} onChange={event => setHasAgreed(event.target.checked)} style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#c8b86a' }} /><span>I agree to the <a href="/terms-of-service" target="_blank" rel="noreferrer" style={{ color: '#c8b86a' }}>Terms of Service</a> and <a href="/privacy-policy" target="_blank" rel="noreferrer" style={{ color: '#c8b86a' }}>Privacy Policy</a>.</span></label></div>}
          <button onClick={handleAuth} disabled={loading} style={{ width: '100%', background: '#c8b86a', color: '#111', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', opacity: loading ? 0.7 : 1, cursor: 'pointer' }}>{loading ? 'PLEASE WAIT...' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}</button>
          {!isSignUp && <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px' }}><button type="button" onClick={async () => { if (!email) { setError('Enter your email first.'); return } const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); if (resetError) setError(resetError.message); else alert('Password reset email sent! Check your inbox.') }} style={{ color: '#c8b86a', cursor: 'pointer', fontSize: '12px', background: 'none', border: 'none' }}>Forgot password?</button></p>}
          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#444' }}>{isSignUp ? 'Already have an account?' : "Don't have an account?"} <button type="button" onClick={() => { setIsSignUp(!isSignUp); setHasAgreed(false); setError('') }} style={{ color: '#c8b86a', fontWeight: '500', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>{isSignUp ? 'Sign in' : 'Sign up'}</button></p>
        </div>
      </div>
      {showSessionChoice && sessionProfile && <div role="dialog" aria-modal="true" aria-labelledby="session-choice-title" style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.8)' }}><div style={{ width: '100%', maxWidth: '400px', background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '16px', padding: '24px' }}><h2 id="session-choice-title" style={{ color: '#e0e0e0', margin: '0 0 10px', fontSize: '18px' }}>{isExistingReassignment ? 'Choose your new session' : 'How would you like to start this session?'}</h2>{isExistingReassignment && <><p style={{ color: '#aaa', fontSize: '13px', lineHeight: 1.5 }}>Changes have been made to Seatbelt session modes. Select how you would like to start this new session.</p><p style={{ color: '#777', fontSize: '12px', lineHeight: 1.5 }}>*User profile and data are not impacted; this only chooses how the new session starts. Your account information remains safe and secure.</p></>}<fieldset style={{ border: 0, padding: 0, margin: '18px 0' }}><legend style={labelStyle}>START THIS SESSION AS</legend><label style={{ display: 'flex', gap: '10px', padding: '10px 0', color: '#ddd', cursor: 'pointer' }}><input type="radio" name="session-mode" value="rider" checked={sessionMode === 'rider'} onChange={() => setSessionMode('rider')} />Rider</label><label style={{ display: 'flex', gap: '10px', padding: '10px 0', color: sessionProfile.is_driver ? '#ddd' : '#666', cursor: sessionProfile.is_driver ? 'pointer' : 'not-allowed' }}><input type="radio" name="session-mode" value="driver" disabled={!sessionProfile.is_driver} checked={sessionMode === 'driver'} onChange={() => setSessionMode('driver')} />Driver {!sessionProfile.is_driver && '(not enabled for this account)'}</label></fieldset><button type="button" onClick={() => void confirmSessionMode()} disabled={!sessionMode || loading} style={{ width: '100%', background: '#c8b86a', color: '#111', border: 0, borderRadius: '10px', padding: '13px', fontWeight: '700', cursor: 'pointer', opacity: !sessionMode || loading ? 0.7 : 1 }}>CONTINUE AS {sessionMode ? sessionMode.toUpperCase() : '…'}</button></div></div>}
    </div>
  )
}