'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── AI Video Generator ──────────────────────────────────────────────────────
function VideoGenerator() {
  const [script, setScript] = useState('')
  const [style, setStyle] = useState('Professional')
  const [generating, setGenerating] = useState(false)
  const [videoId, setVideoId] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState('')

  const generate = async () => {
    if (!script.trim()) return
    setGenerating(true); setError(''); setVideoUrl(''); setVideoId('')
    const res = await fetch('/api/videos/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, style })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Generation failed'); setGenerating(false); return }
    setVideoId(data.videoId)
    // Poll every 5s
    const poll = setInterval(async () => {
      const r = await fetch(`/api/videos/generate?id=${data.videoId}`)
      const d = await r.json()
      if (d.status === 'completed' && d.videoUrl) {
        setVideoUrl(d.videoUrl); setGenerating(false); clearInterval(poll)
      } else if (d.status === 'failed') {
        setError('Generation failed'); setGenerating(false); clearInterval(poll)
      }
    }, 5000)
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Video style</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Professional', 'Casual & Friendly', 'High Energy'].map(s => (
              <button key={s} onClick={() => setStyle(s)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', fontWeight: 600, borderColor: style === s ? 'var(--accent)' : 'var(--border)', background: style === s ? 'var(--accent-dim)' : 'transparent', color: style === s ? 'var(--accent)' : 'var(--text-2)' }}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Script — what should the avatar say?</label>
          <textarea className="input" value={script} onChange={e => setScript(e.target.value)} placeholder="e.g. Hey everyone! Come check out our new summer menu — we've got something for everyone. See you soon!" rows={5} style={{ fontSize: 14 }}/>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{script.length} characters · ~{Math.round(script.length / 15) || 0}s video</div>
        </div>
        {error && <div className="alert alert-error" style={{ fontSize: 13 }}>{error}</div>}
        {videoUrl && (
          <div>
            <video src={videoUrl} controls style={{ width: '100%', borderRadius: 8, marginBottom: 10, background: '#000' }}/>
            <a href={videoUrl} download target="_blank" rel="noreferrer">
              <button className="btn btn-outline btn-block">⬇ Download Video</button>
            </a>
          </div>
        )}
        <button className="btn btn-primary btn-block" onClick={generate} disabled={generating || !script.trim()} style={{ padding: 13, fontSize: 14 }}>
          {generating ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <span style={{ width: 15, height: 15, border: '2px solid rgba(0,0,0,0.25)', borderTopColor: '#080808', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/>
              {videoId ? 'Rendering (2–5 min)...' : 'Generating...'}
            </span>
          ) : 'Generate AI Video ✨'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>💡 Keep scripts under 60 seconds for social. Mention your business name early. End with a clear call to action.</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

// ─── Website Builder ─────────────────────────────────────────────────────────
function WebsiteBuilderFull({ isLoggedIn, hasActiveSubscription, authChecked }: { isLoggedIn: boolean, hasActiveSubscription: boolean, authChecked: boolean }) {
  const [step, setStep] = useState(0)
  const [researching, setResearching] = useState(false)
  const [researchData, setResearchData] = useState('')
  const [generating, setGenerating] = useState(false)
  const [files, setFiles] = useState<Record<string, string>>({})
  const [activeFile, setActiveFile] = useState('page.tsx')
  const [d, setD] = useState({
    businessName: '', businessType: '', location: '', tagline: '', style: 'Modern & Clean',
    description: '', phone: '', email: '', address: '', hours: '',
    currentWebsite: '', instagram: '', facebook: '', tiktok: '', youtube: '', google: '',
    pages: 'Home, About, Services, Contact', staffMembers: '', menuItems: '', services: '',
    testimonials: '', logoUrl: '', aboutStory: ''
  })

  if (!authChecked) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }}/></div>

  if (!isLoggedIn) return (
    <div className="card card-accent" style={{ textAlign: 'center', padding: '48px 32px', maxWidth: 500 }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>Subscription required</h3>
      <p style={{ color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.65 }}>The Website Builder is available on the $99/mo Website Builder plan.</p>
      <a href="https://pay.wovomedia.com/b/4gMcN57U7avV0vqbZ6cIE11" target="_blank" rel="noreferrer">
        <button className="btn btn-primary" style={{ padding: '12px 28px' }}>Get Website Builder — $99/mo</button>
      </a>
    </div>
  )

  if (!hasActiveSubscription) return (
    <div className="card card-accent" style={{ textAlign: 'center', padding: '48px 32px', maxWidth: 500 }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>Website Builder plan required</h3>
      <p style={{ color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.65 }}>Upgrade to the Website Builder plan to generate full multi-file Next.js websites.</p>
      <a href="https://pay.wovomedia.com/b/4gMcN57U7avV0vqbZ6cIE11" target="_blank" rel="noreferrer">
        <button className="btn btn-primary">Get Website Builder — $99/mo</button>
      </a>
    </div>
  )

  const doResearch = async () => {
    if (!d.businessName) return
    setResearching(true)
    try {
      const res = await fetch(`/api/website-builder?name=${encodeURIComponent(d.businessName)}&location=${encodeURIComponent(d.location)}`)
      const data = await res.json()
      setResearchData(data.research || '')
    } catch {}
    setResearching(false)
  }

  const generate = async () => {
    setStep(4); setGenerating(true)
    const res = await fetch('/api/website-builder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, researchData })
    })
    const data = await res.json()
    setFiles(data.files || {})
    setActiveFile('page.tsx')
    setGenerating(false); setStep(5)
  }

  const downloadAll = () => {
    const content = Object.entries(files).map(([path, code]) =>
      `${'='.repeat(60)}\n// FILE: ${path}\n${'='.repeat(60)}\n${code}`
    ).join('\n\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${d.businessName.toLowerCase().replace(/\s+/g, '-')}-website.txt`; a.click()
  }

  if (step === 4) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ width: 52, height: 52, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }}/>
      <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Building your website...</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Generating Nav, Hero, About, Services, Contact + Footer components for {d.businessName}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (step === 5 && Object.keys(files).length > 0) return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>🎉 {d.businessName} — Ready!</h3>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{Object.keys(files).length} files · Next.js + Tailwind CSS</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setStep(0); setFiles({}) }}>Start over</button>
          <button className="btn btn-primary btn-sm" onClick={downloadAll}>⬇ Download All Files</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', height: 580, marginBottom: 16 }}>
        <div style={{ width: 200, background: 'var(--bg-2)', borderRight: '1px solid var(--border)', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--border)' }}>
            {Object.keys(files).length} files
          </div>
          {Object.keys(files).map(path => (
            <button key={path} onClick={() => setActiveFile(path)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: activeFile === path ? 'var(--accent-dim)' : 'transparent', color: activeFile === path ? 'var(--accent)' : 'var(--text-2)', borderLeft: `2px solid ${activeFile === path ? 'var(--accent)' : 'transparent'}` }}>
              {path.includes('/') ? <><span style={{ color: 'var(--text-3)' }}>└ </span>{path.split('/').pop()}</> : path}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: '#0d0d0d' }}>
          <pre style={{ margin: 0, padding: 16, fontSize: 12, lineHeight: 1.6, color: '#e2e8f0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {files[activeFile]}
          </pre>
        </div>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '20px 24px' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Ready to go live?</p>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>Wovo Media can deploy this to your domain, add a contact form backend, and maintain it monthly.</p>
        <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" rel="noreferrer">
          <button className="btn btn-primary">Book a call to deploy →</button>
        </a>
      </div>
    </div>
  )

  const progress = ['Basics', 'Contact & Online', 'Your Content', 'Branding & Pages', 'Generate']

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Website <span style={{ color: 'var(--accent)' }}>Builder</span></h1>
      <p style={{ color: 'var(--text-2)', marginBottom: 28, fontSize: 14 }}>Tell Wovo AI about your business. We generate a full Next.js site with separate components — ready to deploy.</p>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {progress.map((p, i) => (
          <div key={p} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? 'var(--accent)' : 'var(--bg-4)', transition: 'background 0.3s', cursor: i < step ? 'pointer' : 'default' }} onClick={() => i < step && setStep(i)}/>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 20, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Step {step + 1} of 4 — {progress[step]}</div>

      {step === 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>Business name<span style={{ color: 'var(--accent)' }}>*</span></label>
            <input className="input" value={d.businessName} onChange={e => { const v = e.target.value; setD(p => ({ ...p, businessName: v })) }} placeholder="Your business name"/></div>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>Business type<span style={{ color: 'var(--accent)' }}>*</span></label>
            <select className="input" value={d.businessType} onChange={e => setD(p => ({ ...p, businessType: e.target.value }))}>
              <option value="">Select type...</option>
              {['Restaurant / Food & Drink','Bar / Nightlife','Coffee Shop / Cafe','Retail / Boutique','Hair / Beauty Salon','Spa / Wellness','Healthcare / Medical','Auto / Car Services','HVAC / Plumbing / Electrical','Landscaping / Lawn Care','Cleaning Services','Photography / Videography','Real Estate','Gym / Fitness','Law / Legal Services','Accounting / Finance','Other Service Business','Other'].map(o => <option key={o}>{o}</option>)}
            </select></div>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>City, State<span style={{ color: 'var(--accent)' }}>*</span></label>
            <input className="input" value={d.location} onChange={e => { const v = e.target.value; setD(p => ({ ...p, location: v })) }} placeholder="City, State"/></div>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>Your tagline / what makes you special</label>
            <input className="input" value={d.tagline} onChange={e => { const v = e.target.value; setD(p => ({ ...p, tagline: v })) }} placeholder="What makes your business special"/></div>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 6, fontWeight: 500 }}>Website style</label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {['Modern & Clean', 'Bold & Vibrant', 'Minimal', 'Warm & Friendly', 'Luxury', 'Fun & Playful'].map(s => (
                <button key={s} onClick={() => setD(p => ({ ...p, style: s }))} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', fontWeight: 500, borderColor: d.style === s ? 'var(--accent)' : 'var(--border-2)', background: d.style === s ? 'var(--accent-dim)' : 'transparent', color: d.style === s ? 'var(--accent)' : 'var(--text-2)' }}>{s}</button>
              ))}
            </div></div>
          <button className="btn btn-primary" style={{ padding: 12, marginTop: 4 }} onClick={async () => { setStep(1); await doResearch() }} disabled={!d.businessName || !d.businessType || !d.location}>
            Next → {d.businessName ? "(we'll look you up online)" : ''}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {researching && <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>Searching online for {d.businessName}...</div>}
          {researchData && !researching && <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#22c55e' }}>✓ Found info online — we'll use this to fill in your site</div>}
          {[['Phone number','phone','(555) 000-0000'],['Email address','email','hello@yourbusiness.com'],['Full street address','address','123 Main St, Your City, State 00000'],['Business hours','hours','Mon–Fri 11am–9pm, Sat–Sun 10am–10pm'],['Current website (if you have one)','currentWebsite','https://yourbusiness.com']].map(([l,k,p]) => (
            <div key={k}><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>{l}</label>
              <input className="input" value={d[k as keyof typeof d]} onChange={e => { const v = e.target.value; setD(p2 => ({ ...p2, [k]: v })) }} placeholder={p}/></div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Social Media Handles</div>
            {[['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['youtube','YouTube'],['google','Google Business']].map(([k, l]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', width: 80, flexShrink: 0, fontWeight: 500 }}>{l}</span>
                <input className="input" style={{ fontSize: 13 }} value={d[k as keyof typeof d]} onChange={e => { const v = e.target.value; setD(p => ({ ...p, [k]: v })) }} placeholder="@handle or URL"/>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(0)}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 2, padding: 12 }} onClick={() => setStep(2)}>Next →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>About your business — your story, what makes you special</label>
            <textarea className="input" value={d.description} onChange={e => { const v = e.target.value; setD(p => ({ ...p, description: v })) }} placeholder="Tell us your story — how long you've been open, what makes you different..." rows={3}/></div>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>Staff / team members (name + role, one per line)</label>
            <textarea className="input" value={d.staffMembers} onChange={e => { const v = e.target.value; setD(p => ({ ...p, staffMembers: v })) }} placeholder={"Owner Name — Role\nEmployee Name — Role"} rows={3}/></div>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>Menu items or products (name + description, one per line)</label>
            <textarea className="input" value={d.menuItems} onChange={e => { const v = e.target.value; setD(p => ({ ...p, menuItems: v })) }} placeholder={"Item Name — $Price · Description\nAnother Item — $Price · Description"} rows={3}/></div>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>Services you offer (one per line)</label>
            <textarea className="input" value={d.services} onChange={e => { const v = e.target.value; setD(p => ({ ...p, services: v })) }} placeholder={"Service Name — starting at $Price\nAnother Service — $Price"} rows={3}/></div>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>Customer reviews / testimonials (paste a few of your best)</label>
            <textarea className="input" value={d.testimonials} onChange={e => { const v = e.target.value; setD(p => ({ ...p, testimonials: v })) }} placeholder={"'Great service!' — Customer Name\n'Highly recommend!' — Another Customer"} rows={3}/></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 2, padding: 12 }} onClick={() => setStep(3)}>Next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>Pages / sections you want on your site</label>
            <input className="input" value={d.pages} onChange={e => { const v = e.target.value; setD(p => ({ ...p, pages: v })) }} placeholder="Home, About, Services, Contact"/></div>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>Your logo URL (optional — paste a direct image link)</label>
            <input className="input" value={d.logoUrl} onChange={e => { const v = e.target.value; setD(p => ({ ...p, logoUrl: v })) }} placeholder="https://... or leave blank"/></div>
          <div><label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 5, fontWeight: 500 }}>Brand story — anything else about your history or mission</label>
            <textarea className="input" value={d.aboutStory} onChange={e => { const v = e.target.value; setD(p => ({ ...p, aboutStory: v })) }} placeholder="Share your origin story and what drives your business..." rows={3}/></div>
          {researchData && (
            <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Found online about your business</div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>{researchData.slice(0, 400)}{researchData.length > 400 ? '...' : ''}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 2, padding: 13, fontSize: 15 }} onClick={generate}>Generate My Website ✨</button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>Takes ~30s · Generates 7+ component files · Next.js + Tailwind</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Wovo AI Content ────────────────────────────────────────────────────
function WovoAIContent() {
  const params = useSearchParams()
  const [activeTab, setActiveTab] = useState<'content'|'team'|'website'|'video'>(
    (params.get('tab') as any) || 'content'
  )
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [clientPlan, setClientPlan] = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setIsLoggedIn(true)
        const { data: client } = await supabase.from('clients').select('is_active, plan').eq('profile_id', session.user.id).single()
        if (client?.is_active) {
          setClientPlan(client.plan || '')
          setHasActiveSubscription(['starter','growth','pro_ai','website'].includes(client.plan))
        }
      }
      setAuthChecked(true)
    })
  }, [])

  const STRIPE_LINKS: Record<string, string> = {
    starter: 'https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y',
    growth: 'https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z',
    pro_ai: 'https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10',
    cinematic: 'https://pay.wovomedia.com/b/fZu9AT5LZdI76TO6EMcIE1d',
    website: 'https://pay.wovomedia.com/b/4gMcN57U7avV0vqbZ6cIE11',
  }

  const tabs = [
    { key: 'content', label: 'Content' },
    { key: 'team', label: 'Team' },
    { key: 'website', label: 'Website Builder' },
    { key: 'video', label: 'AI Videos' },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border)', background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(20px)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <a href="/" style={{ fontFamily: 'Outfit,sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.04em' }}>
          wovo<span style={{ color: 'var(--accent)' }}>media</span>
        </a>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)} style={{ background: activeTab === t.key ? 'var(--accent-dim)' : 'transparent', border: '0.5px solid', borderColor: activeTab === t.key ? 'var(--accent-border)' : 'transparent', color: activeTab === t.key ? 'var(--accent)' : 'var(--text-2)', padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>{t.label}</button>
          ))}
        </div>
        <a href="/home" style={{ color: 'var(--text-3)', fontSize: 13, textDecoration: 'none' }}>← Home</a>
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>

        {/* ── Content / Plans Tab ── */}
        {activeTab === 'content' && (
          <>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Wovo AI <span style={{ color: 'var(--accent)' }}>Plans</span></h1>
            <p style={{ color: 'var(--text-2)', marginBottom: 32, fontSize: 15 }}>Pick a plan. Pay on Stripe. Your account is created automatically and you get instant access.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { name: 'Starter', price: '$29/mo', desc: 'AI character for yourself.', features: ['Your own AI character', '3 posts per week', 'Ready-to-copy captions', 'Posting tutorials'], link: STRIPE_LINKS.starter },
                { name: 'Growth', price: '$49/mo', desc: 'AI characters for your whole team.', features: ['Characters for entire team', '5 posts per week', 'AI Video Generator', 'Unlimited edits'], link: STRIPE_LINKS.growth, popular: true },
                { name: 'Pro AI', price: '$79/mo', desc: 'Daily posts, Stories, multiple brands.', features: ['Everything in Growth', 'Daily posts + Stories', 'Multiple brand characters', 'Image ad generator'], link: STRIPE_LINKS.pro_ai },
                { name: 'Website Builder', price: '$99/mo', desc: 'AI builds your full website.', features: ['Multi-file Next.js site', '7+ component files', 'Tailwind CSS + TypeScript', 'Ready to deploy'], link: STRIPE_LINKS.website },
              ].map(p => (
                <div key={p.name} className={`card ${(p as any).popular ? 'card-accent' : ''}`} style={{ position: 'relative' }}>
                  {(p as any).popular && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#080808', fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>Most popular</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6 }}>{p.name}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'Outfit,sans-serif', color: 'var(--text)', marginBottom: 4 }}>{p.price}</div>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>{p.desc}</p>
                  {p.features.map(f => <div key={f} style={{ fontSize: 12, color: 'var(--text-2)', padding: '5px 0', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 7 }}><span style={{ color: 'var(--accent)', flexShrink: 0 }}>✓</span>{f}</div>)}
                  <a href={p.link} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 16, textDecoration: 'none' }}>
                    <button className={`btn ${(p as any).popular ? 'btn-primary' : 'btn-outline'}`} style={{ width: '100%', padding: 11, fontSize: 13 }}>Get {p.name} →</button>
                  </a>
                </div>
              ))}
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '16px 20px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
                Already have an account? <a href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Log in →</a>
                &nbsp;·&nbsp; Questions? <a href="mailto:support@wovomedia.com" style={{ color: 'var(--accent)' }}>support@wovomedia.com</a>
              </p>
            </div>
          </>
        )}

        {/* ── Team Tab ── */}
        {activeTab === 'team' && (
          <>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Team <span style={{ color: 'var(--accent)' }}>Characters</span></h1>
            <p style={{ color: 'var(--text-2)', marginBottom: 40 }}>Available on Growth and above. Create a unique AI character for every employee — they all post as themselves, with your brand voice.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 40 }}>
              {['Owner / Founder', 'Manager', 'Front of House', 'Chef / Kitchen', 'Bartender', 'Brand Rep'].map(role => (
                <div key={role} className="card" style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-dim)', border: '2px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 12px', color: 'var(--accent)' }}>👤</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{role}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Upload photos → AI character created</div>
                </div>
              ))}
            </div>
            <div className="card card-accent" style={{ maxWidth: 560 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>How team characters work</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                {[['1','Upload 3–5 photos of each team member'],['2','We build a realistic AI character based on their look'],['3','Each character creates content for their role'],['4','All tied to your account — you approve everything']].map(([n, t]) => (
                  <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#080808', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
                    <span style={{ fontSize: 14, color: 'var(--text-2)', paddingTop: 3 }}>{t}</span>
                  </div>
                ))}
              </div>
              <a href={STRIPE_LINKS.growth} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 24, textDecoration: 'none' }}>
                <button className="btn btn-primary btn-block">Get Growth Plan — $49/mo</button>
              </a>
            </div>
          </>
        )}

        {/* ── Website Builder Tab ── */}
        {activeTab === 'website' && (
          <WebsiteBuilderFull isLoggedIn={isLoggedIn} hasActiveSubscription={hasActiveSubscription && clientPlan === 'website'} authChecked={authChecked}/>
        )}

        {/* ── AI Videos Tab ── */}
        {activeTab === 'video' && (
          <>
            <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>AI <span style={{ color: 'var(--accent)' }}>Video Generator</span></h1>
            <p style={{ color: 'var(--text-2)', marginBottom: 32, fontSize: 15 }}>Generate short AI avatar videos for social media.</p>
            {!authChecked ? (
              <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }}/></div>
            ) : !isLoggedIn || !['growth', 'pro_ai', 'website'].includes(clientPlan) ? (
              <div className="card card-accent" style={{ textAlign: 'center', padding: '48px 32px', maxWidth: 500 }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>🔒</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>Growth plan or higher required</h3>
                <p style={{ color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.65 }}>AI Video Generation is available on Growth ($49/mo) and above.</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <a href={STRIPE_LINKS.growth} target="_blank" rel="noreferrer"><button className="btn btn-primary">Get Growth — $49/mo</button></a>
                  <a href={STRIPE_LINKS.pro_ai} target="_blank" rel="noreferrer"><button className="btn btn-outline">Get Pro — $79/mo</button></a>
                </div>
              </div>
            ) : (
              <VideoGenerator/>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function WovoAI() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner"/></div>}>
      <WovoAIContent/>
    </Suspense>
  )
}
