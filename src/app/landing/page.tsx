'use client'
import { useRouter } from 'next/navigation'

function SeatBeltLogo({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 400 400">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6a6a6a"/>
          <stop offset="25%" stopColor="#a0a0a0"/>
          <stop offset="50%" stopColor="#787878"/>
          <stop offset="75%" stopColor="#b0b0b0"/>
          <stop offset="100%" stopColor="#505050"/>
        </linearGradient>
        <linearGradient id="bk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#888"/>
          <stop offset="40%" stopColor="#bbb"/>
          <stop offset="100%" stopColor="#555"/>
        </linearGradient>
        <linearGradient id="wh" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a4a4a"/>
          <stop offset="50%" stopColor="#6a6a6a"/>
          <stop offset="100%" stopColor="#282828"/>
        </linearGradient>
      </defs>
      <path d="M 200 62 C 240 62 275 80 275 118 C 275 158 240 172 200 182 C 160 192 125 208 125 248 C 125 286 158 308 200 310" fill="none" stroke="#222" strokeWidth="48" strokeLinecap="round" opacity="0.4"/>
      <path d="M 200 62 C 240 62 275 80 275 118 C 275 158 240 172 200 182 C 160 192 125 208 125 248 C 125 286 158 308 200 310" fill="none" stroke="url(#bg)" strokeWidth="42" strokeLinecap="round"/>
      <rect x="170" y="28" width="60" height="46" rx="7" fill="url(#bk)"/>
      <rect x="179" y="36" width="7" height="28" rx="2.5" fill="#333"/>
      <rect x="190" y="36" width="7" height="28" rx="2.5" fill="#333"/>
      <rect x="201" y="36" width="7" height="28" rx="2.5" fill="#333"/>
      <rect x="212" y="36" width="7" height="28" rx="2.5" fill="#333"/>
      <rect x="170" y="308" width="60" height="46" rx="7" fill="url(#bk)"/>
      <rect x="179" y="316" width="7" height="28" rx="2.5" fill="#333"/>
      <rect x="190" y="316" width="7" height="28" rx="2.5" fill="#333"/>
      <rect x="201" y="316" width="7" height="28" rx="2.5" fill="#333"/>
      <rect x="212" y="316" width="7" height="28" rx="2.5" fill="#333"/>
      <rect x="248" y="148" width="52" height="28" rx="12" fill="url(#bk)" transform="rotate(-30 274 162)"/>
      <rect x="258" y="154" width="16" height="16" rx="5" fill="#333" transform="rotate(-30 266 162)"/>
      <circle cx="200" cy="196" r="46" fill="url(#wh)" stroke="#777" strokeWidth="1.5"/>
      <circle cx="200" cy="196" r="36" fill="none" stroke="#888" strokeWidth="9"/>
      <circle cx="200" cy="196" r="12" fill="url(#bk)"/>
      <circle cx="200" cy="196" r="7" fill="#1a1a1a"/>
      <line x1="200" y1="160" x2="200" y2="184" stroke="#888" strokeWidth="8" strokeLinecap="round"/>
      <line x1="168" y1="214" x2="191" y2="204" stroke="#888" strokeWidth="8" strokeLinecap="round"/>
      <line x1="232" y1="214" x2="209" y2="204" stroke="#888" strokeWidth="8" strokeLinecap="round"/>
    </svg>
  )
}

export default function LandingPage() {
  const router = useRouter()

  return (
    <div style={{ background: '#111', color: '#e0e0e0', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

      {/* Sticky nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(17,17,17,0.95)', borderBottom: '0.5px solid #222', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SeatBeltLogo size={28} />
          <span style={{ color: '#e0e0e0', fontSize: '16px', fontWeight: '700', letterSpacing: '3px' }}>SEATBELT</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => router.push('/about')} style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '13px', cursor: 'pointer', padding: '6px 12px' }}>About</button>
          <button onClick={() => router.push('/login')} style={{ background: '#c8b86a', color: '#111', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Sign in</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', borderBottom: '0.5px solid #1e1e1e' }}>
        <SeatBeltLogo size={140} />
        <h1 style={{ fontSize: 'clamp(36px, 8vw, 72px)', fontWeight: '700', letterSpacing: '6px', margin: '28px 0 12px', color: '#e0e0e0', lineHeight: 1.1 }}>SEATBELT</h1>
        <p style={{ fontSize: '12px', fontStyle: 'italic', color: '#c8b86a', letterSpacing: '2px', margin: '-10px 0 12px', textAlign: 'center' }}>by Kinoshi</p>
        <p style={{ fontSize: '14px', letterSpacing: '4px', color: '#555', marginBottom: '28px' }}>The Way Rideshare Should Be</p>
        <p style={{ fontSize: '18px', color: '#777', maxWidth: '560px', lineHeight: 1.8, marginBottom: '48px' }}>
          The community rideshare where <span style={{ color: '#c8b86a', fontWeight: '500' }}>drivers post their routes</span> and riders negotiate a fair price. No algorithms. No surge. Just neighbors moving together.
        </p>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '48px' }}>
          <button onClick={() => router.push('/login')} style={{ background: '#c8b86a', color: '#111', border: 'none', borderRadius: '12px', padding: '16px 40px', fontSize: '16px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
            GET STARTED
          </button>
          <button onClick={() => router.push('/about')} style={{ background: 'transparent', color: '#aaa', border: '0.5px solid #333', borderRadius: '12px', padding: '16px 40px', fontSize: '16px', cursor: 'pointer' }}>
            OUR MISSION
          </button>
        </div>
        <p style={{ color: '#333', fontSize: '13px', letterSpacing: '1px' }}>↓ scroll to learn more</p>
      </div>

      {/* How it works */}
      <div style={{ padding: '100px 24px', borderBottom: '0.5px solid #1e1e1e' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <p style={{ fontSize: '11px', letterSpacing: '4px', color: '#555', textAlign: 'center', marginBottom: '16px' }}>HOW IT WORKS</p>
          <h2 style={{ fontSize: '36px', fontWeight: '700', color: '#e0e0e0', textAlign: 'center', lineHeight: 1.4, marginBottom: '60px' }}>Simple. Human. Fair.</h2>
          {[
            { emoji: '🚗', title: 'Drivers post their route', desc: 'Already heading somewhere? Post your trip to the feed — origin, destination, time, and available seats. You were going anyway.' },
            { emoji: '📱', title: 'Riders browse the feed', desc: 'Scroll through nearby trips like a social feed. Find someone heading your way and reach out directly.' },
            { emoji: '💬', title: 'Negotiate a real price', desc: 'Message the driver, discuss a price that works for both of you. No algorithm decides. No surge kicks in.' },
            { emoji: '🤝', title: 'Ride and pay in-app', desc: 'Confirm the ride and pay securely through SeatBelt. The driver earns. You save. The community wins.' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '24px', marginBottom: '48px', alignItems: 'flex-start' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#1a1a1a', border: '0.5px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0 }}>
                {step.emoji}
              </div>
              <div>
                <div style={{ color: '#e0e0e0', fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>{step.title}</div>
                <div style={{ color: '#666', fontSize: '15px', lineHeight: 1.8 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mission */}
      <div style={{ padding: '100px 24px', borderBottom: '0.5px solid #1e1e1e', background: '#0e0e0e' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', letterSpacing: '4px', color: '#555', marginBottom: '16px' }}>OUR MISSION</p>
          <h2 style={{ fontSize: '34px', fontWeight: '700', color: '#e0e0e0', lineHeight: 1.5, marginBottom: '24px' }}>
            To connect people through the journeys they are already taking.
          </h2>
          <div style={{ width: '40px', height: '2px', background: '#c8b86a', margin: '0 auto 32px' }}></div>
          <p style={{ color: '#777', fontSize: '16px', lineHeight: 1.9, marginBottom: '24px' }}>
            Rideshare changed the world — but somewhere along the way, it stopped serving the people who needed it most. Prices became unpredictable. Drivers became underpaid. Communities were left holding the bill.
          </p>
          <p style={{ color: '#777', fontSize: '16px', lineHeight: 1.9, marginBottom: '40px' }}>
            SeatBelt is built for everyone. The daily commuter. The event planner. The parent on the school run. The small city where there is not much — but there is always someone heading the same direction.
          </p>
          <div style={{ background: '#1a1a1a', borderLeft: '3px solid #c8b86a', borderRadius: '0 12px 12px 0', padding: '24px 28px', textAlign: 'left', marginBottom: '40px' }}>
            <p style={{ fontSize: '18px', fontStyle: 'italic', color: '#e0e0e0', lineHeight: 1.7, margin: '0 0 12px' }}>
              &quot;No surge pricing. No app tax. No middleman. Just neighbors, moving together.&quot;
            </p>
            <p style={{ fontSize: '13px', color: '#555', margin: 0 }}>— Lookman Kinoshi, Founder & CEO</p>
          </div>
          <button onClick={() => router.push('/about')} style={{ background: 'transparent', color: '#c8b86a', border: '0.5px solid #c8b86a', borderRadius: '10px', padding: '12px 28px', fontSize: '14px', cursor: 'pointer', letterSpacing: '1px' }}>
            READ OUR FULL STORY
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '80px 24px', borderBottom: '0.5px solid #1e1e1e' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
            {[
              { value: '60-80%', label: 'less than traditional rideshare' },
              { value: '$0', label: 'surge pricing ever' },
              { value: '100%', label: 'community owned' },
              { value: '5%', label: 'platform fee only' },
            ].map((stat, i) => (
              <div key={i} style={{ background: '#1a1a1a', borderRadius: '14px', padding: '24px 16px', border: '0.5px solid #2a2a2a', textAlign: 'center' }}>
                <div style={{ fontSize: '30px', fontWeight: '700', color: '#c8b86a', marginBottom: '6px' }}>{stat.value}</div>
                <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.5 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Who is it for */}
      <div style={{ padding: '100px 24px', borderBottom: '0.5px solid #1e1e1e' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <p style={{ fontSize: '11px', letterSpacing: '4px', color: '#555', textAlign: 'center', marginBottom: '16px' }}>WHO IS SEATBELT FOR</p>
          <h2 style={{ fontSize: '36px', fontWeight: '700', color: '#e0e0e0', textAlign: 'center', marginBottom: '60px', lineHeight: 1.4 }}>Everyone with somewhere to go.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            {[
              { emoji: '🏙️', title: 'Daily commuters', desc: 'Get to work without the price shock.' },
              { emoji: '🎉', title: 'Event planners', desc: 'Build rides right into the RSVP.' },
              { emoji: '👨‍👧', title: 'Parents', desc: 'Coordinate pickup with neighbors.' },
              { emoji: '🚗', title: 'Drivers', desc: 'Earn on routes you already drive.' },
              { emoji: '🏘️', title: 'Small towns', desc: 'Where there is a driver, there is a way.' },
              { emoji: '⚡', title: 'Last minute', desc: 'Need a ride now? Someone is already going.' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#1a1a1a', borderRadius: '14px', padding: '20px', border: '0.5px solid #2a2a2a' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{item.emoji}</div>
                <div style={{ color: '#e0e0e0', fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>{item.title}</div>
                <div style={{ color: '#666', fontSize: '13px', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div style={{ padding: '100px 24px', textAlign: 'center' }}>
        <SeatBeltLogo size={80} />
        <h2 style={{ fontSize: '48px', fontWeight: '700', color: '#e0e0e0', margin: '24px 0 16px', lineHeight: 1.3 }}>Ready to ride smarter?</h2>
        <p style={{ color: '#555', fontSize: '16px', marginBottom: '40px' }}>Join the community. Save money. Make money.</p>
        <button onClick={() => router.push('/login')} style={{ background: '#c8b86a', color: '#111', border: 'none', borderRadius: '12px', padding: '18px 48px', fontSize: '18px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
          JOIN SEATBELT
        </button>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '0.5px solid #1e1e1e', padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SeatBeltLogo size={20} />
          <span style={{ color: '#333', fontSize: '13px', letterSpacing: '2px' }}>SEATBELT</span>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span onClick={() => router.push('/about')} style={{ color: '#333', fontSize: '12px', cursor: 'pointer' }}>About</span>
          <span onClick={() => router.push('/login')} style={{ color: '#333', fontSize: '12px', cursor: 'pointer' }}>Sign in</span>
        </div>
        <p style={{ color: '#333', fontSize: '11px', margin: 0 }}>© 2026 SeatBelt by Kinoshi LLC · Brooklyn, New York</p>
      </div>

    </div>
  )
}
