'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

const MAIN = ''

export default function Studio() {
  const [client, setClient] = useState<any>(null)
  const [credits, setCredits] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [tab, setTab] = useState<'remix'|'images'|'credits'>('remix')
  const [remixUrl, setRemixUrl] = useState('')
  const [remixResult, setRemixResult] = useState<any>(null)
  const [remixing, setRemixing] = useState(false)
  const [imgDesc, setImgDesc] = useState('')
  const [imgResult, setImgResult] = useState<any>(null)
  const [imgLoading, setImgLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const data = { user: session?.user }
      if (!data.user) { window.location.replace('/login'); return }
      const role = data.user.user_metadata?.wovo_role
      if (role === 'owner' || role === 'admin') { setIsOwner(true); setIsActive(true) }
      const { data: c } = await supabase.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (c) {
        setClient(c); setIsActive(c.is_active)
        const { data: cr } = await supabase.from('client_credits').select('balance').eq('client_id', c.id).single()
        setCredits((cr as any)?.balance || 0)
      }
    })
  }, [])

  const doRemix = async () => {
    if (!remixUrl.trim()) return
    setRemixing(true); setRemixResult(null)
    const res = await fetch(`/api/remix`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: remixUrl, clientId: client?.id })
    })
    const data = await res.json()
    if (res.status === 403) { setMsg('Active subscription required.'); setRemixing(false); return }
    setRemixResult(data); setRemixing(false)
  }

  const doImage = async () => {
    if (!imgDesc.trim()) return
    setImgLoading(true); setImgResult(null)
    const res = await fetch(`/api/images/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client?.id, description: imgDesc, type: 'ad' })
    })
    const data = await res.json()
    setImgResult(data); setImgLoading(false)
  }

  return (
    <AppShell user={client}>
      <div style={{padding:'20px 16px 0'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div>
            <h1 className="page-title">Studio</h1>
            <p className="page-sub">⚡ {credits} credits</p>
          </div>
        </div>

        {!isActive ? (
          <div className="card card-accent" style={{textAlign:'center',padding:'40px 20px'}}>
            <div style={{fontSize:40,marginBottom:14}}>🎨</div>
            <h3 style={{fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:8}}>Studio requires a subscription</h3>
            <p style={{fontSize:13,color:'var(--text-2)',marginBottom:20,lineHeight:1.6}}>Video remixer, AI image ads, captions, and credits. Starting at $29/mo.</p>
            <a href={`/wovo-ai`} target="_blank" rel="noreferrer"><button className="btn btn-primary" style={{padding:'11px 28px'}}>See Plans →</button></a>
          </div>
        ) : (
          <>
            {msg && <div className="alert alert-error" style={{marginBottom:14}}>{msg}</div>}
            <div className="tab-row" style={{marginBottom:16}}>
              {(['remix','images','credits'] as const).map(t=>(
                <button key={t} className={`tab-item ${tab===t?'active':''}`} onClick={()=>setTab(t)} style={{textTransform:'capitalize'}}>{t==='remix'?'🔥 Remix':t==='images'?'🖼️ Images':'💳 Credits'}</button>
              ))}
            </div>

            {tab==='remix' && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div className="card card-accent" style={{padding:'14px 16px'}}>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--accent)',marginBottom:6}}>🔥 Video Remixer</div>
                  <p style={{fontSize:12,color:'var(--text-2)',marginBottom:12,lineHeight:1.5}}>Paste any TikTok, YouTube Short, or Reel. AI rewrites it for your business.</p>
                  <input className="input" value={remixUrl} onChange={e=>setRemixUrl(e.target.value)} placeholder="https://tiktok.com/@..."/>
                  <button className="btn btn-primary btn-block" style={{marginTop:10}} onClick={doRemix} disabled={remixing||!remixUrl}>
                    {remixing?'Remixing...':'Remix This Video →'}
                  </button>
                </div>
                {remixResult && (
                  <>
                    {remixResult.hook && (
                      <div className="card" style={{borderLeft:'3px solid var(--accent)'}}>
                        <div style={{fontSize:10,color:'var(--accent)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Opening Hook</div>
                        <p style={{fontSize:15,fontWeight:600,color:'var(--text)',lineHeight:1.5,margin:0}}>"{remixResult.hook}"</p>
                      </div>
                    )}
                    {remixResult.script && (
                      <div className="card">
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <div style={{fontSize:10,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>Remixed Script</div>
                          <button onClick={()=>navigator.clipboard.writeText(remixResult.script)} className="btn btn-ghost btn-sm" style={{fontSize:10,padding:'4px 10px'}}>Copy</button>
                        </div>
                        <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7,margin:0}}>{remixResult.script}</p>
                      </div>
                    )}
                    {remixResult.caption && (
                      <div className="card">
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <div style={{fontSize:10,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>Caption</div>
                          <button onClick={()=>navigator.clipboard.writeText(remixResult.caption)} className="btn btn-ghost btn-sm" style={{fontSize:10,padding:'4px 10px'}}>Copy</button>
                        </div>
                        <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,margin:0}}>{remixResult.caption}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {tab==='images' && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Describe your image *</label>
                  <textarea className="input" value={imgDesc} onChange={e=>setImgDesc(e.target.value)} placeholder="e.g. Our signature dish beautifully plated, warm lighting, rustic table setting..." rows={3}/>
                </div>
                <button className="btn btn-primary btn-block" onClick={doImage} disabled={imgLoading||!imgDesc}>
                  {imgLoading?'Generating image...':'Generate Image →'}
                </button>
                {imgResult && (
                  <div className="card">
                    {imgResult.imageUrl && imgResult.imageUrl !== 'pending' ? (
                      <img src={imgResult.imageUrl} alt="Generated" style={{width:'100%',borderRadius:8,marginBottom:12}}/>
                    ) : (
                      <div style={{background:'var(--bg-3)',borderRadius:8,aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12,flexDirection:'column',gap:8}}>
                        <span style={{fontSize:28}}>🖼️</span>
                        <p style={{fontSize:11,color:'var(--text-3)',textAlign:'center',padding:'0 16px'}}>Add FAL_API_KEY to enable image generation</p>
                      </div>
                    )}
                    {imgResult.caption && (
                      <>
                        <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,marginBottom:8}}>{imgResult.caption}</p>
                        <button onClick={()=>navigator.clipboard.writeText(imgResult.caption)} className="btn btn-ghost btn-sm" style={{fontSize:11}}>Copy Caption</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab==='credits' && (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div className="card card-accent" style={{textAlign:'center',padding:'24px'}}>
                  <div style={{fontSize:12,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Balance</div>
                  <div style={{fontFamily:'Outfit,sans-serif',fontSize:52,fontWeight:800,color:'var(--accent)',letterSpacing:'-0.04em',lineHeight:1}}>{credits}</div>
                  <div style={{fontSize:13,color:'var(--text-3)',marginTop:6}}>credits remaining</div>
                </div>
                <div className="grid-3">
                  {[['$5','5','https://pay.wovomedia.com/b/5kQeVdderfQfguo7IQcIE12',false],
                    ['$10','12','https://pay.wovomedia.com/b/aFa7sL7U733temg1kscIE13',true],
                    ['$25','35','https://pay.wovomedia.com/b/bJe9AT6Q3cE3emg0gocIE14',false]
                  ].map(([price,creds,url,popular])=>(
                    <a key={price as string} href={url as string} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                      <div style={{background:popular?'var(--accent-dim)':'var(--bg-3)',border:`1px solid ${popular?'var(--accent-border)':'var(--border)'}`,borderRadius:12,padding:'14px 10px',textAlign:'center',cursor:'pointer'}}>
                        {popular && <div style={{fontSize:9,color:'var(--accent)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Best</div>}
                        <div style={{fontSize:20,fontWeight:800,fontFamily:'Outfit,sans-serif',color:'var(--text)'}}>{price}</div>
                        <div style={{fontSize:13,fontWeight:700,color:'var(--accent)',marginTop:2}}>{creds}cr</div>
                        <button className={`btn btn-sm ${popular?'btn-primary':'btn-outline'}`} style={{marginTop:8,width:'100%',padding:'6px 0',fontSize:11}}>Buy</button>
                      </div>
                    </a>
                  ))}
                </div>
                <div className="card">
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Usage</div>
                  {[['🎬 Video generate','1 credit'],['🖼️ Image generate','1 credit'],['📝 Scripts','Free'],['💬 Captions','Free']].map(([f,v])=>(
                    <div key={f as string} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                      <span style={{color:'var(--text-2)'}}>{f}</span>
                      <span style={{color:'var(--text-3)',fontWeight:500}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
