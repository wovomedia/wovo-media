'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase as sb } from '@/lib/supabase'

export default function TeamDashboard() {
  const [empName, setEmpName] = useState('')
  const [empRole, setEmpRole] = useState('')
  const [empCode, setEmpCode] = useState('')
  const [empUid, setEmpUid] = useState('')
  const [newCode, setNewCode] = useState('')
  const [codeMsg, setCodeMsg] = useState('')
  const [tab, setTab] = useState<'home'|'code'>('home')

  useEffect(() => {
    const name = localStorage.getItem('emp_name') || ''
    const role = localStorage.getItem('emp_role') || ''
    const code = localStorage.getItem('emp_code') || ''
    const uid = localStorage.getItem('emp_uid') || ''
    if (!code) { window.location.href = '/login'; return }
    setEmpName(name); setEmpRole(role); setEmpCode(code); setEmpUid(uid)
  }, [])

  const changeCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = newCode.trim().toUpperCase()
    if (code.length < 4) { setCodeMsg('Code must be at least 4 characters.'); return }
    const { error } = await sb.from('profiles').update({ employee_code: code }).eq('user_id', empUid)
    if (error) { setCodeMsg('That code is already taken. Try another.'); return }
    localStorage.setItem('emp_code', code)
    setEmpCode(code)
    setNewCode('')
    setCodeMsg('✓ Employee code updated!')
  }

  const signOut = () => {
    localStorage.removeItem('emp_code')
    localStorage.removeItem('emp_role')
    localStorage.removeItem('emp_name')
    localStorage.removeItem('emp_uid')
    window.location.href = '/login'
  }

  const roleLabel: Record<string,string> = {
    content_manager:'Content Manager', customer_service:'Customer Service',
    employee:'Team Member', admin:'Admin', owner:'Owner'
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 32px',borderBottom:'0.5px solid var(--border)',background:'rgba(8,8,8,0.94)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700}}>wovo<span style={{color:'var(--accent)'}}>media</span><span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>Team</span></div>
        <div style={{display:'flex',gap:6}}>
          {(['home','code'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?'var(--accent-dim)':'transparent',border:'0.5px solid',borderColor:tab===t?'var(--accent-border)':'transparent',color:tab===t?'var(--accent)':'var(--text-2)',padding:'8px 16px',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
              {t==='home'?'Dashboard':'My Code'}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
      </nav>

      <div style={{maxWidth:700,margin:'0 auto',padding:'40px 32px',position:'relative',zIndex:2}}>
        {tab==='home' && (
          <>
            <div style={{marginBottom:32}}>
              <h1 style={{fontSize:28,fontWeight:700,marginBottom:6}}>Hey, {empName?.split(' ')[0] || 'there'} 👋</h1>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span className="badge badge-accent">{roleLabel[empRole] || empRole}</span>
                <span style={{fontSize:13,color:'var(--text-3)'}}>Code: <span style={{color:'var(--text-2)',fontFamily:'monospace',fontWeight:600}}>{empCode}</span></span>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div className="card" style={{textAlign:'center',padding:32}}>
                <div style={{fontSize:32,marginBottom:12}}>📋</div>
                <h3 style={{fontSize:17,fontWeight:600,marginBottom:6}}>Assigned Clients</h3>
                <p style={{fontSize:14,color:'var(--text-2)'}}>View and manage your assigned client accounts.</p>
              </div>
              <div className="card" style={{textAlign:'center',padding:32}}>
                <div style={{fontSize:32,marginBottom:12}}>✏️</div>
                <h3 style={{fontSize:17,fontWeight:600,marginBottom:6}}>Content Queue</h3>
                <p style={{fontSize:14,color:'var(--text-2)'}}>Review and schedule upcoming posts.</p>
              </div>
            </div>
            <div className="card" style={{marginTop:14,padding:24}}>
              <h3 style={{fontSize:16,fontWeight:600,marginBottom:4}}>Need help?</h3>
              <p style={{fontSize:14,color:'var(--text-2)'}}>Reach Payton directly at <a href="mailto:Payton@wovomedia.com" style={{color:'var(--accent)'}}>Payton@wovomedia.com</a> or (931) 458-3255.</p>
            </div>
          </>
        )}

        {tab==='code' && (
          <>
            <h1 style={{fontSize:28,fontWeight:700,marginBottom:6}}>My Employee Code</h1>
            <p style={{color:'var(--text-2)',marginBottom:32}}>Your code is how you log in. Keep it somewhere safe.</p>
            <div className="card card-accent" style={{marginBottom:16,textAlign:'center',padding:36}}>
              <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>Current Code</div>
              <div style={{fontSize:44,fontWeight:700,fontFamily:'Syne,sans-serif',color:'var(--accent)',letterSpacing:'0.15em'}}>{empCode}</div>
            </div>
            <div className="card">
              <h3 style={{fontSize:17,fontWeight:600,marginBottom:16}}>Change your code</h3>
              {codeMsg && <div className={`alert ${codeMsg.startsWith('✓')?'alert-success':'alert-error'}`}>{codeMsg}</div>}
              <form onSubmit={changeCode} style={{display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>New code (4–8 characters)</label>
                  <input
                    className="input"
                    value={newCode}
                    onChange={e=>setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                    placeholder="E.g. JAKE42"
                    maxLength={8}
                    style={{fontSize:22,fontWeight:700,letterSpacing:'0.15em',textAlign:'center',fontFamily:'Syne,sans-serif'}}
                    required
                  />
                  <p style={{fontSize:12,color:'var(--text-3)',marginTop:6}}>Letters and numbers only. At least 4 characters.</p>
                </div>
                <button className="btn btn-primary" type="submit" style={{padding:13,fontSize:15}} disabled={newCode.length<4}>Update Code</button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
