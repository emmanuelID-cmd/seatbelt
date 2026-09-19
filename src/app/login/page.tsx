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
  const [makesLoading, setMakesLoading] = useState(false)
  const [makesError, setMakesError] = useState('')
  const [makesLoaded, setMakesLoaded] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({})
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
    setMakesLoading(true)
    setMakesError('')
    setMakesLoaded(false)
    try {
      const response = await fetch('/api/vehicles?type=makes')
      const data = await response.json() as { makes?: VehicleOption[]; error?: string }
      if (!response.ok || !data.makes) throw new Error(data.error || 'Vehicle makes are unavailable.')
      setMakes(data.makes)
      setMakesLoaded(true)
    } catch (vehicleLoadError) {
      setMakesError(vehicleLoadError instanceof Error ? vehicleLoadError.message : 'Vehicle makes are unavailable.')
    } finally {
      setMakesLoading(false)
    }
  }

  async function loadModels(year: string, makeId: string) {
    if (!year || !makeId) return
    setModelsLoading(true)
    setModelsError('')
    setModelsLoaded(false)
    try {
      const response = await fetch(`/api/vehicles?type=models&year=${encodeURIComponent(year)}&makeId=${encodeURIComponent(makeId)}`)
      const data = await response.json() as { models?: VehicleOption[]; error?: string }
      if (!response.ok || !data.models) throw new Error(data.error || 'Vehicle models are unavailable.')
      setModels(data.models)
      setModelsLoaded(true)
    } catch (vehicleLoadError) {
      setModelsError(vehicleLoadError instanceof Error ? vehicleLoadError.message : 'Vehicle models are unavailable.')
    } finally {
      setModelsLoading(false)
    }
  }

  function clearSignupError(fieldName: string) {
    setError(current => current === 'Please correct the highlighted fields before creating your account.' ? '' : current)
    setSignupErrors(current => {
      if (!current[fieldName]) return current
      const next = { ...current }
      delete next[fieldName]
      return next
    })
  }

  function getSignupValidationErrors() {
    const next: Record<string, string> = {}
    const emailError = validateEmail(email)
    const nameError = validateFullName(fullName)
    const passwordError = validatePassword(password)

    if (nameError) next.fullName = nameError
    if (emailError) next.email = emailError
    if (passwordError) next.password = passwordError
    if (!accountRole) next.accountRole = 'Choose whether you will use Seatbelt as a Rider, Driver, or Both.'
    if (driverCapable && !carYear) next.carYear = 'Choose your vehicle year.'
    if (driverCapable && !carMake) next.carMake = 'Choose your vehicle make.'
    if (driverCapable && !carModel) next.carModel = 'Choose your vehicle model.'
    if (!hasAgreed) next.hasAgreed = 'Agree to the Terms of Service and Privacy Policy.'

    return next
  }

  function getSignupFieldStyle(fieldName: string) {
    return signupErrors[fieldName]
      ? { ...fieldStyle, border: '1px solid #f87171' }
      : fieldStyle
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
    if (sessionMode === 'driver') {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        setError('Sign in is required.')
        return
      }
      const response = await fetch('/api/driver-eligibility', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate_driver_mode' }),
      })
      const activation = await response.json() as { activated?: boolean; error?: string }
      setLoading(false)
      if (!response.ok) {
        setError(activation.error || 'Driver mode is temporarily unavailable. Please try again later.')
        return
      }
      router.push(activation.activated ? '/feed' : '/verify-identity')
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ last_session_mode: 'rider', session_mode_reassignment_seen: true })
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

    if (isSignUp) {
      const validationErrors = getSignupValidationErrors()
      if (Object.keys(validationErrors).length > 0) {
        setSignupErrors(validationErrors)
        setError('Please correct the highlighted fields before creating your account.')
        setLoading(false)
        return
      }

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
        id: data.user.id, full_name: normalizedName, avatar_initials: initials, car_make: driverCapable ? carMake : '', car_model: driverCapable ? carModel : '', car_year: driverCapable ? carYear : '', rating: 0, total_rides: 0, is_driver: driverCapable, account_role: accountRole as 'rider' | 'driver' | 'both', last_session_mode: null, session_mode_reassignment_seen: true,
      }
      setLoading(false)
      await openSessionChoice(data.user.id, newProfile)
      return
    }

    const emailError = validateEmail(email)
    if (emailError) { setError(emailError); setLoading(false); return }
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
          {(error || Object.keys(signupErrors).length > 0) && <div role="alert" style={{ background: '#2a1a1a', border: '0.5px solid #5a2a2a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#f87171' }}><p style={{ margin: 0 }}>{error || 'Please correct the highlighted fields.'}</p>{Object.keys(signupErrors).length > 0 && <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>{Object.values(signupErrors).map(message => <li key={message}>{message}</li>)}</ul>}</div>}
          {isSignUp && <div style={{ marginBottom: '14px' }}><label style={labelStyle}>FULL NAME <span style={{ color: '#f87171' }}>*</span><FieldHelp fieldName="full name">Required. Use 1–32 characters and up to four name parts. Letters, numbers, spaces, hyphens, and apostrophes are accepted. Example: Jordan A. Lee</FieldHelp></label><input type="text" value={fullName} onChange={event => { setFullName(sanitizeFullName(event.target.value)); clearSignupError('fullName') }} placeholder="Your full name (required)" maxLength={32} autoComplete="name" aria-invalid={Boolean(signupErrors.fullName)} style={getSignupFieldStyle('fullName')} /></div>}
          <div style={{ marginBottom: '14px' }}><label style={labelStyle}>EMAIL <span style={{ color: '#f87171' }}>*</span><FieldHelp fieldName="email">Required. Enter a standard personal, school, work, or business email address. Spaces and incomplete addresses are rejected. Example: you@example.com</FieldHelp></label><input type="email" value={email} onChange={event => { setEmail(event.target.value); clearSignupError('email') }} placeholder="you@email.com" autoComplete="email" aria-invalid={Boolean(signupErrors.email)} style={getSignupFieldStyle('email')} /></div>
          <div style={{ marginBottom: '20px' }}><label style={labelStyle}>PASSWORD <span style={{ color: '#f87171' }}>*</span><FieldHelp fieldName="password">Required for signup. Use 8–32 characters with uppercase, lowercase, a number, and one of !.@,#$%&amp;*_-+. Spaces and other symbols are rejected. Example: Seatbelt7!</FieldHelp></label><input type="password" value={password} onChange={event => { setPassword(isSignUp ? sanitizePassword(event.target.value) : event.target.value); clearSignupError('password') }} placeholder={isSignUp ? '8–32 characters' : 'Your password'} maxLength={isSignUp ? 32 : undefined} autoComplete={isSignUp ? 'new-password' : 'current-password'} aria-invalid={Boolean(signupErrors.password)} style={isSignUp ? getSignupFieldStyle('password') : fieldStyle} /></div>
          {isSignUp && <><div style={{ marginBottom: '14px' }}><label htmlFor="account-role" style={labelStyle}>WHAT ARE YOU? <span style={{ color: '#f87171' }}>*</span></label><select id="account-role" value={accountRole} onChange={event => { const role = event.target.value as AccountRole; setAccountRole(role); clearSignupError('accountRole'); setCarMake(''); setCarMakeId(''); setCarModel(''); setCarYear(''); setModels([]); setMakesError(''); setModelsError(''); setMakesLoaded(false); setModelsLoaded(false); if (role === 'driver' || role === 'both') void loadMakes() }} aria-invalid={Boolean(signupErrors.accountRole)} style={getSignupFieldStyle('accountRole')}><option value="">Choose one</option><option value="rider">Rider</option><option value="driver">Driver</option><option value="both">Both</option></select></div>
          {driverCapable && (
            <div style={{ background: '#222', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '0.5px solid #333' }}>
              <p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 10px', letterSpacing: '0.5px' }}>DRIVER VEHICLE DETAILS</p>
              {makesError && <p role="alert" style={{ color: '#f87171', fontSize: '12px', margin: '0 0 10px' }}>{makesError} <button type="button" onClick={() => void loadMakes()} style={{ color: '#c8b86a', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Retry makes</button></p>}
              {modelsError && <p role="alert" style={{ color: '#f87171', fontSize: '12px', margin: '0 0 10px' }}>{modelsError} <button type="button" onClick={() => void loadModels(carYear, carMakeId)} style={{ color: '#c8b86a', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Retry models</button></p>}
              {makesLoaded && makes.length === 0 && !makesError && <p role="status" style={{ color: '#aaa', fontSize: '12px', margin: '0 0 10px' }}>No vehicle makes were found. Try again later.</p>}
              {modelsLoaded && models.length === 0 && !modelsError && <p role="status" style={{ color: '#aaa', fontSize: '12px', margin: '0 0 10px' }}>No model records were found for this year and make. Choose another year or make.</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                <div>
                  <label htmlFor="car-year" style={labelStyle}>VEHICLE YEAR <span style={{ color: '#f87171' }}>*</span></label>
                  <select id="car-year" value={carYear} onChange={event => { const year = event.target.value; setCarYear(year); clearSignupError('carYear'); setCarModel(''); setModels([]); setModelsError(''); setModelsLoaded(false); if (year && carMakeId) void loadModels(year, carMakeId) }} aria-invalid={Boolean(signupErrors.carYear)} style={getSignupFieldStyle('carYear')}>
                    <option value="">Vehicle year</option>
                    {years.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="car-make" style={labelStyle}>VEHICLE MAKE <span style={{ color: '#f87171' }}>*</span></label>
                  <select id="car-make" value={carMakeId} disabled={makesLoading || makes.length === 0} onChange={event => { const makeId = event.target.value; const selectedMake = makes.find(make => make.id === makeId); setCarMakeId(makeId); setCarMake(selectedMake?.name || ''); clearSignupError('carMake'); setCarModel(''); setModels([]); setModelsError(''); setModelsLoaded(false); if (carYear && makeId) void loadModels(carYear, makeId) }} aria-invalid={Boolean(signupErrors.carMake)} style={{ ...getSignupFieldStyle('carMake'), opacity: makesLoading || makes.length === 0 ? 0.7 : 1 }}>
                    <option value="">{makesLoading ? 'Loading makes…' : makesError ? 'Vehicle makes unavailable' : 'Vehicle make'}</option>
                    {makes.map(make => <option key={make.id} value={make.id}>{make.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="car-model" style={labelStyle}>VEHICLE MODEL <span style={{ color: '#f87171' }}>*</span><FieldHelp fieldName="vehicle model">Required for Driver accounts. Choose the vehicle year and make first; then select a model from the available options.</FieldHelp></label>
                  <select id="car-model" value={carModel} disabled={modelsLoading || !carYear || !carMakeId || Boolean(modelsError) || (modelsLoaded && models.length === 0)} onChange={event => { setCarModel(event.target.value); clearSignupError('carModel') }} aria-invalid={Boolean(signupErrors.carModel)} style={{ ...getSignupFieldStyle('carModel'), opacity: modelsLoading || !carYear || !carMakeId || Boolean(modelsError) || (modelsLoaded && models.length === 0) ? 0.7 : 1 }}>
                    <option value="">{modelsLoading ? 'Loading models…' : modelsError ? 'Vehicle models unavailable' : modelsLoaded && models.length === 0 ? 'No models found' : 'Vehicle model'}</option>
                    {models.map(model => <option key={model.id} value={model.name}>{model.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}</>}
          {isSignUp && <div style={{ marginBottom: '20px' }}><label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '12px', lineHeight: '1.5', color: '#aaa' }}><input type="checkbox" checked={hasAgreed} onChange={event => { setHasAgreed(event.target.checked); clearSignupError('hasAgreed') }} aria-invalid={Boolean(signupErrors.hasAgreed)} style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#c8b86a', outline: signupErrors.hasAgreed ? '1px solid #f87171' : undefined }} /><span>I agree to the <a href="/terms-of-service" target="_blank" rel="noreferrer" style={{ color: '#c8b86a' }}>Terms of Service</a> and <a href="/privacy-policy" target="_blank" rel="noreferrer" style={{ color: '#c8b86a' }}>Privacy Policy</a>. <span style={{ color: '#f87171' }}>* Required</span></span></label></div>}
          <button onClick={handleAuth} disabled={loading} style={{ width: '100%', background: '#c8b86a', color: '#111', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', opacity: loading ? 0.7 : 1, cursor: 'pointer' }}>{loading ? 'PLEASE WAIT...' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}</button>
          {!isSignUp && <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px' }}><button type="button" onClick={async () => { if (!email) { setError('Enter your email first.'); return } const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); if (resetError) setError(resetError.message); else alert('Password reset email sent! Check your inbox.') }} style={{ color: '#c8b86a', cursor: 'pointer', fontSize: '12px', background: 'none', border: 'none' }}>Forgot password?</button></p>}
          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#444' }}>{isSignUp ? 'Already have an account?' : "Don't have an account?"} <button type="button" onClick={() => { setIsSignUp(!isSignUp); setHasAgreed(false); setError('') }} style={{ color: '#c8b86a', fontWeight: '500', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>{isSignUp ? 'Sign in' : 'Sign up'}</button></p>
        </div>
      </div>
      {showSessionChoice && sessionProfile && <div role="dialog" aria-modal="true" aria-labelledby="session-choice-title" style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.8)' }}><div style={{ width: '100%', maxWidth: '400px', background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '16px', padding: '24px' }}><h2 id="session-choice-title" style={{ color: '#e0e0e0', margin: '0 0 10px', fontSize: '18px' }}>{isExistingReassignment ? 'Choose your new session' : 'How would you like to start this session?'}</h2>{isExistingReassignment && <><p style={{ color: '#aaa', fontSize: '13px', lineHeight: 1.5 }}>Changes have been made to Seatbelt session modes. Select how you would like to start this new session.</p><p style={{ color: '#777', fontSize: '12px', lineHeight: 1.5 }}>*User profile and data are not impacted; this only chooses how the new session starts. Your account information remains safe and secure.</p></>}<fieldset style={{ border: 0, padding: 0, margin: '18px 0' }}><legend style={labelStyle}>START THIS SESSION AS</legend><label style={{ display: 'flex', gap: '10px', padding: '10px 0', color: '#ddd', cursor: 'pointer' }}><input type="radio" name="session-mode" value="rider" checked={sessionMode === 'rider'} onChange={() => setSessionMode('rider')} />Rider</label><label style={{ display: 'flex', gap: '10px', padding: '10px 0', color: sessionProfile.is_driver ? '#ddd' : '#666', cursor: sessionProfile.is_driver ? 'pointer' : 'not-allowed' }}><input type="radio" name="session-mode" value="driver" disabled={!sessionProfile.is_driver} checked={sessionMode === 'driver'} onChange={() => setSessionMode('driver')} />Driver {!sessionProfile.is_driver && '(not enabled for this account)'}</label></fieldset><button type="button" onClick={() => void confirmSessionMode()} disabled={!sessionMode || loading} style={{ width: '100%', background: '#c8b86a', color: '#111', border: 0, borderRadius: '10px', padding: '13px', fontWeight: '700', cursor: 'pointer', opacity: !sessionMode || loading ? 0.7 : 1 }}>CONTINUE AS {sessionMode ? sessionMode.toUpperCase() : '…'}</button></div></div>}
    </div>
  )
}