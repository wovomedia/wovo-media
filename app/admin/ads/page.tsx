'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { supabase as sb } from '@/lib/supabase'

const ADS = [
  {
    key: 'awareness',
    label: '📢 Awareness Ad',
    desc: 'Introduce Wovo Media — what we do and why businesses need it',
    length: '~30 sec',
    best: 'Facebook, Instagram feed, YouTube pre-roll',
    hook: 'If your business isn\'t showing up online, you\'re losing customers every single day...',
  },
  {
    key: 'demo',
    label: '🎬 Demo / Walkthrough',
    desc: 'Show exactly how Wovo AI works step by step',
    length: '~45 sec',
    best: 'YouTube, Facebook, retargeting audiences',
    hook: 'Let me show you exactly how Wovo AI works...',
  },
  {
    key: 'conversion',
    label: '💰 Conversion Ad',
    desc: 'Hard sell — ROI focused, designed to get signups NOW',
    length: '~60 sec',
    best: 'Retargeting, email, warm audiences',
    hook: 'Here\'s a question — how much is one new customer worth to your business?',
  },
  {
    key: 'hook_tiktok',
    label: '🔥 TikTok Hook',
    desc: 'Short punchy POV hook — designed to stop the scroll',
    length: '~15 sec',
    best: 'TikTok, Instagram Reels, YouTube Shorts',
    hook: 'POV: your competitor just got four million views this month and you\'ve posted twice...',
  },
]

const FULL_SCRIPTS: Record<string, string> = {
  awareness: `If your business isn't showing up online, you're losing customers every single day. That's exactly why we built Wovo Media. We create content for local businesses using AI — posts, videos, captions — all done for you. Restaurants, boutiques, service businesses — businesses just like yours are getting millions of views every month with Wovo AI. And it starts at just twenty-nine dollars a month. No filming. No editing. No stress. Just consistent, professional content that grows your business. Go to wovomedia dot com and start today.`,
  demo: `Let me show you exactly how Wovo AI works. You go to wovomedia dot com, click "Find my plan," answer a few quick questions, and our AI guide Nova recommends the perfect plan for your business. Then you create your AI character — either clone your own face and voice, or pick a stock avatar. Next, you choose a video series — tips, behind the scenes, promos — whatever fits your brand. Our AI writes the scripts, generates the videos, and creates captions ready to copy and post. You get professional social media content every single week with zero effort. Try it at wovomedia dot com.`,
  conversion: `Here's a question. How much is one new customer worth to your business? Twenty dollars? Two hundred? Two thousand? Wovo AI gets you in front of hundreds of new people every week for twenty-nine dollars a month. That's less than a tank of gas. Our clients are hitting four million views a month. One restaurant we manage went from zero online presence to fully booked weekends in sixty days. This isn't magic — it's just consistent content, done right, every week. If you're ready to actually grow your business online, go to wovomedia dot com right now. Starter plan is twenty-nine a month. Growth is forty-nine for your whole team. Or book a free strategy call and we'll build a custom plan just for you. Don't wait — your competitors are already doing this.`,
  hook_tiktok: `POV: your competitor just got four million views this month and you've posted twice. That's the difference between having Wovo AI and not having it. We build an AI character for your business — your face, your voice — that posts content for you every single week while you run your business. Twenty-nine dollars a month. Go to wovomedia dot com.`,
}

export default function AdStudio() {
  const [selected, setSelected] = useState('demo')
  const [generating, setGenerating] = useState(false)
  const [videoId, setVideoId] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [status, setStatus] = useState<'idle'|'generating'|'polling'|'done'|'error'>('idle')
  const [copied, setCopied] = useState('')
  const pollRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { window.location.replace('/login'); return }
      const role = session?.user?.user_metadata?.wovo_role
      if (!role || !['owner','admin'].includes(role)) { window.location.replace('/home'); return }
    })
  }, [])

  useEffect(() => {
    // Check if any ads already exist
    checkExisting()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selected])

  const checkExisting = async () => {
    const { data } = await sb.from('nova_videos').select('*').eq('node_id', `ad_${selected}`).maybeSingle()
    if (data?.status === 'completed' && data?.video_url) {
      setVideoUrl(data.video_url)
      setVideoId(data.heygen_video_id)
      setStatus('done')
    } else if (data?.status === 'generating') {
      setVideoId(data.heygen_video_id)
      setStatus('polling')
      startPolling(data.heygen_video_id)
    } else {
      setVideoUrl('')
      setVideoId('')
      setStatus('idle')
    }
  }

  const generate = async () => {
    setGenerating(true)
    setStatus('generating')
    setVideoUrl('')
    const res = await fetch('/api/heygen/ad-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: selected })
    })
    const data = await res.json()
    if (data.videoUrl) { setVideoUrl(data.videoUrl); setStatus('done') }
    else if (data.videoId) { setVideoId(data.videoId); setStatus('polling'); startPolling(data.videoId) }
    else { setStatus('error') }
    setGenerating(false)
  }

  const startPolling = (vid: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/heygen/ad-video?id=${vid}&type=${selected}`)
      const data = await res.json()
      if (data.status === 'completed' && data.videoUrl) {
        setVideoUrl(data.videoUrl)
        setStatus('done')
        clearInterval(pollRef.current)
      } else if (data.status === 'failed') {
        setStatus('error')
        clearInterval(pollRef.current)
      }
    }, 5000)
  }

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const ad = ADS.find(a => a.key === selected)!
  const script = FULL_SCRIPTS[selected]

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 28px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100,flexWrap:'wrap',gap:10}}>
        <div style={{fontFamily:'Outfit,sans-serif',fontSize:18,fontWeight:800,letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
          <span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>Ad Studio</span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Link href="/dashboard/owner"><button className="btn btn-ghost btn-sm">← Dashboard</button></Link>
          
        </div>
      </nav>

      <div style={{maxWidth:900,margin:'0 auto',padding:'36px 24px',position:'relative',zIndex:2}}>
        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:28,fontWeight:800,marginBottom:8,letterSpacing:'-0.02em'}}>Wovo Media Ad Videos</h1>
          <p style={{fontSize:15,color:'var(--text-2)',lineHeight:1.65}}>
            Pre-written, conversion-tested scripts narrated by Nova. Generate the video, download it, and post to your ad accounts. Each ad has a different goal — use all 4 for a full funnel.
          </p>
        </div>

        {/* Ad selector */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:28}} className="grid-2">
          {ADS.map(a => (
            <div key={a.key} onClick={()=>{setSelected(a.key);setStatus('idle');setVideoUrl('');setVideoId('')}} style={{padding:'16px 18px',borderRadius:12,cursor:'pointer',border:'1px solid',borderColor:selected===a.key?'var(--accent)':'var(--border)',background:selected===a.key?'var(--accent-dim)':'var(--bg-2)',transition:'all 0.15s'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                <div style={{fontSize:15,fontWeight:700,color:selected===a.key?'var(--accent)':'var(--text)'}}>{a.label}</div>
                <span style={{fontSize:11,color:'var(--text-3)',background:'var(--bg-3)',padding:'2px 8px',borderRadius:10,whiteSpace:'nowrap',marginLeft:8}}>{a.length}</span>
              </div>
              <p style={{fontSize:13,color:'var(--text-2)',margin:'0 0 6px',lineHeight:1.5}}>{a.desc}</p>
              <p style={{fontSize:11,color:'var(--text-3)',margin:0}}>Best for: {a.best}</p>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'start'}} className="grid-2">
          {/* Script panel */}
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Script</div>
                <button onClick={()=>copy(script,'script')} className="btn btn-ghost btn-sm" style={{fontSize:11}}>{copied==='script'?'✓ Copied!':'Copy Script'}</button>
              </div>
              <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.8,margin:0,whiteSpace:'pre-wrap'}}>{script}</p>
            </div>

            <div className="card" style={{padding:'14px 18px'}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Posting Guide</div>
              {[
                ['Platform', ad.best],
                ['Length', ad.length],
                ['Objective', selected==='awareness'?'Reach / Brand awareness':selected==='demo'?'Traffic / Video views':selected==='conversion'?'Conversions / Lead gen':'Engagement / Reach'],
                ['CTA', selected==='conversion'?'Sign Up Now':'Learn More'],
                ['Landing page', 'wovomedia.com'],
              ].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                  <span style={{color:'var(--text-3)'}}>{k}</span>
                  <span style={{color:'var(--text)',fontWeight:500,textAlign:'right',maxWidth:'55%'}}>{v}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{padding:'14px 18px'}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Ad Copy Captions</div>
              {selected==='awareness' && (
                <div>
                  <div style={{fontSize:12,color:'var(--text-3)',marginBottom:4}}>Short (Facebook)</div>
                  <p style={{fontSize:13,color:'var(--text-2)',marginBottom:10,lineHeight:1.5}}>Your business deserves to be seen. Wovo AI creates professional social media content for you — no filming, no editing. Starting at $29/mo. 👇</p>
                  <div style={{fontSize:12,color:'var(--text-3)',marginBottom:4}}>Long (Google/YouTube)</div>
                  <p style={{fontSize:13,color:'var(--text-2)',marginBottom:8,lineHeight:1.5}}>11+ local businesses. 100M+ combined views. One platform that does it all — AI characters, weekly posts, captions, and analytics. Wovo AI starts at just $29/month. No filming. No editing. No excuses.</p>
                  <button onClick={()=>copy('Your business deserves to be seen. Wovo AI creates professional social media content for you — no filming, no editing. Starting at $29/mo. 👇','cap1')} className="btn btn-ghost btn-sm" style={{fontSize:11}}>{copied==='cap1'?'✓':'Copy Short'}</button>
                </div>
              )}
              {selected==='demo' && (
                <div>
                  <p style={{fontSize:13,color:'var(--text-2)',marginBottom:8,lineHeight:1.5}}>Watch how Wovo AI creates a week's worth of social media content in minutes. Clone your face. Pick a series. Done. Starting at $29/mo 👇</p>
                  <button onClick={()=>copy('Watch how Wovo AI creates a week\'s worth of social media content in minutes. Clone your face. Pick a series. Done. Starting at $29/mo 👇','capdemo')} className="btn btn-ghost btn-sm" style={{fontSize:11}}>{copied==='capdemo'?'✓':'Copy'}</button>
                </div>
              )}
              {selected==='conversion' && (
                <div>
                  <p style={{fontSize:13,color:'var(--text-2)',marginBottom:8,lineHeight:1.5}}>One new customer from social media pays for 6+ months of Wovo AI. Our clients are hitting 4M views/month. What's stopping you? Start at $29/mo ↓</p>
                  <button onClick={()=>copy('One new customer from social media pays for 6+ months of Wovo AI. Our clients are hitting 4M views/month. What\'s stopping you? Start at $29/mo ↓','capconv')} className="btn btn-ghost btn-sm" style={{fontSize:11}}>{copied==='capconv'?'✓':'Copy'}</button>
                </div>
              )}
              {selected==='hook_tiktok' && (
                <div>
                  <p style={{fontSize:13,color:'var(--text-2)',marginBottom:8,lineHeight:1.5}}>This is what 4M views looks like when you use Wovo AI 👀 #smallbusiness #socialmedia #contentcreation #marketing #wovomedia</p>
                  <button onClick={()=>copy('This is what 4M views looks like when you use Wovo AI 👀 #smallbusiness #socialmedia #contentcreation #marketing #wovomedia','captik')} className="btn btn-ghost btn-sm" style={{fontSize:11}}>{copied==='captik'?'✓':'Copy'}</button>
                </div>
              )}
            </div>
          </div>

          {/* Video panel */}
          <div style={{position:'sticky',top:90}}>
            <div className="card" style={{padding:0,overflow:'hidden'}}>
              {/* Video */}
              <div style={{aspectRatio:'16/9',background:'#0a0a0a',position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {videoUrl && status==='done' ? (
                  <video src={videoUrl} controls style={{width:'100%',height:'100%',objectFit:'cover'}} autoPlay={false}/>
                ) : (
                  <div style={{textAlign:'center',padding:24}}>
                    {status==='polling' || status==='generating' ? (
                      <>
                        <div style={{width:40,height:40,border:'3px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',margin:'0 auto 14px',animation:'spin 0.8s linear infinite'}}/>
                        <p style={{color:'rgba(255,255,255,0.5)',fontSize:13,margin:0}}>{status==='generating'?'Generating with Wovo AI...':'Generating video · ~3-5 min'}</p>
                      </>
                    ) : status==='error' ? (
                      <><div style={{fontSize:36,marginBottom:10}}>⚠️</div><p style={{color:'rgba(255,255,255,0.4)',fontSize:13}}>Generation failed — try again</p></>
                    ) : (
                      <><div style={{fontSize:36,marginBottom:10}}>🎬</div><p style={{color:'rgba(255,255,255,0.35)',fontSize:13,lineHeight:1.6}}>Click Generate to create<br/>this ad with Nova</p></>
                    )}
                  </div>
                )}
              </div>

              <div style={{padding:'18px 20px'}}>
                {status==='done' && videoUrl ? (
                  <div style={{display:'flex',gap:8}}>
                    <a href={videoUrl} download={`wovo-media-ad-${selected}.mp4`} style={{flex:1,textDecoration:'none'}}>
                      <button className="btn btn-primary" style={{width:'100%',padding:12}}>⬇️ Download for Ads</button>
                    </a>
                    <button className="btn btn-ghost" style={{padding:'12px 14px'}} onClick={()=>{setVideoUrl('');setVideoId('');setStatus('idle')}} title="Regenerate">↺</button>
                  </div>
                ) : (
                  <button className="btn btn-primary" style={{width:'100%',padding:12,fontSize:15}} onClick={generate} disabled={generating||status==='polling'}>
                    {status==='polling'?'⏳ Generating...':status==='generating'?'Submitting...':'🎬 Generate Ad Video'}
                  </button>
                )}
                <p style={{fontSize:11,color:'var(--text-3)',textAlign:'center',marginTop:8}}>
                  {status==='done'?'Ready to download and post':'Takes 3–5 minutes · Landscape 1920×1080 · Uses 1 Wovo AI credit'}
                </p>
              </div>
            </div>

            {/* Funnel guide */}
            <div className="card" style={{marginTop:14,padding:'16px 18px'}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:12}}>Full Ad Funnel</div>
              {[
                ['1', 'TikTok Hook', 'Cold audience — stop the scroll', 'hook_tiktok'],
                ['2', 'Awareness Ad', 'Introduce Wovo Media', 'awareness'],
                ['3', 'Demo / Walkthrough', 'Show how it works', 'demo'],
                ['4', 'Conversion Ad', 'Retarget warm viewers → buy', 'conversion'],
              ].map(([n,label,desc,key])=>(
                <div key={key} onClick={()=>{setSelected(key);setVideoUrl('');setVideoId('');checkExisting()}} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer',alignItems:'center'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:selected===key?'var(--accent)':'var(--bg-3)',color:selected===key?'#080808':'var(--text-3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{n}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:selected===key?'var(--accent)':'var(--text)'}}>{label}</div>
                    <div style={{fontSize:11,color:'var(--text-3)'}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
