'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import AccountPage, { Feedback } from '@/components/AccountPage'
import { apiRequest } from '@/lib/apiClient'
import type { LocationStatus, NearbyResult, SharingSession } from '@/lib/location'

const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ''
const mapboxConfigured = mapboxToken.startsWith('pk.')

function AreaMap({ center }: { center: { latitude: number; longitude: number } }) {
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!visible || state !== 'loading') return
    const timeout = window.setTimeout(() => setState('error'), 15000)
    return () => window.clearTimeout(timeout)
  }, [visible, state, attempt])
  if (!mapboxConfigured) return <p className="status-note">The map is unavailable because Mapbox is not configured with a public map token. The nearby list works without a map.</p>
  if (Math.abs(center.latitude) > 85.0511) return <p className="status-note">The map cannot display this polar area. Use the nearby list.</p>
  // Only the rounded search area is sent to Mapbox, never precise GPS or Driver positions.
  const source = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${center.longitude},${center.latitude},9/640x400?access_token=${encodeURIComponent(mapboxToken)}`
  return <section aria-label="Approximate search area map">
    <p className="muted">Show a static map of your approximate search area. Loading it shares that area and your network address with Mapbox. Driver positions and travel routes are not sent to Mapbox.</p>
    {!visible ? <button type="button" className="secondary-button" onClick={() => { setVisible(true); setState('loading') }}>Show area map</button> : <>
      {state === 'loading' && <p role="status">Loading area map…</p>}
      {state === 'error' ? <div><p role="alert">The map is temporarily unavailable. The nearby list remains available.</p><button type="button" className="secondary-button" onClick={() => { setAttempt(value => value + 1); setState('loading') }}>Retry map</button></div> : <figure style={{ margin: '16px 0' }}>
        {/* A direct image preserves Mapbox attribution and avoids server caching of a location-derived image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={attempt} src={source} alt="Street map of the approximate search area; no live Driver markers or routes" width={640} height={400} referrerPolicy="strict-origin" onLoad={() => setState('ready')} onError={() => setState('error')} style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
        <figcaption className="muted">Area overview only. See approximate Driver distances in the list.</figcaption>
      </figure>}
      <button type="button" className="secondary-button" onClick={() => setVisible(false)}>Hide map</button>
    </>}
  </section>
}

function positionError(error: GeolocationPositionError) {
  if (error.code === 1) return 'Location permission was denied. Allow location in your browser settings, then try again.'
  if (error.code === 3) return 'Your device location timed out. Move to a place with a stronger signal and try again.'
  return 'Your device location is unavailable. Check location services and try again.'
}

function deviceLocation() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      reject(new Error('Location requires a supported browser and a secure connection.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, error => reject(new Error(positionError(error))), {
      enableHighAccuracy: false, timeout: 15000, maximumAge: 15000,
    })
  })
}

function coarsePosition(position: GeolocationPosition) {
  return {
    latitude: Math.round(position.coords.latitude * 50) / 50,
    longitude: Math.round(position.coords.longitude * 50) / 50,
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Location is temporarily unavailable. Please try again.'
}

async function locationRequest<T>(path: string, options: RequestInit = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    return await apiRequest<T>(path, { ...options, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The location service timed out. Check your connection and try again.')
    throw error
  } finally { clearTimeout(timeout) }
}

function stopOnServer(session?: string | null) {
  return locationRequest<{ stopped: boolean }>('/api/location', {
    method: 'POST', body: JSON.stringify({ action: 'stop', ...(session ? { sharingId: session } : {}) }), keepalive: true,
  })
}

export default function NearbyPage() {
  const [status, setStatus] = useState<LocationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<NearbyResult | null>(null)
  const [searchArea, setSearchArea] = useState<{ latitude: number; longitude: number } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('Location sharing is off on this page.')
  const [clock, setClock] = useState(0)
  const watch = useRef<number | null>(null)
  const refresh = useRef<ReturnType<typeof setInterval> | null>(null)
  const session = useRef<string | null>(null)
  const pendingStop = useRef<string | null>(null)
  const generation = useRef(0)
  const searchGeneration = useRef(0)
  const mounted = useRef(false)

  const clearCapture = useCallback(() => {
    generation.current += 1
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
    if (refresh.current !== null) clearInterval(refresh.current)
    watch.current = null
    refresh.current = null
    const previous = session.current
    session.current = null
    return previous
  }, [])

  useEffect(() => {
    mounted.current = true
    let current = true
    const initialGeneration = generation.current
    void locationRequest<LocationStatus>('/api/location').then(data => {
      if (!current || generation.current !== initialGeneration) return
      setStatus(data)
      if (data.sharing) setNotice('Another sharing session is active. You can stop it here.')
    }).catch(error => {
      if (current && generation.current === initialGeneration) setError(message(error))
    }).finally(() => { if (current) setLoading(false) })

    const timer = setInterval(() => setClock(Date.now()), 1000)
    function cleanupSharing() {
      const previous = clearCapture() || pendingStop.current
      if (previous) {
        pendingStop.current = previous
        void stopOnServer(previous).catch(() => { /* Presence expires within two minutes. */ })
      }
    }
    // Leaving the page must not silently restart sharing on return.
    function onPageHide() {
      cleanupSharing()
      searchGeneration.current += 1
      setSharing(false)
      setStarting(false)
      setSearching(false)
      setResult(null)
      setSearchArea(null)
      setNotice('Device tracking stopped. If removal cannot be confirmed, the last position expires within two minutes.')
    }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      current = false
      mounted.current = false
      searchGeneration.current += 1
      clearInterval(timer)
      window.removeEventListener('pagehide', onPageHide)
      cleanupSharing()
    }
  }, [clearCapture])

  async function stopSharing() {
    const previous = clearCapture() || pendingStop.current
    setSharing(false)
    setStarting(false)
    setStopping(true)
    setError('')
    setNotice('Device tracking stopped. Confirming removal from nearby discovery…')
    try {
      // An explicit Stop also stops other tabs/devices for this account.
      await stopOnServer()
      pendingStop.current = null
      if (!mounted.current) return
      setStatus(value => value ? { ...value, sharing: false, locationSharing: false } : value)
      setNotice('Location sharing is off. Your position has been removed from nearby discovery.')
    } catch (error) {
      pendingStop.current = previous
      if (mounted.current) {
        setError(message(error) + ' Retry Stop sharing to confirm removal.')
        setNotice('Device tracking is off. The server could not confirm removal; the last position expires within two minutes.')
      }
    } finally { if (mounted.current) setStopping(false) }
  }

  async function startSharing() {
    if (starting || stopping || sharing) return
    setError('')
    if (!window.isSecureContext || !navigator.geolocation) {
      setError('Location requires a supported browser and a secure connection.')
      return
    }
    const activeGeneration = ++generation.current
    setStarting(true)
    setNotice('Checking Driver eligibility…')
    try {
      const started = await locationRequest<SharingSession>('/api/location', { method: 'POST', body: JSON.stringify({ action: 'start' }) })
      if (!mounted.current || activeGeneration !== generation.current) {
        void stopOnServer(started.sharingId).catch(() => { /* No coordinates were published. */ })
        return
      }
      session.current = started.sharingId
      pendingStop.current = null
      setNotice('Waiting for your browser location permission and a device position…')
      let updating = false
      let lastSent = 0
      const isCurrent = () => mounted.current && activeGeneration === generation.current

      async function failSharing(reason: string) {
        if (!isCurrent()) return
        const previous = clearCapture()
        const stoppedGeneration = generation.current
        pendingStop.current = previous
        setSharing(false)
        setStarting(false)
        setError(reason)
        setNotice('Device tracking stopped. Removing your nearby position…')
        try {
          await stopOnServer(previous)
          if (mounted.current && generation.current === stoppedGeneration) {
            pendingStop.current = null
            setStatus(value => value ? { ...value, sharing: false, locationSharing: false } : value)
            setNotice('Location sharing is off.')
          }
        } catch {
          if (mounted.current && generation.current === stoppedGeneration) {
            setNotice('Device tracking is off. Retry Stop sharing to confirm removal; the last position expires within two minutes.')
          }
        }
      }

      async function publish(position: GeolocationPosition) {
        if (!isCurrent() || updating || Date.now() - lastSent < 15000) return
        if (Date.now() - position.timestamp > 60000) {
          await failSharing('The device location is too old. Start sharing again to request a fresh position.')
          return
        }
        updating = true
        try {
          await locationRequest<{ expiresAt: string }>('/api/location', {
            method: 'POST', body: JSON.stringify({ action: 'update', sharingId: started.sharingId, ...coarsePosition(position) }),
          })
          if (!isCurrent()) return
          lastSent = Date.now()
          setStarting(false)
          setSharing(true)
          setStatus({ canShare: true, sharing: true, locationSharing: true, reason: null })
          setNotice('Sharing an approximate Driver position. Updates expire within two minutes if sharing is interrupted.')
        } catch (error) { await failSharing(message(error)) }
        finally { updating = false }
      }

      watch.current = navigator.geolocation.watchPosition(
        position => { void publish(position) },
        error => { void failSharing(positionError(error)) },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 15000 },
      )
      // Stationary devices need fresh fixes too; never renew presence with an old fix.
      refresh.current = setInterval(() => {
        if (!isCurrent()) return
        void deviceLocation().then(publish).catch(error => failSharing(message(error)))
      }, 30000)
    } catch (error) {
      if (mounted.current && activeGeneration === generation.current) {
        const previous = clearCapture()
        pendingStop.current = previous
        if (previous) void stopOnServer(previous).catch(() => { /* Retry remains available. */ })
        setStarting(false)
        setError(message(error))
        setNotice('Location sharing did not start. Use Stop sharing to confirm it is off.')
      }
    }
  }

  async function findNearby() {
    if (searching) return
    const activeSearch = ++searchGeneration.current
    setSearching(true)
    setError('')
    setResult(null)
    setSearchArea(null)
    try {
      const position = await deviceLocation()
      if (!mounted.current || activeSearch !== searchGeneration.current) return
      const area = coarsePosition(position)
      const nearby = await locationRequest<NearbyResult>('/api/location/nearby', { method: 'POST', body: JSON.stringify(area) })
      if (!mounted.current || activeSearch !== searchGeneration.current) return
      setClock(Date.now())
      setResult(nearby)
      setSearchArea(area)
    } catch (error) {
      if (mounted.current && activeSearch === searchGeneration.current) setError(message(error))
    } finally {
      if (mounted.current && activeSearch === searchGeneration.current) setSearching(false)
    }
  }

  const drivers = result?.drivers.filter(driver => Date.parse(driver.expiresAt) > clock) ?? []

  return <AccountPage title="Nearby" showBack={false}>
    <Feedback error={error} />
    <section className="panel" aria-labelledby="nearby-drivers-heading">
      <h2 id="nearby-drivers-heading">Find nearby Drivers</h2>
      <p>See participating, verified Drivers within approximately 10 miles. Your search location is used once and is not published or saved.</p>
      <button type="button" className="primary-button" onClick={() => void findNearby()} disabled={searching}>
        {searching ? 'Finding nearby Drivers…' : 'Find nearby Drivers'}
      </button>
      {searchArea && <AreaMap key={`${searchArea.latitude},${searchArea.longitude}`} center={searchArea} />}
      {!searchArea && !mapboxConfigured && <p className="status-note">The map is unavailable because Mapbox is not configured. The nearby list works without a map.</p>}
      <div aria-live="polite" aria-busy={searching}>
        {!result && !searching && <p className="muted">Choose Find nearby Drivers to request your device location.</p>}
        {result && drivers.length === 0 && <p>No active Driver positions are available in this area. Refresh the search to check again.</p>}
        {drivers.length > 0 && <>
          <p>Up to 50 nearby Drivers. Positions and distances are approximate, not routes or travel distances.</p>
          <ul className="data-list">{drivers.map(driver => <li key={driver.driverId}>
            <strong>Nearby Driver</strong>
            <span> · {driver.approximateMiles < 1 ? 'Less than approximately 1 mile away' : 'Approximately ' + driver.approximateMiles + (driver.approximateMiles === 1 ? ' mile away' : ' miles away')}</span>
          </li>)}</ul>
          <Link href="/feed" className="settings-link">Browse ride offers</Link>
        </>}
      </div>
    </section>
    <section className="panel" aria-labelledby="sharing-heading">
      <h2 id="sharing-heading">Driver location sharing</h2>
      <p>Start sharing to opt in to displaying your approximate position to signed-in members while this page is open. Rider positions are never shown in nearby discovery.</p>
      {loading && <p role="status">Checking sharing availability…</p>}
      {status?.reason && <p className="status-note">{status.reason} <Link href="/profile/settings">Review account settings</Link></p>}
      <p role="status">{notice}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="primary-button" onClick={() => void startSharing()} disabled={starting || stopping || sharing}>
          {starting ? 'Starting sharing…' : sharing ? 'Sharing location' : 'Start sharing'}
        </button>
        <button type="button" className="secondary-button" onClick={() => void stopSharing()} disabled={stopping}>
          {stopping ? 'Stopping sharing…' : 'Stop sharing'}
        </button>
      </div>
    </section>
    <section className="panel" aria-labelledby="travel-history-heading">
      <h2 id="travel-history-heading">Travel History</h2>
      <p>No route or travel distance is recorded by Nearby. Your private Travel History shows completed rides and verified distance when available.</p>
      <Link href="/profile/settings/travel-history" className="settings-link">Open Travel History</Link>
    </section>
  </AccountPage>
}
