'use client'
import { useState, useEffect, useRef } from 'react'
import { NOVA_FLOW, NovaNode } from '@/lib/nova-flow'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

type VideoState = 'loading' | 'generating' | 'ready' | 'playing' | 'done' | 'error'

export default function MeetNova() {
  const [nodeId, setNodeId] = useState('intro')
  const [videoState, setVideoState] = useState<VideoState>('loading')
  const [videoUrl, setVideoUrl] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [showOptions, setShowOptions] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pollRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const node: NovaNode = NOVA_FLOW[nodeId]

  useEffect(() => {
    loadNode(nodeId)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [nodeId])

  const loadNode = async (id: string) => {
    setShowOptions(false)
    setVideoUrl('')
    setVideoState('generating') // will be overridden immediately if cached

    // Request video generation
    const res = await fetch('/api/heygen/nova-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: id })
    })
    const data = await res.json()
    if (!res.ok || !data.videoId) { setVideoState('error'); return }
    // If already cached with URL, play immediately - no loading screen at all
    if (data.videoUrl) {
      setVideoUrl(data.videoUrl)
      setVideoState('playing')
      setTimeout(() => {
        videoRef.current?.play().catch(() => {
          setVideoState('ready') // fallback if autoplay blocked
        })
      }, 100)
      return
    }

    // Poll for completion
    const poll = setInterval(async () => {
      const s = await fetch(`/api/heygen/nova-flow?id=${data.videoId}&node=${id}`)
      const sd = await s.json()
      if (sd.status === 'completed' && sd.videoUrl) {
        clearInterval(poll)
        setVideoUrl(sd.videoUrl)
        setVideoState('ready')
        // Auto-play as soon as video is ready
        setTimeout(() => {
          videoRef.current?.play().catch(() => {
            // Autoplay blocked by browser - show play button as fallback
          })
          setVideoState('playing')
        }, 300)
      } else if (sd.status === 'failed') {
        clearInterval(poll)
        setVideoState('error')
      }
    }, 4000)
    pollRef.current = poll
  }

  const handleVideoEnd = () => {
    setVideoState('done')
    setShowOptions(true)
  }

  const handleOption = (nextId: string) => {
    setHistory(h => [...h, nodeId])
    setShowOptions(false)
    setVideoUrl('')
    setVideoState('loading')
    setNodeId(nextId)
  }

  const handleBack = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setShowOptions(false)
    setVideoUrl('')
    setVideoState('loading')
    setNodeId(prev)
  }

  const progressPct = Math.min(100, Math.round((history.length / 6) * 100))

  return (
    <div style={{minHeight:'100vh',background:'#070707',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',padding:20}}>
      {/* Subtle grid */}
      <div style={{position:'fixed',inset:0,backgroundImage:'linear-gradient(rgba(0,229,200,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,200,0.025) 1px,transparent 1px)',backgroundSize:'48px 48px',pointerEvents:'none'}}/>
      <div style={{position:'fixed',inset:0,background:'radial-gradient(ellipse 80% 50% at 50% 0%,transparent 30%,#070707 100%)',pointerEvents:'none'}}/>

      {/* Nav */}
      <div style={{position:'fixed',top:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 28px',zIndex:100,borderBottom:'1px solid rgba(255,255,255,0.05)',background:'rgba(7,7,7,0.9)',backdropFilter:'blur(12px)'}}>
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:18,fontWeight:800,color:'#fff',textDecoration:'none',letterSpacing:'-0.04em'}}>wovo<span style={{color:'#00E5C8'}}>media</span></Link>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {history.length > 0 && <button className="btn btn-ghost btn-sm" onClick={handleBack} style={{fontSize:12}}>← Back</button>}
          <ThemeToggle/>
          <Link href="/login"><button className="btn btn-ghost btn-sm">Log In</button></Link>
        </div>
      </div>

      <div style={{position:'relative',zIndex:2,width:'100%',maxWidth:680,marginTop:80}}>

        {/* Progress */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
          <div style={{flex:1,height:2,borderRadius:2,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:2,background:'var(--accent)',width:`${progressPct}%`,transition:'width 0.4s ease'}}/>
          </div>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontWeight:500,whiteSpace:'nowrap'}}>Nova · Wovo Media</span>
        </div>

        {/* VIDEO CARD */}
        <div style={{borderRadius:20,overflow:'hidden',background:'#111',border:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 24px 80px rgba(0,0,0,0.5)'}}>

          {/* Video area */}
          <div style={{position:'relative',aspectRatio:'16/9',background:'#0a0a0a'}}>

            {/* Video element */}
            {videoUrl && (
              <video
                ref={videoRef}
                src={videoUrl}
                style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                onEnded={handleVideoEnd}
                playsInline
              />
            )}

            {/* Generating overlay */}
            {(videoState === 'loading' || videoState === 'generating') && (
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#0a0a0a'}}>
                <div style={{position:'relative',width:72,height:72,marginBottom:20}}>
                  {/* Pulsing ring */}
                  <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'2px solid rgba(0,229,200,0.2)',animation:'ping 1.5s ease-out infinite'}}/>
                  <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'2px solid rgba(0,229,200,0.1)',animation:'ping 1.5s ease-out infinite',animationDelay:'0.5s'}}/>
                  {/* Nova avatar - Tyler's face */}
                  <div style={{width:72,height:72,borderRadius:'50%',border:'2px solid rgba(0,229,200,0.4)',overflow:'hidden',background:'#111'}}>
                  <img src="https://files2.heygen.ai/avatar/v3/79b245561ad448e796b7e77cd2773d0b_14263/preview_talk_11.webp" alt="Nova" style={{width:'100%',height:'140%',objectFit:'cover',objectPosition:'top center',marginTop:'-10%'}} onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
                </div>
                </div>
                <p style={{color:'rgba(255,255,255,0.5)',fontSize:14,margin:0,fontWeight:500}}>Nova is getting ready...</p>
                <p style={{color:'rgba(255,255,255,0.2)',fontSize:12,margin:'6px 0 0'}}>AI video generating · ~60 sec first time</p>
              </div>
            )}

            {/* Auto-playing - brief pulse indicator */}
            {videoState === 'ready' && (
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.15)'}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:'rgba(0,229,200,0.9)',display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeOut 0.6s ease forwards 0.4s'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0a0a0a"><polygon points="5,3 19,12 5,21"/></svg>
                </div>
              </div>
            )}

            {/* Error state */}
            {videoState === 'error' && (
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#0a0a0a',gap:12}}>
                <p style={{color:'rgba(255,255,255,0.4)',fontSize:14}}>Couldn't load Nova right now.</p>
                <button className="btn btn-outline btn-sm" onClick={()=>loadNode(nodeId)}>Try again</button>
              </div>
            )}

            {/* NOVA label */}
            <div style={{position:'absolute',bottom:12,left:12,display:'flex',alignItems:'center',gap:7,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(8px)',borderRadius:20,padding:'5px 12px 5px 8px',border:'1px solid rgba(255,255,255,0.1)'}}>
              <div style={{width:20,height:20,borderRadius:'50%',border:'1.5px solid #00E5C8',overflow:'hidden',background:'#111'}}>
                <img src="https://files2.heygen.ai/avatar/v3/79b245561ad448e796b7e77cd2773d0b_14263/preview_talk_11.webp" alt="Nova" style={{width:'100%',height:'140%',objectFit:'cover',objectPosition:'top center',marginTop:'-10%'}}/>
              </div>
              <span style={{fontSize:12,color:'rgba(255,255,255,0.8)',fontWeight:600}}>Nova</span>
              {videoState==='playing' && <span style={{fontSize:10,color:'#00E5C8',display:'flex',alignItems:'center',gap:3}}><div style={{width:5,height:5,borderRadius:'50%',background:'#00E5C8',animation:'pulse 1s infinite'}}/> Speaking</span>}
            </div>
          </div>

          {/* OPTIONS */}
          <div style={{padding:'20px 24px 24px'}}>
            {/* Terminal node CTA */}
            {node.outcome && node.cta && (videoState === 'done' || showOptions) && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <p style={{fontSize:13,color:'rgba(255,255,255,0.4)',margin:'0 0 6px',textAlign:'center'}}>Nova's recommendation for you</p>
                <a href={node.cta.url} style={{textDecoration:'none'}}>
                  <button className="btn btn-primary" style={{width:'100%',padding:14,fontSize:16,borderRadius:12}}>
                    {node.cta.label}
                  </button>
                </a>
                <button className="btn btn-ghost btn-sm" style={{width:'100%'}} onClick={()=>setNodeId('intro')}>
                  Start over
                </button>
              </div>
            )}

            {/* Choice options */}
            {node.options && showOptions && (
              <div style={{display:'flex',flexDirection:'column',gap:9}}>
                <p style={{fontSize:12,color:'rgba(255,255,255,0.35)',margin:'0 0 4px',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>Choose your answer</p>
                {node.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={()=>handleOption(opt.next)}
                    style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'13px 16px',fontSize:14,color:'rgba(255,255,255,0.8)',cursor:'pointer',textAlign:'left',fontFamily:'inherit',fontWeight:500,transition:'all 0.15s',display:'flex',alignItems:'center',gap:10}}
                    onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='rgba(0,229,200,0.08)';el.style.borderColor='rgba(0,229,200,0.3)';el.style.color='#00E5C8'}}
                    onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='rgba(255,255,255,0.04)';el.style.borderColor='rgba(255,255,255,0.1)';el.style.color='rgba(255,255,255,0.8)'}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Waiting for video to finish */}
            {node.options && !showOptions && videoState === 'playing' && (
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <p style={{fontSize:13,color:'rgba(255,255,255,0.25)',margin:0}}>Watch Nova finish speaking, then choose your answer</p>
                <button onClick={()=>setShowOptions(true)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',fontSize:12,cursor:'pointer',marginTop:8,fontFamily:'inherit'}}>Skip to options →</button>
              </div>
            )}

            {/* Waiting for video to load */}
            {videoState !== 'playing' && videoState !== 'done' && !showOptions && videoState !== 'error' && (
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <p style={{fontSize:13,color:'rgba(255,255,255,0.2)',margin:0}}>
                  {videoState === 'ready' ? 'Starting Nova...' : 'Preparing Nova\'s response...'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom note */}
        <p style={{textAlign:'center',fontSize:12,color:'rgba(255,255,255,0.2)',marginTop:16}}>
          Prefer to skip? <Link href="/login" style={{color:'rgba(0,229,200,0.6)',textDecoration:'none'}}>Create an account</Link> or <button onClick={()=>window.dispatchEvent(new CustomEvent('openBooking'))} style={{background:'none',border:'none',color:'rgba(0,229,200,0.6)',cursor:'pointer',fontSize:12,fontFamily:'inherit',padding:0}}>book a call directly</button>
        </p>
      </div>

      <style>{`
        @keyframes ping { 0% { transform:scale(1); opacity:0.6; } 100% { transform:scale(1.8); opacity:0; } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes fadeOut { 0% { opacity:1; transform:scale(1); } 100% { opacity:0; transform:scale(1.3); } }
      `}</style>
    </div>
  )
}
