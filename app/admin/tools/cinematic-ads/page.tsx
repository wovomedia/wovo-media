'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

const STYLES = ['Professional & Clean', 'High Energy', 'Luxury & Premium', 'Friendly & Warm', 'Bold & Direct']
const VOICES = ['Confident & Energetic', 'Warm & Friendly', 'Authoritative', 'Casual & Relatable']

export default function CinematicAds() {
  const [clients, setClients] = useState<any[]>([])
  const [clientId, setClientId] = useState('')
  const [form, setForm] = useState({
    productName: '', productDescription: '', productUrl: '',
    whereToBy: '', style: 'Professional & Clean', voiceStyle: 'Confident & Energetic'
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [polling, setPolling] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { window.location.replace('/login'); return }
      const role = session?.user?.user_metadata?.wovo_role
      if (!role || !['owner', 'admin'].includes(role)) { window.location.replace('/home'); return }
      supabase.from('clients').select('id,business_name').eq('is_active', true).order('business_name').then(({ data }) => setClients(data || []))
      supabase.from('client_videos').select('*').eq('type', 'cinematic_ad').order('created_at', { ascending: false }).limit(20).then(({ data }) => setHistory(data || []))
    })
  }, [])

  const generate = async () => {
    if (!form.productName.trim()) return
    setLoading(true); setError(''); setResult(null); setVideoUrl('')

    const res = await fetch('/api/cinematic-ads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, clientId })
    })
    const data = await res.json()
    if (!res.ok || data.error) { setError(data.error || 'Failed'); setLoading(false); return }

    setResult(data)
    setLoading(false)

    if (data.videoId && !data.fallback) {
      setPolling(true)
      const poll = setInterval(async () => {
        const r = await fetch(`/api/cinematic-ads?id=${data.videoId}`)
        const d = await r.json()
        if (d.status === 'completed' && d.videoUrl) {
          setVideoUrl(d.videoUrl); setPolling(false); clearInterval(poll)
          const { data: v } = await supabase.from('client_videos').select('*').eq('type', 'cinematic_ad').order('created_at', { ascending: false }).limit(20)
          setHistory(v || [])
        } else if (d.status === 'failed') { setError('Video generation failed'); setPolling(false); clearInterval(poll) }
      }, 5000)
    }
  }

  return (
    <AppShell>
      <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.03em' }}>
          Cinematic <span style={{ color: 'var(--accent)' }}>Ad Studio</span>
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 24 }}>Generate 30–45 sec product ads with AI voiceover. Finds product photos online automatically.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>For client (optional)</label>
              <select className="input" value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">No client — general</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
              </select>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 600 }}>Product name<span style={{ color: 'var(--accent)' }}>*</span></label>
                <input className="input" value={form.productName} onChange={e => setForm(p => ({ ...p, productName: e.target.value }))} placeholder="e.g. Air Force 1 Sneakers" style={{ fontSize: 15 }}/>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 600 }}>Product description (optional)</label>
                <textarea className="input" value={form.productDescription} onChange={e => setForm(p => ({ ...p, productDescription: e.target.value }))} placeholder="Key features, benefits, what makes it special..." rows={3}/>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 600 }}>Product URL (optional — helps find photos)</label>
                <input className="input" value={form.productUrl} onChange={e => setForm(p => ({ ...p, productUrl: e.target.value }))} placeholder="https://shop.com/product"/>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 600 }}>Where to buy</label>
                <input className="input" value={form.whereToBy} onChange={e => setForm(p => ({ ...p, whereToBy: e.target.value }))} placeholder="Amazon, Nike.com, our store at 123 Main St..."/>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Ad style</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {STYLES.map(s => <button key={s} onClick={() => setForm(p => ({ ...p, style: s }))} style={{ padding: '5px 11px', borderRadius: 16, fontSize: 11, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', fontWeight: 500, borderColor: form.style === s ? 'var(--accent)' : 'var(--border)', background: form.style === s ? 'var(--accent-dim)' : 'transparent', color: form.style === s ? 'var(--accent)' : 'var(--text-2)' }}>{s}</button>)}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Voice style</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {VOICES.map(v => <button key={v} onClick={() => setForm(p => ({ ...p, voiceStyle: v }))} style={{ padding: '5px 11px', borderRadius: 16, fontSize: 11, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', fontWeight: 500, borderColor: form.voiceStyle === v ? 'var(--accent)' : 'var(--border)', background: form.voiceStyle === v ? 'var(--accent-dim)' : 'transparent', color: form.voiceStyle === v ? 'var(--accent)' : 'var(--text-2)' }}>{v}</button>)}
                </div>
              </div>

              {error && <div className="alert alert-error" style={{ fontSize: 13 }}>{error}</div>}

              <button className="btn btn-primary btn-block" onClick={generate} disabled={loading || polling || !form.productName.trim()} style={{ padding: 13, fontSize: 14 }}>
                {loading ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><span style={{ width: 15, height: 15, border: '2px solid rgba(0,0,0,0.25)', borderTopColor: '#080808', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/>Researching & writing script...</span>
                  : polling ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><span style={{ width: 15, height: 15, border: '2px solid rgba(0,0,0,0.25)', borderTopColor: '#080808', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/>Rendering video (2–5 min)...</span>
                    : 'Generate Cinematic Ad ✨'}
              </button>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          </div>

          <div>
            {result && (
              <div style={{ marginBottom: 20 }}>
                {result.productImage && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
                    <img src={result.productImage} alt="Product" style={{ width: '100%', height: 200, objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}/>
                  </div>
                )}
                <div className="card" style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Generated Script</div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }}>{result.script}</p>
                </div>
                {videoUrl ? (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <video src={videoUrl} controls style={{ width: '100%', display: 'block' }}/>
                    <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                      <a href={videoUrl} download target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none' }}><button className="btn btn-primary btn-block" style={{ fontSize: 13 }}>⬇ Download Ad</button></a>
                      <button className="btn btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => navigator.clipboard.writeText(videoUrl)}>Copy URL</button>
                    </div>
                  </div>
                ) : polling ? (
                  <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                    <div style={{ width: 36, height: 36, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}/>
                    <p style={{ color: 'var(--text-2)', fontSize: 13, margin: 0 }}>Rendering your cinematic ad... this takes 2–5 minutes</p>
                  </div>
                ) : null}
              </div>
            )}

            {!result && !loading && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Recent Cinematic Ads</h3>
                {history.length === 0 && <div className="card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: 32 }}>No cinematic ads generated yet</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {history.map((v, i) => (
                    <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px' }}>
                      <div style={{ width: 48, height: 48, background: 'var(--bg-3)', borderRadius: 8, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {v.video_url ? <video src={v.video_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: 20 }}>🎬</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(v.created_at).toLocaleDateString()}</div>
                      </div>
                      <span className={`badge ${v.status === 'completed' ? 'badge-green' : v.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>{v.status}</span>
                      {v.video_url && <a href={v.video_url} target="_blank" rel="noreferrer"><button className="btn btn-ghost btn-sm">View</button></a>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
