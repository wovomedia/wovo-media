'use client'
import Link from 'next/link'
import { useState } from 'react'

const NAV_LINKS = [
  { href: '#work', label: 'Work' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#contact', label: 'Contact' },
]

const TIERS = [
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

const WORK = [
  { client: 'The Campbell Station', location: 'Culleoka, TN', type: 'Social Media + Video', img: '/social.jpg' },
  { client: 'Mojo\'s Tacos', location: 'Multi-location, TN', type: 'Video Production', img: '/hero.jpg' },
  { client: 'Boot Stompin BBQ', location: 'Tennessee', type: 'Social Media', img: '/drone.jpg' },
]

function CheckIcon({ on }: { on: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
      background: on ? 'rgba(0,229,200,0.12)' : 'rgba(255,255,255,0.04)',
      color: on ? '#00E5C8' : 'rgba(255,255,255,0.2)',
      fontSize: 10, fontWeight: 700,
    }}>
      {on ? '✓' : '–'}
    </span>
  )
}

export default function Home() {
  const [form, setForm] = useState({ name: '', business: '', email: '', phone: '', service: '', message: '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.business) return
    setSending(true)
    try {
      await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } catch {}
    setSent(true)
    setSending(false)
  }

  return (
    <div style={{ background: '#080808', color: '#f2f2f2', fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60,
      }}>
        <a href="/" style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.04em', color: '#f2f2f2', textDecoration: 'none' }}>
          wovo<span style={{ color: '#00E5C8' }}>media</span>
        </a>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f2f2f2')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}>
              {l.label}
            </a>
          ))}
          <a href="#contact" style={{
            background: '#00E5C8', color: '#080808', padding: '8px 18px', borderRadius: 8,
            fontSize: 13, fontWeight: 700, textDecoration: 'none', letterSpacing: '-0.01em',
          }}>
            Get Started
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: 60 }}>
        <video
          autoPlay muted loop playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }}
        >
          <source src="https://assets.mixkit.co/videos/4820/4820-720.mp4" type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(8,8,8,0.3) 0%, rgba(8,8,8,0.7) 60%, #080808 100%)' }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 900, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', background: 'rgba(0,229,200,0.1)', border: '1px solid rgba(0,229,200,0.2)',
            borderRadius: 100, padding: '5px 16px', marginBottom: 28,
            fontSize: 12, fontWeight: 600, color: '#00E5C8', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Franklin, TN · Florence, AL · Culleoka, TN
          </div>
          <h1 style={{
            fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(40px, 7vw, 82px)',
            fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05,
            color: '#f2f2f2', marginBottom: 24,
          }}>
            Content that makes<br />
            <span style={{ color: '#00E5C8' }}>local businesses</span> go viral
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.6 }}>
            Social media management, video production, drone footage, and web — all handled by Wovo Media so you can focus on running your business.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#contact" style={{
              background: '#00E5C8', color: '#080808', padding: '14px 32px', borderRadius: 10,
              fontWeight: 700, fontSize: 15, textDecoration: 'none', letterSpacing: '-0.01em',
            }}>
              Start a conversation
            </a>
            <a href="#pricing" style={{
              background: 'rgba(255,255,255,0.06)', color: '#f2f2f2', padding: '14px 32px', borderRadius: 10,
              fontWeight: 600, fontSize: 15, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)',
            }}>
              See pricing
            </a>
          </div>
        </div>
      </section>

      {/* SERVICES STRIP */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 24px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 900, margin: '0 auto' }}>
          {['Daily Social Media', 'Video Production', 'Drone Footage', 'Short-Form Reels', 'UGC AI Videos', 'Group Review Videos', 'Website Builds', 'Google Business Profile'].map(s => (
            <span key={s} style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#00E5C8', marginRight: 6 }}>✦</span>{s}
            </span>
          ))}
        </div>
      </section>

      {/* WORK */}
      <section id="work" style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 24px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#00E5C8', marginBottom: 12 }}>Our work</p>
        <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 48 }}>
          Real clients. Real results.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {WORK.map(w => (
            <div key={w.client} style={{
              borderRadius: 12, overflow: 'hidden', position: 'relative',
              aspectRatio: '16/10', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <img src={w.img} alt={w.client} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,8,8,0.9) 0%, transparent 50%)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Outfit,sans-serif' }}>{w.client}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{w.location} · {w.type}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#00E5C8', marginBottom: 12 }}>Pricing</p>
          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
            Simple, transparent tiers
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 52, fontSize: 15 }}>No hidden fees. No long-term contracts. Cancel anytime.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
            {TIERS.map(t => (
              <div key={t.id} style={{
                background: t.highlight ? 'rgba(0,229,200,0.05)' : 'rgba(255,255,255,0.02)',
                border: t.highlight ? '1.5px solid rgba(0,229,200,0.35)' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12, padding: '20px 16px',
                display: 'flex', flexDirection: 'column', gap: 10, position: 'relative',
              }}>
                {t.highlight && (
                  <div style={{
                    position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                    background: '#00E5C8', color: '#080808', fontSize: 10, fontWeight: 800,
                    padding: '3px 12px', borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '0.04em',
                  }}>MOST POPULAR</div>
                )}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4 }}>Tier {t.id}</div>
                  <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 15, color: '#f2f2f2' }}>{t.name}</div>
                </div>
                <div style={{ fontSize: t.price ? 24 : 19, fontFamily: 'Outfit,sans-serif', fontWeight: 800, color: t.highlight ? '#00E5C8' : '#f2f2f2', letterSpacing: '-0.03em' }}>
                  {t.price ? `$${t.price.toLocaleString()}` : 'Custom'}
                  {t.price && <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}>/mo</span>}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '5px 8px' }}>
                  {t.cadence}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {t.features.map(f => (
                    <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, opacity: f.on ? 1 : 0.35 }}>
                      <CheckIcon on={f.on} />
                      <span style={{ fontSize: 11.5, color: f.on ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{f.label}</span>
                    </div>
                  ))}
                </div>
                <a href="#contact" style={{
                  marginTop: 'auto', paddingTop: 12, display: 'block', textAlign: 'center',
                  background: t.highlight ? '#00E5C8' : 'rgba(255,255,255,0.06)',
                  color: t.highlight ? '#080808' : 'rgba(255,255,255,0.7)',
                  padding: '9px 0', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  textDecoration: 'none', border: t.highlight ? 'none' : '1px solid rgba(255,255,255,0.09)',
                }}>
                  Get started
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ maxWidth: 640, margin: '0 auto', padding: '100px 24px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#00E5C8', marginBottom: 12 }}>Contact</p>
        <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Let's work together
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 40, fontSize: 15 }}>
          Fill out the form and Payton will reach out within 24 hours.
        </p>

        {sent ? (
          <div style={{ background: 'rgba(0,229,200,0.08)', border: '1px solid rgba(0,229,200,0.2)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Message received</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>We'll be in touch within 24 hours.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { key: 'name', label: 'Your name', placeholder: 'John Smith' },
              { key: 'business', label: 'Business name', placeholder: 'Smith\'s BBQ' },
              { key: 'email', label: 'Email', placeholder: 'john@smithsbbq.com' },
              { key: 'phone', label: 'Phone (optional)', placeholder: '(931) 000-0000' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6, letterSpacing: '0.02em' }}>{f.label}</label>
                <input
                  type="text"
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '12px 14px', color: '#f2f2f2', fontSize: 14, outline: 'none',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>What are you interested in?</label>
              <select
                value={form.service}
                onChange={e => setForm(p => ({ ...p, service: e.target.value }))}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '12px 14px', color: form.service ? '#f2f2f2' : 'rgba(255,255,255,0.3)',
                  fontSize: 14, outline: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                <option value="" disabled>Select a tier or service</option>
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
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Tell us about your business</label>
              <textarea
                placeholder="What do you do, where are you located, what's your goal?"
                value={form.message}
                onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                rows={4}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '12px 14px', color: '#f2f2f2', fontSize: 14, outline: 'none',
                  fontFamily: "'Plus Jakarta Sans', sans-serif", resize: 'vertical',
                }}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={sending || !form.name || !form.email || !form.business}
              style={{
                background: '#00E5C8', color: '#080808', border: 'none',
                padding: '14px 0', borderRadius: 9, fontSize: 15, fontWeight: 700,
                cursor: sending ? 'wait' : 'pointer', width: '100%', letterSpacing: '-0.01em',
                opacity: (!form.name || !form.email || !form.business) ? 0.5 : 1,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 24px', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em' }}>
          wovo<span style={{ color: '#00E5C8' }}>media</span>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <a href="mailto:Payton@wovomedia.com" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>Payton@wovomedia.com</a>
          <a href="tel:9314583255" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>931-458-3255</a>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Franklin, TN</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>© 2025 Wovo Media</div>
      </footer>
    </div>
  )
}
