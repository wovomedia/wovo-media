'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function Account() {
  const [user, setUser] = useState<any>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    sb.auth.getUser().then(({data}) => { if(data.user) { setUser(data.user) } else { window.location.href='/login' } })
  }, [])

  const updateEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMsg(''); setError('')
    const { error } = await sb.auth.updateUser({ email: newEmail })
    if(error) setError(error.message)
    else { setMsg('Check your new email to confirm the change.'); setNewEmail('') }
    setLoading(false)
  }

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMsg(''); setError('')
    if(newPassword !== confirmPassword) { setError("Passwords don't match"); setLoading(false); return }
    const { error } = await sb.auth.updateUser({ password: newPassword })
    if(error) setError(error.message)
    else { setMsg('Password updated successfully.'); setNewPassword(''); setConfirmPassword('') }
    setLoading(false)
  }

  const signOut = async () => { await sb.auth.signOut(); window.location.href = '/' }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 48px',borderBottom:'0.5px solid var(--border)',background:'rgba(8,8,8,0.92)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:100}}>
        <Link href="/" style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:700,color:'var(--text)',textDecoration:'none'}}>wovo<span style={{color:'var(--accent)'}}>media</span></Link>
        <div style={{display:'flex',gap:12}}>
          <Link href="/dashboard/client"><button className="btn btn-ghost btn-sm">← Dashboard</button></Link>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </nav>
      <div style={{maxWidth:540,margin:'0 auto',padding:'48px 32px',position:'relative',zIndex:2}}>
        <h1 style={{fontSize:28,fontWeight:700,marginBottom:4}}>Account Settings</h1>
        <p style={{color:'var(--text-2)',marginBottom:40}}>Manage your email, password, and account.</p>
        {msg && <div style={{background:'var(--accent-dim)',border:'0.5px solid var(--accent-border)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'var(--accent)',marginBottom:20}}>{msg}</div>}
        {error && <div style={{background:'rgba(255,80,80,0.1)',border:'0.5px solid rgba(255,80,80,0.3)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#ff5050',marginBottom:20}}>{error}</div>}
        
        <div className="card" style={{marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:600,marginBottom:4}}>Current email</h3>
          <p style={{fontSize:14,color:'var(--text-2)',marginBottom:20}}>{user?.email}</p>
          <form onSubmit={updateEmail} style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>New email address</label><input className="input" type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="newemail@business.com" required/></div>
            <button className="btn btn-primary btn-sm" type="submit" disabled={loading||!newEmail}>Update email</button>
          </form>
        </div>

        <div className="card" style={{marginBottom:16}}>
          <h3 style={{fontSize:15,fontWeight:600,marginBottom:16}}>Change password</h3>
          <form onSubmit={updatePassword} style={{display:'flex',flexDirection:'column',gap:12}}>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>New password</label><input className="input" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Min 8 characters" minLength={8} required/></div>
            <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Confirm password</label><input className="input" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Same as above" required/></div>
            <button className="btn btn-primary btn-sm" type="submit" disabled={loading||!newPassword}>Update password</button>
          </form>
        </div>

        <div className="card" style={{borderColor:'rgba(255,80,80,0.2)'}}>
          <h3 style={{fontSize:15,fontWeight:600,marginBottom:8}}>Sign out</h3>
          <p style={{fontSize:13,color:'var(--text-2)',marginBottom:16}}>Sign out of your Wovo Media account on this device.</p>
          <button className="btn btn-ghost btn-sm" onClick={signOut} style={{borderColor:'rgba(255,80,80,0.3)',color:'#ff8080'}}>Sign out</button>
        </div>
      </div>
    </div>
  )
}
