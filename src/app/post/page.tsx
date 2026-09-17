'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import FieldHelp from '@/components/FieldHelp'

type FieldErrors = Record<string, string>

export default function PostTripPage() {
  const router = useRouter()
  const [postType, setPostType] = useState<'driver' | 'rider'>('driver')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [asap, setAsap] = useState(true)
  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('')
  const [seats, setSeats] = useState('1')
  const [minPrice, setMinPrice] = useState('1.00')
  const [maxPrice, setMaxPrice] = useState('1.00')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)
  const [submissionError, setSubmissionError] = useState('')

  function updatePrice(setPrice: (value: string) => void, value: string) {
    if (!value) {
      setPrice('')
      return
    }

    if (!/^\d*\.?\d{0,2}$/.test(value)) return

    const amount = Number(value)
    if (!Number.isFinite(amount) || amount < 1 || amount > 999.99) return

    setPrice(value)
  }

  function blockInvalidPriceKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (['-', '+', 'e', 'E'].includes(event.key)) event.preventDefault()
  }

  function getValidationErrors(): FieldErrors {
    const errors: FieldErrors = {}
    const seatCount = Number(seats)
    const minimum = Number(minPrice)
    const maximum = Number(maxPrice)

    if (postType === 'rider') {
      if (!origin.trim()) errors.origin = 'Departure is required.'
      if (!destination.trim()) errors.destination = 'Arrival is required.'

      if (!asap) {
        if (!departureDate) errors.departureDate = 'Departure date is required.'
        if (!departureTime) errors.departureTime = 'Departure time is required.'

        if (departureDate && departureTime) {
          const departureTimestamp = new Date(`${departureDate}T${departureTime}`)
          if (Number.isNaN(departureTimestamp.getTime())) {
            errors.schedule = 'Select a valid departure date and time.'
          } else if (departureTimestamp <= new Date()) {
            errors.schedule = 'Choose a future departure date and time, or choose Present.'
          }
        }
      }

      if (!minPrice.trim()) {
        errors.minPrice = 'Minimum wager price is required.'
      } else if (!Number.isFinite(minimum) || minimum < 1 || minimum > 999.99) {
        errors.minPrice = 'Minimum wager price must be from $1.00 to $999.99.'
      }

      if (!maxPrice.trim()) {
        errors.maxPrice = 'Maximum wager price is required.'
      } else if (!Number.isFinite(maximum) || maximum < 1 || maximum > 999.99) {
        errors.maxPrice = 'Maximum wager price must be from $1.00 to $999.99.'
      }

      if (Number.isFinite(minimum) && Number.isFinite(maximum) && minimum > maximum) {
        errors.priceRange = 'Minimum wager price cannot exceed maximum wager price.'
      }
    }

    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 4) {
      errors.seats = 'Seats must be a whole number from 1 to 4.'
    }

    return errors
  }

  const validationErrors = getValidationErrors()
  const visibleErrors = [...new Set([
    ...(hasAttemptedSubmit ? Object.values(validationErrors) : []),
    ...(submissionError ? [submissionError] : []),
  ])]
  const hasFieldError = (fieldName: string) => hasAttemptedSubmit && Boolean(validationErrors[fieldName])
  async function postTrip() {
    setHasAttemptedSubmit(true)

    if (Object.keys(getValidationErrors()).length > 0) {
      return
    }

    const seatCount = Number(seats)
    const minimum = Number(minPrice)
    const maximum = Number(maxPrice)
    const departureTimestamp = postType === 'rider' && !asap
      ? new Date(`${departureDate}T${departureTime}`)
      : new Date()

    setLoading(true)
    setSubmissionError('')

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
      departure_time: postType === 'rider' ? departureTimestamp.toISOString() : null,
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
      setSubmissionError(tripError.message)
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

          {visibleErrors.length > 0 && (
            <div id="post-errors" role="alert" aria-live="assertive" style={{ background: '#2a1a1a', border: '0.5px solid #5a2a2a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#f87171' }}>
              <div style={{ fontWeight: '700', marginBottom: '6px' }}>Please correct the following:</div>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                {visibleErrors.map(message => <li key={message}>{message}</li>)}
              </ul>
            </div>
          )}

          {/* Rider route */}
          {postType === 'rider' && (
            <>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                  📍 DEPARTING FROM

                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={e => setOrigin(e.target.value)}
                  placeholder="e.g. Coney Island, Brooklyn"
                  maxLength={32}
                  aria-invalid={hasFieldError('origin')}
                  aria-describedby={hasFieldError('origin') ? 'post-errors' : undefined}
                  style={{ background: '#222', border: hasFieldError('origin') ? '1px solid #f87171' : '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', width: '100%', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                  🏁 ARRIVAL

                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="e.g. Downtown Brooklyn"
                  maxLength={32}
                  aria-invalid={hasFieldError('destination')}
                  aria-describedby={hasFieldError('destination') ? 'post-errors' : undefined}
                  style={{ background: '#222', border: hasFieldError('destination') ? '1px solid #f87171' : '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', width: '100%', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 0.75fr) auto', gap: '8px', alignItems: 'end', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: '#555', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
                    📅 DATE

                  </label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={e => setDepartureDate(e.target.value)}
                    disabled={asap}
                    aria-label="Departure date"
                    aria-invalid={hasFieldError('departureDate') || hasFieldError('schedule')}
                    aria-describedby={hasFieldError('departureDate') || hasFieldError('schedule') ? 'post-errors' : undefined}
                    style={{ background: '#222', border: hasFieldError('departureDate') || hasFieldError('schedule') ? '1px solid #f87171' : '0.5px solid #333', borderRadius: '8px', padding: '9px 10px', fontSize: '13px', color: '#e0e0e0', width: '100%', minWidth: 0, outline: 'none', opacity: asap ? 0.5 : 1 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: '#555', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
                    🕐 TIME

                  </label>
                  <input
                    type="time"
                    step="900"
                    value={departureTime}
                    onChange={e => setDepartureTime(e.target.value)}
                    disabled={asap}
                    aria-label="Departure time"
                    aria-invalid={hasFieldError('departureTime') || hasFieldError('schedule')}
                    aria-describedby={hasFieldError('departureTime') || hasFieldError('schedule') ? 'post-errors' : undefined}
                    style={{ background: '#222', border: hasFieldError('departureTime') || hasFieldError('schedule') ? '1px solid #f87171' : '0.5px solid #333', borderRadius: '8px', padding: '9px 10px', fontSize: '13px', color: '#e0e0e0', width: '100%', minWidth: 0, outline: 'none', opacity: asap ? 0.5 : 1 }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', paddingBottom: '10px', color: '#aaa', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={asap}
                    onChange={e => setAsap(e.target.checked)}
                    style={{ accentColor: '#5a7aaa', margin: 0 }}
                  />
                  Present

                </label>
              </div>
            </>
          )}

          {/* Seats */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
              💺 {postType === 'driver' ? 'SEATS FIT' : 'SEATS NEEDED'}

            </label>
            <select
              value={seats}
              onChange={e => setSeats(e.target.value)}
              aria-invalid={hasFieldError('seats')}
              aria-describedby={hasFieldError('seats') ? 'post-errors' : undefined}
              style={{ background: '#222', border: hasFieldError('seats') ? '1px solid #f87171' : '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', width: '100%', outline: 'none' }}
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

              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={minPrice}
                  min="1"
                  max="999.99"
                  step="1"
                  onChange={e => updatePrice(setMinPrice, e.target.value)}
                  onKeyDown={blockInvalidPriceKey}
                  placeholder="$1.00"
                  aria-label="Minimum price"
                  aria-invalid={hasFieldError('minPrice') || hasFieldError('priceRange')}
                  aria-describedby={hasFieldError('minPrice') || hasFieldError('priceRange') ? 'post-errors' : undefined}
                  style={{ flex: 1, background: '#222', border: hasFieldError('minPrice') || hasFieldError('priceRange') ? '1px solid #f87171' : '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', outline: 'none' }}
                />
                <span style={{ color: '#777' }}>to</span>
                <input
                  type="number"
                  value={maxPrice}
                  min="1"
                  max="999.99"
                  step="1"
                  onChange={e => updatePrice(setMaxPrice, e.target.value)}
                  onKeyDown={blockInvalidPriceKey}
                  placeholder="$999.99"
                  aria-label="Maximum price"
                  aria-invalid={hasFieldError('maxPrice') || hasFieldError('priceRange')}
                  aria-describedby={hasFieldError('maxPrice') || hasFieldError('priceRange') ? 'post-errors' : undefined}
                  style={{ flex: 1, background: '#222', border: hasFieldError('maxPrice') || hasFieldError('priceRange') ? '1px solid #f87171' : '0.5px solid #333', borderRadius: '8px', padding: '11px 12px', fontSize: '14px', color: '#e0e0e0', outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Caption */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
              ✍️ COMMENT / NOTE
              <FieldHelp fieldName="comment">
                Optional. Up to 280 characters.
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