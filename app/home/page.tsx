'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import Link from 'next/link'

const TYLER = 'https://files2.heygen.ai/avatar/v3/79b245561ad448e796b7e77cd2773d0b_14263/preview_talk_11.webp'

export default function Home() {
  const [client, setClient] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [isActive, setIsActive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const { data: c } = await supabase.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (c) {
        setClient(c)
        const active = c.is_active
        setIsActive(active)
        if (active) {
          const [s, v] = await Promise.all([
            supabase.from('client_stats_history').select('*').eq('client_id', c.id).order('recorded_at', { ascending: false }).limit(6),
            supabase.from('client_videos').select('*').eq('client_id', c.id).order('created_at', { ascending: false }).limit(3)
          ])
          if (s.data) setStats(s.data)
          if (v.data) setVideos(v.data)
        }
      }
      setLoading(false)
    })
  }, [])

  const totalViews = stats.reduce((a, s) => a + (s.views || 0), 0)
  const totalEng = stats.reduce((a, s) => a + (s.engagements || 0), 0)

  if (loading) return (
    <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="spinner"/>
    </div>
  )

  return (
    <AppShell user={client}>
      <div style={{padding:'20px 16px 0'}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <div style={{fontFamily:'Outfit,sans-serif',fontSize:22,fontWeight:800,letterSpacing:'-0.04em',color:'var(--text)'}}>
              wovo<span style={{color:'var(--accent)'}}>media</span>
            </div>
            <div style={{fontSize:12,color:'var(--text-3)',marginTop:2,display:'flex',alignItems:'center',gap:5}}>
              {isActive && <span style={{width:6,height:6,borderRadius:'50%',background:'#22c55e',display:'inline-block'}}/>}
              {client?.business_name || 'Your business'} · {isActive ? 'Active' : 'Free account'}
            </div>
          </div>
          <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',border:'2px solid var(--accent-border)',background:'#0d3330'}}>
            <img src={TYLER} alt="" style={{width:'100%',height:'140%',objectFit:'cover',objectPosition:'top center',marginTop:'-10%'}}/>
          </div>
        </div>

        {/* FREE ACCOUNT */}
        {!isActive && (
          <>
            <div className="card card-accent" style={{marginBottom:14,padding:'20px'}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>Free Account</div>
              <h3 style={{fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:8,letterSpacing:'-0.02em'}}>Start posting content that grows your business</h3>
              <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,marginBottom:16}}>Upgrade to unlock AI characters, video series, the remixer, image generator, and weekly captions.</p>
              <div style={{display:'flex',gap:8}}>
                <a href={`/wovo-ai`} style={{flex:1,textDecoration:'none'}}>
                  <button className="btn btn-primary btn-block" style={{fontSize:13}}>See Plans →</button>
                </a>
                <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer" style={{flex:1,textDecoration:'none'}}>
                  <button className="btn btn-outline btn-block" style={{fontSize:13}}>Book a Call</button>
                </a>
              </div>
            </div>

            {/* Feature preview */}
            <div className="section-label">What's included</div>
            <div className="grid-2" style={{marginBottom:14}}>
              {[['🧑‍💼','AI Characters','Clone your face & voice'],['🎬','Video Series','AI writes & generates'],['🔥','Remix','Viral TikToks → your brand'],['🖼️','Image Ads','Food, product & promo ads'],['💬','Captions','AI-written for every video'],['📊','Reports','Monthly performance data']].map(([icon,title,desc])=>(
                <div key={title} className="card" style={{padding:'14px',position:'relative'}}>
                  <div style={{position:'absolute',top:8,right:8,fontSize:11,color:'var(--text-3)'}}>🔒</div>
                  <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:3}}>{title}</div>
                  <div style={{fontSize:11,color:'var(--text-3)',lineHeight:1.4}}>{desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ACTIVE ACCOUNT */}
        {isActive && (
          <>
            {/* Stats */}
            <div className="grid-3" style={{marginBottom:16}}>
              <div className="stat-card"><div className="stat-num">{totalViews > 999999 ? (totalViews/1000000).toFixed(1)+'M' : totalViews > 999 ? Math.round(totalViews/1000)+'K' : totalViews}</div><div className="stat-label">Views</div></div>
              <div className="stat-card"><div className="stat-num">{totalEng > 999 ? Math.round(totalEng/1000)+'K' : totalEng}</div><div className="stat-label">Engagements</div></div>
              <div className="stat-card"><div className="stat-num">{stats.length}</div><div className="stat-label">Reports</div></div>
            </div>

            {/* Quick actions */}
            <div className="section-label">Quick actions</div>
            <div className="grid-2" style={{marginBottom:16}}>
              {[
                {href:'/videos',icon:'🎬',label:'New Video'},
                {href:'/studio',icon:'🔥',label:'Remix'},
                {href:'/studio?tab=images',icon:'🖼️',label:'Make Ad'},
                {href:'/business',icon:'🏢',label:'My Business'},
              ].map(a=>(
                <Link key={a.label} href={a.href} style={{textDecoration:'none'}}>
                  <div className="card" style={{textAlign:'center',padding:'18px 8px',cursor:'pointer'}}>
                    <div style={{fontSize:26,marginBottom:6}}>{a.icon}</div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{a.label}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Recent videos */}
            {videos.length > 0 && (
              <>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div className="section-label" style={{margin:0}}>Recent content</div>
                  <Link href="/videos" style={{fontSize:12,color:'var(--accent)',textDecoration:'none',fontWeight:600}}>See all →</Link>
                </div>
                {videos.map(v=>(
                  <div key={v.id} className="card" style={{marginBottom:8,padding:'12px 14px'}}>
                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                      <div style={{width:44,height:44,borderRadius:8,background:'linear-gradient(135deg,#0d1f1c,#0a3330)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🎬</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.script ? v.script.slice(0,50)+'...' : 'Video'}</div>
                        <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>Ep. {v.episode_number || '—'}</div>
                      </div>
                      <span className={`badge ${v.status==='completed'?'badge-green':v.status==='generating'?'badge-accent':'badge-gray'}`}>
                        {v.status==='completed'?'Ready':v.status==='generating'?'⏳':'—'}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
