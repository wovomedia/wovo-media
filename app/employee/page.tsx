'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import Link from 'next/link'

const JOB_ICONS: Record<string,string> = { shoot:'🎬',edit:'✂️',photo_shoot:'📷',post_content:'📱',write_report:'📊',strategy_call:'📞',onboarding:'👋',other:'📋' }
const STATUS_COLORS: Record<string,string> = { pending:'#f59e0b',in_progress:'#00E5C8',needs_review:'#8b5cf6',approved:'#22c55e',complete:'#22c55e',cancelled:'#ef4444' }
const STATUS_NEXT: Record<string,{label:string,next:string,color:string}> = {
  pending: { label:'Start Job', next:'in_progress', color:'var(--accent)' },
  in_progress: { label:'Submit for Review', next:'needs_review', color:'#8b5cf6' },
  needs_review: { label:'Mark Approved', next:'approved', color:'#22c55e' },
  approved: { label:'Mark Complete ✓', next:'complete', color:'#22c55e' },
}

export default function EmployeeDashboard() {
  const [employee, setEmployee] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [shoots, setShoots] = useState<any[]>([])
  const [tab, setTab] = useState<'jobs'|'schedule'|'upload'>('jobs')
  const [filter, setFilter] = useState<'active'|'all'>('active')
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({ jobId:'', clientId:'', caption:'', fileType:'video', notes:'' })
  const [uploadFile, setUploadFile] = useState<File|null>(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const MAIN = ''

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const { data: emp } = await supabase.from('employees').select('*').eq('user_id', data.user.id).single()
      if (!emp) { window.location.href = '/home'; return }
      setEmployee(emp)
      loadJobs(emp.id)
      loadSchedule(emp.id)
    })
  }, [])

  const loadJobs = async (empId: string) => {
    let q = supabase.from('jobs').select('*, clients(business_name, id)').eq('assigned_to', empId).order('due_date', { ascending: true })
    const { data } = await q
    setJobs(data || [])
  }

  const loadSchedule = async (empId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('shoot_schedule').select('*, clients(business_name)').gte('scheduled_date', today).order('scheduled_date').limit(10)
    // Filter shoots where this employee is in crew
    setSchedule(data?.filter(s => s.crew?.includes(empId)) || [])
  }

  const [schedule, setSchedule] = useState<any[]>([])

  const updateJobStatus = async (jobId: string, newStatus: string) => {
    await supabase.from('jobs').update({ status: newStatus, updated_at: new Date().toISOString(), ...(newStatus==='complete'?{completed_at:new Date().toISOString()}:{}) }).eq('id', jobId)
    if (employee) loadJobs(employee.id)
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadForm.clientId) { setMsg('Select a file and client.'); return }
    setUploading(true); setMsg('')

    // Upload to Supabase storage
    const ext = uploadFile.name.split('.').pop()
    const path = `deliverables/${uploadForm.clientId}/${Date.now()}.${ext}`
    const { error: storageErr } = await supabase.storage.from('deliverables').upload(path, uploadFile)

    if (storageErr) {
      // Storage bucket might not exist - save as external URL placeholder
      setMsg('Storage not configured. Save file URL manually.')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('deliverables').getPublicUrl(path)

    await supabase.from('deliverables').insert({
      client_id: uploadForm.clientId,
      job_id: uploadForm.jobId || null,
      uploaded_by: employee?.id,
      file_name: uploadFile.name,
      file_url: publicUrl,
      file_type: uploadForm.fileType,
      file_size_mb: Math.round(uploadFile.size / 1024 / 1024 * 10) / 10,
      caption: uploadForm.caption || null,
      notes: uploadForm.notes || null,
      status: 'uploaded'
    })

    setMsg('✓ Content uploaded successfully!')
    setUploadFile(null)
    setUploadForm({ jobId:'', clientId:'', caption:'', fileType:'video', notes:'' })
    setUploading(false)
  }

  const activeJobs = filter === 'active' ? jobs.filter(j => !['complete','cancelled'].includes(j.status)) : jobs
  const ROLE_LABELS: Record<string,string> = { account_manager:'Account Manager',editor:'Editor',filmmaker:'Filmmaker',photographer:'Photographer',social_poster:'Social Poster',owner:'Owner' }

  if (!employee) return <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><div className="spinner"/></div>

  return (
    <AppShell>
      <div style={{padding:'20px 16px 0'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div>
            <h1 className="page-title">{employee.full_name.split(' ')[0]}</h1>
            <p className="page-sub">{ROLE_LABELS[employee.role]||employee.role} · {activeJobs.length} open job{activeJobs.length!==1?'s':''}</p>
          </div>
          <div className="avatar" style={{width:40,height:40,fontSize:15}}>{employee.full_name[0]}</div>
        </div>

        <div className="tab-row" style={{marginBottom:16}}>
          {(['jobs','schedule','upload'] as const).map(t=>(
            <button key={t} className={`tab-item ${tab===t?'active':''}`} onClick={()=>setTab(t)} style={{textTransform:'capitalize',fontSize:12}}>
              {t==='jobs'?`📋 Jobs`:t==='schedule'?'📅 Schedule':'⬆️ Upload'}
            </button>
          ))}
        </div>

        {msg && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`} style={{marginBottom:12}}>{msg}<button onClick={()=>setMsg('')} style={{float:'right',background:'none',border:'none',color:'inherit',cursor:'pointer'}}>×</button></div>}

        {/* JOBS */}
        {tab==='jobs' && (
          <>
            <div style={{display:'flex',gap:6,marginBottom:12}}>
              {(['active','all'] as const).map(f=>(
                <button key={f} className={`tab-item ${filter===f?'active':''}`} onClick={()=>setFilter(f)} style={{fontSize:11,textTransform:'capitalize'}}>{f}</button>
              ))}
            </div>
            {activeJobs.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:36,color:'var(--text-3)'}}>
                <div style={{fontSize:32,marginBottom:10}}>✅</div>
                <p>No {filter==='active'?'open ':''} jobs assigned to you.</p>
              </div>
            ) : activeJobs.map(job=>{
              const nextAction = STATUS_NEXT[job.status]
              return (
                <div key={job.id} className="card" style={{marginBottom:10,padding:'14px 16px'}}>
                  <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:10}}>
                    <div style={{fontSize:24,flexShrink:0}}>{JOB_ICONS[job.type]||'📋'}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:3}}>{job.title}</div>
                      <div style={{fontSize:12,color:'var(--accent)',marginBottom:3}}>{job.clients?.business_name}</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <span style={{fontSize:10,color:STATUS_COLORS[job.status],fontWeight:700,textTransform:'uppercase'}}>{job.status?.replace('_',' ')}</span>
                        {job.due_date && <span style={{fontSize:10,color:new Date(job.due_date)<new Date()?'#ef4444':'var(--text-3)'}}>Due {new Date(job.due_date).toLocaleDateString()}</span>}
                        {job.location && <span style={{fontSize:10,color:'var(--text-3)'}}>📍 {job.location}</span>}
                      </div>
                      {job.description && <p style={{fontSize:12,color:'var(--text-3)',marginTop:6,lineHeight:1.5}}>{job.description}</p>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    {nextAction && (
                      <button onClick={()=>updateJobStatus(job.id, nextAction.next)} className="btn btn-sm btn-block" style={{background:`${nextAction.color}20`,color:nextAction.color,border:`1px solid ${nextAction.color}40`,fontSize:12}}>
                        {nextAction.label}
                      </button>
                    )}
                    {job.clients?.id && (
                      <button onClick={()=>setUploadForm(f=>({...f,clientId:job.clients.id,jobId:job.id}))} className="btn btn-ghost btn-sm" style={{flexShrink:0,fontSize:12}}>
                        ⬆️
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* SCHEDULE */}
        {tab==='schedule' && (
          <>
            <p style={{fontSize:13,color:'var(--text-2)',marginBottom:14}}>Upcoming shoots you're assigned to.</p>
            {schedule.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:36,color:'var(--text-3)'}}>No upcoming shoots assigned to you.</div>
            ) : schedule.map(s=>(
              <div key={s.id} className="card" style={{marginBottom:10,padding:'14px 16px',borderLeft:'3px solid var(--accent)'}}>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:4}}>{s.title}</div>
                <div style={{fontSize:12,color:'var(--accent)',marginBottom:6}}>{s.clients?.business_name}</div>
                {[
                  ['📅', new Date(s.scheduled_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})],
                  s.start_time ? ['⏰', `${s.start_time}${s.end_time?' – '+s.end_time:''}`] : null,
                  s.location ? ['📍', s.location] : null,
                  s.address ? ['🗺️', s.address] : null,
                ].filter((x): x is string[] => x !== null).map(([icon,val],i)=>(
                  <div key={i} style={{display:'flex',gap:8,fontSize:12,color:'var(--text-2)',marginBottom:3}}>
                    <span>{icon}</span><span>{val}</span>
                  </div>
                ))}
                {s.notes && <p style={{fontSize:12,color:'var(--text-3)',marginTop:8,lineHeight:1.5,fontStyle:'italic'}}>{s.notes}</p>}
                {s.address && (
                  <a href={`https://maps.google.com?q=${encodeURIComponent(s.address)}`} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                    <button className="btn btn-ghost btn-sm" style={{marginTop:10,width:'100%',fontSize:12}}>Open in Maps →</button>
                  </a>
                )}
              </div>
            ))}
          </>
        )}

        {/* UPLOAD */}
        {tab==='upload' && (
          <>
            <p style={{fontSize:13,color:'var(--text-2)',marginBottom:14}}>Upload finished content to a client's account.</p>
            <div className="card" style={{marginBottom:14}}>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Client *</label>
                  <select className="input" value={uploadForm.clientId} onChange={e=>setUploadForm(f=>({...f,clientId:e.target.value}))}>
                    <option value="">Select client...</option>
                    {jobs.map(j=>j.clients).filter((c,i,a)=>c&&a.findIndex(x=>x?.id===c.id)===i).map(c=>(
                      <option key={c.id} value={c.id}>{c.business_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Content type</label>
                  <select className="input" value={uploadForm.fileType} onChange={e=>setUploadForm(f=>({...f,fileType:e.target.value}))}>
                    {[['video','Raw Video'],['edited_video','Edited Video'],['photo','Raw Photo'],['edited_photo','Edited Photo'],['other','Other']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Caption (optional)</label>
                  <textarea className="input" value={uploadForm.caption} onChange={e=>setUploadForm(f=>({...f,caption:e.target.value}))} placeholder="Write a caption for this content..." rows={2}/>
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>File *</label>
                  <input ref={fileRef} type="file" accept="video/*,image/*" style={{display:'none'}} onChange={e=>setUploadFile(e.target.files?.[0]||null)}/>
                  <button className="btn btn-outline btn-block" onClick={()=>fileRef.current?.click()} style={{fontSize:13}}>
                    {uploadFile ? `✓ ${uploadFile.name}` : '+ Select File'}
                  </button>
                  {uploadFile && <div style={{fontSize:11,color:'var(--text-3)',marginTop:4,textAlign:'center'}}>{(uploadFile.size/1024/1024).toFixed(1)} MB</div>}
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Notes</label>
                  <input className="input" value={uploadForm.notes} onChange={e=>setUploadForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes for the account manager..."/>
                </div>
                <button className="btn btn-primary btn-block" style={{padding:13}} onClick={handleUpload} disabled={uploading||!uploadFile||!uploadForm.clientId}>
                  {uploading?'Uploading...':'Upload Content →'}
                </button>
                <p style={{fontSize:11,color:'var(--text-3)',textAlign:'center'}}>Content will appear in the client's dashboard after upload.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
