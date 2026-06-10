'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Msg = { role: 'user' | 'ai'; content: string; imageUrl?: string; videoUrl?: string }

const SUGGESTIONS = [
  "Write me a caption for a lunch special",
  "How do I get more Instagram followers?",
  "Make me a photo of a cozy coffee shop",
  "What's the best time to post on TikTok?",
]

export default function WovoAIFree() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showAuthWall, setShowAuthWall] = useState(false)
  const [sessionId] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('wovo_sid') || (() => { const id = Math.random().toString(36).slice(2); localStorage.setItem('wovo_sid', id); return id })()) : 'anon')
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

    // Detect intent
    const lower = prompt.toLowerCase()
    const wantsImage = /make.*(image|photo|picture|poster|logo|graphic)|generate.*(image|photo|picture)|create.*(image|photo|picture)|draw|design a/i.test(lower)
    const wantsPaidFeature = /make.*(video|ad|website|series)|generate.*(video|ad)|cinematic|wovo os|clone|avatar/i.test(lower)

    setMsgs(m => [...m, { role: 'user', content: prompt }])
    setLoading(true)

    // Paid feature gate
    if (wantsPaidFeature) {
      setLoading(false)
      setMsgs(m => [...m, { role: 'ai', content: `That's a paid feature. Video generation, cinematic ads, website building, and AI avatars are available on Wovo AI plans starting at $29/mo. You get way more than just this chat — AI characters that post for you, daily content, and tools that run your whole online presence.` }])
      return
    }

    const action = wantsImage ? 'image' : 'chat'
    const res = await fetch('/api/wovo-free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, prompt, userId, sessionId })
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (data.requiresAuth) {
        setShowAuthWall(true)
        setMsgs(m => [...m, { role: 'ai', content: `You've hit the free limit for today. Create a free account to get 10 messages per day — takes 30 seconds.` }])
      } else if (data.requiresPlan) {
        setMsgs(m => [...m, { role: 'ai', content: data.error }])
      } else {
        setMsgs(m => [...m, { role: 'ai', content: 'Something went wrong. Try again.' }])
      }
      return
    }

    if (action === 'image' && data.imageUrl) {
      setMsgs(m => [...m, { role: 'ai', content: 'Here you go:', imageUrl: data.imageUrl }])
    } else {
      setMsgs(m => [...m, { role: 'ai', content: data.reply }])
    }
  }


  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{ padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--border)', position: 'sticky', top: 0, background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <Link href="/" style={{ fontFamily: 'Outfit,sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.04em' }}>
          wovo<span style={{ color: 'var(--accent)' }}>media</span>
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          {userId
            ? <Link href="/home"><button className="btn btn-outline btn-sm">Dashboard →</button></Link>
            : <>
                <Link href="/login"><button className="btn btn-ghost btn-sm">Sign in</button></Link>
                <Link href="/login?tab=signup"><button className="btn btn-primary btn-sm">Sign up free</button></Link>
              </>
          }
        </div>
      </nav>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 0', maxWidth: 720, margin: '0 auto', width: '100%' }}>

        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#00E5C8,#00b89c)', margin: '0 auto 14px', border: '2px solid var(--accent)', boxShadow: '0 0 24px rgba(0,229,200,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:26, color:'#080808' }}>W</span>
            </div>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>Wovo AI</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 8 }}>
              Ask anything. Generate images. Get content ideas.
            </p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 28 }}>
              {userId ? '10 free messages/day · Upgrade for unlimited' : '3 free messages · Sign up for 10/day'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding: '9px 16px', borderRadius: 20, fontSize: 13, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: 20, display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            {m.role === 'ai' && (
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#00E5C8,#00b89c)', flexShrink: 0, border: '1.5px solid var(--accent)', marginTop: 2, display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:13, color:'#080808' }}>W</span></div>
            )}
            <div style={{ maxWidth: '82%' }}>
              {m.imageUrl && (
                <div style={{ marginBottom: 8, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img src={m.imageUrl} alt="Generated" style={{ width: '100%', display: 'block' }}/>
                  <a href={m.imageUrl} download target="_blank" rel="noreferrer">
                    <button style={{ width: '100%', padding: '8px', background: 'var(--bg-2)', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ⬇ Download
                    </button>
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
                  {m.content.includes('$29/mo') && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <a href="https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                        <button style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#080808', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Start at $29/mo →
                        </button>
                      </a>
                      <Link href="/wovo-ai" style={{ textDecoration: 'none' }}>
                        <button style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(0,229,200,0.3)', borderRadius: 8, color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                          See all plans
                        </button>
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
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#00E5C8,#00b89c)', flexShrink: 0, border: '1.5px solid var(--accent)', marginTop: 2, display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontFamily:'Outfit,sans-serif', fontWeight:900, fontSize:13, color:'#080808' }}>W</span></div>
            <div style={{ padding: '14px 18px', background: 'var(--bg-2)', borderRadius: 14, borderBottomLeftRadius: 4 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1.1s ${i*0.18}s infinite ease-in-out` }}/>
                ))}
              </div>
            </div>
          </div>
        )}

        {showAuthWall && (
          <div className="card" style={{ textAlign: 'center', padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(0,229,200,0.2)', background: 'rgba(0,229,200,0.03)' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>You've used your 3 free messages</p>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Create a free account for 10 messages/day. No credit card.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Link href="/login?tab=signup"><button className="btn btn-primary">Create free account</button></Link>
              <Link href="/wovo-ai"><button className="btn btn-outline">See paid plans</button></Link>
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 24 }}/>
      </div>

      {/* Input */}
      <div style={{ padding: '12px 20px 24px', background: 'rgba(8,8,8,0.97)', borderTop: '0.5px solid var(--border)', position: 'sticky', bottom: 0, backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 16, padding: '10px 12px 10px 16px' }}>
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
              style={{ width: 36, height: 36, borderRadius: 10, background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-3)', border: 'none', color: input.trim() && !loading ? '#080808' : 'var(--text-3)', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, transition: 'all 0.15s' }}
            >
              ↑
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>💬 Ask anything · 🎨 "Make me a photo of..." · 🔒 Videos & websites need a plan</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
    </div>
  )
}
