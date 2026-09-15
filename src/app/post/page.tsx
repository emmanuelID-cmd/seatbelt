'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import FieldHelp from '@/components/FieldHelp'

export default function PostTripPage() {
  const router = useRouter()
  const [postType, setPostType] = useState<'driver' | 'rider'>('driver')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [asap, setAsap] = useState(true)
  const [seats, setSeats] = useState('1')
  const [minPrice, setMinPrice] = useState('1.00')
  const [maxPrice, setMaxPrice] = useState('1.00')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function postTrip() {
    const seatCount = Number(seats)
    const minimum = Number(minPrice)
    const maximum = Number(maxPrice)

    if (postType === 'rider' && (!origin.trim() || !destination.trim())) {
      setError('Please enter a departure and arrival location.')
      return
    }

    if (postType === 'rider' && !asap) {
      setError('Trips are currently for immediate travel. Check ASAP to continue.')
      return
    }

    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 4) {
      setError('Seats must be a whole number from 1 to 4.')
      return
    }

    if (
      postType === 'rider' &&
      (!Number.isFinite(minimum) ||
        !Number.isFinite(maximum) ||
        minimum < 1 ||
        maximum > 999.99 ||
        minimum > maximum)
    ) {
      setError('Enter a price range from $1.00 to $999.99.')
      return
    }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const formattedMinimum = minimum.toFixed(2)
    const formattedMaximum = maximum.toFixed(2)

    const { error: tripError } = await supabase.from('trips').insert({
      driver_id: postType === 'driver' ? user.id : null,
      rider_id: postType === 'rider' ? user.id : null,
      post_type: postType,
      origin: postType === 'rider' ? origin.trim() : null,
      destination: postType === 'rider' ? destination.trim() : null,
      departure_time: postType === 'rider' ? new Date().toISOString() : null,
      seats_available: seatCount,
      suggested_price: postType === 'rider'
        ? `${formattedMinimum}-${formattedMaximum}`
        : null,
      price_min: postType === 'rider' ? minimum : null,
      price_max: postType === 'rider' ? maximum : null,
      currency_code: 'USD',
      notes: caption,
      is_active: true,
    })

    if (tripError) {
      setError(tripError.message)
      setLoading(false)
      return
    }

    router.push('/feed')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ background: '#111', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '0.5px solid #222', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.push('/feed')} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '22px' }}>←</button>
        <span style={{ color: '#e0e0e0', fontSize: '17px', fontWeight: '600', letterSpacing: '1px' }}>New Post</span>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>

        {/* Post type toggle */}
        <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: '12px', padding: '4px', marginBottom: '20px', border: '0.5px solid #2a2a2a' }}>
          <button
            onClick={() => setPostType('driver')}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: postType === 'driver' ? '#2a3a2a' : 'transparent', color: postType === 'driver' ? '#6dba6d' : '#444', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}
          >
            🚗 I&apos;M DRIVING
          </button>
          <button
            onClick={() => setPostType('rider')}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: postType === 'rider' ? '#1a2a3a' : 'transparent', color: postType === 'rider' ? '#6d8dba' : '#444', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}
          >
            🙋 I NEED A RIDE
          </button>
        </div>

        <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '20px', border: '0.5px solid #2a2a2a' }}>

          {error && (
            <div style={{ background: '#2a1a1a', border: '0.5px solid #5a2a2a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Rider route */}
          {postType === 'rider' && (
            <>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                  📍 DEPARTING FROM
                  <FieldHelp fieldName="departure">
                    Required location. Select a location from map search. Typed search text is limited to 32 characters.
                  </FieldHelp>
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={e => setOrigin(e.target.value)}
                  placeholder="e.g. Coney Island, Brooklyn"
                  maxLength={32}
                  style={{ background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', width: '100%', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                  🏁 ARRIVAL
                  <FieldHelp fieldName="arrival">
                    Required location. Select a location from map search. Typed search text is limited to 32 characters.
                  </FieldHelp>
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="e.g. Downtown Brooklyn"
                  maxLength={32}
                  style={{ background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', width: '100%', outline: 'none' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#aaa', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={asap}
                  onChange={e => setAsap(e.target.checked)}
                  style={{ accentColor: '#5a7aaa' }}
                />
                ASAP — use the current time
                <FieldHelp fieldName="ASAP">
                  Trips are currently for immediate travel only. Scheduled trips will be added later.
                </FieldHelp>
              </label>
            </>
          )}

          {/* Seats */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
              💺 {postType === 'driver' ? 'SEATS FIT' : 'SEATS NEEDED'}
              <FieldHelp fieldName="seats">
                Choose 1–4 seats. Driver capacity must follow legal vehicle seating limits.
              </FieldHelp>
            </label>
            <select
              value={seats}
              onChange={e => setSeats(e.target.value)}
              style={{ background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', width: '100%', outline: 'none' }}
            >
              <option>1</option>
              <option>2</option>
              <option>3</option>
              <option>4</option>
            </select>
          </div>

          {/* Rider price range */}
          {postType === 'rider' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                💰 WAGER PRICE RANGE
                <FieldHelp fieldName="wager price range">
                  Enter an estimated range from $1.00 to $999.99. Drivers may offer below or above this estimate.
                </FieldHelp>
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={minPrice}
                  min="1"
                  max="999.99"
                  step="0.01"
                  onChange={e => setMinPrice(e.target.value)}
                  placeholder="$1.00"
                  aria-label="Minimum price"
                  style={{ flex: 1, background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', outline: 'none' }}
                />
                <span style={{ color: '#777' }}>to</span>
                <input
                  type="number"
                  value={maxPrice}
                  min="1"
                  max="999.99"
                  step="0.01"
                  onChange={e => setMaxPrice(e.target.value)}
                  placeholder="$999.99"
                  aria-label="Maximum price"
                  style={{ flex: 1, background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Caption */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
              ✍️ COMMENT / NOTE
              <FieldHelp fieldName="comment">
                Optional. Up to 280 characters. Example: Heading to the Mall in Manhattan, any driver nearby?
              </FieldHelp>
            </label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder={postType === 'driver'
                ? 'e.g. Heading to the Mall in Manhattan, any riders nearby?'
                : 'e.g. Heading to the Mall in Manhattan, any driver nearby?'}
              maxLength={280}
              rows={3}
              style={{ background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', width: '100%', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
          </div>

          <button
            onClick={postTrip}
            disabled={loading}
            style={{ width: '100%', background: postType === 'driver' ? '#c8b86a' : '#5a7aaa', color: '#111', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'POSTING...' : postType === 'driver' ? '🚗 POST TRIP TO FEED' : '🙋 POST RIDE REQUEST'}
          </button>
        </div>
      </div>
    </div>
  )
}