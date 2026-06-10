'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Msg = { role: 'user' | 'ai'; content: string; imageUrl?: string }

const AVATAR = 'https://v3b.fal.media/files/b/0a9dc045/i1MJb4Rv11UqEM1NlCVX8.jpg'

const IMGS = {
  hero: 'https://v3b.fal.media/files/b/0a9dc82f/qSFW82dOEK5PMHb--MQvl.jpg',
  social: 'https://v3b.fal.media/files/b/0a9dc82f/e43qNXw5XXtLdWq6XTQWQ.jpg',
  ai: 'https://v3b.fal.media/files/b/0a9dc82f/88gQU_rbqHUneOexDyfHO.jpg',
  drone: 'https://v3b.fal.media/files/b/0a9dc82f/tjT9L2NkpUNYPNnkQ-8gY.jpg',
  cinAd: 'https://v3b.fal.media/files/b/0a9dc82f/B6tH2UjRVW9J90tvdjJF9.jpg',
}

const NAV_ITEMS = [
  { id: 'chat', icon: '✦', label: 'Wovo AI', sub: 'Chat + Image gen' },
  { id: 'wovo-ai', icon: '⚡', label: 'AI Content Plans', sub: 'From $29/mo', href: '/wovo-ai' },
  { id: 'cinematic', icon: '🎬', label: 'Cinematic Ads', sub: '$149/mo', href: '/wovo-ai?tab=cinematic' },
  { id: 'websites', icon: '🌐', label: 'Website Builder', sub: '$99/mo', href: '/wovo-ai?tab=website' },
  { id: 'wovo-os', icon: '🤖', label: 'WOVO OS', sub: 'AI Employee', href: '/wovo-os' },
  { id: 'premium', icon: '🎥', label: 'Premium', sub: 'Full-service', href: '#premium-section' },
]

const SUGGESTIONS = [
  'Write a caption for a restaurant special',
  'How do I get more Instagram followers?',
  'Make me a photo of a modern coffee shop',
  'What content works best for restaurants?',
]

export default function Home() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'anon'
    return localStorage.getItem('wovo_sid') || (() => {
      const id = Math.random().toString(36).slice(2)
      localStorage.setItem('wovo_sid', id)
      return id
    })()
  })
  const [showAuthWall, setShowAuthWall] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('chat')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const send = async (promptOverride?: string) => {
    const prompt = (promptOverride || input).trim()
    if (!prompt || loading) return
    setInput('')
    setShowAuthWall(false)

    const lower = prompt.toLowerCase()
    const wantsImage = /make.*(image|photo|picture|poster|logo)|generate.*(image|photo|picture)|create.*(image|photo|picture)|draw|photo of|picture of/i.test(lower)
    const wantsPaid = /make.*(video|ad|website|series)|generate.*video|cinematic|wovo os|clone|avatar|website/i.test(lower)

    setMsgs(m => [...m, { role: 'user', content: prompt }])
    setLoading(true)

    if (wantsPaid) {
      setLoading(false)
      setMsgs(m => [...m, { role: 'ai', content: `That's a paid feature — video generation, cinematic ads, website building, and WOVO OS are available on paid plans.\n\nCheck out the services on the left to find the right plan for you.` }])
      return
    }

    const res = await fetch('/api/wovo-free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: wantsImage ? 'image' : 'chat', prompt, userId, sessionId })
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (data.requiresAuth) {
        setShowAuthWall(true)
        setMsgs(m => [...m, { role: 'ai', content: `You've used your 3 free messages for today. Create a free account to get 10 per day — no credit card needed.` }])
      } else {
        setMsgs(m => [...m, { role: 'ai', content: data.error || 'Something went wrong. Try again.' }])
      }
      return
    }

    if (wantsImage && data.imageUrl) {
      setMsgs(m => [...m, { role: 'ai', content: 'Here you go:', imageUrl: data.imageUrl }])
    } else {
      setMsgs(m => [...m, { role: 'ai', content: data.reply }])
    }
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── TOP NAV ─────────────────────────── */}
      <nav style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '0.5px solid var(--border)', background: 'rgba(8,8,8,0.98)', zIndex: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 18, padding: '4px 6px', borderRadius: 6 }} className="mobile-only">
            ☰
          </button>
          <Link href="/" style={{ fontFamily: 'Outfit,sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.04em' }}>
            wovo<span style={{ color: 'var(--accent)' }}>media</span>
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {userId
            ? <Link href="/home"><button className="btn btn-outline btn-sm">Dashboard</button></Link>
            : <>
                <Link href="/login"><button className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>Sign in</button></Link>
                <Link href="/login?tab=signup"><button className="btn btn-primary btn-sm" style={{ fontSize: 13 }}>Sign up free</button></Link>
              </>
          }
        </div>
      </nav>

      {/* ── MAIN LAYOUT ─────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ── SIDEBAR ─────────────────────── */}
        <div style={{
          width: 220, flexShrink: 0, borderRight: '0.5px solid var(--border)',
          background: 'var(--bg)', display: 'flex', flexDirection: 'column',
          overflowY: 'auto', transition: 'transform 0.2s',
        }} className="sidebar">

          {/* Wovo AI section */}
          <div style={{ padding: '14px 10px 8px' }}>
            <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 4 }}>Wovo AI — Free</div>
            <button
              onClick={() => setActiveNav('chat')}
              style={{
                width: '100%', padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: activeNav === 'chat' ? 'rgba(0,229,200,0.1)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                borderLeft: activeNav === 'chat' ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: 15 }}>✦</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: activeNav === 'chat' ? 'var(--accent)' : 'var(--text)', fontFamily: 'inherit' }}>Wovo AI Chat</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'inherit' }}>Ask & generate images free</div>
              </div>
            </button>
          </div>

          <div style={{ height: '0.5px', background: 'var(--border)', margin: '4px 10px' }}/>

          {/* Paid products */}
          <div style={{ padding: '8px 10px', flex: 1 }}>
            <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 4 }}>Paid Plans</div>
            {[
              { id: 'wovo-ai', icon: '⚡', label: 'AI Content', sub: 'Posts, captions, characters', href: '/wovo-ai', badge: 'From $29' },
              { id: 'cinematic', icon: '🎬', label: 'Cinematic Ads', sub: '30–45 sec product ads', href: '/wovo-ai', badge: '$149/mo' },
              { id: 'websites', icon: '🌐', label: 'Website Builder', sub: 'Full Next.js site', href: '/wovo-ai', badge: '$99/mo' },
              { id: 'wovo-os', icon: '🤖', label: 'WOVO OS', sub: 'AI employee on your PC', href: '/wovo-os', badge: '$350/mo' },
              { id: 'premium', icon: '🎥', label: 'Premium', sub: 'Real filming & drone', href: '#premium-section', badge: 'Custom' },
            ].map(item => (
              <a key={item.id} href={item.href} style={{ textDecoration: 'none', display: 'block' }}
                onClick={() => setActiveNav(item.id)}>
                <div style={{
                  padding: '9px 10px', borderRadius: 10, marginBottom: 2, cursor: 'pointer',
                  background: activeNav === item.id ? 'var(--bg-2)' : 'transparent',
                  borderLeft: activeNav === item.id ? '2px solid var(--border-2)' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background 0.1s',
                }}>
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit' }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, flexShrink: 0, fontFamily: 'inherit' }}>{item.badge}</span>
                </div>
              </a>
            ))}
          </div>

          {/* Bottom CTA */}
          <div style={{ padding: '10px', borderTop: '0.5px solid var(--border)' }}>
            {!userId ? (
              <Link href="/login?tab=signup" style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary" style={{ width: '100%', fontSize: 13, padding: '10px' }}>
                  Sign up free →
                </button>
              </Link>
            ) : (
              <Link href="/home" style={{ textDecoration: 'none' }}>
                <button className="btn btn-outline" style={{ width: '100%', fontSize: 13, padding: '10px' }}>
                  Go to dashboard →
                </button>
              </Link>
            )}
            <Link href="/meet-nova" style={{ textDecoration: 'none', display: 'block', marginTop: 6 }}>
              <button style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✦ Meet Nova — find your plan
              </button>
            </Link>
          </div>
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }} className="mobile-overlay"/>
        )}

        {/* ── CHAT AREA ───────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 0' }}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>

              {msgs.length === 0 && (
                <div style={{ textAlign: 'center', paddingTop: 40 }}>
                  {/* Hero image behind greeting */}
                  <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', marginBottom: 28, height: 200 }}>
                    <img src={IMGS.hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }}/>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(8,8,8,0.3), rgba(8,8,8,0.8))' }}/>
                    <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center' }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 10px', border: '2px solid var(--accent)', boxShadow: '0 0 20px rgba(0,229,200,0.3)' }}>
                        <img src={AVATAR} alt="Wovo AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      </div>
                      <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Wovo AI</h1>
                      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, margin: 0 }}>
                        {userId ? 'What can I help you with today?' : '3 free messages · Sign up for more'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => send(s)} style={{
                        padding: '9px 16px', borderRadius: 20, fontSize: 13,
                        background: 'var(--bg-2)', border: '1px solid var(--border)',
                        color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msgs.map((m, i) => (
                <div key={i} style={{ marginBottom: 20, display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                  {m.role === 'ai' && (
                    <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1.5px solid var(--accent)', marginTop: 2 }}>
                      <img src={AVATAR} alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    </div>
                  )}
                  <div style={{ maxWidth: '80%' }}>
                    {m.imageUrl && (
                      <div style={{ marginBottom: 6, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={m.imageUrl} alt="Generated" style={{ width: '100%', display: 'block' }}/>
                        <a href={m.imageUrl} download target="_blank" rel="noreferrer">
                          <button style={{ width: '100%', padding: '8px', background: 'var(--bg-2)', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Download</button>
                        </a>
                      </div>
                    )}
                    {m.content && (
                      <div style={{
                        padding: '11px 15px', borderRadius: 14, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                        background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-2)',
                        color: m.role === 'user' ? '#080808' : 'var(--text)',
                        fontWeight: m.role === 'user' ? 600 : 400,
                        borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                        borderBottomLeftRadius: m.role === 'ai' ? 4 : 14,
                      }}>
                        {m.content}
                        {(m.content.includes('paid feature') || m.content.includes('paid plans')) && (
                          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Link href="/wovo-ai" style={{ textDecoration: 'none' }}>
                              <button style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#080808', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>See plans from $29/mo →</button>
                            </Link>
                            <Link href="/meet-nova" style={{ textDecoration: 'none' }}>
                              <button style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(0,229,200,0.3)', borderRadius: 8, color: 'var(--accent)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Talk to Nova</button>
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1.5px solid var(--accent)', marginTop: 2 }}>
                    <img src={AVATAR} alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  </div>
                  <div style={{ padding: '14px 18px', background: 'var(--bg-2)', borderRadius: 14, borderBottomLeftRadius: 4 }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1.1s ${i*0.18}s infinite ease-in-out` }}/>)}
                    </div>
                  </div>
                </div>
              )}

              {showAuthWall && (
                <div className="card" style={{ textAlign: 'center', padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(0,229,200,0.2)' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Free messages used up</p>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>Sign up free for 10 messages/day. No credit card.</p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <Link href="/login?tab=signup"><button className="btn btn-primary btn-sm">Create free account</button></Link>
                    <Link href="/wovo-ai"><button className="btn btn-outline btn-sm">See paid plans</button></Link>
                  </div>
                </div>
              )}

              <div ref={bottomRef} style={{ height: 16 }}/>
            </div>
          </div>

          {/* Input */}
          <div style={{ padding: '12px 20px 20px', borderTop: '0.5px solid var(--border)', background: 'rgba(8,8,8,0.98)', flexShrink: 0 }}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 16, padding: '10px 10px 10px 16px' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Ask anything or say 'make me a photo of...'"
                  rows={1}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.55, maxHeight: 120, padding: 0 }}
                />
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  style={{ width: 36, height: 36, borderRadius: 10, background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-3)', border: 'none', color: input.trim() && !loading ? '#080808' : 'var(--text-3)', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, transition: 'all 0.15s', fontWeight: 800 }}
                >↑</button>
              </div>
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 7 }}>
                💬 Chat · 🎨 "Make me a photo of..." · 🔒 Videos, websites & more need a plan
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @media(max-width:640px){
          .sidebar{position:fixed;left:0;top:52px;bottom:0;z-index:55;transform:${sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'};box-shadow:4px 0 24px rgba(0,0,0,0.5)}
          .mobile-only{display:flex!important}
        }
        @media(min-width:641px){
          .mobile-only{display:none!important}
          .mobile-overlay{display:none!important}
        }
      `}</style>
    </div>
  )
}
