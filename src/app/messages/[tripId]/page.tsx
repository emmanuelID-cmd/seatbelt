'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase, Message } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import PaymentModal from '@/app/components/PaymentModal'
import FieldHelp from '@/components/FieldHelp'
import { validateMessage } from '@/lib/inputValidation'

export default function MessagesPage() {
  const router = useRouter()
  const params = useParams()
  const tripId = params.tripId as string
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [messageError, setMessageError] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [currentProfile, setCurrentProfile] = useState<any>(null)
  const [trip, setTrip] = useState<any>(null)
  const [otherProfile, setOtherProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadData() }, [tripId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setCurrentUser(session.user)

    // Get current user profile
    const { data: myProfile } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single()
    setCurrentProfile(myProfile)

    // Get trip with driver profile
    const { data: tripData } = await supabase
      .from('trips').select('*, profiles(*)').eq('id', tripId).single()
    setTrip(tripData)

    // Get other person's profile
    if (tripData?.driver_id === session.user.id) {
      // I am the driver — find the first person who messaged me
      const { data: firstMsg } = await supabase
        .from('messages').select('sender_id').eq('trip_id', tripId)
        .neq('sender_id', session.user.id).limit(1).single()
      if (firstMsg) {
        const { data: otherProf } = await supabase
          .from('profiles').select('*').eq('id', firstMsg.sender_id).single()
        setOtherProfile(otherProf)
      }
    } else {
      // I am the rider — get the driver's profile
      const { data: otherProf } = await supabase
        .from('profiles').select('*').eq('id', tripData?.driver_id).single()
      setOtherProfile(otherProf)
    }

    // Get messages
    const { data: msgs } = await supabase
      .from('messages').select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
    setMessages(msgs || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!tripId) return
    const channel = supabase
      .channel(`messages-${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `trip_id=eq.${tripId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tripId])

  async function sendMessage() {
    const validationError = validateMessage(newMessage)
    if (validationError) {
      setMessageError(validationError)
      return
    }
    if (!currentUser || !trip) return

    const content = newMessage.trim()

    let receiverId = trip.driver_id
    if (trip.driver_id === currentUser.id) {
      const otherMessage = messages.find(message => message.sender_id !== currentUser.id)
      receiverId = otherMessage?.sender_id || currentUser.id
    }

    const { error } = await supabase.from('messages').insert({
      trip_id: tripId,
      sender_id: currentUser.id,
      receiver_id: receiverId,
      content,
    })

    if (error) {
      setMessageError(error.message)
      return
    }

    setNewMessage('')
    setMessageError('')
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getSenderName = (msg: any) => {
    if (msg.sender_id === currentUser?.id) return 'You'
    return otherProfile?.full_name || 'User'
  }

  return (
    <div style={{ height: '100vh', background: '#111', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: '#111', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '0.5px solid #222', flexShrink: 0 }}>
        <button onClick={() => router.push('/dms')} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '22px' }}>←</button>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2a2a2a', border: '0.5px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: '#aaa', flexShrink: 0 }}>
          {otherProfile?.avatar_initials || '??'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#e0e0e0', fontSize: '14px', fontWeight: '500' }}>{otherProfile?.full_name || 'User'}</div>
          <div style={{ color: '#444', fontSize: '11px' }}>{trip?.origin} → {trip?.destination} · {trip?.departure_time}</div>
        </div>
        <div style={{ background: '#1a2a1a', color: '#6dba6d', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '99px' }}>
          {trip?.suggested_price || 'Open'}
        </div>
      </div>

      {/* Trip card */}
      {trip && (
        <div style={{ margin: '12px 16px', background: '#1a1a1a', borderRadius: '12px', padding: '12px', border: '0.5px solid #2a2a2a', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#7ab3d4' }}></div>
              <div style={{ width: '1px', height: '14px', background: '#333' }}></div>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#c47a5a' }}></div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#e0e0e0', fontSize: '13px', fontWeight: '500' }}>{trip.origin}</div>
              <div style={{ color: '#555', fontSize: '12px', marginTop: '4px' }}>{trip.destination}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#c8b86a', fontSize: '16px', fontWeight: '600' }}>{trip.suggested_price || 'Open'}</div>
              <div style={{ color: '#444', fontSize: '11px' }}>{trip.departure_time}</div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading && <div style={{ textAlign: 'center', color: '#444', fontSize: '13px' }}>Loading...</div>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
            <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '6px' }}>Start the conversation</p>
            <p style={{ color: '#444', fontSize: '12px' }}>Negotiate a price and arrange your pickup</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser?.id
          const isPriceRequest = msg.content.startsWith('PRICE_REQUEST:')
          const requestedPrice = isPriceRequest ? parseFloat(msg.content.split(':')[1]) : 0
          const isDriver = currentUser?.id === trip?.driver_id

          if (isPriceRequest) {
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                <div style={{ background: '#1a2a1a', border: '0.5px solid #2a4a2a', borderRadius: '12px', padding: '14px 18px', textAlign: 'center', maxWidth: '85%' }}>
                  <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px', letterSpacing: '0.5px' }}>PRICE CONFIRMATION REQUEST</div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: '#c8b86a', marginBottom: '4px' }}>${requestedPrice.toFixed(2)}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginBottom: '12px' }}>
                    {isMe ? 'Waiting for driver to confirm...' : 'Rider is requesting this price'}
                  </div>
                  {isDriver && !isMe && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={async () => {
                          await supabase.from('messages').insert({
                            trip_id: tripId,
                            sender_id: currentUser.id,
                            receiver_id: msg.sender_id,
                            content: `PRICE_CONFIRMED:${requestedPrice}`,
                          })
                        }}
                        style={{ flex: 1, background: '#1e3a1e', color: '#6dba6d', border: '0.5px solid #2a4a2a', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                        ✅ Confirm Price
                      </button>
                      <button
                        onClick={async () => {
                          await supabase.from('messages').insert({
                            trip_id: tripId,
                            sender_id: currentUser.id,
                            receiver_id: msg.sender_id,
                            content: `PRICE_DECLINED:${requestedPrice}`,
                          })
                        }}
                        style={{ flex: 1, background: '#2a1a1a', color: '#f87171', border: '0.5px solid #4a2a2a', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                        ❌ Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          if (msg.content.startsWith('PRICE_CONFIRMED:')) {
            const confirmedPrice = parseFloat(msg.content.split(':')[1])
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                <div style={{ background: '#1a2a1a', border: '0.5px solid #2a4a2a', borderRadius: '12px', padding: '14px 18px', textAlign: 'center', maxWidth: '85%' }}>
                  <div style={{ fontSize: '16px', marginBottom: '4px' }}>✅</div>
                  <div style={{ fontSize: '13px', color: '#6dba6d', fontWeight: '600', marginBottom: '4px' }}>Price Confirmed!</div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: '#c8b86a', marginBottom: '8px' }}>${confirmedPrice.toFixed(2)}</div>
                  {!isDriver && (
                    <button
                      onClick={() => { setPaymentAmount(confirmedPrice); setShowPayment(true) }}
                      style={{ width: '100%', background: '#c8b86a', color: '#111', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                      💳 PAY NOW
                    </button>
                  )}
                </div>
              </div>
            )
          }

          if (msg.content.startsWith('PRICE_DECLINED:')) {
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                <div style={{ background: '#2a1a1a', border: '0.5px solid #4a2a2a', borderRadius: '12px', padding: '14px 18px', textAlign: 'center', maxWidth: '85%' }}>
                  <div style={{ fontSize: '13px', color: '#f87171', fontWeight: '600' }}>❌ Price Declined</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>Continue negotiating in the chat</div>
                </div>
              </div>
            )
          }

          return (
            <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%' }}>
                <div style={{ fontSize: '10px', color: '#555', marginBottom: '3px', textAlign: isMe ? 'right' : 'left', padding: '0 4px' }}>
                  {getSenderName(msg)}
                </div>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isMe ? '#c8b86a' : '#1e1e1e',
                  color: isMe ? '#111' : '#e0e0e0',
                  fontSize: '14px', lineHeight: 1.4,
                  border: isMe ? 'none' : '0.5px solid #2a2a2a'
                }}>
                  {msg.content}
                </div>
                <div style={{ fontSize: '10px', color: '#333', marginTop: '3px', textAlign: isMe ? 'right' : 'left', padding: '0 4px' }}>
                  {formatTime(msg.created_at)}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          amount={paymentAmount}
          tripId={tripId}
          driverId={trip?.driver_id || ''}
          onSuccess={() => {
            setShowPayment(false)
            alert('Payment successful! Your ride is confirmed. 🚗')
          }}
          onCancel={() => setShowPayment(false)}
        />
      )}

      {/* Confirm Ride Button - only show to riders */}
      {currentUser && trip && currentUser.id !== trip.driver_id && (
        <div style={{ padding: '8px 16px', background: '#111', borderTop: '0.5px solid #1a1a1a' }}>
          <button
            onClick={async () => {
              const suggested = trip.suggested_price?.replace(/[^0-9.]/g, '') || ''
              const input = prompt('Enter the final agreed price ($):', suggested)
              if (input === null) return
              const custom = parseFloat(input)
              if (custom <= 0) { alert('Please enter a valid price greater than $0'); return }
              setPaymentAmount(custom)
              // Send price confirmation request to driver
              const receiverId = trip.driver_id
              await supabase.from('messages').insert({
                trip_id: tripId,
                sender_id: currentUser.id,
                receiver_id: receiverId,
                content: `PRICE_REQUEST:${custom}`,
              })
              alert('Price confirmation sent to driver! Waiting for approval...')
            }}
            style={{ width: '100%', background: '#1e2a1e', color: '#6dba6d', border: '0.5px solid #2a4a2a', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.5px' }}>
            🚗 CONFIRM RIDE & PAY
          </button>
        </div>
      )}

      {messageError && (
        <div id="message-error" role="alert" style={{ padding: '8px 16px', background: '#2a1a1a', color: '#f87171', fontSize: '12px' }}>
          {messageError}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '0.5px solid #222', display: 'flex', gap: '10px', alignItems: 'center', background: '#111', flexShrink: 0 }}>
        <FieldHelp fieldName="message">Required to send. Use up to 140 characters. Text, punctuation, and emoji are accepted. Example: I can meet at the main entrance.</FieldHelp>
        <input
          type="text"
          value={newMessage}
          onChange={e => {
            setNewMessage(Array.from(e.target.value).slice(0, 140).join(''))
            if (messageError) setMessageError('')
          }}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={`Message ${otherProfile?.full_name || 'driver'}...`}
          aria-invalid={Boolean(messageError)}
          aria-describedby={messageError ? 'message-error' : undefined}
          style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '99px', padding: '10px 16px', fontSize: '14px', color: '#e0e0e0', outline: 'none' }}
        />
        <button onClick={sendMessage}
          style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#c8b86a', border: 'none', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
          ↑
        </button>
      </div>
    </div>
  )
}