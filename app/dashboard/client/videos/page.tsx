'use client'
import { useState, useEffect } from 'react'
import { supabase as sb } from '@/lib/supabase'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

const SERIES_THEMES = [
  { key: 'tips', label: '💡 Tips & Advice', desc: 'Share expertise and tips about your industry' },
  { key: 'behind', label: '🎬 Behind the Scenes', desc: 'Show how your business operates day to day' },
  { key: 'promo', label: '🎉 Promotions & Deals', desc: 'Announce specials, sales, and new offerings' },
  { key: 'story', label: '📖 Brand Story', desc: 'Tell your business story and what makes you unique' },
  { key: 'hero', label: '🦸 Hero Character', desc: 'Your AI character as a strong brand mascot or persona' },
]

const TONES = ['Professional', 'Casual & Friendly', 'Energetic & Fun', 'Inspiring', 'Educational']

export default function ClientVideos() {
  const [client, setClient] = useState<any>(null)
  const [series, setSeries] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [tab, setTab] = useState<'series'|'create'|'library'>('series')
  const [step, setStep] = useState(1)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState('')

  // Create form state
  const [form, setForm] = useState({
    seriesName: '', theme: '', tone: 'Casual & Friendly',
    businessDesc: '', episodes: 3, customScript: ''
  })
  const [generatedScripts, setGeneratedScripts] = useState<string[]>([])
  const [selectedScript, setSelectedScript] = useState(0)
  const [currentSeriesId, setCurrentSeriesId] = useState<string>('')

  useEffect(() => {
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const { data: c } = await sb.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (c) {
        setClient(c)
        const [s, v] = await Promise.all([
          sb.from('client_video_series').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
          sb.from('client_videos').select('*').eq('client_id', c.id).order('created_at', { ascending: false }).limit(20)
        ])
        if (s.data) setSeries(s.data)
        if (v.data) setVideos(v.data)
      }
      setLoading(false)
    })
  }, [])

  const generateScripts = async () => {
    setGenerating(true)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' },
    })
    // Use our own API instead
    const apiRes = await fetch('/api/videos/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: `Generate ${form.episodes} short social media video scripts (30-45 seconds each) for ${client?.business_name || 'a business'}.
Theme: ${form.theme} - ${SERIES_THEMES.find(t => t.key === form.theme)?.desc}
Tone: ${form.tone}
Business description: ${form.businessDesc || client?.business_name}
Series name: ${form.seriesName}

Return ONLY a JSON array of script strings, no other text. Example: ["script1", "script2", "script3"]
Each script should be natural spoken language, 60-80 words max.`,
        clientId: client?.id,
        videoDbId: null
      })
    })
    const data = await apiRes.json()
    try {
      const scripts = JSON.parse(data.caption || '[]')
      setGeneratedScripts(Array.isArray(scripts) ? scripts : [data.caption])
    } catch {
      setGeneratedScripts([form.customScript || `Hey everyone! Welcome to ${form.seriesName} from ${client?.business_name}. We're so excited to share this series with you. Stay tuned for amazing content!`])
    }
    setStep(3)
    setGenerating(false)
  }

  const startGeneration = async () => {
    if (!termsAccepted) { setMsg('Please accept the terms to continue.'); return }
    setGenerating(true)
    setMsg('')

    // Create series
    const { data: newSeries } = await sb.from('client_video_series').insert({
      client_id: client.id,
      series_name: form.seriesName,
      series_theme: form.theme,
      episode_count: generatedScripts.length,
    }).select().single()

    // Generate video for selected script
    const script = generatedScripts[selectedScript]
    const res = await fetch('/api/videos/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: client.id,
        seriesId: newSeries?.id,
        script,
        episodeNumber: selectedScript + 1,
      })
    })
    const data = await res.json()
    if (data.videoId) {
      setMsg('✓ Video generating! Check your library in 5-10 minutes.')
      setTab('library')
      setStep(1)
      // Refresh videos
      const { data: v } = await sb.from('client_videos').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(20)
      if (v) setVideos(v)
    } else {
      setMsg('Error: ' + (data.error || 'Generation failed'))
    }
    setGenerating(false)
  }

  if (loading) return <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'var(--text-2)'}}>Loading...</div></div>

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 32px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontFamily:'Outfit,sans-serif',fontSize:18,fontWeight:800,letterSpacing:'-0.04em'}}>wovo<span style={{color:'var(--accent)'}}>media</span><span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>AI Videos</span></div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {(['series','create','library'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{background:tab===t?'var(--accent-dim)':'transparent',border:'1px solid',borderColor:tab===t?'var(--accent-border)':'transparent',color:tab===t?'var(--accent)':'var(--text-2)',padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:600,textTransform:'capitalize'}}>
              {t === 'series' ? 'My Series' : t === 'create' ? '+ Create' : 'Library'}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <Link href="/dashboard/client"><button className="btn btn-ghost btn-sm">← Dashboard</button></Link>
          <ThemeToggle/>
        </div>
      </nav>

      <div style={{maxWidth:800,margin:'0 auto',padding:'36px 32px',position:'relative',zIndex:2}}>
        {msg && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`} style={{marginBottom:20}}>{msg}</div>}

        {/* MY SERIES */}
        {tab === 'series' && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:28}}>
              <h1 style={{fontSize:26,fontWeight:700}}>AI Video Series</h1>
              <button className="btn btn-primary" onClick={() => setTab('create')}>+ New Series</button>
            </div>
            {series.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:'56px 32px'}}>
                <div style={{fontSize:44,marginBottom:16}}>🎬</div>
                <h3 style={{fontSize:20,fontWeight:700,marginBottom:10}}>No series yet</h3>
                <p style={{color:'var(--text-2)',marginBottom:24,lineHeight:1.6}}>Create your first AI video series. Your AI character will generate short videos for social media — each with a caption ready to copy.</p>
                <button className="btn btn-primary" onClick={() => setTab('create')}>Create First Series →</button>
              </div>
            ) : series.map(s => (
              <div key={s.id} className="card" style={{marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>{s.series_name}</div>
                  <div style={{fontSize:13,color:'var(--text-3)',marginTop:3}}>{SERIES_THEMES.find(t => t.key === s.series_theme)?.label || s.series_theme} · {s.episode_count} episodes</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setTab('create')}>Add Episode</button>
              </div>
            ))}
          </>
        )}

        {/* CREATE */}
        {tab === 'create' && (
          <>
            <div style={{display:'flex',gap:4,marginBottom:28}}>
              {[1,2,3,4].map(n => (
                <div key={n} style={{flex:1,height:3,borderRadius:2,background:n<=step?'var(--accent)':'var(--bg-4)',transition:'background 0.3s'}}/>
              ))}
            </div>

            {step === 1 && (
              <div>
                <h2 style={{fontSize:22,fontWeight:700,marginBottom:6}}>Name your series</h2>
                <p style={{color:'var(--text-2)',marginBottom:24}}>Give your video series a name and choose a theme.</p>
                <div style={{display:'flex',flexDirection:'column',gap:16}}>
                  <div>
                    <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Series name *</label>
                    <input className="input" value={form.seriesName} onChange={e=>setForm(f=>({...f,seriesName:e.target.value}))} placeholder={`e.g. "${client?.business_name} Tips" or "Behind the Scenes"`}/>
                  </div>
                  <div>
                    <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:10,fontWeight:600}}>Series theme *</label>
                    <div style={{display:'flex',flexDirection:'column',gap:9}}>
                      {SERIES_THEMES.map(t => (
                        <div key={t.key} onClick={() => setForm(f=>({...f,theme:t.key}))} className="card" style={{cursor:'pointer',padding:'14px 18px',borderColor:form.theme===t.key?'var(--accent)':'var(--border)',background:form.theme===t.key?'var(--accent-dim)':'var(--bg-2)',transition:'all 0.15s'}}>
                          <div style={{fontSize:14,fontWeight:600,color:form.theme===t.key?'var(--accent)':'var(--text)'}}>{t.label}</div>
                          <div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>{t.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{padding:13,fontSize:15}} onClick={() => setStep(2)} disabled={!form.seriesName||!form.theme}>
                    Next: Customize →
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 style={{fontSize:22,fontWeight:700,marginBottom:6}}>Customize your style</h2>
                <p style={{color:'var(--text-2)',marginBottom:24}}>Tell us about your business so we can write the scripts.</p>
                <div style={{display:'flex',flexDirection:'column',gap:16}}>
                  <div>
                    <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>What does {client?.business_name} do? (optional)</label>
                    <textarea className="input" value={form.businessDesc} onChange={e=>setForm(f=>({...f,businessDesc:e.target.value}))} rows={3} placeholder="Describe your business, what makes you special, your main products or services..."/>
                  </div>
                  <div>
                    <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:8,fontWeight:600}}>Tone</label>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                      {TONES.map(t => (
                        <button key={t} onClick={() => setForm(f=>({...f,tone:t}))} style={{padding:'8px 16px',borderRadius:20,fontSize:13,cursor:'pointer',border:'1px solid',borderColor:form.tone===t?'var(--accent)':'var(--border-2)',background:form.tone===t?'var(--accent-dim)':'transparent',color:form.tone===t?'var(--accent)':'var(--text-2)',fontFamily:'inherit',fontWeight:500}}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Number of episodes to generate</label>
                    <div style={{display:'flex',gap:8}}>
                      {[1,3,5].map(n => (
                        <button key={n} onClick={() => setForm(f=>({...f,episodes:n}))} style={{padding:'10px 20px',borderRadius:9,fontSize:14,cursor:'pointer',border:'1px solid',borderColor:form.episodes===n?'var(--accent)':'var(--border-2)',background:form.episodes===n?'var(--accent-dim)':'transparent',color:form.episodes===n?'var(--accent)':'var(--text-2)',fontFamily:'inherit',fontWeight:600}}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:10}}>
                    <button className="btn btn-ghost" style={{flex:1}} onClick={() => setStep(1)}>← Back</button>
                    <button className="btn btn-primary" style={{flex:2,padding:13,fontSize:15}} onClick={generateScripts} disabled={generating}>
                      {generating ? 'Writing scripts...' : 'Generate Scripts →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && generatedScripts.length > 0 && (
              <div>
                <h2 style={{fontSize:22,fontWeight:700,marginBottom:6}}>Review your scripts</h2>
                <p style={{color:'var(--text-2)',marginBottom:24}}>Pick which script to turn into a video first. You can do the others later.</p>
                <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:24}}>
                  {generatedScripts.map((script, i) => (
                    <div key={i} onClick={() => setSelectedScript(i)} className="card" style={{cursor:'pointer',borderColor:selectedScript===i?'var(--accent)':'var(--border)',background:selectedScript===i?'var(--accent-dim)':'var(--bg-2)',transition:'all 0.15s',padding:'18px 20px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                        <span style={{fontSize:12,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>Episode {i+1}</span>
                        {selectedScript===i && <span style={{fontSize:11,color:'var(--accent)',fontWeight:700}}>✓ Selected</span>}
                      </div>
                      <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.65,margin:0}}>{script}</p>
                    </div>
                  ))}
                </div>

                {/* Terms */}
                <div className="card" style={{marginBottom:20,borderColor:termsAccepted?'var(--accent-border)':'var(--border)'}}>
                  <h4 style={{fontSize:14,fontWeight:700,marginBottom:8}}>AI Video Terms of Use</h4>
                  <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,marginBottom:14}}>By generating an AI video using Wovo Media's platform, you confirm that: (1) You have the rights to any likeness or image used in this video. (2) The content follows our <Link href="/terms" style={{color:'var(--accent)'}}>Terms of Service</Link>. (3) You will not use AI-generated videos to deceive, impersonate, or mislead others. (4) Wovo Media may use anonymized data to improve our services.</p>
                  <div className="policy-check">
                    <input type="checkbox" id="video-terms" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)}/>
                    <label htmlFor="video-terms" style={{fontSize:14,fontWeight:500}}>I agree to the AI Video Terms of Use and take responsibility for this content.</label>
                  </div>
                </div>

                <div style={{display:'flex',gap:10}}>
                  <button className="btn btn-ghost" style={{flex:1}} onClick={() => setStep(2)}>← Back</button>
                  <button className="btn btn-primary" style={{flex:2,padding:13,fontSize:15}} onClick={startGeneration} disabled={generating||!termsAccepted}>
                    {generating ? 'Starting...' : 'Generate Video →'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* LIBRARY */}
        {tab === 'library' && (
          <>
            <h1 style={{fontSize:26,fontWeight:700,marginBottom:24}}>Video Library</h1>
            {videos.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:'48px 32px',color:'var(--text-3)'}}>No videos yet — create your first series to get started.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {videos.map(v => (
                  <div key={v.id} className="card" style={{padding:'18px 22px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                          <span className={`badge ${v.status==='completed'?'badge-green':v.status==='generating'?'badge-accent':'badge-gray'}`}>
                            {v.status==='completed'?'✓ Ready':v.status==='generating'?'⏳ Generating':'Pending'}
                          </span>
                          {v.episode_number && <span style={{fontSize:12,color:'var(--text-3)'}}>Episode {v.episode_number}</span>}
                        </div>
                        {v.script && <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,marginBottom:v.caption?10:0}}>{v.script.slice(0,120)}{v.script.length>120?'...':''}</p>}
                        {v.caption && (
                          <div style={{background:'var(--bg-3)',borderRadius:8,padding:'10px 14px',marginTop:8}}>
                            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:600}}>Caption</div>
                            <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,margin:0}}>{v.caption}</p>
                            <button onClick={() => navigator.clipboard.writeText(v.caption)} className="btn btn-ghost btn-sm" style={{marginTop:8,fontSize:11}}>Copy Caption</button>
                          </div>
                        )}
                      </div>
                      {v.video_url && (
                        <div style={{flexShrink:0}}>
                          <a href={v.video_url} target="_blank" rel="noreferrer">
                            <button className="btn btn-primary btn-sm">Download</button>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
