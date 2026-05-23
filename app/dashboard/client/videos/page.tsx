'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase as sb } from '@/lib/supabase'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

const SERIES_THEMES = [
  { key: 'tips', label: '💡 Tips & Advice', desc: 'Share expertise and tips about your industry' },
  { key: 'behind', label: '🎬 Behind the Scenes', desc: 'Show how your business operates day to day' },
  { key: 'promo', label: '🎉 Promotions & Deals', desc: 'Announce specials, sales, and new offerings' },
  { key: 'story', label: '📖 Brand Story', desc: 'Tell your business story and what makes you unique' },
  { key: 'hero', label: '🦸 Hero Character', desc: 'Your AI character as a strong brand persona' },
]
const TONES = ['Professional', 'Casual & Friendly', 'Energetic & Fun', 'Inspiring', 'Educational']

export default function ClientVideos() {
  const [client, setClient] = useState<any>(null)
  const [characters, setCharacters] = useState<any[]>([])
  const [series, setSeries] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [tab, setTab] = useState<'characters'|'series'|'library'>('characters')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [businessProfile, setBusinessProfile] = useState<any>(null)

  // Character creation
  const [showCreateChar, setShowCreateChar] = useState(false)
  const [charType, setCharType] = useState<'clone'|'stock'>('clone')
  const [charName, setCharName] = useState('')
  const [charRole, setCharRole] = useState('')
  const [charFile, setCharFile] = useState<File|null>(null)
  const [voiceFile, setVoiceFile] = useState<File|null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [charCreating, setCharCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const voiceRef = useRef<HTMLInputElement>(null)

  // Series creation
  const [showCreateSeries, setShowCreateSeries] = useState(false)
  const [seriesStep, setSeriesStep] = useState(1)
  const [seriesForm, setSeriesForm] = useState({ name: '', theme: '', tone: 'Casual & Friendly', desc: '', episodes: 3, selectedChars: [] as string[] })
  const [scripts, setScripts] = useState<string[]>([])
  const [selectedScript, setSelectedScript] = useState(0)
  const [seriesTerms, setSeriesTerms] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const { data: c } = await sb.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (c) {
        setClient(c)
        const [ch, s, v] = await Promise.all([
          sb.from('client_ai_characters').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
          sb.from('client_video_series').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
          sb.from('client_videos').select('*').eq('client_id', c.id).order('created_at', { ascending: false }).limit(30),
          sb.from('client_business_profiles').select('*').eq('client_id', c.id).maybeSingle()
        ])
        if (ch.data) setCharacters(ch.data)
        if (s.data) setSeries(s.data)
        if (v.data) setVideos(v.data)
      }
      setLoading(false)
    })
  }, [])

  const reload = async () => {
    if (!client) return
    const [ch, s, v] = await Promise.all([
      sb.from('client_ai_characters').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
      sb.from('client_video_series').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
      sb.from('client_videos').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(30)
    ])
    if (ch.data) setCharacters(ch.data)
    if (s.data) setSeries(s.data)
    if (v.data) setVideos(v.data)
  }

  // ── CREATE CHARACTER ─────────────────────────────────────
  const createCharacter = async () => {
    if (!termsAccepted) { setMsg('Please accept the terms to clone your likeness.'); return }
    if (!charName) { setMsg('Please enter a name for this character.'); return }
    setCharCreating(true); setMsg('')

    let avatarId = 'Tyler-incasualsuit-20220721' // default stock
    let voiceId = 'f4ae3907c6e5446ea1daeab0c2f82bd5' // default voice

    if (charType === 'clone' && charFile) {
      // Upload to HeyGen Instant Avatar
      const form = new FormData()
      form.append('video', charFile)
      form.append('name', charName)

      const res = await fetch('/api/heygen/clone-avatar', {
        method: 'POST',
        body: form
      })
      const data = await res.json()
      if (data.avatarId) avatarId = data.avatarId
      else { setMsg('Avatar upload failed: ' + (data.error || 'Try a clearer video')); setCharCreating(false); return }
    }

    if (charType === 'clone' && voiceFile) {
      // Clone voice
      const form = new FormData()
      form.append('audio', voiceFile)
      form.append('name', charName + ' voice')

      const res = await fetch('/api/heygen/clone-voice', {
        method: 'POST',
        body: form
      })
      const data = await res.json()
      if (data.voiceId) voiceId = data.voiceId
    }

    // Save character to DB
    const { data: char, error } = await sb.from('client_ai_characters').insert({
      client_id: client.id,
      character_name: charName,
      heygen_avatar_id: avatarId,
      business_description: charRole,
      tone: seriesForm.tone,
      terms_accepted_at: new Date().toISOString(),
      niche: charType === 'clone' ? 'cloned' : 'stock',
    }).select().single()

    if (error) { setMsg('Error saving character: ' + error.message); setCharCreating(false); return }

    setMsg(`✓ ${charName} created! You can now use them in a video series.`)
    setShowCreateChar(false)
    setCharName(''); setCharRole(''); setCharFile(null); setVoiceFile(null); setTermsAccepted(false); setCharType('clone')
    await reload()
    setCharCreating(false)
  }

  // ── GENERATE SCRIPTS ─────────────────────────────────────
  const generateScripts = async () => {
    setGenerating(true)
    const selectedCharNames = seriesForm.selectedChars.map(id => characters.find(c => c.id === id)?.character_name).filter(Boolean)

    const res = await fetch('/api/videos/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: client?.business_name,
        businessProfile,
        seriesName: seriesForm.name,
        theme: SERIES_THEMES.find(t => t.key === seriesForm.theme)?.desc,
        tone: seriesForm.tone,
        businessDesc: seriesForm.desc,
        episodes: seriesForm.episodes,
        characters: selectedCharNames,
      })
    })
    const data = await res.json()
    setScripts(data.scripts || [])
    setSeriesStep(4)
    setGenerating(false)
  }

  // ── START VIDEO GENERATION ────────────────────────────────
  const startVideoGen = async () => {
    if (!seriesTerms) { setMsg('Please accept the terms.'); return }
    setGenerating(true); setMsg('')

    // Create series record
    const { data: newSeries } = await sb.from('client_video_series').insert({
      client_id: client.id,
      series_name: seriesForm.name,
      series_theme: seriesForm.theme,
      episode_count: scripts.length,
    }).select().single()

    // Generate one video per script, rotating through selected characters
    const chars = seriesForm.selectedChars.length > 0
      ? seriesForm.selectedChars.map(id => characters.find(c => c.id === id)).filter(Boolean)
      : [null]

    let successCount = 0
    for (let i = 0; i < scripts.length; i++) {
      const char = chars[i % chars.length]
      const res = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          characterId: char?.id,
          seriesId: newSeries?.id,
          script: scripts[i],
          episodeNumber: i + 1,
          avatarId: char?.heygen_avatar_id,
        })
      })
      const data = await res.json()
      if (data.videoId) successCount++
    }

    setMsg(`✓ ${successCount} video${successCount > 1 ? 's' : ''} generating! Check your library in 5–10 minutes.`)
    setShowCreateSeries(false)
    setSeriesStep(1)
    setSeriesForm({ name: '', theme: '', tone: 'Casual & Friendly', desc: '', episodes: 3, selectedChars: [] })
    setScripts([])
    setSeriesTerms(false)
    await reload()
    setTab('library')
    setGenerating(false)
  }

  if (loading) return <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'var(--text-2)'}}>Loading...</div></div>

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>

      {/* CREATE CHARACTER MODAL */}
      {showCreateChar && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div className="card slide-up" style={{width:500,maxHeight:'92vh',overflowY:'auto',position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{fontSize:20,fontWeight:700}}>Create AI Character</h3>
              <button onClick={()=>setShowCreateChar(false)} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:22}}>×</button>
            </div>
            {msg && <div className="alert alert-error" style={{marginBottom:14}}>{msg}</div>}

            {/* Type selector */}
            <div style={{display:'flex',background:'var(--bg-3)',borderRadius:9,padding:3,marginBottom:20,gap:3}}>
              {[['clone','🧑 Clone Yourself'],['stock','🎭 Use Stock Avatar']].map(([v,l])=>(
                <button key={v} onClick={()=>setCharType(v as any)} style={{flex:1,padding:'9px 0',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',border:'none',fontFamily:'inherit',background:charType===v?'var(--bg)':'transparent',color:charType===v?'var(--text)':'var(--text-3)',transition:'all 0.15s',boxShadow:charType===v?'var(--shadow)':'none'}}>{l}</button>
              ))}
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Character name *</label>
                <input className="input" value={charName} onChange={e=>setCharName(e.target.value)} placeholder="e.g. Sarah (Owner), Jake (Chef), Brand Rep"/>
              </div>
              <div>
                <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Role / description</label>
                <input className="input" value={charRole} onChange={e=>setCharRole(e.target.value)} placeholder="e.g. Head chef who shares cooking tips"/>
              </div>

              {charType === 'clone' && (
                <>
                  <div style={{background:'var(--bg-3)',borderRadius:10,padding:14}}>
                    <div style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:6}}>📹 Face Video</div>
                    <p style={{fontSize:13,color:'var(--text-2)',marginBottom:12,lineHeight:1.6}}>Upload a 30–60 second video of yourself looking at the camera, speaking clearly. Good lighting, no hats or sunglasses. HeyGen will clone your likeness.</p>
                    <input ref={fileRef} type="file" accept="video/*" style={{display:'none'}} onChange={e=>setCharFile(e.target.files?.[0]||null)}/>
                    <button className="btn btn-ghost btn-sm" onClick={()=>fileRef.current?.click()}>
                      {charFile ? `✓ ${charFile.name}` : '+ Upload face video'}
                    </button>
                  </div>

                  <div style={{background:'var(--bg-3)',borderRadius:10,padding:14}}>
                    <div style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:6}}>🎙️ Voice Clone <span style={{fontSize:12,color:'var(--text-3)',fontWeight:400}}>(optional)</span></div>
                    <p style={{fontSize:13,color:'var(--text-2)',marginBottom:12,lineHeight:1.6}}>Upload 30+ seconds of clear audio of your voice. If skipped, a professional matching voice will be used.</p>
                    <input ref={voiceRef} type="file" accept="audio/*,video/*" style={{display:'none'}} onChange={e=>setVoiceFile(e.target.files?.[0]||null)}/>
                    <button className="btn btn-ghost btn-sm" onClick={()=>voiceRef.current?.click()}>
                      {voiceFile ? `✓ ${voiceFile.name}` : '+ Upload voice sample'}
                    </button>
                  </div>
                </>
              )}

              {charType === 'stock' && (
                <div style={{background:'var(--bg-3)',borderRadius:10,padding:14}}>
                  <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6}}>A professional stock avatar will be assigned to this character. The script and voice will be personalized to your business.</p>
                </div>
              )}

              {/* Terms */}
              <div style={{background:'var(--bg-3)',borderRadius:10,padding:14,borderLeft:'3px solid var(--accent)'}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:8}}>AI Likeness Terms of Use</div>
                <p style={{fontSize:12,color:'var(--text-2)',lineHeight:1.6,marginBottom:12}}>
                  By creating this AI character, you confirm: (1) You have full rights to any face, voice, or likeness used. (2) You will not use this to impersonate, deceive, or create harmful content. (3) This character is for legitimate business promotion only. (4) You accept our <Link href="/terms" target="_blank" style={{color:'var(--accent)'}}>Terms of Service</Link>.
                </p>
                <div className="policy-check">
                  <input type="checkbox" id="char-terms" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)}/>
                  <label htmlFor="char-terms" style={{fontSize:13,fontWeight:500}}>I agree and confirm I have the rights to use this likeness.</label>
                </div>
              </div>

              <button className="btn btn-primary" style={{padding:13,fontSize:15}} onClick={createCharacter} disabled={charCreating||!charName||!termsAccepted||( charType==='clone'&&!charFile)}>
                {charCreating ? 'Creating...' : 'Create Character →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE SERIES MODAL */}
      {showCreateSeries && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div className="card slide-up" style={{width:540,maxHeight:'92vh',overflowY:'auto',position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{fontSize:20,fontWeight:700}}>New Video Series</h3>
              <button onClick={()=>{setShowCreateSeries(false);setSeriesStep(1)}} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:22}}>×</button>
            </div>

            {/* Progress */}
            <div style={{display:'flex',gap:4,marginBottom:24}}>
              {[1,2,3,4,5].map(n=><div key={n} style={{flex:1,height:3,borderRadius:2,background:n<=seriesStep?'var(--accent)':'var(--bg-4)',transition:'background 0.3s'}}/>)}
            </div>

            {seriesStep===1 && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <h4 style={{fontSize:16,fontWeight:600}}>Name & Theme</h4>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Series name *</label>
                  <input className="input" value={seriesForm.name} onChange={e=>setSeriesForm(f=>({...f,name:e.target.value}))} placeholder={`e.g. "${client?.business_name} Tips" or "Behind the Scenes"`}/>
                </div>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:8,fontWeight:600}}>Theme *</label>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {SERIES_THEMES.map(t=>(
                      <div key={t.key} onClick={()=>setSeriesForm(f=>({...f,theme:t.key}))} style={{padding:'12px 16px',borderRadius:10,cursor:'pointer',border:'1px solid',borderColor:seriesForm.theme===t.key?'var(--accent)':'var(--border)',background:seriesForm.theme===t.key?'var(--accent-dim)':'var(--bg-3)',transition:'all 0.15s'}}>
                        <div style={{fontSize:14,fontWeight:600,color:seriesForm.theme===t.key?'var(--accent)':'var(--text)'}}>{t.label}</div>
                        <div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{t.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary" style={{padding:12,fontSize:15}} onClick={()=>setSeriesStep(2)} disabled={!seriesForm.name||!seriesForm.theme}>Next →</button>
              </div>
            )}

            {seriesStep===2 && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <h4 style={{fontSize:16,fontWeight:600}}>Choose Characters</h4>
                <p style={{fontSize:13,color:'var(--text-2)'}}>Pick one or more characters to appear in this series. Multiple characters will rotate through episodes.</p>
                {characters.length === 0 ? (
                  <div style={{background:'var(--bg-3)',borderRadius:10,padding:16,textAlign:'center'}}>
                    <p style={{fontSize:13,color:'var(--text-2)',marginBottom:12}}>No characters yet. Create one first or use a stock avatar.</p>
                    <button className="btn btn-outline btn-sm" onClick={()=>{setShowCreateSeries(false);setShowCreateChar(true)}}>Create Character</button>
                  </div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {characters.map(c=>(
                      <div key={c.id} onClick={()=>setSeriesForm(f=>({...f,selectedChars:f.selectedChars.includes(c.id)?f.selectedChars.filter(id=>id!==c.id):[...f.selectedChars,c.id]}))} style={{padding:'12px 16px',borderRadius:10,cursor:'pointer',border:'1px solid',borderColor:seriesForm.selectedChars.includes(c.id)?'var(--accent)':'var(--border)',background:seriesForm.selectedChars.includes(c.id)?'var(--accent-dim)':'var(--bg-3)',display:'flex',alignItems:'center',gap:12,transition:'all 0.15s'}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:'var(--accent-dim)',border:'2px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'var(--accent)',flexShrink:0}}>
                          {c.character_name[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:seriesForm.selectedChars.includes(c.id)?'var(--accent)':'var(--text)'}}>{c.character_name}</div>
                          <div style={{fontSize:12,color:'var(--text-3)'}}>{c.niche==='cloned'?'Cloned avatar':'Stock avatar'} · {c.business_description||'No role set'}</div>
                        </div>
                        {seriesForm.selectedChars.includes(c.id) && <div style={{marginLeft:'auto',color:'var(--accent)',fontSize:16}}>✓</div>}
                      </div>
                    ))}
                    <div style={{fontSize:12,color:'var(--text-3)',marginTop:4}}>No character selected = stock avatar will be used.</div>
                  </div>
                )}
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setSeriesStep(1)}>← Back</button>
                  <button className="btn btn-primary" style={{flex:2,padding:12}} onClick={()=>setSeriesStep(3)}>Next →</button>
                </div>
              </div>
            )}

            {seriesStep===3 && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <h4 style={{fontSize:16,fontWeight:600}}>Customize Style</h4>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>About your business (optional)</label>
                  <textarea className="input" value={seriesForm.desc} onChange={e=>setSeriesForm(f=>({...f,desc:e.target.value}))} rows={3} placeholder="What makes you special, key products/services, anything specific to include..."/>
                </div>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:8,fontWeight:600}}>Tone</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                    {TONES.map(t=>(
                      <button key={t} onClick={()=>setSeriesForm(f=>({...f,tone:t}))} style={{padding:'8px 14px',borderRadius:20,fontSize:13,cursor:'pointer',border:'1px solid',borderColor:seriesForm.tone===t?'var(--accent)':'var(--border-2)',background:seriesForm.tone===t?'var(--accent-dim)':'transparent',color:seriesForm.tone===t?'var(--accent)':'var(--text-2)',fontFamily:'inherit',fontWeight:500}}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:8,fontWeight:600}}>Episodes to generate</label>
                  <div style={{display:'flex',gap:8}}>
                    {[1,3,5,10].map(n=>(
                      <button key={n} onClick={()=>setSeriesForm(f=>({...f,episodes:n}))} style={{padding:'10px 18px',borderRadius:9,fontSize:14,cursor:'pointer',border:'1px solid',borderColor:seriesForm.episodes===n?'var(--accent)':'var(--border-2)',background:seriesForm.episodes===n?'var(--accent-dim)':'transparent',color:seriesForm.episodes===n?'var(--accent)':'var(--text-2)',fontFamily:'inherit',fontWeight:600}}>{n}</button>
                    ))}
                  </div>
                  <p style={{fontSize:12,color:'var(--text-3)',marginTop:6}}>Each episode = 1 HeyGen credit from your balance.</p>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setSeriesStep(2)}>← Back</button>
                  <button className="btn btn-primary" style={{flex:2,padding:12}} onClick={generateScripts} disabled={generating}>{generating?'Writing scripts...':'Generate Scripts →'}</button>
                </div>
              </div>
            )}

            {seriesStep===4 && scripts.length>0 && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <h4 style={{fontSize:16,fontWeight:600}}>Review Scripts ({scripts.length} episodes)</h4>
                <p style={{fontSize:13,color:'var(--text-2)'}}>All scripts will be turned into videos. Pick which one to preview.</p>
                <div style={{display:'flex',flexDirection:'column',gap:9,maxHeight:280,overflowY:'auto'}}>
                  {scripts.map((script,i)=>(
                    <div key={i} onClick={()=>setSelectedScript(i)} style={{padding:'14px 16px',borderRadius:10,cursor:'pointer',border:'1px solid',borderColor:selectedScript===i?'var(--accent)':'var(--border)',background:selectedScript===i?'var(--accent-dim)':'var(--bg-3)',transition:'all 0.15s'}}>
                      <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Episode {i+1} {selectedScript===i?'· Selected':''}</div>
                      <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,margin:0}}>{script}</p>
                    </div>
                  ))}
                </div>

                {/* Terms */}
                <div style={{background:'var(--bg-3)',borderRadius:10,padding:14,borderLeft:'3px solid var(--accent)'}}>
                  <div className="policy-check">
                    <input type="checkbox" id="series-terms" checked={seriesTerms} onChange={e=>setSeriesTerms(e.target.checked)}/>
                    <label htmlFor="series-terms" style={{fontSize:13,fontWeight:500}}>I agree to the <Link href="/terms" target="_blank" style={{color:'var(--accent)'}}>AI Video Terms</Link>. This content is for legitimate business promotion and I take responsibility for it.</label>
                  </div>
                </div>

                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setSeriesStep(3)}>← Back</button>
                  <button className="btn btn-primary" style={{flex:2,padding:12,fontSize:15}} onClick={startVideoGen} disabled={generating||!seriesTerms}>{generating?'Generating...':'Generate All Videos →'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100,flexWrap:'wrap',gap:10}}>
        <div style={{fontFamily:'Outfit,sans-serif',fontSize:17,fontWeight:800,letterSpacing:'-0.04em'}}>wovo<span style={{color:'var(--accent)'}}>media</span><span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>AI Video Studio</span></div>
        <div style={{display:'flex',gap:4}}>
          {(['characters','series','library'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?'var(--accent-dim)':'transparent',border:'1px solid',borderColor:tab===t?'var(--accent-border)':'transparent',color:tab===t?'var(--accent)':'var(--text-2)',padding:'7px 12px',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:600,textTransform:'capitalize'}}>
              {t==='characters'?'Characters':t==='series'?'Series':'Library'}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <Link href="/dashboard/client"><button className="btn btn-ghost btn-sm">← Dashboard</button></Link>
          <ThemeToggle/>
        </div>
      </nav>

      <div style={{maxWidth:820,margin:'0 auto',padding:'32px 20px',position:'relative',zIndex:2}}>
        {msg && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`} style={{marginBottom:20}}>{msg}<button onClick={()=>setMsg('')} style={{float:'right',background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:16}}>×</button></div>}

        {/* CHARACTERS TAB */}
        {tab==='characters' && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <div>
                <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>AI Characters</h1>
                <p style={{fontSize:14,color:'var(--text-2)'}}>Clone yourself, team members, or use a stock avatar for your videos.</p>
              </div>
              <button className="btn btn-primary" onClick={()=>setShowCreateChar(true)}>+ Add Character</button>
            </div>

            {characters.length===0 ? (
              <div className="card" style={{textAlign:'center',padding:'52px 32px'}}>
                <div style={{fontSize:48,marginBottom:16}}>🧑‍💼</div>
                <h3 style={{fontSize:20,fontWeight:700,marginBottom:10}}>No characters yet</h3>
                <p style={{color:'var(--text-2)',marginBottom:24,lineHeight:1.65,maxWidth:400,margin:'0 auto 24px'}}>Create an AI character by cloning your face and voice, or pick a stock avatar. Then use characters in your video series.</p>
                <button className="btn btn-primary" style={{padding:'12px 24px'}} onClick={()=>setShowCreateChar(true)}>Create First Character →</button>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}} className="grid-2">
                {characters.map(c=>(
                  <div key={c.id} className="card" style={{padding:'20px 22px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                      <div style={{width:48,height:48,borderRadius:'50%',background:'var(--accent-dim)',border:'2px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:'var(--accent)',flexShrink:0}}>
                        {c.character_name[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>{c.character_name}</div>
                        <div style={{fontSize:12,color:'var(--text-3)'}}>{c.niche==='cloned'?'🧬 Cloned':'🎭 Stock avatar'}</div>
                      </div>
                    </div>
                    {c.business_description && <p style={{fontSize:13,color:'var(--text-2)',marginBottom:12,lineHeight:1.5}}>{c.business_description}</p>}
                    <button className="btn btn-outline btn-sm" onClick={()=>{setSeriesForm(f=>({...f,selectedChars:[c.id]}));setShowCreateSeries(true)}}>
                      Use in Series →
                    </button>
                  </div>
                ))}
                <div className="card" style={{padding:'20px 22px',border:'2px dashed var(--border)',background:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:120}} onClick={()=>setShowCreateChar(true)}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:24,marginBottom:6}}>+</div>
                    <div style={{fontSize:13,color:'var(--text-3)',fontWeight:500}}>Add character</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* SERIES TAB */}
        {tab==='series' && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <div>
                <h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>Video Series</h1>
                <p style={{fontSize:14,color:'var(--text-2)'}}>Group related videos into a series. AI writes the scripts, your characters star in them.</p>
              </div>
              <button className="btn btn-primary" onClick={()=>setShowCreateSeries(true)}>+ New Series</button>
            </div>
            {series.length===0 ? (
              <div className="card" style={{textAlign:'center',padding:'52px 32px'}}>
                <div style={{fontSize:48,marginBottom:16}}>🎬</div>
                <h3 style={{fontSize:20,fontWeight:700,marginBottom:10}}>No series yet</h3>
                <p style={{color:'var(--text-2)',marginBottom:24,lineHeight:1.65}}>Create a video series and Wovo AI will write the scripts and generate the videos for you. AI-written captions included.</p>
                <button className="btn btn-primary" onClick={()=>setShowCreateSeries(true)}>Create First Series →</button>
              </div>
            ) : series.map(s=>(
              <div key={s.id} className="card" style={{marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px'}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>{s.series_name}</div>
                  <div style={{fontSize:13,color:'var(--text-3)',marginTop:3}}>{SERIES_THEMES.find(t=>t.key===s.series_theme)?.label||s.series_theme} · {s.episode_count} episodes · {new Date(s.created_at).toLocaleDateString()}</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={()=>setTab('library')}>View Videos</button>
              </div>
            ))}
          </>
        )}

        {/* LIBRARY TAB */}
        {tab==='library' && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <h1 style={{fontSize:24,fontWeight:700}}>Video Library</h1>
              <button className="btn btn-ghost btn-sm" onClick={reload}>↻ Refresh</button>
            </div>
            {videos.length===0 ? (
              <div className="card" style={{textAlign:'center',padding:'48px 32px',color:'var(--text-3)'}}>No videos yet — create a series to get started.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {videos.map(v=>(
                  <div key={v.id} className="card" style={{padding:'18px 20px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
                          <span className={`badge ${v.status==='completed'?'badge-green':v.status==='generating'?'badge-accent':'badge-gray'}`}>
                            {v.status==='completed'?'✓ Ready':v.status==='generating'?'⏳ Generating':'Pending'}
                          </span>
                          {v.episode_number && <span style={{fontSize:12,color:'var(--text-3)'}}>Ep. {v.episode_number}</span>}
                          <span style={{fontSize:11,color:'var(--text-3)'}}>{new Date(v.created_at).toLocaleDateString()}</span>
                        </div>
                        {v.script && <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,marginBottom:v.caption?12:0,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{v.script}</p>}
                        {v.caption && (
                          <div style={{background:'var(--bg-3)',borderRadius:8,padding:'10px 14px'}}>
                            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:4,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>AI Caption</div>
                            <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,margin:0}}>{v.caption}</p>
                            <button onClick={()=>{navigator.clipboard.writeText(v.caption);setMsg('✓ Caption copied!')}} className="btn btn-ghost btn-sm" style={{marginTop:8,fontSize:11}}>Copy Caption</button>
                          </div>
                        )}
                      </div>
                      {v.video_url && (
                        <a href={v.video_url} target="_blank" rel="noreferrer" style={{flexShrink:0}}>
                          <button className="btn btn-primary btn-sm">Download</button>
                        </a>
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
