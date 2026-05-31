'use client'
import { useState, useEffect } from 'react'
import { supabase as sb } from '@/lib/supabase'
import Link from 'next/link'

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [editUser, setEditUser] = useState<any>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    if (data.users) setUsers(data.users)
    setLoading(false)
  }

  const updateUser = async (userId: string, updates: any) => {
    setWorking(true)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...updates })
    })
    const data = await res.json()
    if (data.success) { setMsg('✓ Updated'); loadUsers(); setEditUser(null) }
    else setMsg('Error: ' + data.error)
    setWorking(false)
  }

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Delete account for ${email}? This cannot be undone.`)) return
    setWorking(true)
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })
    const data = await res.json()
    if (data.success) { setMsg('✓ Account deleted'); loadUsers() }
    else setMsg('Error: ' + data.error)
    setWorking(false)
  }

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const ROLES = ['client','employee','content_manager','customer_service','admin','owner']
  const ROLE_COLORS: Record<string,string> = { owner:'accent', admin:'accent', client:'gray', employee:'gray', content_manager:'green', customer_service:'green' }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>

      {/* Edit Modal */}
      {editUser && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div className="card slide-up" style={{width:460,position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{fontSize:18,fontWeight:700}}>Edit Account</h3>
              <button onClick={()=>setEditUser(null)} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:22}}>×</button>
            </div>
            <div style={{background:'var(--bg-3)',borderRadius:9,padding:'12px 16px',marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>{editUser.full_name||'No name'}</div>
              <div style={{fontSize:13,color:'var(--text-3)'}}>{editUser.email}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Change email</label>
                <input className="input" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="New email address"/>
              </div>
              <div>
                <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Reset password</label>
                <input className="input" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password (min 8 chars)"/>
              </div>
              <div>
                <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Role</label>
                <select className="input" value={editUser.wovo_role} onChange={e=>setEditUser({...editUser,wovo_role:e.target.value})}>
                  {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1,padding:12}} disabled={working} onClick={()=>{
                  const updates: any = { role: editUser.wovo_role }
                  if (newEmail.trim()) updates.email = newEmail.trim()
                  if (newPassword.trim()) updates.password = newPassword.trim()
                  updateUser(editUser.user_id, updates)
                }}>{working?'Saving...':'Save Changes'}</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>setEditUser(null)}>Cancel</button>
              </div>
              <button className="btn btn-danger" style={{width:'100%'}} onClick={()=>deleteUser(editUser.user_id, editUser.email)}>
                Delete Account Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 32px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontFamily:'Outfit,sans-serif',fontSize:18,fontWeight:800,letterSpacing:'-0.04em'}}>wovo<span style={{color:'var(--accent)'}}>media</span><span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>User Management</span></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Link href="/dashboard/owner"><button className="btn btn-ghost btn-sm">← Dashboard</button></Link>
          
        </div>
      </nav>

      <div style={{maxWidth:1000,margin:'0 auto',padding:'32px',position:'relative',zIndex:2}}>
        {msg && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`} style={{marginBottom:20}}>{msg}</div>}

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <h1 style={{fontSize:26,fontWeight:700}}>All Accounts</h1>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or email..." style={{width:240}}/>
            <span style={{fontSize:13,color:'var(--text-3)'}}>{filtered.length} accounts</span>
          </div>
        </div>

        <div className="card" style={{padding:0,overflow:'hidden'}}>
          {loading ? <div style={{padding:'40px',textAlign:'center',color:'var(--text-3)'}}>Loading...</div> :
          filtered.length === 0 ? <div style={{padding:'40px',textAlign:'center',color:'var(--text-3)'}}>No accounts found</div> :
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.user_id}>
                  <td style={{color:'var(--text)',fontWeight:500,fontSize:14}}>{u.full_name||'—'}</td>
                  <td style={{fontSize:13}}>{u.email}</td>
                  <td>
                    <span className={`badge badge-${ROLE_COLORS[u.wovo_role]||'gray'}`}>{u.wovo_role}</span>
                  </td>
                  <td style={{fontSize:12,color:'var(--text-3)'}}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>{setEditUser(u);setNewEmail('');setNewPassword('')}}>Edit</button>
                      <button className="btn btn-danger btn-sm" style={{padding:'5px 10px',fontSize:12}} onClick={()=>deleteUser(u.user_id, u.email)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
      </div>
    </div>
  )
}
