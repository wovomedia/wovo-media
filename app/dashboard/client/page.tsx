'use client'
import { useState, useEffect } from 'react'
import { supabase as sb } from '@/lib/supabase'
import Link from 'next/link'

export default function ClientDashboard() {
  const [client, setClient] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [sub, setSub] = useState<any>(null)
  const [tab, setTab] = useState<'overview'|'reports'>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const { data: c } = await sb.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (c) {
        setClient(c)
        const [r, s, subData] = await Promise.all([
          sb.from('client_reports').select('*').eq('client_id', c.id).order('created_at', { ascending: false }).limit(6),
          sb.from('client_stats_history').select('*').eq('client_id', c.id).order('recorded_at', { ascending: false }).limit(12),
          sb.from('wovo_subscriptions').select('*').eq('client_id', c.id).eq('status','active').maybeSingle()
        ])
        if (r.data) setReports(r.data)
        if (s.data) setStats(s.data)
        setSub((subData as any)?.data || null)
      }
      setLoading(false)
    })
  }, [])

  const isActive = client?.is_active || sub?.status === 'active'
  const planName = sub?.plan || client?.plan || null

  const totalViews = stats.reduce((a:number, s:any) => a + (s.views || 0), 0)
  const totalEng = stats.reduce((a:number, s:any) => a + (s.engagements || 0), 0)
  const latest = reports[0]

  if (loading) return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'var(--text-2)',fontSize:14}}>Loading...</div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>

      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100,flexWrap:'wrap',gap:8}}>
        <div style={{fontFamily:'Outfit,sans-serif',fontSize:18,fontWeight:800,letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
          {client?.business_name && <span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>{client.business_name}</span>}
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {isActive && <>
            <Link href="/dashboard/client/business"><button className="btn btn-ghost btn-sm">🏢 My Business</button></Link>
            <Link href="/dashboard/client/videos"><button className="btn btn-ghost btn-sm">🎬 AI Videos</button></Link>
            <Link href="/dashboard/client/studio"><button className="btn btn-ghost btn-sm">🎨 Studio</button></Link>
          </>}
          <Link href="/account"><button className="btn btn-ghost btn-sm">Account</button></Link>
          
          <a href="/"><button className="btn btn-ghost btn-sm">← Home</button></a>
          <button className="btn btn-ghost btn-sm" onClick={() => sb.auth.signOut().then(() => window.location.href = '/')}>Sign out</button>
        </div>
      </nav>

      <div style={{maxWidth:900,margin:'0 auto',padding:'32px 20px',position:'relative',zIndex:2}}>

        {/* FREE ACCOUNT — full feature preview with upgrade prompts */}
        {!isActive && (
          <div style={{marginBottom:28}}>
            <div className="card card-accent" style={{padding:'28px 28px 24px',marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:16}}>
                <div>
                  <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Free Account</div>
                  <h2 style={{fontSize:22,fontWeight:800,marginBottom:8,letterSpacing:'-0.02em'}}>Welcome to Wovo Media 👋</h2>
                  <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.65,maxWidth:480}}>
                    You're in. Below is a preview of everything your subscription unlocks. Pick a plan to start posting consistent AI content for your business every week.
                  </p>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8,flexShrink:0}}>
                  <a href="/wovo-ai" style={{textDecoration:'none'}}><button className="btn btn-primary" style={{padding:'11px 24px',fontSize:14,whiteSpace:'nowrap'}}>See Plans & Pricing →</button></a>
                  <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}><button className="btn btn-ghost" style={{width:'100%',padding:'9px 0',fontSize:13}}>Book a Free Call</button></a>
                </div>
              </div>
            </div>

            {/* Feature preview grid */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}} className="grid-3">
              {[
                {icon:'🧑‍💼',title:'AI Characters',desc:'Clone your face & voice or use a stock avatar. Your business, personified.',locked:true},
                {icon:'🎬',title:'Video Series',desc:'AI writes scripts and generates videos for your brand every week.',locked:true},
                {icon:'🔥',title:'Video Remixer',desc:'Paste any viral TikTok — AI rewrites it for your business instantly.',locked:true},
                {icon:'🖼️',title:'Image Generator',desc:'Turn descriptions into polished food ads, promos, and announcements.',locked:true},
                {icon:'📊',title:'Monthly Reports',desc:'Views, engagements, and growth tracked every month by your team.',locked:true},
                {icon:'💬',title:'Caption Generator',desc:'AI writes scroll-stopping captions for every piece of content.',locked:true},
              ].map(f=>(
                <div key={f.title} className="card" style={{padding:'18px 16px',position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:10,right:10,fontSize:11,color:'var(--text-3)'}}>🔒</div>
                  <div style={{fontSize:28,marginBottom:10}}>{f.icon}</div>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:4}}>{f.title}</div>
                  <p style={{fontSize:12,color:'var(--text-2)',lineHeight:1.55,margin:0}}>{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Pricing comparison */}
            <div className="card" style={{padding:'22px 24px'}}>
              <h3 style={{fontSize:16,fontWeight:700,marginBottom:16}}>Choose your plan</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10}} className="grid-2">
                {[
                  {name:'Starter',price:'$29',period:'/mo',features:['AI character (you)','3 posts/week','Captions'],url:'https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y'},
                  {name:'Growth',price:'$49',period:'/mo',features:['Entire team characters','5 posts/week','Unlimited edits'],url:'https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z',popular:true},
                  {name:'Pro AI',price:'$79',period:'/mo',features:['Daily posts + Stories','Multiple brand chars','Strategy report'],url:'https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10'},
                  {name:'Premium',price:'Custom',period:'',features:['Real filming & drone','Full account mgmt','Website builds'],url:'https://calendly.com/wovomedia/wovo-media-strategy-call',cta:'Book a Call'},
                ].map(p=>(
                  <div key={p.name} style={{padding:'16px 14px',borderRadius:12,border:`1px solid ${p.popular?'var(--accent)':'var(--border)'}`,background:p.popular?'var(--accent-dim)':'var(--bg-3)',textAlign:'center'}}>
                    {p.popular && <div style={{fontSize:10,color:'var(--accent)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Most Popular</div>}
                    <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:4}}>{p.name}</div>
                    <div style={{fontSize:22,fontWeight:800,color:p.popular?'var(--accent)':'var(--text)',fontFamily:'Outfit,sans-serif',letterSpacing:'-0.02em'}}>{p.price}<span style={{fontSize:12,fontWeight:400,color:'var(--text-3)'}}>{p.period}</span></div>
                    <div style={{margin:'10px 0',display:'flex',flexDirection:'column',gap:4}}>
                      {p.features.map(f=><div key={f} style={{fontSize:11,color:'var(--text-2)'}}>{f}</div>)}
                    </div>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                      <button className={`btn ${p.popular?'btn-primary':'btn-outline'}`} style={{width:'100%',padding:'8px 0',fontSize:12,marginTop:4}}>
                        {p.cta||`Get ${p.name}`}
                      </button>
                    </a>
                  </div>
                ))}
              </div>
              <p style={{fontSize:12,color:'var(--text-3)',textAlign:'center',marginTop:14}}>
                Questions? Email <a href="mailto:support@wovomedia.com" style={{color:'var(--accent)'}}>support@wovomedia.com</a> or <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>book a free strategy call</a>
              </p>
            </div>
          </div>
        )}

        {/* ACTIVE ACCOUNT */}
        {isActive && (
          <>
            {/* Plan badge */}
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,flexWrap:'wrap'}}>
              <h1 style={{fontSize:24,fontWeight:700}}>Welcome back 👋</h1>
              {planName && <span style={{background:'var(--accent-dim)',border:'1px solid var(--accent-border)',borderRadius:20,padding:'4px 14px',fontSize:12,fontWeight:700,color:'var(--accent)',textTransform:'capitalize'}}>{String(planName).replace('_',' ')}</span>}
            </div>
            <p style={{fontSize:14,color:'var(--text-2)',marginBottom:24}}>Here's how {client?.business_name||'your business'} is performing.</p>

            {/* Stats */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}} className="grid-3">
              {[['📈',totalViews.toLocaleString(),'Total Views'],['💬',totalEng.toLocaleString(),'Total Engagements'],['📋',reports.length.toString(),'Reports Received']].map(([icon,val,label])=>(
                <div key={label} className="stat-card">
                  <div style={{fontSize:22,marginBottom:8}}>{icon}</div>
                  <div className="stat-num">{val}</div>
                  <div className="stat-label" style={{marginTop:4}}>{label}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{display:'flex',gap:4,marginBottom:16}}>
              {(['overview','reports'] as const).map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?'var(--accent-dim)':'transparent',border:'1px solid',borderColor:tab===t?'var(--accent-border)':'transparent',color:tab===t?'var(--accent)':'var(--text-2)',padding:'7px 16px',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:600,textTransform:'capitalize'}}>{t}</button>
              ))}
            </div>

            {tab==='overview' && (
              <>
                {!latest ? (
                  <div className="card" style={{textAlign:'center',padding:'48px 32px'}}>
                    <div style={{fontSize:32,marginBottom:12}}>📊</div>
                    <h3 style={{fontSize:16,fontWeight:600,marginBottom:8}}>Your first report is on the way</h3>
                    <p style={{color:'var(--text-2)',fontSize:14}}>Your team will send your monthly performance report soon. Check back here to track views, engagements, and more.</p>
                  </div>
                ) : (
                  <div className="card">
                    <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8,fontWeight:600}}>Latest Report · {new Date(latest.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}} className="grid-3">
                      {[['Views',latest.total_views?.toLocaleString()||'—'],['Engagements',latest.total_engagements?.toLocaleString()||'—'],['Followers',latest.follower_growth ? `+${latest.follower_growth}` : '—']].map(([k,v])=>(
                        <div key={k} style={{textAlign:'center',padding:12,background:'var(--bg-3)',borderRadius:9}}>
                          <div style={{fontSize:20,fontWeight:700,color:'var(--accent)',fontFamily:'Outfit,sans-serif'}}>{v}</div>
                          <div style={{fontSize:12,color:'var(--text-3)',marginTop:3}}>{k}</div>
                        </div>
                      ))}
                    </div>
                    {latest.notes && <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.65,margin:0}}>{latest.notes}</p>}
                  </div>
                )}
                <div className="card" style={{marginTop:14,padding:'18px 20px'}}>
                  <h3 style={{fontSize:15,fontWeight:600,marginBottom:8}}>Need help?</h3>
                  <p style={{fontSize:13,color:'var(--text-2)',marginBottom:14}}>Our team is here for you.</p>
                  <div style={{display:'flex',gap:10}}>
                    <a href="mailto:support@wovomedia.com"><button className="btn btn-primary btn-sm">Email Support</button></a>
                    <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer"><button className="btn btn-ghost btn-sm">Book a Call</button></a>
                  </div>
                </div>
              </>
            )}

            {tab==='reports' && (
              reports.length === 0
                ? <div className="card" style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>No reports yet. Your first report will appear here soon.</div>
                : <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    {reports.map(r=>(
                      <div key={r.id} className="card" style={{padding:'18px 20px'}}>
                        <div style={{fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:6}}>{new Date(r.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>
                        <div style={{display:'flex',gap:16,marginBottom:r.notes?12:0}}>
                          {[['Views',r.total_views],['Engagements',r.total_engagements],['New followers',r.follower_growth?`+${r.follower_growth}`:null]].filter(([,v])=>v).map(([k,v])=>(
                            <div key={k as string}><span style={{fontSize:13,color:'var(--text-3)'}}>{k}: </span><span style={{fontSize:13,fontWeight:600,color:'var(--accent)'}}>{v}</span></div>
                          ))}
                        </div>
                        {r.notes && <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,margin:0}}>{r.notes}</p>}
                        {r.video_url && <a href={r.video_url} target="_blank" rel="noreferrer"><button className="btn btn-ghost btn-sm" style={{marginTop:10}}>Watch Report Video</button></a>}
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
