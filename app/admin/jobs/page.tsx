'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'

const JOB_ICONS: Record<string,string> = { shoot:'🎬',edit:'✂️',photo_shoot:'📷',post_content:'📱',write_report:'📊',strategy_call:'📞',onboarding:'👋',other:'📋' }
const STATUS_COLORS: Record<string,string> = { pending:'#f59e0b',in_progress:'#00E5C8',needs_review:'#8b5cf6',approved:'#22c55e',complete:'#22c55e',cancelled:'#ef4444' }

export default function Jobs() {
  const [jobs, setJobs] = useState<any[]>([])
  const [filter, setFilter] = useState<'all'|'pending'|'in_progress'|'needs_review'>('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadJobs() }, [filter])

  const loadJobs = async () => {
    let q = supabase.from('jobs').select('*, clients(business_name)').order('due_date', { ascending: true })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setJobs(data || [])
    setLoading(false)
  }

  const updateStatus = async (jobId: string, status: string) => {
    await supabase.from('jobs').update({ status, updated_at: new Date().toISOString(), ...(status==='complete'?{completed_at:new Date().toISOString()}:{}) }).eq('id', jobId)
    await loadJobs()
  }

  return (
    <AppShell>
    <div style={{padding:'20px 16px 0'}}>
      <h1 className="page-title" style={{marginBottom:14}}>Jobs</h1>

      <div className="tab-row" style={{marginBottom:16}}>
        {(['pending','in_progress','needs_review','all'] as const).map(f=>(
          <button key={f} className={`tab-item ${filter===f?'active':''}`} onClick={()=>setFilter(f)} style={{fontSize:10,textTransform:'capitalize'}}>
            {f.replace('_',' ')}
          </button>
        ))}
      </div>

      {loading ? <div style={{textAlign:'center',padding:40}}><div className="spinner" style={{margin:'0 auto'}}/></div> :
        jobs.length === 0 ? <div className="card" style={{textAlign:'center',padding:32,color:'var(--text-3)'}}>No jobs in this category.</div> :
        jobs.map(job=>(
          <div key={job.id} className="card" style={{marginBottom:10,padding:'12px 14px'}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <div style={{fontSize:24,flexShrink:0,marginTop:1}}>{JOB_ICONS[job.type]||'📋'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:2}}>{job.title}</div>
                <div style={{fontSize:11,color:'var(--accent)',marginBottom:4}}>{job.clients?.business_name}</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:10,color:STATUS_COLORS[job.status],fontWeight:700,textTransform:'uppercase'}}>{job.status?.replace('_',' ')}</span>
                  {job.due_date && <span style={{fontSize:10,color:'var(--text-3)'}}>Due {new Date(job.due_date).toLocaleDateString()}</span>}
                </div>
                {/* Quick status actions */}
                <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}>
                  {job.status==='pending' && <button onClick={()=>updateStatus(job.id,'in_progress')} className="btn btn-sm" style={{fontSize:10,padding:'4px 9px',background:'rgba(0,229,200,0.1)',color:'var(--accent)',border:'1px solid var(--accent-border)'}}>Start →</button>}
                  {job.status==='in_progress' && <button onClick={()=>updateStatus(job.id,'needs_review')} className="btn btn-sm" style={{fontSize:10,padding:'4px 9px',background:'rgba(139,92,246,0.1)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.2)'}}>Submit for review</button>}
                  {job.status==='needs_review' && <button onClick={()=>updateStatus(job.id,'approved')} className="btn btn-sm" style={{fontSize:10,padding:'4px 9px',background:'rgba(34,197,94,0.1)',color:'#22c55e',border:'1px solid rgba(34,197,94,0.2)'}}>Approve ✓</button>}
                  {job.status==='approved' && <button onClick={()=>updateStatus(job.id,'complete')} className="btn btn-sm" style={{fontSize:10,padding:'4px 9px',background:'rgba(34,197,94,0.1)',color:'#22c55e',border:'1px solid rgba(34,197,94,0.2)'}}>Mark Complete</button>}
                  <Link href={`/admin/clients/${job.client_id}`} style={{textDecoration:'none'}}><button className="btn btn-ghost btn-sm" style={{fontSize:10,padding:'4px 9px'}}>View Client →</button></Link>
                </div>
              </div>
            </div>
          </div>
        ))
      }
    </div>
  </AppShell>
  )
}
