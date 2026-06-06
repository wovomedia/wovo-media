'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

export default function AdminVideoGen() {
  const [clients, setClients] = useState<any[]>([])
  const [clientId, setClientId] = useState('')
  const [avatars, setAvatars] = useState<any[]>([])
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [script, setScript] = useState('')
  const [style, setStyle] = useState('Professional')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [videoId, setVideoId] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { window.location.replace('/login'); return }
      const role = session?.user?.user_metadata?.wovo_role
      if (!role || !['owner','admin'].includes(role)) { window.location.replace('/home'); return }
      if (!session?.user) { window.location.replace('/login'); return }
      Promise.all([
        supabase.from('clients').select('id,business_name').eq('is_active',true).order('business_name'),
        supabase.from('client_videos').select('*').order('created_at',{ascending:false}).limit(20)
      ]).then(([c,v])=>{
        setClients(c.data||[])
        setHistory(v.data||[])
      })
      // Load avatars from HeyGen
      fetch('/api/heygen/avatars').then(r=>r.json()).then(d=>setAvatars(d.avatars||[]))
    })
  }, [])

  const generate = async () => {
    if (!script.trim()) return
    setGenerating(true); setError(''); setVideoId(''); setVideoUrl('')
    const res = await fetch('/api/videos/generate', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ script, style, avatarId: selectedAvatar, clientId })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error||'Generation failed'); setGenerating(false); return }
    setVideoId(data.videoId)
    // Poll for completion
    const poll = setInterval(async () => {
      const r = await fetch(`/api/videos/generate?id=${data.videoId}`)
      const d = await r.json()
      if (d.status === 'completed' && d.videoUrl) {
        setVideoUrl(d.videoUrl)
        setGenerating(false)
        clearInterval(poll)
        // Refresh history
        const {data:v} = await supabase.from('client_videos').select('*').order('created_at',{ascending:false}).limit(20)
        setHistory(v||[])
      } else if (d.status === 'failed') {
        setError('Video generation failed'); setGenerating(false); clearInterval(poll)
      }
    }, 5000)
  }

  const charCount = script.length
  const estDuration = Math.round(charCount / 15) || 0

  return (
    <AppShell>
      <div style={{padding:'24px 20px',maxWidth:1100,margin:'0 auto'}}>
        <h1 style={{fontFamily:'Outfit,sans-serif',fontSize:26,fontWeight:800,color:'var(--text)',marginBottom:4,letterSpacing:'-0.03em'}}>
          AI Video <span style={{color:'var(--accent)'}}>Generator</span>
        </h1>
        <p style={{color:'var(--text-3)',fontSize:14,marginBottom:24}}>Generate AI avatar videos for any client using HeyGen</p>

        <div style={{display:'grid',gridTemplateColumns:'400px 1fr',gap:20}}>
          {/* Controls */}
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="card" style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6,fontWeight:600}}>For client</label>
                <select className="input" value={clientId} onChange={e=>setClientId(e.target.value)}>
                  <option value="">No client (general)</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.business_name}</option>)}
                </select>
              </div>

              {avatars.length > 0 && (
                <div>
                  <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6,fontWeight:600}}>Avatar</label>
                  <select className="input" value={selectedAvatar} onChange={e=>setSelectedAvatar(e.target.value)}>
                    <option value="">Default avatar</option>
                    {avatars.map((a:any)=><option key={a.avatar_id} value={a.avatar_id}>{a.avatar_name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6,fontWeight:600}}>Video style</label>
                <div style={{display:'flex',gap:6}}>
                  {['Professional','Casual & Friendly','High Energy'].map(s=>(
                    <button key={s} onClick={()=>setStyle(s)} style={{flex:1,padding:'7px 0',borderRadius:8,fontSize:11,cursor:'pointer',border:'1px solid',fontFamily:'inherit',fontWeight:600,borderColor:style===s?'var(--accent)':'var(--border)',background:style===s?'var(--accent-dim)':'transparent',color:style===s?'var(--accent)':'var(--text-2)'}}>{s}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6,fontWeight:600}}>Script — what should the avatar say?</label>
                <textarea className="input" value={script} onChange={e=>setScript(e.target.value)}
                  placeholder="Write the exact script for the avatar to say. Keep it under 60 seconds for social media."
                  rows={6} style={{fontSize:13}}/>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:4}}>{charCount} chars · ~{estDuration}s video</div>
              </div>

              {error && <div className="alert alert-error" style={{fontSize:13}}>{error}</div>}

              <button className="btn btn-primary btn-block" onClick={generate} disabled={generating||!script.trim()} style={{padding:13,fontSize:14}}>
                {generating ? (
                  <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                    <span style={{width:15,height:15,border:'2px solid rgba(0,0,0,0.25)',borderTopColor:'#080808',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/>
                    {videoId ? 'Rendering...' : 'Generating...'}
                  </span>
                ) : 'Generate Video ✨'}
              </button>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              {generating && <p style={{fontSize:11,color:'var(--text-3)',textAlign:'center'}}>HeyGen renders in 2–5 minutes. Stay on this page.</p>}
            </div>
          </div>

          {/* Results + History */}
          <div>
            {videoUrl && (
              <div className="card" style={{marginBottom:20}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <h3 style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>🎬 Video Ready!</h3>
                  <a href={videoUrl} download target="_blank" rel="noreferrer"><button className="btn btn-primary btn-sm">⬇ Download</button></a>
                </div>
                <video src={videoUrl} controls style={{width:'100%',borderRadius:8,background:'#000'}}/>
              </div>
            )}

            <h3 style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:12}}>Recent Videos</h3>
            {history.length === 0 && <div className="card" style={{textAlign:'center',color:'var(--text-3)',fontSize:13,padding:32}}>No videos generated yet</div>}
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {history.map((v,i)=>(
                <div key={i} className="card" style={{display:'flex',alignItems:'center',gap:14,padding:'12px 14px'}}>
                  <div style={{width:60,height:60,background:'var(--bg-3)',borderRadius:8,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {(v.permanent_url||v.video_url) ? <video src={v.permanent_url||v.video_url} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <i className="ti ti-video" style={{fontSize:22,color:'var(--text-3)'}}/>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,color:'var(--text)',fontWeight:600,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.title||'AI Video'}</div>
                    <div style={{fontSize:11,color:'var(--text-3)'}}>{v.style||'Standard'} · {new Date(v.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`badge ${v.status==='completed'?'badge-green':v.status==='failed'?'badge-red':'badge-amber'}`}>{v.status||'pending'}</span>
                  {(v.permanent_url||v.video_url) && v.status==='completed' && (
                    <a href={v.permanent_url||v.video_url} target="_blank" rel="noreferrer"><button className="btn btn-ghost btn-sm">View</button></a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
