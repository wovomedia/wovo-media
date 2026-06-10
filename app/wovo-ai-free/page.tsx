'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Msg = { role: 'user' | 'ai'; content: string; imageUrl?: string; type?: 'text' | 'image' }

const SUGGESTIONS = [
  "How do I get more views on Instagram?",
  "Write a caption for a restaurant special",
  "What content works best for small businesses?",
  "How do I grow my social media faster?",
]

const PAID_PROMPTS = ['make a video', 'generate a video', 'create a video', 'make a website', 'build a website', 
  'clone my', 'cinematic ad', 'wovo os', 'video series', 'make a series']

function isPaidRequest(prompt: string) {
  return PAID_PROMPTS.some(p => prompt.toLowerCase().includes(p))
}

export default function WovoAIFree() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [plan, setPlan] = useState('free')
  const [sessionId] = useState(() => Math.random().toString(36).slice(2))
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [mode, setMode] = useState<'chat' | 'image'>('chat')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id)
        supabase.from('clients').select('plan, is_active').eq('profile_id', session.user.id).single()
          .then(({ data }) => { if (data?.plan) setPlan(data.plan) })
      }
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const send = async (promptOverride?: string) => {
    const prompt = promptOverride || input.trim()
    if (!prompt || loading) return
    setInput('')
    setMsgs(m => [...m, { role: 'user', content: prompt, type: mode === 'image' ? 'image' : 'text' }])
    setLoading(true)

    // Check if paid request - show upsell before even hitting API
    if (isPaidRequest(prompt)) {
      setMsgs(m => [...m, {
        role: 'ai', content: '',
        type: 'text',
        imageUrl: undefined
      }])
      setLoading(false)
      // Show paid upsell inline
      setMsgs(m => [...m, {
        role: 'ai',
        content: `That's a paid feature! To generate videos, cinematic ads, websites, or clone avatars you'll need a Wovo AI plan starting at just $29/mo. You get AI characters, daily posts, video generation, and way more.`,
        type: 'text'
      }])
      return
    }

    const action = mode
    const res = await fetch('/api/wovo-free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, prompt, userId, sessionId })
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (data.requiresAuth) {
        setShowAuthPrompt(true)
        setMsgs(m => [...m, { role: 'ai', content: "You've used your free messages for today. Sign up free to get more!", type: 'text' }])
      } else if (data.requiresPlan) {
        setMsgs(m => [...m, { role: 'ai', content: data.error + ' Upgrade at wovomedia.com/wovo-ai', type: 'text' }])
      } else {
        setMsgs(m => [...m, { role: 'ai', content: "Something went wrong. Try again.", type: 'text' }])
      }
      return
    }

    if (action === 'image' && data.imageUrl) {
      setMsgs(m => [...m, { role: 'ai', content: 'Here\'s your image:', imageUrl: data.imageUrl, type: 'image' }])
    } else {
      setMsgs(m => [...m, { role: 'ai', content: data.reply, type: 'text' }])
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--border)', position: 'sticky', top: 0, background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(12px)', zIndex: 50 }}>
        <Link href="/" style={{ fontFamily: 'Outfit,sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.04em' }}>
          wovo<span style={{ color: 'var(--accent)' }}>media</span>
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {userId ? (
            <span style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-2)', padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
              {plan === 'free' ? 'Free plan' : plan}
            </span>
          ) : (
            <Link href="/login"><button className="btn btn-primary btn-sm">Sign in</button></Link>
          )}
        </div>
      </nav>

      {/* Mode toggle */}
      <div style={{ padding: '12px 20px 0', display: 'flex', gap: 6, justifyContent: 'center' }}>
        {(['chat', 'image'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '6px 18px', borderRadius: 20, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600,
            background: mode === m ? 'var(--accent)' : 'var(--bg-2)',
            color: mode === m ? '#080808' : 'var(--text-2)',
            border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`,
          }}>
            {m === 'chat' ? '💬 Ask Wovo AI' : '🎨 Generate Image'}
          </button>
        ))}
        <Link href="/wovo-ai">
          <button style={{ padding: '6px 18px', borderRadius: 20, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
            🎬 Videos & More ↗
          </button>
        </Link>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 16px', border: '2px solid var(--accent)' }}>
              <img src="https://v3b.fal.media/files/b/0a9dc045/i1MJb4Rv11UqEM1NlCVX8.jpg" alt="Wovo AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Wovo AI</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 28 }}>
              {userId ? `Ask me anything about growing your business.` : `Try 3 free messages — no account needed.`}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{ padding: '8px 14px', borderRadius: 20, fontSize: 13, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: 16, display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
            {m.role === 'ai' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1.5px solid var(--accent)' }}>
                <img src="https://v3b.fal.media/files/b/0a9dc045/i1MJb4Rv11UqEM1NlCVX8.jpg" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              </div>
            )}
            <div style={{ maxWidth: '80%' }}>
              {m.imageUrl && <img src={m.imageUrl} alt="Generated" style={{ width: '100%', borderRadius: 12, marginBottom: 6 }}/>}
              {m.content && (
                <div style={{
                  padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.65,
                  background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-2)',
                  color: m.role === 'user' ? '#080808' : 'var(--text)',
                  fontWeight: m.role === 'user' ? 600 : 400,
                  borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius: m.role === 'ai' ? 4 : 12,
                }}>
                  {m.content}
                  {m.content.includes('$29/mo') && (
                    <a href="https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y" target="_blank" rel="noreferrer">
                      <button style={{ marginTop: 10, padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#080808', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'block', width: '100%' }}>
                        Get Wovo AI — $29/mo →
                      </button>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1.5px solid var(--accent)' }}>
              <img src="https://v3b.fal.media/files/b/0a9dc045/i1MJb4Rv11UqEM1NlCVX8.jpg" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 12, borderBottomLeftRadius: 4 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1.2s ${i*0.2}s infinite` }}/>)}
              </div>
            </div>
          </div>
        )}

        {showAuthPrompt && (
          <div className="card" style={{ textAlign: 'center', padding: '20px', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 12 }}>Sign up free to keep chatting and get 10 messages/day</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Link href="/login?tab=signup"><button className="btn btn-primary btn-sm">Create free account</button></Link>
              <Link href="/wovo-ai"><button className="btn btn-outline btn-sm">See paid plans</button></Link>
            </div>
          </div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{ padding: '12px 20px 20px', background: 'rgba(8,8,8,0.95)', borderTop: '0.5px solid var(--border)', position: 'sticky', bottom: 0, backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={mode === 'image' ? 'Describe an image to generate...' : 'Ask Wovo AI anything about your business...'}
            rows={1}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-2)', background: 'var(--bg-2)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} className="btn btn-primary" style={{ padding: '12px 18px', borderRadius: 12, flexShrink: 0 }}>
            {loading ? '...' : '↑'}
          </button>
        </div>
        {!userId && (
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
            3 free messages · <Link href="/login" style={{ color: 'var(--accent)' }}>Sign in</Link> for 10/day · <Link href="/wovo-ai" style={{ color: 'var(--accent)' }}>Upgrade</Link> for unlimited
          </p>
        )}
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  )
}
