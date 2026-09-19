'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [trips, setTrips] = useState<any[]>([])
  const [commutes, setCommutes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCommute, setShowAddCommute] = useState(false)
  const [commuteFrom, setCommuteFrom] = useState('')
  const [commuteTo, setCommuteTo] = useState('')
  const [commuteDays, setCommuteDays] = useState('')
  const [commuteTime, setCommuteTime] = useState('')
  const [commuteWager, setCommuteWager] = useState('')
  const [savingCommute, setSavingCommute] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCarMake, setEditCarMake] = useState('')
  const [editCarModel, setEditCarModel] = useState('')
  const [editCarYear, setEditCarYear] = useState('')
  const [editIsDriver, setEditIsDriver] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => { loadProfile() }, [])

  async function saveProfile() {
    setSavingProfile(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const initials = editName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    const accountRole = editIsDriver ? (profile?.account_role === 'both' ? 'both' : 'driver') : 'rider'
    await supabase.from('profiles').update({
      full_name: editName,
      avatar_initials: initials,
      car_make: editCarMake,
      car_model: editCarModel,
      car_year: editCarYear,
      is_driver: editIsDriver,
      account_role: accountRole,
      last_session_mode: editIsDriver ? profile?.last_session_mode : 'rider',
    }).eq('id', session.user.id)
    setSavingProfile(false)
    setShowEditProfile(false)
    loadProfile()
  }

  async function loadProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }

    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(profileData)

    const { data: tripsData } = await supabase
      .from('trips').select('*').eq('driver_id', session.user.id).order('created_at', { ascending: false })
    setTrips(tripsData || [])

    const { data: commutesData } = await supabase
      .from('frequent_commutes').select('*').eq('user_id', session.user.id)
    setCommutes(commutesData || [])
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function saveCommute() {
    setSavingCommute(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('frequent_commutes').insert({
      user_id: session.user.id,
      origin: commuteFrom,
      destination: commuteTo,
      days: commuteDays,
      preferred_time: commuteTime,
      wager: commuteWager,
    })
    setCommuteFrom(''); setCommuteTo(''); setCommuteDays(''); setCommuteTime(''); setCommuteWager('')
    setShowAddCommute(false)
    setSavingCommute(false)
    loadProfile()
  }

  async function deleteCommute(id: string) {
    await supabase.from('frequent_commutes').delete().eq('id', id)
    setCommutes(prev => prev.filter(c => c.id !== id))
  }

  async function deactivateTrip(id: string) {
    await supabase.from('trips').update({ is_active: false }).eq('id', id)
    setTrips(prev => prev.filter(t => t.id !== id))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#444' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#111', paddingBottom: '80px' }}>

      <div style={{ background: '#111', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid #222', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ color: '#e0e0e0', fontSize: '17px', fontWeight: '600', letterSpacing: '1px' }}>Profile</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><button onClick={() => router.push('/profile/settings')} aria-label="Open settings" style={{ background: 'none', border: '0.5px solid #333', borderRadius: '50%', width: '30px', height: '30px', color: '#aaa', fontSize: '15px', cursor: 'pointer' }}>⚙</button><button onClick={signOut} style={{ background: 'none', border: '0.5px solid #333', borderRadius: '99px', padding: '6px 14px', color: '#666', fontSize: '12px', cursor: 'pointer' }}>Sign out</button></div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Profile card */}
        <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '24px', border: '0.5px solid #2a2a2a', marginBottom: '20px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#2a2a2a', border: '2px solid #444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', color: '#aaa', margin: '0 auto 14px' }}>
            {profile?.avatar_initials || '??'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ color: '#e0e0e0', fontSize: '20px', fontWeight: '600' }}>{profile?.full_name}</div>
            <button onClick={() => { setShowEditProfile(true); setEditName(profile?.full_name || ''); setEditCarMake(profile?.car_make || ''); setEditCarModel(profile?.car_model || ''); setEditCarYear(profile?.car_year || ''); setEditIsDriver(profile?.is_driver || false) }}
              style={{ background: 'none', border: '0.5px solid #333', borderRadius: '99px', padding: '3px 10px', color: '#555', fontSize: '11px', cursor: 'pointer' }}>
              Edit
            </button>
          </div>
          <div style={{ color: '#555', fontSize: '13px', marginBottom: '16px' }}>
            {profile?.is_driver ? '🚗 Driver & Rider' : '🙋 Rider'}
          </div>
          <div style={{ display: 'flex', gap: '1px', background: '#2a2a2a', borderRadius: '12px', overflow: 'hidden' }}>
            {[
              { label: 'Rides', value: profile?.total_rides || 0 },
              { label: 'Rating', value: `${profile?.rating || '5.0'}⭐` },
              { label: 'Trips posted', value: trips.length },
            ].map((stat, i) => (
              <div key={i} style={{ flex: 1, background: '#1a1a1a', padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ color: '#c8b86a', fontSize: '18px', fontWeight: '600' }}>{stat.value}</div>
                <div style={{ color: '#444', fontSize: '10px', marginTop: '2px' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Edit Profile Modal */}
        {showEditProfile && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', border: '0.5px solid #2a2a2a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <span style={{ color: '#e0e0e0', fontSize: '16px', fontWeight: '600' }}>Edit Profile</span>
                <button onClick={() => setShowEditProfile(false)} style={{ background: 'none', border: 'none', color: '#555', fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>FULL NAME</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your full name"
                  style={{ width: '100%', background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#e0e0e0', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#aaa' }}>
                  <input type="checkbox" checked={editIsDriver} onChange={e => setEditIsDriver(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#c8b86a' }} />
                  I want to post trips as a driver
                </label>
              </div>
              {editIsDriver && (
                <div style={{ background: '#222', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '0.5px solid #333' }}>
                  <p style={{ fontSize: '11px', color: '#555', margin: '0 0 10px', letterSpacing: '0.5px' }}>YOUR VEHICLE</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" value={editCarMake} onChange={e => setEditCarMake(e.target.value)} placeholder="Make"
                      style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#e0e0e0', outline: 'none' }} />
                    <input type="text" value={editCarModel} onChange={e => setEditCarModel(e.target.value)} placeholder="Model"
                      style={{ flex: 1, background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#e0e0e0', outline: 'none' }} />
                    <input type="text" value={editCarYear} onChange={e => setEditCarYear(e.target.value)} placeholder="Year"
                      style={{ width: '80px', background: '#1a1a1a', border: '0.5px solid #333', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#e0e0e0', outline: 'none' }} />
                  </div>
                </div>
              )}
              <button onClick={saveProfile} disabled={savingProfile || !editName}
                style={{ width: '100%', background: '#c8b86a', color: '#111', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', opacity: savingProfile || !editName ? 0.7 : 1 }}>
                {savingProfile ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
            </div>
          </div>
        )}

        {/* Vehicle */}
        {profile?.car_make && (
          <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid #2a2a2a', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.5px', marginBottom: '8px' }}>YOUR VEHICLE</div>
            <div style={{ color: '#e0e0e0', fontSize: '15px', fontWeight: '500' }}>
              🚗 {profile.car_year} {profile.car_make} {profile.car_model}
            </div>
          </div>
        )}

        {/* Frequent Commutes */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.5px' }}>MY FREQUENT COMMUTES</div>
            <button onClick={() => setShowAddCommute(!showAddCommute)}
              style={{ background: '#c8b86a', color: '#111', border: 'none', borderRadius: '99px', padding: '5px 14px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
              {showAddCommute ? 'Cancel' : '+ Add commute'}
            </button>
          </div>

          {showAddCommute && (
            <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '16px', border: '0.5px solid #2a2a2a', marginBottom: '12px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>FROM</label>
                <input type="text" value={commuteFrom} onChange={e => setCommuteFrom(e.target.value)} placeholder="e.g. Flatbush, Brooklyn"
                  style={{ width: '100%', background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#e0e0e0', outline: 'none' }} />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>TO</label>
                <input type="text" value={commuteTo} onChange={e => setCommuteTo(e.target.value)} placeholder="e.g. Midtown Manhattan"
                  style={{ width: '100%', background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#e0e0e0', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>DAYS</label>
                  <input type="text" value={commuteDays} onChange={e => setCommuteDays(e.target.value)} placeholder="e.g. Mon-Fri"
                    style={{ width: '100%', background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#e0e0e0', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>TIME</label>
                  <input type="text" value={commuteTime} onChange={e => setCommuteTime(e.target.value)} placeholder="e.g. 8:00 AM"
                    style={{ width: '100%', background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#e0e0e0', outline: 'none' }} />
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>MY WAGER (willing to pay)</label>
                <input type="text" value={commuteWager} onChange={e => setCommuteWager(e.target.value)} placeholder="e.g. $10-15 per trip"
                  style={{ width: '100%', background: '#222', border: '0.5px solid #333', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#e0e0e0', outline: 'none' }} />
              </div>
              <button onClick={saveCommute} disabled={savingCommute || !commuteFrom || !commuteTo}
                style={{ width: '100%', background: '#c8b86a', color: '#111', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', opacity: savingCommute || !commuteFrom || !commuteTo ? 0.6 : 1 }}>
                {savingCommute ? 'SAVING...' : 'SAVE COMMUTE'}
              </button>
            </div>
          )}

          {commutes.length === 0 && !showAddCommute && (
            <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '20px', border: '0.5px solid #2a2a2a', textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: '13px', marginBottom: '8px' }}>No frequent commutes listed yet</p>
              <p style={{ color: '#444', fontSize: '12px' }}>Add your regular routes so drivers can find and contact you</p>
            </div>
          )}

          {commutes.map(commute => (
            <div key={commute.id} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '14px', border: '0.5px solid #2a2a2a', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#7ab3d4' }}></div>
                  <div style={{ width: '1px', height: '14px', background: '#333' }}></div>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#c47a5a' }}></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e0e0e0', fontSize: '13px', fontWeight: '500' }}>{commute.origin}</div>
                  <div style={{ color: '#555', fontSize: '12px', marginTop: '4px' }}>{commute.destination}</div>
                </div>
                <div style={{ color: '#c8b86a', fontSize: '14px', fontWeight: '600' }}>{commute.wager || 'Open'}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                {commute.days && <span style={{ background: '#222', border: '0.5px solid #333', borderRadius: '99px', padding: '3px 10px', fontSize: '10px', color: '#777' }}>📅 {commute.days}</span>}
                {commute.preferred_time && <span style={{ background: '#222', border: '0.5px solid #333', borderRadius: '99px', padding: '3px 10px', fontSize: '10px', color: '#777' }}>🕐 {commute.preferred_time}</span>}
              </div>
              <button onClick={() => deleteCommute(commute.id)}
                style={{ width: '100%', background: 'transparent', border: '0.5px solid #3a2a2a', borderRadius: '8px', padding: '7px', color: '#6a3a3a', fontSize: '12px', cursor: 'pointer' }}>
                Remove commute
              </button>
            </div>
          ))}
        </div>

        {/* My trips */}
        <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.5px', marginBottom: '12px' }}>MY POSTED TRIPS</div>

        {trips.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#1a1a1a', borderRadius: '12px', border: '0.5px solid #2a2a2a' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>🚗</div>
            <p style={{ color: '#555', fontSize: '13px' }}>No trips posted yet</p>
            <button onClick={() => router.push('/post')} style={{ marginTop: '14px', background: '#c8b86a', color: '#111', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
              POST A TRIP
            </button>
          </div>
        )}

        {trips.map(trip => (
          <div key={trip.id} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '14px', border: '0.5px solid #2a2a2a', marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
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
                <div style={{ color: '#c8b86a', fontSize: '15px', fontWeight: '600' }}>{trip.suggested_price || 'Open'}</div>
                <div style={{ color: '#444', fontSize: '11px' }}>{trip.departure_time}</div>
              </div>
            </div>
            <button onClick={() => deactivateTrip(trip.id)}
              style={{ width: '100%', background: 'transparent', border: '0.5px solid #3a2a2a', borderRadius: '8px', padding: '8px', color: '#6a3a3a', fontSize: '12px', cursor: 'pointer' }}>
              Remove trip
            </button>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', borderTop: '0.5px solid #222', display: 'flex', padding: '8px 0' }}>
        {[
          { icon: '🏠', label: 'Feed', path: '/feed' },
          { icon: '➕', label: 'Post', path: '/post' },
          { icon: '💬', label: 'DMs', path: '/feed' },
          { icon: 'ℹ️', label: 'About', path: '/about' },
          { icon: '👤', label: 'Profile', path: '/profile' },
        ].map((item, i) => (
          <div key={i} onClick={() => router.push(item.path)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontSize: '9px', color: i === 4 ? '#c8b86a' : '#444' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}