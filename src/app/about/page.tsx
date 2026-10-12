'use client'
import { useRouter } from 'next/navigation'

export default function AboutPage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#e0e0e0', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', paddingBottom: '80px' }}>

      {/* Header */}
      <div style={{ background: '#111', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '0.5px solid #222', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '22px' }}>←</button>
        <span style={{ color: '#e0e0e0', fontSize: '17px', fontWeight: '600', letterSpacing: '1px' }}>About SeatBelt</span>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 20px' }}>

        {/* Mission */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '11px', color: '#555', letterSpacing: '3px', marginBottom: '16px' }}>OUR MISSION</div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#e0e0e0', lineHeight: 1.5, marginBottom: '16px' }}>
            To connect people through the journeys they are already taking — making transportation affordable, community-driven, and human again.
          </h1>
          <div style={{ width: '40px', height: '2px', background: '#c8b86a', marginBottom: '20px' }}></div>
          <p style={{ color: '#777', fontSize: '15px', lineHeight: 1.8, marginBottom: '16px' }}>
            Rideshare changed the world — but somewhere along the way, it stopped serving the people who needed it most. Prices became unpredictable. Drivers became underpaid. And the communities that depended on affordable transportation were left holding the bill.
          </p>
          <p style={{ color: '#777', fontSize: '15px', lineHeight: 1.8 }}>
            SeatBelt was built on a simple truth: people are already going where you need to go. A driver heading downtown. A parent dropping kids at school. An event-goer heading to the same venue. SeatBelt lets them open a seat and lets you take it — at a price you both agree on, with no algorithm in between.
          </p>
        </div>

        {/* What is SeatBelt */}
        <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '24px', border: '0.5px solid #2a2a2a', marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', color: '#555', letterSpacing: '3px', marginBottom: '16px' }}>WHAT IS SEATBELT</div>
          <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.9, marginBottom: '14px' }}>
            SeatBelt is a peer-to-peer community rideshare platform where drivers post their everyday routes to a social feed — and riders browse, message, and negotiate a fair price directly. No surge pricing. No app tax. No middleman.
          </p>
          <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.9, marginBottom: '14px' }}>
            We are for the commuter who just wants to get to work without breaking the bank. For the driver who wants to earn on a trip they were already taking. For the event planner who wants to build transportation into the RSVP. For the parent coordinating pickup with another parent on the same block.
          </p>
          <p style={{ color: '#888', fontSize: '14px', lineHeight: 1.9 }}>
            SeatBelt is for fast cities and quiet towns. For the person planning a week ahead and the person who needs a ride right now. For the communities that have always taken care of each other — we are just making it easier.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '32px' }}>
          {[
            { value: '60-80%', label: 'less than traditional rideshare' },
            { value: '$0', label: 'surge pricing ever' },
            { value: '100%', label: 'community owned' },
            { value: '5%', label: 'platform fee only' },
          ].map((stat, i) => (
            <div key={i} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '16px', border: '0.5px solid #2a2a2a', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#c8b86a', marginBottom: '4px' }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.5px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Values */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '11px', color: '#555', letterSpacing: '3px', marginBottom: '24px' }}>WHAT WE STAND FOR</div>
          {[
            { icon: '🤝', title: 'Community first', desc: 'Every feature we build puts the community before the corporation. SeatBelt exists to serve the people who use it — not investors.' },
            { icon: '💰', title: 'Economic empowerment', desc: 'If you have a car and a route, you can earn on SeatBelt. No resume, no interview, no boss. Just your community.' },
            { icon: '⚖️', title: 'Fair pricing always', desc: 'We will never implement surge pricing. Prices are set by humans through honest conversation. The way it should be.' },
            { icon: '🏘️', title: 'Built for real communities', desc: 'SeatBelt works in fast cities and quiet towns, for big events and daily commutes, for parents and planners and everyone in between.' },
            { icon: '🔒', title: 'Safety and trust', desc: 'Every user is verified. Every ride is tracked. Every transaction is processed securely in-app. Your safety is non-negotiable.' },
          ].map((value, i) => (
            <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'flex-start' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#1a1a1a', border: '0.5px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                {value.icon}
              </div>
              <div>
                <div style={{ color: '#e0e0e0', fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>{value.title}</div>
                <div style={{ color: '#666', fontSize: '13px', lineHeight: 1.7 }}>{value.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Founder */}
        <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '24px', border: '0.5px solid #2a2a2a', marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', color: '#555', letterSpacing: '3px', marginBottom: '16px' }}>WHO WE ARE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#2a2a2a', border: '2px solid #444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#aaa', flexShrink: 0 }}>LK</div>
            <div>
              <div style={{ color: '#e0e0e0', fontSize: '17px', fontWeight: '600' }}>Lookman Kinoshi</div>
              <div style={{ color: '#c8b86a', fontSize: '12px', marginTop: '3px', letterSpacing: '0.5px' }}>Community Builder · Father · Entrepreneur · Jr. Dev</div>
              <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>Founder & CEO · Brooklyn, New York</div>
            </div>
          </div>
          <p style={{ color: '#777', fontSize: '14px', lineHeight: 1.8, marginBottom: '14px' }}>
            Lookman Kinoshi built SeatBelt from a genuine frustration — watching his community pay too much to get around while hardworking drivers earned too little. A Brooklyn native, father, entrepreneur, and self-taught developer, Lookman believes the best solutions come from the people who live the problem every day.
          </p>
          <p style={{ color: '#777', fontSize: '14px', lineHeight: 1.8 }}>
            SeatBelt is his answer to a system that was never designed with communities like his in mind. He built it himself — from the logo to the code — because he believes technology should serve people, not extract from them.
          </p>
        </div>

        {/* Quote */}
        <div style={{ borderLeft: '3px solid #c8b86a', paddingLeft: '20px', marginBottom: '36px' }}>
          <p style={{ fontSize: '17px', fontStyle: 'italic', color: '#e0e0e0', lineHeight: 1.7, margin: '0 0 10px' }}>
            &quot;No surge pricing. No app tax. No middleman. Just neighbors, moving together.&quot;
          </p>
          <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>— Lookman Kinoshi, Founder & CEO</p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ color: '#555', fontSize: '14px', marginBottom: '20px' }}>Ready to be part of the movement?</p>
          <button onClick={() => router.push('/login')} style={{ background: '#c8b86a', color: '#111', border: 'none', borderRadius: '10px', padding: '14px 32px', fontSize: '14px', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
            JOIN SEATBELT
          </button>
        </div>

      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', borderTop: '0.5px solid #222', display: 'flex', padding: '8px 0' }}>
        {[
          { icon: '🏠', label: 'Feed', path: '/feed' },
          { icon: '➕', label: 'Post', path: '/post' },
          { icon: '💬', label: 'DMs', path: '/dms' },
          { icon: 'ℹ️', label: 'About', path: '/about' },
          { icon: '👤', label: 'Profile', path: '/profile' },
        ].map((item, i) => (
          <div key={i} onClick={() => router.push(item.path)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontSize: '9px', color: i === 3 ? '#c8b86a' : '#444' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
