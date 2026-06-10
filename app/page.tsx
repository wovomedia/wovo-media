'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const HERO_IMG = 'https://v3b.fal.media/files/b/0a9dc82f/qSFW82dOEK5PMHb--MQvl.jpg'

type Msg = { id?: string; role: 'user' | 'ai'; content: string; imageUrl?: string; uploadedImg?: string }
type Chat = { id: string; title: string; msgs: Msg[]; createdAt?: number }

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
  { icon: '🌐', label: 'Website Builder', sub: 'Full Next.js deploy-ready', href: '/wovo-ai', badge: '$99/mo', color: '#60a5fa' },
  { icon: '🤖', label: 'WOVO OS', sub: 'AI employee on your computer', href: '/wovo-os', badge: '$350/mo', color: '#f59e0b' },
  { icon: '🎥', label: 'Premium Production', sub: 'Real filming, drone, photography', href: '/wovo-ai', badge: 'Custom', color: '#f97316' },
]

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string>('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [uploadedImg, setUploadedImg] = useState<string | null>(null)
  const [showAuthWall, setShowAuthWall] = useState(false)
  const [chatLoading, setChatLoading] = useState(true)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'anon'
    return localStorage.getItem('wovo_sid') || (() => {
      const id = Math.random().toString(36).slice(2)
      localStorage.setItem('wovo_sid', id)
      return id
    })()
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const activeChat = chats.find(c => c.id === activeChatId)
  const msgs = activeChat?.msgs || []

  // Load chats from server on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id || null
      setUserId(uid)
      await loadChats(uid)
    })
  }, [])

  const loadChats = async (uid: string | null) => {
    setChatLoading(true)
    try {
      const params = new URLSearchParams({ session: sessionId })
      if (uid) params.set('user', uid)
      const res = await fetch(`/api/wovo-chats?${params}`)
      const data = await res.json()
      if (data.chats && data.chats.length > 0) {
        setChats(data.chats)
        setActiveChatId(data.chats[0].id)
      } else {
        await createNewChat(uid, true)
      }
    } catch {
      await createNewChat(uid, true)
    } finally {
      setChatLoading(false)
    }
  }

  const createNewChat = async (uid?: string | null, isInit = false) => {
    try {
      const res = await fetch('/api/wovo-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userId: uid ?? userId })
      })
      const data = await res.json()
      if (data.chat) {
        setChats(c => isInit ? [data.chat] : [...c, data.chat])
        setActiveChatId(data.chat.id)
        setUploadedImg(null)
        setShowAuthWall(false)
      }
    } catch {
      const fallback = { id: Date.now().toString(), title: 'New chat', msgs: [] }
      setChats(c => isInit ? [fallback] : [...c, fallback])
      setActiveChatId(fallback.id)
    }
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])

  const saveMessage = async (chatId: string, role: 'user' | 'ai', content: string, imageUrl?: string, uploadedImgUrl?: string) => {
    try {
      const res = await fetch('/api/wovo-chats/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, role, content, imageUrl, uploadedImgUrl })
      })
      const data = await res.json()
      return data.message?.id
    } catch { return undefined }
  }

  const deleteChat = async (id: string) => {
    await fetch('/api/wovo-chats', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: id, sessionId, userId })
    })
    setChats(c => {
      const remaining = c.filter(chat => chat.id !== id)
      if (remaining.length === 0) { createNewChat(); return c }
      if (id === activeChatId) setActiveChatId(remaining[0].id)
      return remaining
    })
  }

  const renameChat = async (chatId: string, newTitle: string) => {
    setEditingChatId(null)
    if (!newTitle.trim()) return
    setChats(c => c.map(chat => chat.id === chatId ? { ...chat, title: newTitle.trim() } : chat))
    await fetch('/api/wovo-chats', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, title: newTitle.trim(), sessionId, userId })
    })
  }

  const deleteMessage = async (msgId: string | undefined, chatId: string, msgIndex: number) => {
    if (msgId) {
      await fetch('/api/wovo-chats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgId })
      })
    }
    setChats(c => c.map(chat => chat.id === chatId
      ? { ...chat, msgs: chat.msgs.filter((_, i) => i !== msgIndex) }
      : chat
    ))
  }

  const updateChatMsgs = (chatId: string, msgs: Msg[], title?: string) => {
    setChats(c => c.map(chat => chat.id === chatId
      ? { ...chat, msgs, ...(title ? { title } : {}) }
      : chat
    ))
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => setUploadedImg(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const send = async (promptOverride?: string) => {
    const prompt = (promptOverride || input).trim()
    if (!prompt || loading) return
    setInput('')
    setShowAuthWall(false)

    const chatId = activeChatId
    const lower = prompt.toLowerCase()
    const imgPreview = uploadedImg
    const wantsEdit = !!imgPreview && /edit|change|remove|add|make.*look|background|color|replace|swap|put.*in|insert|photo of me/i.test(lower)
    const wantsImage = !imgPreview && /\b(make|generate|create|draw|design)\b.*(image|photo|picture|poster|logo|graphic)|\b(photo|picture|image)\s+of\b/i.test(lower)
    const wantsPaid = /make.*(video|ad|website|series)|generate.*video|cinematic|wovo os|clone|avatar/i.test(lower)

    // Add user message locally + save to server
    const userMsg: Msg = { role: 'user', content: prompt, uploadedImg: imgPreview || undefined }
    const newMsgs = [...msgs, userMsg]
    updateChatMsgs(chatId, newMsgs, msgs.length === 0 ? prompt.slice(0, 40) : undefined)
    setUploadedImg(null)
    setLoading(true)

    // Save user message
    const userMsgId = await saveMessage(chatId, 'user', prompt, undefined, imgPreview || undefined)
    if (userMsgId) userMsg.id = userMsgId

    if (wantsPaid) {
      setLoading(false)
      const reply = `That's a paid feature. Use the sidebar to find the right plan — videos, cinematic ads, websites, and WOVO OS all have dedicated pages with pricing.`
      const aiMsg: Msg = { role: 'ai', content: reply }
      const aiId = await saveMessage(chatId, 'ai', reply)
      if (aiId) aiMsg.id = aiId
      updateChatMsgs(chatId, [...newMsgs, aiMsg])
      return
    }

    const action = wantsEdit ? 'edit_image' : wantsImage ? 'image' : 'chat'
    const res = await fetch('/api/wovo-free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action, prompt, userId, sessionId,
        imageBase64: imgPreview || undefined,
        history: msgs.slice(-12).map(m => ({ role: m.role, content: m.content }))
      })
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (data.requiresAuth) setShowAuthWall(true)
      const errMsg: Msg = { role: 'ai', content: data.error || 'Something went wrong. Try again.' }
      const errId = await saveMessage(chatId, 'ai', errMsg.content)
      if (errId) errMsg.id = errId
      updateChatMsgs(chatId, [...newMsgs, errMsg])
      return
    }

    const aiMsg: Msg = {
      role: 'ai',
      content: (action === 'image' || action === 'edit_image') && data.imageUrl ? 'Here you go:' : data.reply || '',
      imageUrl: data.imageUrl || undefined
    }
    const aiId = await saveMessage(chatId, 'ai', aiMsg.content, aiMsg.imageUrl)
    if (aiId) aiMsg.id = aiId
    updateChatMsgs(chatId, [...newMsgs, aiMsg])
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── SIDEBAR ─────────────────────────── */}
      <div style={{ width: 240, flexShrink: 0, borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

        {/* Logo + auth */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Link href="/" style={{ fontFamily: 'Outfit,sans-serif', fontSize: 17, fontWeight: 800, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.04em' }}>
              wovo<span style={{ color: 'var(--accent)' }}>media</span>
            </Link>
            {userId
              ? <Link href="/home"><button style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>App</button></Link>
              : <div style={{ display: 'flex', gap: 5 }}>
                  <Link href="/login"><button style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>Sign in</button></Link>
                  <Link href="/login?tab=signup"><button style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'var(--accent)', border: 'none', color: '#080808', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Sign up</button></Link>
                </div>
            }
          </div>
          <button onClick={() => createNewChat()} style={{ width: '100%', padding: '7px 11px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, fontWeight: 500 }}>
            <span>✦</span> New chat
          </button>
        </div>

        {/* Chat history */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px 4px' }}>
          {chatLoading ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Loading...</div>
          ) : (
            <>
              {chats.length > 0 && <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 8px 4px' }}>Chats</div>}
              {chats.map(chat => (
                <div key={chat.id} style={{ position: 'relative', marginBottom: 1 }} className="chat-row">
                  {editingChatId === chat.id ? (
                    <input
                      autoFocus
                      defaultValue={chat.title}
                      onBlur={e => renameChat(chat.id, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingChatId(null) }}
                      style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--bg-2)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                    />
                  ) : (
                    <button onClick={() => setActiveChatId(chat.id)} onDoubleClick={() => setEditingChatId(chat.id)} title="Double-click to rename" style={{
                      width: '100%', padding: '7px 28px 7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      background: chat.id === activeChatId ? 'var(--bg-2)' : 'transparent',
                      borderLeft: chat.id === activeChatId ? '2px solid var(--accent)' : '2px solid transparent',
                    }}>
                      <div style={{ fontSize: 12, color: chat.id === activeChatId ? 'var(--text)' : 'var(--text-2)', fontWeight: chat.id === activeChatId ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title}</div>
                    </button>
                  )}
                  <button onClick={() => deleteChat(chat.id)} className="del-chat" title="Delete" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: '2px 5px', borderRadius: 4, opacity: 0, transition: 'opacity 0.12s' }}>×</button>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ height: '0.5px', background: 'var(--border)', margin: '0 10px' }}/>

        {/* Paid products */}
        <div style={{ padding: '8px 6px', overflowY: 'auto', maxHeight: 280 }}>
          <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 6px' }}>Upgrade</div>
          {PAID_SIDEBAR.map(item => (
            <a key={item.label} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ padding: '7px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 1 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: item.color, flexShrink: 0 }}>{item.badge}</span>
              </div>
            </a>
          ))}
        </div>

        {/* Bottom links */}
        <div style={{ padding: '8px', borderTop: '0.5px solid var(--border)', flexShrink: 0 }}>
          {userId ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {[['🏠','Dashboard','/home'],['🎬','Videos','/videos'],['🏢','Business','/business'],['👤','Account','/account']].map(([icon,label,href])=>(
                <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                  <button style={{ width: '100%', padding: '6px 4px', borderRadius: 7, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <span>{icon}</span>{label}
                  </button>
                </Link>
              ))}
            </div>
          ) : (
            <>
              <Link href="/login?tab=signup" style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary" style={{ width: '100%', fontSize: 13, padding: '8px' }}>Sign up free →</button>
              </Link>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', marginTop: 4 }}>3 free · Sign up for 10/day</div>
            </>
          )}
        </div>
      </div>

      {/* ── CHAT AREA ───────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>

            {msgs.length === 0 && !chatLoading && (
              <div style={{ textAlign: 'center', paddingTop: 28 }}>
                <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 22, height: 150 }}>
                  <img src={HERO_IMG} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}/>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(8,8,8,0.2),rgba(8,8,8,0.8))' }}/>
                  <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><WLogo size={42}/></div>
                    <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 3px', letterSpacing: '-0.02em' }}>Wovo AI</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: 0 }}>Ask · Generate images · Edit photos</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginBottom: 12 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s.replace(/^[^\s]+\s/, ''))} style={{ padding: '7px 13px', borderRadius: 18, fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {userId ? 'Chats saved to your account · Sync across devices' : '3 free messages · Sign up to save your chats'}
                </p>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ marginBottom: 16, display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', position: 'relative' }} className="msg-row">
                {m.role === 'ai' && <WLogo size={26}/>}
                <div style={{ maxWidth: '82%' }}>
                  {m.uploadedImg && (
                    <div style={{ marginBottom: 5, borderRadius: 10, overflow: 'hidden', maxWidth: 180 }}>
                      <img src={m.uploadedImg} alt="Upload" style={{ width: '100%', display: 'block' }}/>
                    </div>
                  )}
                  {m.imageUrl && (
                    <div style={{ marginBottom: 5, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={m.imageUrl} alt="Generated" style={{ width: '100%', display: 'block' }}/>
                      <a href={m.imageUrl} download target="_blank" rel="noreferrer">
                        <button style={{ width: '100%', padding: '6px', background: 'var(--bg-2)', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Download</button>
                      </a>
                    </div>
                  )}
                  {m.content && (
                    <div style={{
                      padding: '9px 13px', borderRadius: 12, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                      background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-2)',
                      color: m.role === 'user' ? '#080808' : 'var(--text)',
                      fontWeight: m.role === 'user' ? 600 : 400,
                      borderBottomRightRadius: m.role === 'user' ? 3 : 12,
                      borderBottomLeftRadius: m.role === 'ai' ? 3 : 12,
                    }}>
                      {m.content}
                      {m.content.includes('sidebar') && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 7 }}>
                          <Link href="/wovo-ai" style={{ textDecoration: 'none' }}><button style={{ padding: '6px 12px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#080808', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>See plans →</button></Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteMessage(m.id, activeChatId, i)} className="del-msg" title="Delete" style={{ position: 'absolute', top: 0, [m.role === 'user' ? 'left' : 'right']: -28, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 10, padding: '2px 5px', borderRadius: 5, opacity: 0, transition: 'opacity 0.12s', whiteSpace: 'nowrap' }}>✕</button>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
                <WLogo size={26}/>
                <div style={{ padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 12, borderBottomLeftRadius: 3 }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1.1s ${i*0.18}s infinite` }}/>)}
                  </div>
                </div>
              </div>
            )}

            {showAuthWall && (
              <div className="card" style={{ textAlign: 'center', padding: '16px 20px', marginBottom: 16, border: '1px solid rgba(0,229,200,0.2)' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>Free messages used up</p>
                <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>Create a free account for 10/day. Your chats sync across all your devices.</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Link href="/login?tab=signup"><button className="btn btn-primary btn-sm">Create free account</button></Link>
                  <Link href="/wovo-ai"><button className="btn btn-outline btn-sm">See paid plans</button></Link>
                </div>
              </div>
            )}
            <div ref={bottomRef} style={{ height: 16 }}/>
          </div>
        </div>

        {/* Attached image preview */}
        {uploadedImg && (
          <div style={{ padding: '6px 20px 0', maxWidth: 700, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '5px 10px' }}>
              <img src={uploadedImg} alt="" style={{ width: 36, height: 36, borderRadius: 5, objectFit: 'cover' }}/>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Image attached — tell Wovo what to do with it</span>
              <button onClick={() => setUploadedImg(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>×</button>
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '10px 20px 18px', borderTop: '0.5px solid var(--border)', background: 'rgba(8,8,8,0.97)', flexShrink: 0 }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 13, padding: '8px 8px 8px 13px' }}>
              <button onClick={() => fileRef.current?.click()} title="Upload image" style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>🖼️</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}/>
              <textarea ref={inputRef} value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px' }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                onPaste={e => { const item = Array.from(e.clipboardData.items).find(i => i.type.includes('image')); if (item) { const f = item.getAsFile(); if (f) handleFile(f) } }}
                placeholder={uploadedImg ? 'Tell Wovo what to do with your image...' : 'Ask anything or say "make me a photo of..."'}
                rows={1} style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.55, maxHeight: 120, padding: 0 }}
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg-3)', border: 'none', color: input.trim() && !loading ? '#080808' : 'var(--text-3)', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15, fontWeight: 800, transition: 'all 0.15s' }}>↑</button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>Chat · Generate images · Upload photo to edit · Paste images</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .chat-row:hover .del-chat{opacity:1!important}
        .msg-row:hover .del-msg{opacity:1!important}
      `}</style>
    </div>
  )
}
