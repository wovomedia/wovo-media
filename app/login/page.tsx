'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    const { data: profile } = await sb.from('profiles').select('wovo_role').eq('user_id', data.user.id).single()
    const routes: Record<string,string> = { owner:'/dashboard/owner', admin:'/dashboard/admin', content_manager:'/dashboard/content', customer_service:'/dashboard/support', employee:'/dashboard/employee', client:'/dashboard/client' }
    window.location.href = routes[profile?.wovo_role || 'client'] || '/dashboard/client'
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div className="card slide-up" style={{width:400,position:'relative',zIndex:2}}>
        <Link href="/" style={{display:'block',fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:700,color:'var(--text)',textDecoration:'none',marginBottom:28,textAlign:'center'}}>wovo<span style={{color:'var(--accent)'}}>media</span></Link>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:6,textAlign:'center'}}>Welcome back</h2>
        <p style={{color:'var(--text-2)',fontSize:14,textAlign:'center',marginBottom:28}}>Sign in to your account</p>
        {error && <div style={{background:'rgba(255,80,80,0.1)',border:'0.5px solid rgba(255,80,80,0.3)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#ff5050',marginBottom:16}}>{error}</div>}
        <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@business.com" required/></div>
          <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/></div>
          <button className="btn btn-primary" type="submit" style={{width:'100%',padding:13}} disabled={loading}>{loading?'Signing in...':'Sign in'}</button>
        </form>
        <p style={{fontSize:13,color:'var(--text-3)',textAlign:'center',marginTop:16}}><Link href="/reset-password" style={{color:'var(--text-3)',textDecoration:'none'}}>Forgot password?</Link></p>
      </div>
    </div>
  )
}
