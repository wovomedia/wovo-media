'use client'
import { useState, useEffect } from 'react'
import { supabase as sb } from '@/lib/supabase'
import Link from 'next/link'

const CREDIT_PACKS = [
  { credits: 5, price: '$5', label: 'Starter Pack', link: 'https://pay.wovomedia.com/b/5kQeVdderfQfguo7IQcIE12', bonus: '' },
  { credits: 12, price: '$10', label: 'Creator Pack', link: 'https://pay.wovomedia.com/b/aFa7sL7U733temg1kscIE13', bonus: '+2 bonus', popular: true },
  { credits: 35, price: '$25', label: 'Pro Pack', link: 'https://pay.wovomedia.com/b/bJe9AT6Q3cE3emg0gocIE14', bonus: '+10 bonus' },
]

const STYLES = ['Modern & Clean', 'Bold & Vibrant', 'Warm & Cozy', 'Minimal', 'Luxury', 'Fun & Playful']
const IMAGE_TYPES = [
  { key: 'food', label: '🍽️ Food Ad', desc: 'Make your menu look irresistible' },
  { key: 'product', label: '📦 Product Ad', desc: 'Showcase a product professionally' },
  { key: 'announcement', label: '📣 Announcement', desc: 'New hours, specials, events' },
  { key: 'promo', label: '💰 Promotion', desc: 'Sale, deal, or limited offer' },
  { key: 'custom', label: '✨ Custom', desc: 'Describe anything' },
]

export default function Studio() {
  const [client, setClient] = useState<any>(null)
  const [credits, setCredits] = useState(0)
  const [characters, setCharacters] = useState<any[]>([])
  const [tab, setTab] = useState<'remix'|'images'|'credits'>('remix')
  const [msg, setMsg] = useState('')

  // Remix state
  const [remixUrl, setRemixUrl] = useState('')
  const [remixInstructions, setRemixInstructions] = useState('')
  const [selectedChar, setSelectedChar] = useState<string>('')
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [remixing, setRemixing] = useState(false)
  const [remixResult, setRemixResult] = useState<any>(null)

  // Image state
  const [imgType, setImgType] = useState('food')
  const [imgDesc, setImgDesc] = useState('')
  const [imgStyle, setImgStyle] = useState('Modern & Clean')
  const [imgGenerating, setImgGenerating] = useState(false)
  const [imgResult, setImgResult] = useState<any>(null)
  const [images, setImages] = useState<any[]>([])

  useEffect(() => {
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const { data: c } = await sb.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (!c) { window.location.href = '/login'; return }
      // Gate: check active subscription
      const isClientActive = c.is_active
      if (!isClientActive) {
        const { data: activeSub } = await sb.from('wovo_subscriptions').select('status').eq('client_id', c.id).eq('status','active').maybeSingle()
        if (!activeSub) { window.location.href = '/dashboard/client'; return }
      }
      if (c) {
        setClient(c)
        const [cr, ch, imgs] = await Promise.all([
          sb.from('client_credits').select('balance').eq('client_id', c.id).single(),
          sb.from('client_ai_characters').select('*').eq('client_id', c.id),
          sb.from('client_images').select('*').eq('client_id', c.id).order('created_at', { ascending: false }).limit(20)
        ])
        setCredits((cr as any).data?.balance || 0)
        if (ch.data) setCharacters(ch.data)
        if (imgs.data) setImages(imgs.data)
      }
    })
  }, [])

  const doRemix = async () => {
    if (!remixUrl.trim()) { setMsg('Paste a TikTok or YouTube URL first.'); return }
    setRemixing(true); setRemixResult(null); setMsg('')
    const char = characters.find(c => c.id === selectedChar)
    const res = await fetch('/api/remix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: remixUrl,
        clientId: client.id,
        avatarId: autoGenerate && char ? char.heygen_avatar_id : null,
        customInstructions: remixInstructions
      })
    })
    const data = await res.json()
    setRemixResult(data)
    if (data.videoId) setMsg('✓ Video generating! Check your video library in 5–10 min.')
    setRemixing(false)
  }

  const doGenImage = async () => {
    if (!imgDesc.trim()) { setMsg('Describe what you want first.'); return }
    setImgGenerating(true); setImgResult(null); setMsg('')
    const res = await fetch('/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, description: imgDesc, type: imgType, style: imgStyle })
    })
    const data = await res.json()
    setImgResult(data)
    if (data.imageUrl && data.imageUrl !== 'pending') {
      setImages(prev => [{ image_url: data.imageUrl, caption: data.caption, prompt: imgDesc, created_at: new Date().toISOString() }, ...prev])
      setMsg('✓ Image generated!')
    } else {
      setMsg('Image generation requires a FAL API key. The caption is ready below.')
    }
    setImgGenerating(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100,flexWrap:'wrap',gap:10}}>
        <div style={{fontFamily:'Outfit,sans-serif',fontSize:17,fontWeight:800,letterSpacing:'-0.04em'}}>wovo<span style={{color:'var(--accent)'}}>media</span><span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>Creative Studio</span></div>
        <div style={{display:'flex',gap:4}}>
          {(['remix','images','credits'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?'var(--accent-dim)':'transparent',border:'1px solid',borderColor:tab===t?'var(--accent-border)':'transparent',color:tab===t?'var(--accent)':'var(--text-2)',padding:'7px 12px',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:600,textTransform:'capitalize'}}>
              {t==='remix'?'🔥 Remix':'images'===t?'🖼️ Images':'💳 Credits'}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{background:'var(--bg-3)',border:'1px solid var(--accent-border)',borderRadius:20,padding:'5px 14px',fontSize:13,fontWeight:600,color:'var(--accent)'}}>⚡ {credits} credits</div>
          <Link href="/dashboard/client"><button className="btn btn-ghost btn-sm">← Dashboard</button></Link>
          
        </div>
      </nav>

      <div style={{maxWidth:820,margin:'0 auto',padding:'32px 20px',position:'relative',zIndex:2}}>
        {msg && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`} style={{marginBottom:20}}>{msg}<button onClick={()=>setMsg('')} style={{float:'right',background:'none',border:'none',cursor:'pointer',color:'inherit'}}>×</button></div>}

        {/* REMIX TAB */}
        {tab==='remix' && (
          <>
            <div style={{marginBottom:24}}>
              <h1 style={{fontSize:24,fontWeight:700,marginBottom:6}}>🔥 Video Remixer</h1>
              <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.6}}>Paste any viral TikTok, YouTube Short, or Reel. Our AI analyzes what makes it work and rewrites it for your business — then generates it with your AI character.</p>
            </div>

            <div className="card" style={{marginBottom:16}}>
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Paste the video URL *</label>
                  <input className="input" value={remixUrl} onChange={e=>setRemixUrl(e.target.value)} placeholder="https://tiktok.com/@user/video/... or https://youtube.com/shorts/..."/>
                  <p style={{fontSize:12,color:'var(--text-3)',marginTop:5}}>Works with TikTok, YouTube Shorts, Instagram Reels, Twitter/X videos</p>
                </div>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Special instructions <span style={{fontWeight:400,color:'var(--text-3)'}}>(optional)</span></label>
                  <input className="input" value={remixInstructions} onChange={e=>setRemixInstructions(e.target.value)} placeholder="e.g. Make it about our Tuesday special, focus on the hook, use humor..."/>
                </div>
                {characters.length > 0 && (
                  <div>
                    <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:8,fontWeight:600}}>AI Character to star in it</label>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      <button onClick={()=>setSelectedChar('')} style={{padding:'8px 14px',borderRadius:20,fontSize:13,cursor:'pointer',border:'1px solid',borderColor:!selectedChar?'var(--accent)':'var(--border-2)',background:!selectedChar?'var(--accent-dim)':'transparent',color:!selectedChar?'var(--accent)':'var(--text-2)',fontFamily:'inherit',fontWeight:500}}>Script only</button>
                      {characters.map(c=>(
                        <button key={c.id} onClick={()=>setSelectedChar(c.id)} style={{padding:'8px 14px',borderRadius:20,fontSize:13,cursor:'pointer',border:'1px solid',borderColor:selectedChar===c.id?'var(--accent)':'var(--border-2)',background:selectedChar===c.id?'var(--accent-dim)':'transparent',color:selectedChar===c.id?'var(--accent)':'var(--text-2)',fontFamily:'inherit',fontWeight:500}}>{c.character_name}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button className="btn btn-primary" style={{padding:13,fontSize:15}} onClick={doRemix} disabled={remixing||!remixUrl}>
                  {remixing ? '🔄 Analyzing & remixing...' : '🔥 Remix This Video →'}
                </button>
              </div>
            </div>

            {remixResult && (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {remixResult.analysis && (
                  <div className="card" style={{padding:'16px 20px',borderLeft:'3px solid var(--accent)'}}>
                    <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Why it works</div>
                    <p style={{fontSize:14,color:'var(--text-2)',margin:0,lineHeight:1.6}}>{remixResult.analysis}</p>
                  </div>
                )}
                {remixResult.hook && (
                  <div className="card" style={{padding:'16px 20px',background:'var(--accent-dim)',borderColor:'var(--accent-border)'}}>
                    <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Opening Hook (first 3 sec)</div>
                    <p style={{fontSize:16,fontWeight:600,color:'var(--text)',margin:0}}>"{remixResult.hook}"</p>
                  </div>
                )}
                {remixResult.script && (
                  <div className="card" style={{padding:'16px 20px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                      <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>Remixed Script</div>
                      <button onClick={()=>{navigator.clipboard.writeText(remixResult.script);setMsg('✓ Script copied!')}} className="btn btn-ghost btn-sm" style={{fontSize:11}}>Copy</button>
                    </div>
                    <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.7,margin:0}}>{remixResult.script}</p>
                  </div>
                )}
                {remixResult.caption && (
                  <div className="card" style={{padding:'14px 18px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em'}}>AI Caption</div>
                      <button onClick={()=>{navigator.clipboard.writeText(remixResult.caption);setMsg('✓ Caption copied!')}} className="btn btn-ghost btn-sm" style={{fontSize:11}}>Copy</button>
                    </div>
                    <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,margin:0}}>{remixResult.caption}</p>
                  </div>
                )}
                {remixResult.tips?.length > 0 && (
                  <div className="card" style={{padding:'14px 18px'}}>
                    <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Filming Tips</div>
                    {remixResult.tips.map((t: string, i: number) => (
                      <div key={i} style={{display:'flex',gap:8,fontSize:13,color:'var(--text-2)',marginTop:6}}><span style={{color:'var(--accent)',flexShrink:0}}>→</span>{t}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* IMAGES TAB */}
        {tab==='images' && (
          <>
            <div style={{marginBottom:24}}>
              <h1 style={{fontSize:24,fontWeight:700,marginBottom:6}}>🖼️ AI Image Generator</h1>
              <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.6}}>Generate professional ad images for social media. Food photos, product shots, announcements — described in words, delivered in seconds.</p>
            </div>

            <div className="card" style={{marginBottom:20}}>
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:8,fontWeight:600}}>What type of image?</label>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}} className="grid-2">
                    {IMAGE_TYPES.map(t=>(
                      <div key={t.key} onClick={()=>setImgType(t.key)} style={{padding:'10px 14px',borderRadius:9,cursor:'pointer',border:'1px solid',borderColor:imgType===t.key?'var(--accent)':'var(--border)',background:imgType===t.key?'var(--accent-dim)':'var(--bg-3)',transition:'all 0.15s'}}>
                        <div style={{fontSize:13,fontWeight:600,color:imgType===t.key?'var(--accent)':'var(--text)'}}>{t.label}</div>
                        <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{t.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Describe what you want *</label>
                  <textarea className="input" value={imgDesc} onChange={e=>setImgDesc(e.target.value)} rows={3} placeholder={imgType==='food'?'e.g. A plate of our signature tacos with fresh lime, cilantro, and colorful salsa. Rustic wood table, warm lighting.':imgType==='announcement'?'e.g. Grand opening celebration, balloons, excitement, our logo colors (teal and black)':'Describe exactly what you want in the image...'}/>
                </div>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:8,fontWeight:600}}>Visual style</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                    {STYLES.map(s=>(
                      <button key={s} onClick={()=>setImgStyle(s)} style={{padding:'7px 14px',borderRadius:20,fontSize:12,cursor:'pointer',border:'1px solid',borderColor:imgStyle===s?'var(--accent)':'var(--border-2)',background:imgStyle===s?'var(--accent-dim)':'transparent',color:imgStyle===s?'var(--accent)':'var(--text-2)',fontFamily:'inherit',fontWeight:500}}>{s}</button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary" style={{padding:13,fontSize:15}} onClick={doGenImage} disabled={imgGenerating||!imgDesc}>
                  {imgGenerating?'Generating image...':'Generate Image →'}
                </button>
              </div>
            </div>

            {imgResult && (
              <div className="card" style={{marginBottom:20}}>
                {imgResult.imageUrl && imgResult.imageUrl !== 'pending' ? (
                  <img src={imgResult.imageUrl} alt="Generated" style={{width:'100%',borderRadius:10,marginBottom:14}}/>
                ) : (
                  <div style={{background:'var(--bg-3)',borderRadius:10,aspectRatio:'1',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14,flexDirection:'column',gap:8}}>
                    <div style={{fontSize:32}}>🖼️</div>
                    <p style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:'0 20px'}}>Add a FAL API key (fal.ai) to your Vercel env vars to enable image generation.<br/>The caption below is ready.</p>
                  </div>
                )}
                {imgResult.caption && (
                  <div>
                    <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>AI Caption</div>
                    <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.6,marginBottom:10}}>{imgResult.caption}</p>
                    <button onClick={()=>{navigator.clipboard.writeText(imgResult.caption);setMsg('✓ Copied!')}} className="btn btn-ghost btn-sm">Copy Caption</button>
                  </div>
                )}
              </div>
            )}

            {images.length > 0 && (
              <>
                <h3 style={{fontSize:16,fontWeight:700,marginBottom:14}}>Previous Images</h3>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}} className="grid-3">
                  {images.filter(i=>i.image_url && i.image_url !== 'pending').map((img,i)=>(
                    <div key={i} style={{borderRadius:10,overflow:'hidden',border:'1px solid var(--border)',cursor:'pointer'}} onClick={()=>setImgResult(img)}>
                      <img src={img.image_url} alt="" style={{width:'100%',aspectRatio:'1',objectFit:'cover'}}/>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* CREDITS TAB */}
        {tab==='credits' && (
          <>
            <div style={{marginBottom:28}}>
              <h1 style={{fontSize:24,fontWeight:700,marginBottom:6}}>💳 Credits</h1>
              <p style={{fontSize:14,color:'var(--text-2)'}}>Credits power your AI video generation and image creation. 1 credit = 1 video or 1 image.</p>
            </div>

            <div className="card card-accent" style={{marginBottom:24,textAlign:'center',padding:'28px 24px'}}>
              <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Current Balance</div>
              <div style={{fontSize:56,fontWeight:800,fontFamily:'Outfit,sans-serif',color:'var(--accent)',letterSpacing:'-0.03em',lineHeight:1}}>{credits}</div>
              <div style={{fontSize:14,color:'var(--text-3)',marginTop:6}}>credits remaining</div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:28}} className="grid-3">
              {CREDIT_PACKS.map(pack=>(
                <div key={pack.credits} className={`card ${pack.popular?'card-accent':''}`} style={{textAlign:'center',position:'relative',padding:'20px 16px'}}>
                  {pack.popular && <div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'var(--accent)',color:'#080808',fontSize:10,fontWeight:700,padding:'3px 12px',borderRadius:20,whiteSpace:'nowrap'}}>Best value</div>}
                  <div style={{fontSize:28,fontWeight:800,fontFamily:'Outfit,sans-serif',color:'var(--text)',marginBottom:2}}>{pack.price}</div>
                  <div style={{fontSize:22,fontWeight:700,color:'var(--accent)',marginBottom:4}}>{pack.credits} credits</div>
                  {pack.bonus && <div style={{fontSize:12,color:'var(--accent)',fontWeight:600,marginBottom:10}}>{pack.bonus}</div>}
                  <div style={{fontSize:13,color:'var(--text-3)',marginBottom:14}}>{pack.label}</div>
                  <a href={pack.link} target="_blank" rel="noreferrer">
                    <button className={`btn ${pack.popular?'btn-primary':'btn-outline'}`} style={{width:'100%',padding:'10px 0',fontSize:13}}>Buy Now</button>
                  </a>
                </div>
              ))}
            </div>

            <div className="card" style={{padding:'18px 20px'}}>
              <h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Credit usage</h3>
              {[['🎬 AI video generation','1 credit per video'],['🖼️ Image generation','1 credit per image'],['🔥 Video remix','1 credit (if auto-generate is on)'],['📝 Script writing only','Free — no credits used'],['📋 Caption generation','Free — no credits used']].map(([f,v])=>(
                <div key={f} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                  <span style={{color:'var(--text-2)'}}>{f}</span>
                  <span style={{color:'var(--text-3)',fontWeight:500}}>{v}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
