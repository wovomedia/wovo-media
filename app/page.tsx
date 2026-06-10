'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const HERO_IMG = 'https://v3b.fal.media/files/b/0a9dc82f/qSFW82dOEK5PMHb--MQvl.jpg'

type Msg = { role: 'user' | 'ai'; content: string; imageUrl?: string; uploadedImg?: string }
type Chat = { id: string; title: string; msgs: Msg[]; createdAt: number }

const WLogo = ({ size = 28 }: { size?: number }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#00E5C8,#00b89c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <span style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 900, fontSize: size * 0.46, color: '#080808', letterSpacing: '-0.04em' }}>W</span>
  </div>
)

const SUGGESTIONS = [
  '✍️ Write a caption for a lunch special',
  '📈 How do I grow on Instagram?',
  '🎨 Make me a photo of a cozy coffee shop',
  '📅 Best time to post on TikTok?',
]

const PAID_SIDEBAR = [
  { icon: '⚡', label: 'AI Content Plans', sub: 'AI characters, posts, videos', href: '/wovo-ai', badge: 'From $29', color: '#00E5C8' },
  { icon: '🎬', label: 'Cinematic Ads', sub: '30–45 sec product ads', href: '/wovo-ai', badge: '$149/mo', color: '#a78bfa' },
  { icon: '🌐', label: 'Website Builder', sub: 'Full Next.js deploy-ready site', href: '/wovo-ai', badge: '$99/mo', color: '#60a5fa' },
  { icon: '🤖', label: 'WOVO OS', sub: 'AI employee on your computer', href: '/wovo-os', badge: '$350/mo', color: '#f59e0b' },
  { icon: '🎥', label: 'Premium Production', sub: 'Real filming, drone, photography', href: '/wovo-ai', badge: 'Custom', color: '#f97316' },
]

export default function Home() {
  const [chats, setChats] = useState<Chat[]>(() => {
    if (typeof window === 'undefined') return [{ id: '1', title: 'New chat', msgs: [], createdAt: Date.now() }]
    try {
      const saved = localStorage.getItem('wovo_chats')
      if (saved) {
        const parsed = JSON.parse(saved) as Chat[]
        if (parsed.length > 0) return parsed
      }
    } catch {}
    return [{ id: '1', title: 'New chat', msgs: [], createdAt: Date.now() }]
  })
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    if (typeof window === 'undefined') return '1'
    try { return localStorage.getItem('wovo_active_chat') || '1' } catch { return '1' }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [uploadedImg, setUploadedImg] = useState<string | null>(null)
  const [uploadedImgUrl, setUploadedImgUrl] = useState<string | null>(null)
  const [showAuthWall, setShowAuthWall] = useState(false)
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'anon'
    return localStorage.getItem('wovo_sid') || (() => { const id = Math.random().toString(36).slice(2); localStorage.setItem('wovo_sid', id); return id })()
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const activeChat = chats.find(c => c.id === activeChatId)!
  const msgs = activeChat?.msgs || []

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id)
    })
  }, [])

  // Save chats to localStorage whenever they change (device-private)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      // Keep max 50 chats, trim old ones
      const toSave = chats.slice(-50)
      localStorage.setItem('wovo_chats', JSON.stringify(toSave))
      localStorage.setItem('wovo_active_chat', activeChatId)
    } catch {}
  }, [chats, activeChatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  const newChat = () => {
    const id = Date.now().toString()
    setChats(c => [...c, { id, title: 'New chat', msgs: [], createdAt: Date.now() }])
    setActiveChatId(id)
    setUploadedImg(null)
    setUploadedImgUrl(null)
    setShowAuthWall(false)
  }

  const deleteChat = (id: string) => {
    setChats(c => {
      const remaining = c.filter(chat => chat.id !== id)
      if (remaining.length === 0) {
        const newId = Date.now().toString()
        setActiveChatId(newId)
        return [{ id: newId, title: 'New chat', msgs: [], createdAt: Date.now() }]
      }
      if (id === activeChatId) setActiveChatId(remaining[remaining.length - 1].id)
      return remaining
    })
  }

  const deleteMessage = (chatId: string, msgIndex: number) => {
    setChats(c => c.map(chat => chat.id === chatId
      ? { ...chat, msgs: chat.msgs.filter((_, i) => i !== msgIndex) }
      : chat
    ))
  }

  const clearChat = (id: string) => {
    setChats(c => c.map(chat => chat.id === id ? { ...chat, msgs: [], title: 'New chat' } : chat))
  }

  const updateChat = (id: string, msgs: Msg[]) => {
    setChats(c => c.map(chat => chat.id === id ? {
      ...chat, msgs,
      title: msgs.find(m => m.role === 'user')?.content.slice(0, 32) || 'New chat'
    } : chat))
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const base64 = e.target?.result as string
      setUploadedImg(base64)
    }
    reader.readAsDataURL(file)
  }

  const send = async (promptOverride?: string) => {
    const prompt = (promptOverride || input).trim()
    if (!prompt || loading) return
    setInput('')
    setShowAuthWall(false)

    const lower = prompt.toLowerCase()
    const hasImage = !!uploadedImg
    const wantsEdit = hasImage && /edit|change|remove|add|make.*look|background|color|replace|swap/i.test(lower)
    const wantsImage = !hasImage && /make.*(image|photo|picture|poster|logo)|generate.*(image|photo|picture)|photo of|picture of|image of/i.test(lower)
    const wantsPaid = /make.*(video|ad|website|series)|generate.*video|cinematic|wovo os|clone|avatar/i.test(lower)

    const imgPreview = uploadedImg
    const newMsgs: Msg[] = [...msgs, { role: 'user', content: prompt, uploadedImg: imgPreview || undefined }]
    updateChat(activeChatId, newMsgs)
    setUploadedImg(null)
    setUploadedImgUrl(null)
    setLoading(true)

    if (wantsPaid) {
      setLoading(false)
      const reply = `That's a paid feature. Use the sidebar to find the right plan — videos, cinematic ads, websites, and WOVO OS all have dedicated pages with pricing.`
      updateChat(activeChatId, [...newMsgs, { role: 'ai', content: reply }])
      return
    }

    let action = 'chat'
    if (wantsEdit && imgPreview) action = 'edit_image'
    else if (wantsImage) action = 'image'

    const res = await fetch('/api/wovo-free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, prompt, userId, sessionId, imageBase64: imgPreview || undefined })
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (data.requiresAuth) {
        setShowAuthWall(true)
        updateChat(activeChatId, [...newMsgs, { role: 'ai', content: `You've used your free messages for today. Sign up free for 10/day — no credit card.` }])
      } else {
        updateChat(activeChatId, [...newMsgs, { role: 'ai', content: data.error || 'Something went wrong. Try again.' }])
      }
      return
    }

    if ((action === 'image' || action === 'edit_image') && data.imageUrl) {
      updateChat(activeChatId, [...newMsgs, { role: 'ai', content: action === 'edit_image' ? 'Here\'s your edited image:' : 'Here you go:', imageUrl: data.imageUrl }])
    } else {
      updateChat(activeChatId, [...newMsgs, { role: 'ai', content: data.reply }])
    }
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── SIDEBAR ─────────────────────────── */}
      <div style={{ width: 240, flexShrink: 0, borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

        {/* Logo + new chat */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Link href="/" style={{ fontFamily: 'Outfit,sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.04em' }}>
              wovo<span style={{ color: 'var(--accent)' }}>media</span>
            </Link>
            <div style={{ display: 'flex', gap: 6 }}>
              {userId
                ? <Link href="/home"><button style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>App</button></Link>
                : <Link href="/login"><button style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, background: 'var(--accent)', border: 'none', color: '#080808', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Sign in</button></Link>
              }
            </div>
          </div>
          <button onClick={newChat} style={{ width: '100%', padding: '8px 12px', borderRadius: 9, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
            <span style={{ fontSize: 15 }}>✦</span> New chat
          </button>
        </div>

        {/* Chat history */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 4px' }}>
          {chats.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 6px' }}>Chats</div>
              {[...chats].reverse().map(chat => (
                <div key={chat.id} style={{ position: 'relative', marginBottom: 2 }} className="chat-item-wrap">
                  <button onClick={() => setActiveChatId(chat.id)} style={{
                    width: '100%', padding: '8px 30px 8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    background: chat.id === activeChatId ? 'var(--bg-2)' : 'transparent',
                    borderLeft: chat.id === activeChatId ? '2px solid var(--accent)' : '2px solid transparent',
                  }}>
                    <div style={{ fontSize: 12, color: chat.id === activeChatId ? 'var(--text)' : 'var(--text-2)', fontWeight: chat.id === activeChatId ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title}</div>
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteChat(chat.id) }} className="chat-delete-btn" title="Delete chat" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4, opacity: 0, transition: 'opacity 0.15s' }}>×</button>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ height: '0.5px', background: 'var(--border)', margin: '0 10px' }}/>

        {/* Paid products */}
        <div style={{ padding: '10px 8px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 8px' }}>Upgrade</div>
          {PAID_SIDEBAR.map(item => (
            <a key={item.label} href={item.href} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
              <div style={{ padding: '8px 10px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: item.color, flexShrink: 0 }}>{item.badge}</span>
              </div>
            </a>
          ))}
        </div>

        {/* Bottom CTA */}
        <div style={{ padding: '10px', borderTop: '0.5px solid var(--border)' }}>
          {userId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Link href="/home" style={{ textDecoration: 'none' }}><button style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7 }}><span>🏠</span> Dashboard</button></Link>
              <Link href="/videos" style={{ textDecoration: 'none' }}><button style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7 }}><span>🎬</span> My Videos</button></Link>
              <Link href="/business" style={{ textDecoration: 'none' }}><button style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7 }}><span>🏢</span> My Business</button></Link>
              <Link href="/account" style={{ textDecoration: 'none' }}><button style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7 }}><span>👤</span> Account</button></Link>
            </div>
          ) : (
            <>
              <Link href="/login?tab=signup" style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary" style={{ width: '100%', fontSize: 13, padding: '9px' }}>Sign up free →</button>
              </Link>
              <Link href="/login" style={{ textDecoration: 'none', display: 'block', marginTop: 5 }}>
                <button style={{ width: '100%', padding: '7px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Already have an account? Sign in</button>
              </Link>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', marginTop: 5 }}>3 free · Sign up for 10/day</div>
            </>
          )}
        </div>
      </div>

      {/* ── CHAT AREA ───────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>

            {msgs.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 32 }}>
                <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', marginBottom: 24, height: 160 }}>
                  <img src={HERO_IMG} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}/>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(8,8,8,0.2),rgba(8,8,8,0.75))' }}/>
                  <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0 }}>
                    <div style={{ margin: '0 auto 8px', display: 'flex', justifyContent: 'center' }}><WLogo size={44}/></div>
                    <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 3px', letterSpacing: '-0.02em' }}>Wovo AI</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: 0 }}>Ask · Generate images · Edit photos</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s.replace(/^[^\s]+\s/,''))} style={{ padding: '8px 14px', borderRadius: 20, fontSize: 13, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 16 }}>
                  {userId ? '10 free messages/day · Upgrade for unlimited' : '3 free messages · Sign up for 10/day · No credit card'}
                </p>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ marginBottom: 18, display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', position: 'relative' }} className="msg-wrap">
                {m.role === 'ai' && <WLogo size={28}/>}
                <div style={{ maxWidth: '82%' }}>
                  {m.uploadedImg && (
                    <div style={{ marginBottom: 6, borderRadius: 12, overflow: 'hidden', maxWidth: 200 }}>
                      <img src={m.uploadedImg} alt="Uploaded" style={{ width: '100%', display: 'block' }}/>
                    </div>
                  )}
                  {m.imageUrl && (
                    <div style={{ marginBottom: 6, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={m.imageUrl} alt="Generated" style={{ width: '100%', display: 'block' }}/>
                      <a href={m.imageUrl} download target="_blank" rel="noreferrer">
                        <button style={{ width: '100%', padding: '7px', background: 'var(--bg-2)', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Download</button>
                      </a>
                    </div>
                  )}
                  {m.content && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 13, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                      background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-2)',
                      color: m.role === 'user' ? '#080808' : 'var(--text)',
                      fontWeight: m.role === 'user' ? 600 : 400,
                      borderBottomRightRadius: m.role === 'user' ? 3 : 13,
                      borderBottomLeftRadius: m.role === 'ai' ? 3 : 13,
                    }}>
                      {m.content}
                      {m.content.includes('sidebar') && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                          <Link href="/wovo-ai" style={{ textDecoration: 'none' }}><button style={{ padding: '7px 14px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#080808', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>See all plans →</button></Link>
                          <Link href="/meet-nova" style={{ textDecoration: 'none' }}><button style={{ padding: '7px 12px', background: 'transparent', border: '1px solid rgba(0,229,200,0.3)', borderRadius: 7, color: 'var(--accent)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Talk to Wovo</button></Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteMessage(activeChatId, i)} className="msg-delete-btn" title="Delete message" style={{ position: 'absolute', top: 0, right: m.role === 'user' ? 'auto' : 0, left: m.role === 'user' ? 0 : 'auto', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 5, opacity: 0, transition: 'opacity 0.15s', whiteSpace: 'nowrap' }}>✕ delete</button>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 18 }}>
                <WLogo size={28}/>
                <div style={{ padding: '13px 16px', background: 'var(--bg-2)', borderRadius: 13, borderBottomLeftRadius: 3 }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1.1s ${i*0.18}s infinite ease-in-out` }}/>)}
                  </div>
                </div>
              </div>
            )}

            {showAuthWall && (
              <div className="card" style={{ textAlign: 'center', padding: '18px 20px', marginBottom: 18, border: '1px solid rgba(0,229,200,0.2)' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>Free messages used up</p>
                <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>Create a free account for 10 messages/day.</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Link href="/login?tab=signup"><button className="btn btn-primary btn-sm">Create free account</button></Link>
                  <Link href="/wovo-ai"><button className="btn btn-outline btn-sm">See paid plans</button></Link>
                </div>
              </div>
            )}

            <div ref={bottomRef} style={{ height: 16 }}/>
          </div>
        </div>

        {/* Image preview if uploaded */}
        {uploadedImg && (
          <div style={{ padding: '8px 20px 0', maxWidth: 700, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px' }}>
              <img src={uploadedImg} alt="To edit" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }}/>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Image attached — tell Wovo what to do with it</span>
              <button onClick={() => setUploadedImg(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>×</button>
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '10px 20px 18px', borderTop: '0.5px solid var(--border)', background: 'rgba(8,8,8,0.97)', flexShrink: 0 }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 14, padding: '8px 8px 8px 14px' }}>
              {/* Image upload button */}
              <button onClick={() => fileRef.current?.click()} title="Upload image to edit" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15 }}>
                🖼️
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}/>

              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                onPaste={e => {
                  const item = Array.from(e.clipboardData.items).find(i => i.type.includes('image'))
                  if (item) { const f = item.getAsFile(); if (f) handleFile(f) }
                }}
                placeholder={uploadedImg ? 'Tell Wovo what to do with your image...' : 'Ask anything or say "make me a photo of..."'}
                rows={1}
                style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.55, maxHeight: 120, padding: 0 }}
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                style={{ width: 34, height: 34, borderRadius: 9, background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-3)', border: 'none', color: input.trim() && !loading ? '#080808' : 'var(--text-3)', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, fontWeight: 800, transition: 'all 0.15s' }}
              >↑</button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
              Chat · Generate images · Upload photo to edit · Drag & drop images
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .chat-item-wrap:hover .chat-delete-btn { opacity: 1 !important; }
        .msg-wrap:hover .msg-delete-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
