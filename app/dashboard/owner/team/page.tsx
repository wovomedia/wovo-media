'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const ROLES = ['content_manager','customer_service','employee']
const ROLE_LABELS: Record<string,string> = { content_manager:'Content Manager', customer_service:'Customer Service', employee:'Team Member', admin:'Admin', owner:'Owner' }

function randCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('')
}

export default function TeamManagement() {
  const [team, setTeam] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ full_name:'', role:'employee', email:'' })
  const [newCode, setNewCode] = useState(randCode())
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [createdMember, setCreatedMember] = useState<any>(null)

  useEffect(()=>{
    sb.auth.getUser().then(({data})=>{
      if(!data.user){window.location.href='/login';return}
      loadTeam()
    })
  },[])

  const loadTeam = async () => {
    const { data } = await sb.from('profiles').select('user_id,full_name,wovo_role,employee_code,created_at').in('wovo_role',['employee','content_manager','customer_service','admin']).order('created_at',{ascending:false})
    if(data) setTeam(data)
  }

  const createEmployee = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMsg('')
    const code = newCode.trim().toUpperCase()

    // Check code not taken
    const { data: existing } = await sb.from('profiles').select('user_id').eq('employee_code', code).single()
    if(existing){ setMsg('That code is already taken. Generate a new one.'); setLoading(false); return }

    // Create auth user if email provided, otherwise just create a profile entry
    let userId = crypto.randomUUID()
    if(form.email) {
      const tempPass = Math.random().toString(36).slice(-10)+'A1!'
      const res = await fetch('/api/admin/create-employee', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email:form.email, password:tempPass, fullName:form.full_name, role:form.role, code }) })
      const d = await res.json()
      if(d.userId) userId = d.userId
    } else {
      await sb.from('profiles').insert({ user_id:userId, full_name:form.full_name, wovo_role:form.role, employee_code:code })
    }

    setCreatedMember({ name:form.full_name, role:form.role, code, email:form.email })
    setForm({full_name:'',role:'employee',email:''})
    setNewCode(randCode())
    setShowAdd(false)
    setLoading(false)
    loadTeam()
  }

  const resetCode = async (uid: string) => {
    const code = randCode()
    await sb.from('profiles').update({ employee_code:code }).eq('user_id',uid)
    setMsg(`✓ Code reset`)
    loadTeam()
  }

  const removeEmployee = async (uid: string) => {
    if(!confirm('Remove this team member?')) return
    await sb.from('profiles').update({ wovo_role:'client', employee_code:null }).eq('user_id',uid)
    loadTeam()
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 32px',borderBottom:'0.5px solid var(--border)',background:'rgba(8,8,8,0.94)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700}}>wovo<span style={{color:'var(--accent)'}}>media</span><span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>Team Management</span></div>
        <div style={{display:'flex',gap:8}}>
          <Link href="/dashboard/owner"><button className="btn btn-ghost btn-sm">← Owner Dashboard</button></Link>
          <button className="btn btn-primary btn-sm" onClick={()=>{setShowAdd(true);setNewCode(randCode())}}>+ Add Team Member</button>
        </div>
      </nav>

      <div style={{maxWidth:860,margin:'0 auto',padding:'40px 32px',position:'relative',zIndex:2}}>
        {msg && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`} style={{marginBottom:20}}>{msg}</div>}

        {/* ADD MODAL */}
        {showAdd && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div className="card slide-up" style={{width:480}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
                <h3 style={{fontSize:20,fontWeight:700}}>Add Team Member</h3>
                <button onClick={()=>setShowAdd(false)} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:22}}>×</button>
              </div>
              {msg && <div className="alert alert-error">{msg}</div>}
              <form onSubmit={createEmployee} style={{display:'flex',flexDirection:'column',gap:16}}>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Full name *</label>
                  <input className="input" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="Team member's full name" required/>
                </div>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Role *</label>
                  <select className="input" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                    {ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Email <span style={{color:'var(--text-3)',fontWeight:400}}>(optional — for email login too)</span></label>
                  <input className="input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="Their email address"/>
                </div>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Employee Code *</label>
                  <div style={{display:'flex',gap:8}}>
                    <input className="input" value={newCode} onChange={e=>setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} maxLength={8} style={{fontSize:20,fontWeight:700,letterSpacing:'0.15em',textAlign:'center',fontFamily:'Syne,sans-serif'}} required/>
                    <button type="button" className="btn btn-ghost" style={{flexShrink:0,padding:'0 14px'}} onClick={()=>setNewCode(randCode())}>🔀</button>
                  </div>
                  <p style={{fontSize:12,color:'var(--text-3)',marginTop:6}}>They'll use this code to log in. They can change it later.</p>
                </div>
                <div style={{background:'var(--accent-dim)',border:'0.5px solid var(--accent-border)',borderRadius:9,padding:'12px 16px',fontSize:13,color:'var(--accent)'}}>
                  Share this code with them: <strong>{newCode}</strong>. They log in at wovomedia.com/login → Employee tab.
                </div>
                <button className="btn btn-primary" type="submit" style={{padding:13,fontSize:15}} disabled={loading}>{loading?'Creating...':'Create Team Member'}</button>
              </form>
            </div>
          </div>
        )}

        {/* SUCCESS - show new member code */}
        {createdMember && (
          <div className="card card-accent" style={{marginBottom:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontSize:11,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600,marginBottom:6}}>Team member created ✓</div>
                <h3 style={{fontSize:18,fontWeight:600,marginBottom:4}}>{createdMember.name}</h3>
                <p style={{fontSize:14,color:'var(--text-2)',marginBottom:12}}>{ROLE_LABELS[createdMember.role]}{createdMember.email?` · ${createdMember.email}`:''}</p>
                <div style={{fontSize:13,color:'var(--text-3)',marginBottom:4}}>Share this login code:</div>
                <div style={{fontSize:32,fontWeight:700,fontFamily:'Syne,sans-serif',color:'var(--accent)',letterSpacing:'0.15em'}}>{createdMember.code}</div>
                <div style={{fontSize:12,color:'var(--text-3)',marginTop:4}}>Login: wovomedia.com/login → Employee tab</div>
              </div>
              <button onClick={()=>setCreatedMember(null)} style={{background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:20}}>×</button>
            </div>
          </div>
        )}

        <h2 style={{fontSize:24,fontWeight:700,marginBottom:20}}>Team Members</h2>
        <div className="card">
          {team.length===0
            ? <p style={{textAlign:'center',padding:'40px 0',color:'var(--text-3)',fontSize:15}}>No team members yet. Add your first one above.</p>
            : <table>
                <thead><tr><th>Name</th><th>Role</th><th>Code</th><th>Actions</th></tr></thead>
                <tbody>
                  {team.map(m=>(
                    <tr key={m.user_id}>
                      <td style={{color:'var(--text)',fontWeight:500,fontSize:15}}>{m.full_name||'—'}</td>
                      <td><span className="badge badge-gray">{ROLE_LABELS[m.wovo_role]||m.wovo_role}</span></td>
                      <td><span style={{fontFamily:'monospace',fontSize:15,fontWeight:600,color:'var(--accent)',letterSpacing:'0.1em'}}>{m.employee_code||'—'}</span></td>
                      <td style={{display:'flex',gap:8}}>
                        <button className="btn btn-ghost btn-sm" onClick={()=>resetCode(m.user_id)}>Reset Code</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>removeEmployee(m.user_id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>
    </div>
  )
}
