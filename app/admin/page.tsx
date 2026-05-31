'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'

export default function AdminHome() {
  const [stats, setStats] = useState({ clients: 0, active: 0, jobs: 0, pendingJobs: 0, employees: 0 })
  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const data = { user: session?.user }
      if (!data.user) { window.location.replace('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('wovo_role').eq('user_id', data.user.id).single()
      if (!profile || !['owner','admin'].includes(profile.wovo_role)) { window.location.href = '/home'; return }

      const [c, j, e] = await Promise.all([
        supabase.from('clients').select('id, is_active'),
        supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('employees').select('id').eq('is_active', true)
      ])

      setStats({
        clients: c.data?.length || 0,
        active: c.data?.filter(x => x.is_active).length || 0,
        jobs: j.data?.length || 0,
        pendingJobs: j.data?.filter(x => x.status === 'pending' || x.status === 'in_progress').length || 0,
        employees: e.data?.length || 0
      })
      setRecentJobs(j.data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><div className="spinner"/></div>

  const STATUS_COLOR: Record<string,string> = {
    pending: '#f59e0b', in_progress: '#00E5C8', needs_review: '#8b5cf6',
    approved: '#22c55e', complete: '#22c55e', cancelled: '#ef4444'
  }

  return (
    <AppShell>
    <div style={{padding:'20px 16px 0'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <div style={{fontFamily:'Outfit,sans-serif',fontSize:22,fontWeight:800,letterSpacing:'-0.04em',color:'var(--text)'}}>wovo<span style={{color:'var(--accent)'}}>media</span></div>
          <div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>Owner Dashboard</div>
        </div>
        <Link href="/home"><button className="btn btn-ghost btn-sm">Client view</button></Link>
      </div>

      {/* Stats */}
      <div className="grid-2" style={{marginBottom:14}}>
        {[
          ['👥', stats.active, 'Active Clients', '/admin/clients'],
          ['⚡', stats.pendingJobs, 'Open Jobs', '/admin/jobs'],
          ['👔', stats.employees, 'Employees', '/admin/team'],
          ['📋', stats.clients, 'Total Clients', '/admin/clients'],
        ].map(([icon,val,label,href])=>(
          <Link key={label as string} href={href as string} style={{textDecoration:'none'}}>
            <div className="stat-card" style={{cursor:'pointer'}}>
              <div style={{fontSize:20,marginBottom:6}}>{icon}</div>
              <div className="stat-num">{val}</div>
              <div className="stat-label">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid-2" style={{marginBottom:16}}>
        <Link href="/admin/clients?action=onboard" style={{textDecoration:'none'}}>
          <button className="btn btn-primary btn-block" style={{padding:13,fontSize:13}}>➕ Onboard Client</button>
        </Link>
        <Link href="/admin/jobs?action=new" style={{textDecoration:'none'}}>
          <button className="btn btn-outline btn-block" style={{padding:13,fontSize:13}}>📋 Create Job</button>
        </Link>
        <Link href="/admin/schedule" style={{textDecoration:'none'}}>
          <button className="btn btn-outline btn-block" style={{padding:13,fontSize:13}}>📅 Schedule Shoot</button>
        </Link>
        <Link href="/admin/team?action=add" style={{textDecoration:'none'}}>
          <button className="btn btn-outline btn-block" style={{padding:13,fontSize:13}}>👔 Add Employee</button>
        </Link>
      </div>

      {/* Recent jobs */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div className="section-label" style={{margin:0}}>Recent jobs</div>
        <Link href="/admin/jobs" style={{fontSize:12,color:'var(--accent)',textDecoration:'none',fontWeight:600}}>See all →</Link>
      </div>
      {recentJobs.slice(0,5).map(job=>(
        <Link key={job.id} href={`/admin/jobs/${job.id}`} style={{textDecoration:'none'}}>
          <div className="card" style={{marginBottom:8,padding:'12px 14px',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{job.title}</div>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:2,textTransform:'capitalize'}}>{job.type?.replace('_',' ')} · {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'No due date'}</div>
              </div>
              <div style={{width:8,height:8,borderRadius:'50%',background:STATUS_COLOR[job.status]||'#666',marginTop:4,flexShrink:0,marginLeft:10}}/>
            </div>
          </div>
        </Link>
      ))}
    </div>
  </AppShell>
  )
}
