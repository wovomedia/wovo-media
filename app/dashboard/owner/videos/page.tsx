'use client'
import { useState, useEffect } from 'react'
import { supabase as sb } from '@/lib/supabase'
import Link from 'next/link'

const VIDEO_TYPES = [
  { key: 'post_booking', label: 'Post-Booking', desc: 'Sent after someone books a strategy call. Builds hype, explains Wovo AI vs Premium, warms them up before the call.', badge: '🗓', color: '#3b82f6' },
  { key: 'free_to_paid', label: 'Free → Paid', desc: 'Sent to free account holders who haven\'t upgraded. Shows them what they\'re missing and pushes them to start a plan.', badge: '⬆️', color: '#8b5cf6' },
  { key: 'premium_welcome', label: 'Premium Welcome', desc: 'Sent automatically when a Premium client pays. Personal welcome, explains next steps, builds excitement.', badge: '🎉', color: '#00E5C8' },
  { key: 'ai_to_premium', label: 'AI → Premium Upsell', desc: 'Sent to Wovo AI clients who\'ve been around a while. Shows them what real production would do for their brand.', badge: '🚀', color: '#f59e0b' },
]

export default function VideosPage() {
  const [clients, setClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [selectedType, setSelectedType] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string[]>([])
  const [customEmail, setCustomEmail] = useState('')
  const [customName, setCustomName] = useState('')
  const [customBusiness, setCustomBusiness] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  useEffect(() => {
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      sb.from('clients').select('*').order('created_at', { ascending: false }).then(({ data: c }) => {
        if (c) setClients(c)
      })
    })
  }, [])

  const sendVideo = async () => {
    if (!selectedType) return
    setSending(true)

    const payload = useCustom
      ? { type: selectedType, name: customName, email: customEmail, business: customBusiness }
      : { type: selectedType, name: selectedClient?.owner_name, email: selectedClient?.email, business: selectedClient?.business_name, clientId: selectedClient?.id }

    const res = await fetch('/api/heygen/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (data.success) {
      setSent(s => [...s, `${payload.type} → ${payload.email}`])
      setSelectedType('')
    }
    setSending(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div className="grid-bg" /><div className="grid-fade" />
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', backdropFilter: 'blur(14px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Outfit,sans-serif', fontSize: 18, fontWeight: 800, letterSpacing: '-0.04em' }}>wovo<span style={{ color: 'var(--accent)' }}>media</span><span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400, marginLeft: 8 }}>AI Videos</span></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/dashboard/owner"><button className="btn btn-ghost btn-sm">← Dashboard</button></Link>
          
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '36px 32px', position: 'relative', zIndex: 2 }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>AI Conversion Videos</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 15 }}>Send personalized AI avatar videos to leads and clients. Each video is generated specifically for them and emailed automatically.</p>
        </div>

        {sent.length > 0 && (
          <div className="alert alert-success" style={{ marginBottom: 24 }}>
            ✓ Video generating — email will arrive in ~5–10 min: {sent[sent.length - 1]}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* LEFT — Video type picker */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SELECT VIDEO TYPE</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {VIDEO_TYPES.map(v => (
                <div key={v.key} onClick={() => setSelectedType(v.key)} className="card" style={{ cursor: 'pointer', borderColor: selectedType === v.key ? 'var(--accent)' : 'var(--border)', padding: '18px 20px', transition: 'all 0.15s', background: selectedType === v.key ? 'var(--accent-dim)' : 'var(--bg-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{v.badge}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: selectedType === v.key ? 'var(--accent)' : 'var(--text)' }}>{v.label}</span>
                        {selectedType === v.key && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />}
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>{v.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Recipient picker */}
          <div>
            <h3 style={{ fontSize: 11, fontWeight: 700, marginBottom: 14, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>WHO GETS IT</h3>

            {/* Toggle custom vs client */}
            <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 9, padding: 3, marginBottom: 16, gap: 3 }}>
              {[['client', 'Existing Client'], ['custom', 'Any Email']].map(([v, l]) => (
                <button key={v} onClick={() => setUseCustom(v === 'custom')} style={{ flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: (v === 'custom') === useCustom ? 'var(--bg)' : 'transparent', color: (v === 'custom') === useCustom ? 'var(--text)' : 'var(--text-3)', boxShadow: (v === 'custom') === useCustom ? 'var(--shadow)' : 'none', transition: 'all 0.15s' }}>{l}</button>
              ))}
            </div>

            {!useCustom ? (
              <div className="card" style={{ padding: '16px', maxHeight: 320, overflowY: 'auto' }}>
                {clients.length === 0 ? <p style={{ fontSize: 14, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>No clients yet</p> : clients.map(c => (
                  <div key={c.id} onClick={() => setSelectedClient(c)} style={{ padding: '11px 12px', borderRadius: 9, cursor: 'pointer', background: selectedClient?.id === c.id ? 'var(--accent-dim)' : 'transparent', border: '1px solid', borderColor: selectedClient?.id === c.id ? 'var(--accent-border)' : 'transparent', marginBottom: 6, transition: 'all 0.12s' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: selectedClient?.id === c.id ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>{c.business_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.owner_name} · {c.email}</div>
                    <span className="badge badge-gray" style={{ marginTop: 4, fontSize: 10 }}>{c.plan || 'client'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Name *</label>
                  <input className="input" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Their first name or full name" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Email *</label>
                  <input className="input" type="email" value={customEmail} onChange={e => setCustomEmail(e.target.value)} placeholder="Their email address" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Business name</label>
                  <input className="input" value={customBusiness} onChange={e => setCustomBusiness(e.target.value)} placeholder="Their business name" />
                </div>
              </div>
            )}

            {/* SEND BUTTON */}
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: 14, fontSize: 15, marginTop: 16 }}
              onClick={sendVideo}
              disabled={sending || !selectedType || (useCustom ? (!customName || !customEmail) : !selectedClient)}
            >
              {sending ? 'Generating video...' : selectedType ? `Send "${VIDEO_TYPES.find(v => v.key === selectedType)?.label}" Video →` : 'Select a video type first'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>Video takes ~5–10 min to generate, then emails automatically.</p>

            {/* Preview script */}
            {selectedType && (
              <div className="card" style={{ marginTop: 16, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Script preview</div>
                <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, maxHeight: 120, overflowY: 'auto' }}>
                  {selectedType === 'post_booking' && 'Hey [Name]! I just got your request for a strategy call, and I\'m genuinely excited to connect with you about [Business]. Our team has helped 11+ businesses generate over 100 million combined views...'}
                  {selectedType === 'free_to_paid' && 'Hey [Name]! Welcome to Wovo Media. You just created your free account, and I wanted to personally show you what\'s waiting on the other side. Businesses just like yours are using Wovo AI to post every single day...'}
                  {selectedType === 'premium_welcome' && 'Hey [Name], welcome to Wovo Media Premium! I\'m so excited to officially have [Business] as part of our family. Within 24 hours, Payton is going to reach out personally to schedule your onboarding call...'}
                  {selectedType === 'ai_to_premium' && 'Hey [Name]! You\'ve been crushing it with Wovo AI, and I wanted to personally check in. You\'re already posting consistently, building your brand, and staying visible — but there\'s a next level...'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* STATS */}
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[['post_booking', '🗓', 'Post-Booking'], ['free_to_paid', '⬆️', 'Free→Paid'], ['premium_welcome', '🎉', 'Welcome'], ['ai_to_premium', '🚀', 'Upsell']].map(([k, icon, l]) => (
            <div key={k} className="stat-card" style={{ textAlign: 'center', padding: '18px 16px' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{l}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>AI conversion video</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
