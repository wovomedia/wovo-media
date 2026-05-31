'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'

export default function ClientDetail() {
  const { id } = useParams()
  const [client, setClient] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [deliverables, setDeliverables] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [activeConvo, setActiveConvo] = useState<string>('')
  const [msgText, setMsgText] = useState('')
  const [senderName, setSenderName] = useState('Wovo Media Team')
  const [tab, setTab] = useState<'overview'|'jobs'|'content'|'messages'>('overview')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const msgsEnd = useRef<HTMLDivElement>(null)
  const [showJobForm, setShowJobForm] = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)
  const MAIN = ''

  const [jobForm, setJobForm] = useState({
    type: 'shoot', title: '', description: '', dueDate: '',
    scheduledDate: '', location: '', priority: 'normal'
  })

  useEffect(() => { loadAll() }, [id])
  useEffect(() => {
    if (activeConvo) loadMessages(activeConvo)
  }, [activeConvo])
  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [messages])

  const loadAll = async () => {
    const [c, j, d, cv] = await Promise.all([
      supabase.from('clients').select('*, client_managers(*, employees(*))').eq('id', id).single(),
      supabase.from('jobs').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('deliverables').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('conversations').select('*').eq('client_id', id).order('last_message_at', { ascending: false })
    ])
    setClient(c.data)
    setJobs(j.data || [])
    setDeliverables(d.data || [])
    setConversations(cv.data || [])
    if (cv.data?.[0]) { setActiveConvo(cv.data[0].id); loadMessages(cv.data[0].id) }
    setLoading(false)
  }

  const loadMessages = async (convoId: string) => {
    const { data } = await supabase.from('conversation_messages').select('*').eq('conversation_id', convoId).order('created_at', { ascending: true })
    setMessages(data || [])
  }

  useEffect(() => { msgsEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Real-time subscription — update messages instantly without reload
  useEffect(() => {
    if (!activeConvo) return
    const sub = supabase.channel(`admin-chat-${activeConvo}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'conversation_messages',
        filter: `conversation_id=eq.${activeConvo}`
      }, payload => {
        setMessages(m => [...m, payload.new])
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [activeConvo])

  const sendMessage = async () => {
    if (!msgText.trim() || !activeConvo) return
    setSending(true)
    await supabase.from('conversation_messages').insert({
      conversation_id: activeConvo,
      sender_name: senderName,
      sender_role: 'account_manager',
      body: msgText.trim()
    })
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', activeConvo)
    setMsgText('')
    setSending(false)
  }

  const createJob = async () => {
    if (!jobForm.title) return
    await supabase.from('jobs').insert({
      client_id: id,
      type: jobForm.type,
      title: jobForm.title,
      description: jobForm.description,
      due_date: jobForm.dueDate || null,
      scheduled_date: jobForm.scheduledDate || null,
      location: jobForm.location || null,
      priority: jobForm.priority,
      status: 'pending'
    })
    setShowJobForm(false)
    setJobForm({ type:'shoot',title:'',description:'',dueDate:'',scheduledDate:'',location:'',priority:'normal' })
    const { data } = await supabase.from('jobs').select('*').eq('client_id', id).order('created_at', { ascending: false })
    setJobs(data || [])
  }

  const JOB_ICONS: Record<string,string> = { shoot:'🎬', edit:'✂️', photo_shoot:'📷', post_content:'📱', write_report:'📊', strategy_call:'📞', onboarding:'👋', other:'📋' }
  const STATUS_COLORS: Record<string,string> = { pending:'#f59e0b', in_progress:'#00E5C8', needs_review:'#8b5cf6', approved:'#22c55e', complete:'#22c55e', cancelled:'#ef4444' }

  if (loading) return <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><div className="spinner"/></div>
  if (!client) return <div style={{padding:20,color:'var(--text-2)'}}>Client not found.</div>

  const manager = client.client_managers?.[0]?.employees

  return (
    <AppShell>
    <div style={{padding:'20px 16px 0'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <Link href="/admin/clients" style={{color:'var(--text-3)',textDecoration:'none',fontSize:20}}>←</Link>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{client.business_name}</h1>
          <div style={{fontSize:12,color:'var(--text-3)'}}>{client.owner_name} · {manager ? `👔 ${manager.full_name}` : 'No manager assigned'}</div>
        </div>
        <span className={`badge ${client.is_active?'badge-green':'badge-gray'}`}>{client.is_active?'Active':'Inactive'}</span>
      </div>

      <div className="tab-row" style={{marginBottom:16}}>
        {(['overview','jobs','content','messages'] as const).map(t=>(
          <button key={t} className={`tab-item ${tab===t?'active':''}`} onClick={()=>setTab(t)} style={{textTransform:'capitalize',fontSize:11}}>
            {t==='messages'?`💬 ${conversations.length > 0 ? 'Chat' : 'Chat'}`:t==='jobs'?`📋 Jobs`:t==='content'?`📁 Content`:t}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab==='overview' && (
        <>
          <div className="card" style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.07em'}}>Client Info</div>
              <button onClick={async()=>{
                const action = client.is_active?'deactivate':'activate'
                if(!confirm(`${action.charAt(0).toUpperCase()+action.slice(1)} this account? ${client.is_active?'They will lose access immediately.':'They will regain full access.'}`)) return
                const {createClient} = await import('@supabase/supabase-js')
                const sb2 = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
                await sb2.from('clients').update({is_active:!client.is_active}).eq('id',id)
                window.location.reload()
              }} style={{fontSize:11,padding:'5px 12px',borderRadius:8,border:'1px solid',borderColor:client.is_active?'rgba(239,68,68,0.3)':'rgba(34,197,94,0.3)',background:client.is_active?'rgba(239,68,68,0.06)':'rgba(34,197,94,0.06)',color:client.is_active?'#ef4444':'#22c55e',cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>
                {client.is_active?'⛔ Deactivate':'✅ Activate'}
              </button>
            </div>
            {[['Email',client.email],['Phone',client.phone||'—'],['Plan',client.plan?.replace('_',' ')||'—'],['Monthly Rate',client.monthly_rate?`$${client.monthly_rate}/mo`:'—'],['Manager',manager?.full_name||'Unassigned'],['Status',client.is_active?'Active':'Inactive']].map(([k,v])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span style={{color:'var(--text-3)'}}>{k}</span>
                <span style={{color:k==='Status'?(client.is_active?'#22c55e':'#ef4444'):'var(--text)',fontWeight:500,textAlign:'right',maxWidth:'55%',textTransform:'capitalize'}}>{v}</span>
              </div>
            ))}
          </div>
          <div className="grid-2">
            <div className="stat-card"><div className="stat-num">{jobs.filter(j=>j.status!=='complete'&&j.status!=='cancelled').length}</div><div className="stat-label">Open Jobs</div></div>
            <div className="stat-card"><div className="stat-num">{deliverables.length}</div><div className="stat-label">Deliverables</div></div>
          </div>
        </>
      )}

      {/* JOBS */}
      {tab==='jobs' && (
        <>
          <button className="btn btn-primary btn-block" style={{marginBottom:14}} onClick={()=>setShowJobForm(!showJobForm)}>
            {showJobForm?'Cancel':'+ Create Job'}
          </button>

          {showJobForm && (
            <div className="card" style={{marginBottom:14}}>
              <div style={{display:'flex',flexDirection:'column',gap:11}}>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Job type</label>
                  <select className="input" value={jobForm.type} onChange={e=>setJobForm(f=>({...f,type:e.target.value}))}>
                    {[['shoot','Film Shoot'],['edit','Edit Video'],['photo_shoot','Photo Shoot'],['post_content','Post Content'],['write_report','Write Report'],['strategy_call','Strategy Call'],['onboarding','Onboarding'],['other','Other']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Title *</label>
                  <input className="input" value={jobForm.title} onChange={e=>setJobForm(f=>({...f,title:e.target.value}))} placeholder="e.g. October social media shoot"/>
                </div>
                <div className="grid-2">
                  <div>
                    <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Due date</label>
                    <input className="input" type="date" value={jobForm.dueDate} onChange={e=>setJobForm(f=>({...f,dueDate:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Scheduled</label>
                    <input className="input" type="date" value={jobForm.scheduledDate} onChange={e=>setJobForm(f=>({...f,scheduledDate:e.target.value}))}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Location</label>
                  <input className="input" value={jobForm.location} onChange={e=>setJobForm(f=>({...f,location:e.target.value}))} placeholder="Client's address or remote"/>
                </div>
                <button className="btn btn-primary btn-block" onClick={createJob}>Create Job →</button>
              </div>
            </div>
          )}

          {jobs.length === 0 ? <div className="card" style={{textAlign:'center',padding:32,color:'var(--text-3)'}}>No jobs yet.</div> :
            jobs.map(job=>(
              <div key={job.id} className="card" style={{marginBottom:10,padding:'12px 14px'}}>
                <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                  <div style={{fontSize:22,flexShrink:0,marginTop:1}}>{JOB_ICONS[job.type]||'📋'}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:4}}>{job.title}</div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      <span style={{fontSize:10,color:STATUS_COLORS[job.status]||'var(--text-3)',fontWeight:700,textTransform:'uppercase'}}>{job.status?.replace('_',' ')}</span>
                      {job.due_date && <span style={{fontSize:10,color:'var(--text-3)'}}>Due {new Date(job.due_date).toLocaleDateString()}</span>}
                      {job.location && <span style={{fontSize:10,color:'var(--text-3)'}}>📍 {job.location}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
        </>
      )}

      {/* CONTENT */}
      {tab==='content' && (
        <>
          <div className="card" style={{marginBottom:14,padding:'14px 16px',background:'var(--accent-dim)',borderColor:'var(--accent-border)'}}>
            <div style={{fontSize:12,fontWeight:700,color:'var(--accent)',marginBottom:6}}>Upload Content</div>
            <p style={{fontSize:12,color:'var(--text-2)',marginBottom:10,lineHeight:1.5}}>Upload finished videos, photos, and edited content directly to this client's account.</p>
            <a href={`/dashboard/owner`} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
              <button className="btn btn-primary btn-sm" style={{fontSize:12}}>Open Full Upload Panel →</button>
            </a>
          </div>
          {deliverables.length === 0 ? <div className="card" style={{textAlign:'center',padding:32,color:'var(--text-3)'}}>No content uploaded yet.</div> :
            deliverables.map(d=>(
              <div key={d.id} className="card" style={{marginBottom:10,padding:'12px 14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.file_name}</div>
                    <div style={{fontSize:11,color:'var(--text-3)',marginTop:2,textTransform:'capitalize'}}>{d.file_type?.replace('_',' ')} · {new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`badge ${d.status==='posted'?'badge-green':d.status==='approved'?'badge-accent':'badge-gray'}`} style={{fontSize:10,marginLeft:8,flexShrink:0}}>{d.status}</span>
                </div>
                {d.caption && <p style={{fontSize:11,color:'var(--text-3)',marginTop:6,lineHeight:1.5}}>{d.caption.slice(0,100)}{d.caption.length>100?'...':''}</p>}
              </div>
            ))
          }
        </>
      )}

      {/* MESSAGES */}
      {tab==='messages' && (
        <div style={{display:'flex',flexDirection:'column',height:'calc(100dvh - 260px)'}}>
          {conversations.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:32,color:'var(--text-3)'}}>No conversations yet.</div>
          ) : (
            <>
              <div ref={msgsRef} style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:8,marginBottom:12,paddingBottom:4}}>
                {messages.map(m=>(
                  <div key={m.id} style={{
                    alignSelf:['client'].includes(m.sender_role)?'flex-start':'flex-end',
                    maxWidth:'85%',
                    background:m.sender_role==='client'?'var(--bg-3)':'var(--accent)',
                    color:m.sender_role==='client'?'var(--text-2)':'#080808',
                    borderRadius:m.sender_role==='client'?'12px 12px 12px 3px':'12px 12px 3px 12px',
                    padding:'9px 13px',fontSize:13,lineHeight:1.6
                  }}>
                    {m.sender_role!=='client'&&<div style={{fontSize:10,fontWeight:700,marginBottom:4,opacity:0.7}}>{m.sender_name}</div>}
                    {m.body}
                    <div style={{fontSize:10,opacity:0.5,marginTop:4,textAlign:'right'}}>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
                <div style={{flex:1}}>
                  <input className="input" style={{marginBottom:6,fontSize:12,padding:'7px 10px'}} value={senderName} onChange={e=>setSenderName(e.target.value)} placeholder="Your name"/>
                  <textarea className="input" value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),sendMessage())} placeholder="Type a message..." rows={2} style={{fontSize:13,resize:'none'}}/>
                </div>
                <button className="btn btn-primary" style={{padding:'10px 14px',flexShrink:0,alignSelf:'flex-end'}} onClick={sendMessage} disabled={sending||!msgText.trim()}>→</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  </AppShell>
  )
}
