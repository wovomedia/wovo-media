'use client'
import { useState, useEffect, useRef } from 'react'

const TIERS = [
  {
    id: 'NP', name: 'Nonprofit', price: 150,
    cadence: '2–3x/week (~10/mo)',
    badge: '501(c)(3) only',
    badgeColor: '#7c3aed',
    features: [
      { label: '2 platforms managed', on: true },
      { label: 'Graphics & captions', on: true },
      { label: 'Awareness & event posts', on: true },
      { label: 'No reels or video', on: false },
      { label: 'Remote content only', on: false },
      { label: 'No website or GBP', on: false },
    ],
    highlight: false,
  },
  {
    id: 'A', name: 'Starter', price: 300,
    cadence: 'Every other day (~15/mo)',
    features: [
      { label: '2 platforms managed', on: true },
      { label: 'Graphics & captions', on: true },
      { label: 'No reels', on: false },
      { label: 'No UGC videos', on: false },
      { label: 'Remote only', on: false },
      { label: 'No website', on: false },
    ],
    highlight: false,
  },
  {
    id: 'B', name: 'Essential', price: 500,
    cadence: 'Every other day (~15/mo)',
    features: [
      { label: '3 platforms managed', on: true },
      { label: 'Graphics & captions', on: true },
      { label: '2 reels/mo', on: true },
      { label: 'No UGC videos', on: false },
      { label: 'Remote only', on: false },
      { label: 'No website', on: false },
    ],
    highlight: false,
  },
  {
    id: 'C', name: 'Growth', price: 750,
    cadence: 'Daily (30/mo)',
    features: [
      { label: 'All platforms managed', on: true },
      { label: 'Graphics & captions', on: true },
      { label: '4 reels/mo', on: true },
      { label: '1 UGC AI creator video', on: true },
      { label: 'Remote only', on: false },
      { label: '1-page website setup', on: true },
    ],
    highlight: false,
  },
  {
    id: 'D', name: 'Pro', price: 1100,
    cadence: 'Daily (30/mo)',
    features: [
      { label: 'All platforms managed', on: true },
      { label: 'Graphics & captions', on: true },
      { label: '6 reels/mo', on: true },
      { label: '2 UGC AI creator videos', on: true },
      { label: '1x/mo in-person filming', on: true },
      { label: 'Multi-page website + GBP', on: true },
    ],
    highlight: false,
  },
  {
    id: 'E', name: 'Pro + Drone', price: 1500,
    cadence: 'Daily (30/mo)',
    features: [
      { label: 'All platforms managed', on: true },
      { label: 'Graphics & captions', on: true },
      { label: '8 reels/mo', on: true },
      { label: '2 UGC AI + 1 group review video', on: true },
      { label: '1x/mo filming + drone footage', on: true },
      { label: 'Website + GBP managed', on: true },
    ],
    highlight: true,
  },
  {
    id: 'F', name: 'Elite', price: 2000,
    cadence: 'Daily (30/mo)',
    features: [
      { label: 'All platforms managed', on: true },
      { label: 'Graphics & captions', on: true },
      { label: '10 reels/mo', on: true },
      { label: '4 UGC AI + 2 group review videos', on: true },
      { label: '2x/mo filming + drone footage', on: true },
      { label: 'Website + app + GBP managed', on: true },
    ],
    highlight: false,
  },
  {
    id: 'G', name: 'Full Partner', price: null,
    cadence: 'Daily + strategy calls',
    features: [
      { label: 'All platforms managed', on: true },
      { label: 'Graphics & captions', on: true },
      { label: '12+ reels/mo', on: true },
      { label: '4+ UGC AI + monthly group review', on: true },
      { label: 'Weekly filming + drone', on: true },
      { label: 'Full website/app + influencer sourcing', on: true },
    ],
    highlight: false,
  },
]

const SERVICES = [
  { icon: '📱', title: 'Social Media Management', desc: 'Daily posts, captions, and engagement across all platforms — handled completely.' },
  { icon: '🎬', title: 'Video Production', desc: 'In-person filming, cinematic edits, and short-form reels that stop the scroll.' },
  { icon: '🚁', title: 'Drone Footage', desc: 'Aerial shots that make your business look like a million dollars.' },
  { icon: '🤖', title: 'UGC AI Creator Videos', desc: 'AI-powered spokesperson videos that feel authentic and convert like crazy.' },
  { icon: '👥', title: 'Group Review Videos', desc: 'TikTok-style street interview and reaction content for your brand.' },
  { icon: '🌐', title: 'Website Design & Builds', desc: 'Fast, clean, conversion-focused websites from 1-page to full multi-page.' },
  { icon: '📍', title: 'Google Business Profile', desc: 'Full GBP management, posts, and optimization so you show up first locally.' },
  { icon: '📸', title: 'Photography', desc: 'Professional product, brand, and lifestyle photography for any industry.' },
]

const STATS = [
  { value: 9, suffix: '+', label: 'Active Clients' },
  { value: 100, suffix: 'M+', label: 'Views Generated' },
  { value: 30, suffix: '+', label: 'Posts Per Client/Mo' },
  { value: 100, suffix: '%', label: 'US Coverage' },
]

const WHY = [
  { title: 'We do everything', body: 'Social, video, drone, web, GBP — one team, one invoice, zero coordination headache.' },
  { title: 'No contracts', body: "Month-to-month on every tier. Stay because the results are good, not because you're locked in." },
  { title: 'Remote or in-person', body: 'We serve businesses anywhere in the US. Need us there in person? We show up.' },
  { title: 'Built for results', body: "We've generated over 100M views for our clients. Content that performs, not just content that exists." },
]

const PLATFORMS = ['TikTok', 'Instagram', 'Facebook', 'YouTube', 'Google', 'Pinterest', 'Shopify', 'Meta']

const HERO_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_3FMbCNaesGPRIrH56UM1e3O0NX0/hf_20260624_184640_0b07dca7-2d08-4530-819b-507d958fd3b1.mp4"
const EDITOR_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_3FMbCNaesGPRIrH56UM1e3O0NX0/hf_20260624_184650_587a75b7-3ac7-46d4-8cca-d349e1ff243c.mp4"
const PHONE_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_3FMbCNaesGPRIrH56UM1e3O0NX0/hf_20260624_184654_29693bb5-ea77-413d-b672-1a3ed4d6efe1.mp4"
const DRONE_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_3FMbCNaesGPRIrH56UM1e3O0NX0/hf_20260624_184658_b904134b-e5f1-4554-a488-36aa326a0865.mp4"

function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return count
}

function StatCard({ value, suffix, label, animate }: { value: number, suffix: string, label: string, animate: boolean }) {
  const count = useCountUp(value, 1600, animate)
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(40px,6vw,80px)', fontWeight: 800, letterSpacing: '-0.04em', color: '#00E5C8', lineHeight: 1 }}>
        {animate ? count : 0}{suffix}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 10, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function CheckIcon({ on }: { on: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
      background: on ? 'rgba(0,229,200,0.15)' : 'rgba(255,255,255,0.04)',
      color: on ? '#00E5C8' : 'rgba(255,255,255,0.2)',
      fontSize: 10, fontWeight: 800,
    }}>
      {on ? '✓' : '–'}
    </span>
  )
}

export default function Home() {
  const [form, setForm] = useState({ name: '', business: '', email: '', phone: '', service: '', message: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true) }, { threshold: 0.3 })
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.business) return
    setSending(true)
    try {
      await fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } catch {}
    setSent(true)
    setSending(false)
  }

  return (
    <div style={{ background: '#080808', color: '#f2f2f2', fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh' }}>

      {/* ── GLOBAL MOBILE STYLES ── */}
      <style>{`
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .nav-cta { display: none !important; }
          .hamburger { display: flex !important; }
          .mobile-menu { display: flex !important; }
          .hero-pad { padding: 0 20px !important; }
          .section-pad { padding: 72px 20px !important; }
          .section-pad-sm { padding: 48px 20px !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .services-grid { grid-template-columns: 1fr !important; }
          .why-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .contact-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .platform-strip { padding: 16px 20px !important; }
          .footer-inner { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
          .footer-wrap { padding: 28px 20px !important; }
          .why-video { display: none !important; }
          .nav-inner { padding: 0 20px !important; }
          .hero-btns { flex-direction: column !important; }
          .hero-btns a { text-align: center !important; }
          .services-header { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="nav-inner" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          <a href="/" style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.04em', color: '#f2f2f2', textDecoration: 'none' }}>
            wovo<span style={{ color: '#00E5C8' }}>media</span>
          </a>
          <div className="nav-links" style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
            {[['#services','Services'],['#why','Why Us'],['#pricing','Pricing'],['#contact','Contact']].map(([href, label]) => (
              <a key={href} href={href} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f2f2f2')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}>
                {label}
              </a>
            ))}
            <a href="#contact" className="nav-cta" style={{ background: '#00E5C8', color: '#080808', padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Get Started</a>
          </div>
          {/* Hamburger */}
          <button className="hamburger" onClick={() => setMenuOpen(o => !o)}
            style={{ display: 'none', flexDirection: 'column', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ display: 'block', width: 24, height: 2, background: '#f2f2f2', borderRadius: 2, transition: 'all 0.2s',
                transform: menuOpen ? (i === 0 ? 'rotate(45deg) translate(5px,5px)' : i === 2 ? 'rotate(-45deg) translate(5px,-5px)' : 'opacity 0') : 'none',
                opacity: menuOpen && i === 1 ? 0 : 1,
              }} />
            ))}
          </button>
        </div>
        {/* Mobile menu dropdown */}
        <div className="mobile-menu" style={{ display: 'none', flexDirection: 'column', background: '#0f0f0f', borderTop: '1px solid rgba(255,255,255,0.07)', padding: menuOpen ? '20px' : '0 20px', maxHeight: menuOpen ? 300 : 0, overflow: 'hidden', transition: 'all 0.25s ease' }}>
          {menuOpen && [['#services','Services'],['#why','Why Us'],['#pricing','Pricing'],['#contact','Contact']].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}
              style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, textDecoration: 'none', fontWeight: 500, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {label}
            </a>
          ))}
          {menuOpen && <a href="#contact" onClick={() => setMenuOpen(false)}
            style={{ background: '#00E5C8', color: '#080808', padding: '14px 0', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center', marginTop: 16 }}>
            Get Started
          </a>}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: 68 }}>
        <video autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }}>
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(8,8,8,0.85) 0%, rgba(8,8,8,0.5) 50%, rgba(8,8,8,0.9) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, #080808 100%)' }} />
        <div className="hero-pad" style={{ position: 'relative', zIndex: 2, maxWidth: 1100, margin: '0 auto', padding: '0 48px', width: '100%' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,229,200,0.08)', border: '1px solid rgba(0,229,200,0.2)', borderRadius: 100, padding: '6px 18px', marginBottom: 32 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00E5C8', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#00E5C8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Serving businesses anywhere in the US</span>
          </div>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(40px,7.5vw,96px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.0, color: '#f2f2f2', marginBottom: 28, maxWidth: 800 }}>
            Content that makes<br /><span style={{ color: '#00E5C8' }}>businesses</span><br />go viral.
          </h1>
          <p style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'rgba(255,255,255,0.5)', maxWidth: 500, lineHeight: 1.7, marginBottom: 44 }}>
            Social media, video production, drone, and web — all under one roof. Fully remote or in-person, anywhere in the US.
          </p>
          <div className="hero-btns" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <a href="#contact" style={{ background: '#00E5C8', color: '#080808', padding: '16px 36px', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Start a conversation →</a>
            <a href="#pricing" style={{ background: 'transparent', color: '#f2f2f2', padding: '16px 36px', borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.15)' }}>See pricing</a>
          </div>
        </div>
      </section>

      {/* ── PLATFORM STRIP ── */}
      <div className="platform-strip" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '18px 48px', background: 'rgba(255,255,255,0.01)', overflowX: 'auto' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap', minWidth: 'max-content' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 12, whiteSpace: 'nowrap' }}>We post on</span>
          {PLATFORMS.map((p, i) => (
            <span key={p} style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.45)', fontFamily: 'Outfit,sans-serif', paddingRight: i < PLATFORMS.length - 1 ? 12 : 0, borderRight: i < PLATFORMS.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none', whiteSpace: 'nowrap' }}>{p}</span>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <div ref={statsRef} style={{ background: '#0c0c0c', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
        <video autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.08 }}>
          <source src={PHONE_VIDEO} type="video/mp4" />
        </video>
        <div className="stats-grid" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '0 20px', position: 'relative' }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none', padding: '0 8px' }}>
              <StatCard value={s.value} suffix={s.suffix} label={s.label} animate={statsVisible} />
            </div>
          ))}
        </div>
      </div>

      {/* ── SERVICES ── */}
      <section id="services" className="section-pad" style={{ padding: '120px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div className="services-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 64, flexWrap: 'wrap', gap: 24 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00E5C8', marginBottom: 14 }}>What we do</p>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(28px,4vw,54px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.1, margin: 0 }}>
              Everything your<br />business needs online
            </h2>
          </div>
          <a href="#contact" style={{ color: '#00E5C8', fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(0,229,200,0.3)', paddingBottom: 2 }}>
            Get a free consultation →
          </a>
        </div>
        <div className="services-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
          {SERVICES.map((s, i) => (
            <div key={s.title} style={{ padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,200,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{s.icon}</div>
              <h3 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BROLL DIVIDER ── */}
      <div style={{ position: 'relative', height: 280, overflow: 'hidden' }}>
        <video autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }}>
          <source src={DRONE_VIDEO} type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #080808 0%, transparent 25%, transparent 75%, #080808 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '0 20px' }}>
          <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(22px,4vw,48px)', fontWeight: 800, letterSpacing: '-0.04em', color: '#f2f2f2', textAlign: 'center', margin: 0 }}>
            Real content. Real results.
          </p>
          <a href="#contact" style={{ background: '#00E5C8', color: '#080808', padding: '12px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Start today →</a>
        </div>
      </div>

      {/* ── WHY WOVO ── */}
      <section id="why" style={{ background: 'rgba(0,229,200,0.03)', borderTop: '1px solid rgba(0,229,200,0.08)', borderBottom: '1px solid rgba(0,229,200,0.08)', padding: '120px 48px' }}
        className="section-pad">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="why-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00E5C8', marginBottom: 14 }}>Why Wovo Media</p>
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(28px,4vw,52px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.1, marginBottom: 24 }}>
                One team.<br />Every platform.<br />Real results.
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, marginBottom: 36 }}>
                Most agencies specialize in one thing. Wovo Media handles your entire digital presence — from the content shot on location to the website visitors land on.
              </p>
              <a href="#contact" style={{ display: 'inline-block', background: '#00E5C8', color: '#080808', padding: '14px 32px', borderRadius: 9, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Work with us →</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div className="why-video" style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 24, position: 'relative' }}>
                <video autoPlay muted loop playsInline style={{ width: '100%', borderRadius: 12, display: 'block', maxHeight: 180, objectFit: 'cover' }}>
                  <source src={EDITOR_VIDEO} type="video/mp4" />
                </video>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 12, border: '1px solid rgba(0,229,200,0.2)' }} />
              </div>
              {WHY.map((w, i) => (
                <div key={w.title} style={{ padding: '24px 0', borderBottom: i < WHY.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,229,200,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#00E5C8', flexShrink: 0, fontFamily: 'Outfit,sans-serif' }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{w.title}</div>
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{w.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="section-pad" style={{ padding: '120px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00E5C8', marginBottom: 14 }}>Pricing</p>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(28px,4vw,54px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.1, marginBottom: 12 }}>
              Simple, transparent tiers
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>No hidden fees. No long-term contracts. Cancel anytime.</p>
          </div>
          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {TIERS.map(t => (
              <div key={t.id} style={{
                background: t.highlight ? 'rgba(0,229,200,0.04)' : '#0f0f0f',
                border: t.highlight ? '1.5px solid rgba(0,229,200,0.4)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '28px 22px',
                display: 'flex', flexDirection: 'column', gap: 14, position: 'relative',
              }}>
                {t.highlight && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#00E5C8', color: '#080808', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>MOST POPULAR</div>
                )}
                {(t as any).badge && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#7c3aed', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>{(t as any).badge}</div>
                )}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 6 }}>
                    {t.id === 'NP' ? 'Nonprofit' : `Tier ${t.id}`}
                  </div>
                  <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 17, color: '#f2f2f2' }}>{t.name}</div>
                </div>
                <div>
                  <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', color: t.highlight ? '#00E5C8' : '#f2f2f2' }}>
                    {t.price ? `$${t.price.toLocaleString()}` : 'Custom'}
                  </span>
                  {t.price && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>/mo</span>}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', borderRadius: 7, padding: '6px 10px', display: 'inline-block', width: 'fit-content' }}>
                  {t.cadence}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                  {t.features.map(f => (
                    <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      <CheckIcon on={f.on} />
                      <span style={{ fontSize: 12, color: f.on ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>{f.label}</span>
                    </div>
                  ))}
                </div>
                <a href="#contact" style={{
                  display: 'block', textAlign: 'center',
                  background: t.highlight ? '#00E5C8' : 'rgba(255,255,255,0.06)',
                  color: t.highlight ? '#080808' : 'rgba(255,255,255,0.75)',
                  padding: '12px 0', borderRadius: 9, fontSize: 13, fontWeight: 700,
                  textDecoration: 'none', border: t.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  marginTop: 'auto',
                }}>Get started</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="section-pad" style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '120px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 100, alignItems: 'start' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00E5C8', marginBottom: 14 }}>Contact</p>
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(28px,4vw,52px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.1, marginBottom: 24 }}>
                Let's build<br />something together
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, marginBottom: 40 }}>
                Fill out the form and our team will reach out within 24 hours to go over your goals and find the right plan.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  { label: 'Email', value: 'support@wovomedia.com', href: 'mailto:support@wovomedia.com' },
                  { label: 'Coverage', value: 'Anywhere in the US' },
                  { label: 'Response time', value: 'Within 24 hours' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ width: 2, background: 'rgba(0,229,200,0.3)', alignSelf: 'stretch', flexShrink: 0, borderRadius: 2 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                      {item.href
                        ? <a href={item.href} style={{ fontSize: 15, color: '#00E5C8', textDecoration: 'none', fontWeight: 500 }}>{item.value}</a>
                        : <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{item.value}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              {sent ? (
                <div style={{ background: 'rgba(0,229,200,0.06)', border: '1px solid rgba(0,229,200,0.2)', borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
                  <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Message received</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15 }}>We'll be in touch within 24 hours.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { key: 'name', label: 'Your name', placeholder: 'John Smith' },
                    { key: 'business', label: 'Business name', placeholder: "Smith's BBQ" },
                    { key: 'email', label: 'Email address', placeholder: 'john@smithsbbq.com' },
                    { key: 'phone', label: 'Phone (optional)', placeholder: '(555) 000-0000' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 7, letterSpacing: '0.02em' }}>{f.label}</label>
                      <input type="text" placeholder={f.placeholder}
                        value={form[f.key as keyof typeof form]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: '100%', background: '#161616', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '14px 16px', color: '#f2f2f2', fontSize: 15, outline: 'none', fontFamily: "'Plus Jakarta Sans',sans-serif", boxSizing: 'border-box' }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(0,229,200,0.4)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 7, letterSpacing: '0.02em' }}>What are you interested in?</label>
                    <select value={form.service} onChange={e => setForm(p => ({ ...p, service: e.target.value }))}
                      style={{ width: '100%', background: '#161616', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '14px 16px', color: '#f2f2f2', fontSize: 15, outline: 'none', fontFamily: "'Plus Jakarta Sans',sans-serif", cursor: 'pointer' }}>
                      <option value="" disabled>Select a tier or service</option>
                      <option value="nonprofit">Nonprofit — $150/mo (501c3 required)</option>
                      <option value="tier-a">Tier A — Starter ($300/mo)</option>
                      <option value="tier-b">Tier B — Essential ($500/mo)</option>
                      <option value="tier-c">Tier C — Growth ($750/mo)</option>
                      <option value="tier-d">Tier D — Pro ($1,100/mo)</option>
                      <option value="tier-e">Tier E — Pro + Drone ($1,500/mo)</option>
                      <option value="tier-f">Tier F — Elite ($2,000/mo)</option>
                      <option value="tier-g">Tier G — Full Partner (Custom)</option>
                      <option value="not-sure">Not sure yet</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 7, letterSpacing: '0.02em' }}>Tell us about your business</label>
                    <textarea placeholder="What do you do, where are you located, what's your goal?"
                      value={form.message}
                      onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                      rows={4}
                      style={{ width: '100%', background: '#161616', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '14px 16px', color: '#f2f2f2', fontSize: 15, outline: 'none', fontFamily: "'Plus Jakarta Sans',sans-serif", resize: 'vertical', boxSizing: 'border-box' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(0,229,200,0.4)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                    />
                  </div>
                  <button onClick={handleSubmit} disabled={sending || !form.name || !form.email || !form.business}
                    style={{ background: '#00E5C8', color: '#080808', border: 'none', padding: '16px 0', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: sending ? 'wait' : 'pointer', width: '100%', letterSpacing: '-0.01em', opacity: (!form.name || !form.email || !form.business) ? 0.45 : 1, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'opacity 0.15s' }}>
                    {sending ? 'Sending…' : 'Send message →'}
                  </button>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 1.7 }}>
                    By submitting you agree to our{' '}
                    <a href="/terms" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline' }}>Terms</a> and{' '}
                    <a href="/cancellation-policy" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline' }}>Cancellation Policy</a>.
                    {' '}Services renew monthly until cancelled in writing.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 48px' }}>
        <div className="footer-inner" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 18, letterSpacing: '-0.04em' }}>
            wovo<span style={{ color: '#00E5C8' }}>media</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.2)', marginLeft: 16 }}>© 2025</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:support@wovomedia.com" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>support@wovomedia.com</a>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
            <a href="/terms" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textDecoration: 'none' }}>Terms</a>
            <a href="/privacy" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textDecoration: 'none' }}>Privacy</a>
            <a href="/cancellation-policy" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textDecoration: 'none' }}>Cancellation</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
