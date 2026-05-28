'use client'
import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const MAIN = ''
const ROLE_LABELS: Record<string,string> = { account_manager:'Account Manager', editor:'Editor', filmmaker:'Filmmaker', photographer:'Photographer', social_poster:'Social Poster', owner:'Owner' }
const ROLE_ICONS: Record<string,string> = { account_manager:'👔', editor:'✂️', filmmaker:'🎬', photographer:'📷', social_poster:'📱', owner:'👑' }

export default function Team() {
  const [employees, setEmployees] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ fullName:'', email:'', role:'editor', notes:'' })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    loadTeam()
    if (window.location.search.includes('add')) setShowAdd(true)
  }, [])

  const loadTeam = async () => {
    const { data } = await supabase.from('employees').select(`*, client_managers(client_id, clients(business_name))`).order('created_at', { ascending: false })
    setEmployees(data || [])
  }

  const addEmployee = async () => {
    if (!form.fullName || !form.email) { setMsg('Name and email are required.'); return }
    setSubmitting(true); setMsg('')

    // Create auth account for employee
    const res = await fetch(`/api/admin/create-employee`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: form.fullName, email: form.email, role: form.role })
    })
    const data = await res.json()
    if (!res.ok) { setMsg(data.error || 'Failed'); setSubmitting(false); return }

    // Add to employees table
    await supabase.from('employees').insert({ user_id: data.userId, full_name: form.fullName, email: form.email, role: form.role, notes: form.notes || null })
    setMsg(`✓ ${form.fullName} added to the team!`)
    setShowAdd(false)
    setForm({ fullName:'', email:'', role:'editor', notes:'' })
    await loadTeam()
    setSubmitting(false)
  }

  return (
    <AppShell>
    <div style={{padding:'20px 16px 0'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <h1 className="page-title">Team</h1>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(!showAdd)}>+ Add</button>
      </div>

      {showAdd && (
        <div className="card" style={{marginBottom:16}}>
          <h3 style={{fontSize:16,fontWeight:700,marginBottom:14}}>Add Team Member</h3>
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            <div className="grid-2">
              <div>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Full name *</label>
                <input className="input" value={form.fullName} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))} placeholder="Jake Smith"/>
              </div>
              <div>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Email *</label>
                <input className="input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="jake@wovomedia.com"/>
              </div>
            </div>
            <div>
              <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Role</label>
              <select className="input" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                {Object.entries(ROLE_LABELS).filter(([k])=>k!=='owner').map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:4,fontWeight:600}}>Notes</label>
              <input className="input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Specialties, availability, etc."/>
            </div>
            {msg && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`}>{msg}</div>}
            <button className="btn btn-primary btn-block" onClick={addEmployee} disabled={submitting}>{submitting?'Adding...':'Add to Team →'}</button>
          </div>
        </div>
      )}

      {msg && !showAdd && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`} style={{marginBottom:14}}>{msg}</div>}

      {employees.length === 0 ? (
        <div className="card" style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>No team members yet.</div>
      ) : employees.map(emp=>{
        const clientCount = emp.client_managers?.length || 0
        return (
          <div key={emp.id} className="card" style={{marginBottom:10,padding:'14px 16px'}}>
            <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
              <div className="avatar" style={{width:44,height:44,fontSize:16,flexShrink:0}}>{emp.full_name[0].toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{emp.full_name}</div>
                <div style={{fontSize:12,color:'var(--accent)',marginTop:2}}>{ROLE_ICONS[emp.role]} {ROLE_LABELS[emp.role]}</div>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:3}}>{emp.email}</div>
                {clientCount > 0 && <div style={{fontSize:11,color:'var(--text-3)',marginTop:3}}>{clientCount} client{clientCount!==1?'s':''} assigned</div>}
              </div>
              <span className={`badge ${emp.is_active?'badge-green':'badge-gray'}`} style={{fontSize:10,flexShrink:0}}>{emp.is_active?'Active':'Inactive'}</span>
            </div>
          </div>
        )
      })}
    </div>
  </AppShell>
  )
}
