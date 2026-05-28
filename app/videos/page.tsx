'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import Link from 'next/link'

export default function Videos() {
  const [client, setClient] = useState<any>(null)
  const [characters, setCharacters] = useState<any[]>([])
  const [series, setSeries] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [tab, setTab] = useState<'characters'|'series'|'library'>('characters')
  const [isActive, setIsActive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const { data: c } = await supabase.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (c) {
        setClient(c)
        setIsActive(c.is_active)
        if (c.is_active) {
          const [ch, s, v] = await Promise.all([
            supabase.from('client_ai_characters').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
            supabase.from('client_video_series').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
            supabase.from('client_videos').select('*').eq('client_id', c.id).order('created_at', { ascending: false }).limit(20)
          ])
          if (ch.data) setCharacters(ch.data)
          if (s.data) setSeries(s.data)
          if (v.data) setVideos(v.data)
        }
      }
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><div className="spinner"/></div>

  return (
    <AppShell user={client}>
      <div style={{padding:'20px 16px 0'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div>
            <h1 className="page-title">AI Videos</h1>
            <p className="page-sub">{isActive ? `${characters.length} characters · ${series.length} series` : 'Upgrade to access'}</p>
          </div>
          {isActive && <a href={`/dashboard/client/videos`} target="_blank" rel="noreferrer"><button className="btn btn-primary btn-sm">+ New</button></a>}
        </div>

        {!isActive ? (
          <div className="card card-accent" style={{textAlign:'center',padding:'40px 20px'}}>
            <div style={{fontSize:40,marginBottom:14}}>🎬</div>
            <h3 style={{fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:8}}>AI Videos require a subscription</h3>
            <p style={{fontSize:13,color:'var(--text-2)',marginBottom:20,lineHeight:1.6}}>Create AI characters, generate video series, and get captions for every video. Starting at $29/mo.</p>
            <a href={`/wovo-ai`} target="_blank" rel="noreferrer"><button className="btn btn-primary" style={{padding:'11px 28px'}}>See Plans →</button></a>
          </div>
        ) : (
          <>
            <div className="tab-row" style={{marginBottom:16}}>
              {(['characters','series','library'] as const).map(t=>(
                <button key={t} className={`tab-item ${tab===t?'active':''}`} onClick={()=>setTab(t)} style={{textTransform:'capitalize'}}>{t}</button>
              ))}
            </div>

            {tab==='characters' && (
              <>
                {characters.length===0 ? (
                  <div className="card" style={{textAlign:'center',padding:'40px 16px'}}>
                    <div style={{fontSize:36,marginBottom:12}}>🧑‍💼</div>
                    <p style={{fontSize:14,color:'var(--text-2)',marginBottom:16}}>No characters yet. Create one to start making videos.</p>
                    <a href={`/dashboard/client/videos`} target="_blank" rel="noreferrer"><button className="btn btn-primary btn-sm">Create Character</button></a>
                  </div>
                ) : characters.map(c=>(
                  <div key={c.id} className="card" style={{marginBottom:10,display:'flex',alignItems:'center',gap:12}}>
                    <div className="avatar" style={{width:44,height:44,fontSize:16}}>{c.character_name[0].toUpperCase()}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{c.character_name}</div>
                      <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{c.niche==='cloned'?'🧬 Cloned':'🎭 Stock'} · {c.business_description||'—'}</div>
                    </div>
                    <span className="badge badge-green">Active</span>
                  </div>
                ))}
              </>
            )}

            {tab==='series' && (
              <>
                {series.length===0 ? (
                  <div className="card" style={{textAlign:'center',padding:'40px 16px'}}>
                    <div style={{fontSize:36,marginBottom:12}}>📺</div>
                    <p style={{fontSize:14,color:'var(--text-2)',marginBottom:16}}>No series yet. Create your first video series.</p>
                    <a href={`/dashboard/client/videos`} target="_blank" rel="noreferrer"><button className="btn btn-primary btn-sm">Create Series</button></a>
                  </div>
                ) : series.map(s=>(
                  <div key={s.id} className="card" style={{marginBottom:10}}>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:4}}>{s.series_name}</div>
                    <div style={{fontSize:12,color:'var(--text-3)'}}>{s.series_theme} · {s.episode_count} episodes · {new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </>
            )}

            {tab==='library' && (
              videos.length===0 ? (
                <div className="card" style={{textAlign:'center',padding:'40px 16px',color:'var(--text-3)'}}>No videos yet.</div>
              ) : videos.map(v=>(
                <div key={v.id} className="card" style={{marginBottom:10,padding:'14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:v.caption?10:0}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                        <span className={`badge ${v.status==='completed'?'badge-green':v.status==='generating'?'badge-accent':'badge-gray'}`} style={{fontSize:10}}>
                          {v.status==='completed'?'✓ Ready':v.status==='generating'?'⏳ Generating':'Pending'}
                        </span>
                        {v.episode_number && <span style={{fontSize:10,color:'var(--text-3)'}}>Ep. {v.episode_number}</span>}
                      </div>
                      {v.script && <p style={{fontSize:12,color:'var(--text-2)',lineHeight:1.5,margin:0,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{v.script}</p>}
                    </div>
                    {v.video_url && <a href={v.video_url} target="_blank" rel="noreferrer"><button className="btn btn-primary btn-sm" style={{marginLeft:10,flexShrink:0}}>↓</button></a>}
                  </div>
                  {v.caption && (
                    <div style={{background:'var(--bg-3)',borderRadius:8,padding:'10px 12px',marginTop:8}}>
                      <div style={{fontSize:10,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>AI Caption</div>
                      <p style={{fontSize:12,color:'var(--text-2)',lineHeight:1.5,margin:'0 0 6px'}}>{v.caption}</p>
                      <button onClick={()=>navigator.clipboard.writeText(v.caption)} className="btn btn-ghost btn-sm" style={{fontSize:10,padding:'5px 10px'}}>Copy</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
