'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [tab, setTab] = useState<'login'|'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [terms, setTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // 1 second max to check existing session - then show form regardless
    const timeout = setTimeout(() => setChecking(false), 1000)
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout)
      if (!session?.user) { setChecking(false); return }
      // Get role from metadata - zero DB call needed
      const role = session.user.user_metadata?.wovo_role || 'client'
      const routes: Record<string, string> = {
        owner: '/admin', admin: '/admin',
        content_manager: '/employee', customer_service: '/employee',
        employee: '/employee', client: '/home'
      }
      window.location.replace(routes[role] || '/home')
    }).catch(() => { clearTimeout(timeout); setChecking(false) })
    return () => clearTimeout(timeout)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message.includes('Invalid') ? 'Incorrect email or password.' : err.message)
      setLoading(false)
      return
    }

    // Get role from metadata first (no DB) - fall back to DB only if missing
    let role = data.user.user_metadata?.wovo_role
    if (!role) {
      const { data: p } = await supabase.from('profiles').select('wovo_role').eq('user_id', data.user.id).single()
      role = p?.wovo_role || 'client'
      // Cache it so next login is instant
      supabase.auth.updateUser({ data: { wovo_role: role } }).catch(() => {})
    }

    const routes: Record<string, string> = {
      owner: '/admin', admin: '/admin',
      content_manager: '/employee', customer_service: '/employee',
      employee: '/employee', client: '/home'
    }
    window.location.replace(routes[role] || '/home')
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!terms) { setError('Please accept the Terms of Service.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, businessName })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Signup failed.'); setLoading(false); return }
    setSuccess(email); setLoading(false)
  }

  if (checking) return (
    <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="spinner"/>
    </div>
  )

  if (success) return (
    <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{textAlign:'center',maxWidth:340}}>
        <div style={{fontSize:48,marginBottom:16}}>🎉</div>
        <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:24,fontWeight:800,color:'var(--text)',marginBottom:10}}>You're in!</h2>
        <p style={{fontSize:14,color:'var(--text-2)',marginBottom:24,lineHeight:1.65}}>Check <strong style={{color:'var(--text)'}}>{success}</strong> for your welcome email.</p>
        <button className="btn btn-primary btn-block" style={{padding:14}} onClick={()=>{setSuccess('');setTab('login')}}>Log In →</button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24}}>
      <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:24,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em',marginBottom:32}}>
        wovo<span style={{color:'var(--accent)'}}>media</span>
      </Link>
      <div style={{width:'100%',maxWidth:360}}>
        <div className="tab-row" style={{marginBottom:20}}>
          <button className={`tab-item ${tab==='login'?'active':''}`} onClick={()=>{setTab('login');setError('')}}>Log In</button>
          <button className={`tab-item ${tab==='signup'?'active':''}`} onClick={()=>{setTab('signup');setError('')}}>Sign Up</button>
        </div>
        {error && <div className="alert alert-error" style={{marginBottom:14,fontSize:13}}>{error}</div>}
        {tab==='login' ? (
          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:12}}>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="Email address" required autoComplete="email" style={{fontSize:16}}/>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="Password" required autoComplete="current-password" style={{fontSize:16}}/>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{padding:14,fontSize:15,marginTop:2}}>
              {loading
                ? <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                    <span style={{width:15,height:15,border:'2px solid rgba(0,0,0,0.25)',borderTopColor:'#080808',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/>
                    Signing in...
                  </span>
                : 'Sign In'}
            </button>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginTop:2}}>
              <button type="button" onClick={()=>setTab('signup')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontFamily:'inherit',fontWeight:600,fontSize:13,padding:0}}>Create account</button>
              <Link href="/reset-password" style={{color:'var(--text-3)',textDecoration:'none',fontSize:13}}>Forgot password?</Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup} style={{display:'flex',flexDirection:'column',gap:12}}>
            <input className="input" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name" required autoComplete="name" style={{fontSize:16}}/>
            <input className="input" value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="Business name (optional)" style={{fontSize:16}}/>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" required autoComplete="email" style={{fontSize:16}}/>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (min 8 chars)" minLength={8} required autoComplete="new-password" style={{fontSize:16}}/>
            <div className="policy-check">
              <input type="checkbox" id="terms" checked={terms} onChange={e=>setTerms(e.target.checked)}/>
              <label htmlFor="terms" style={{fontSize:12,lineHeight:1.5,color:'var(--text-2)'}}>
                I agree to the <Link href="/terms" target="_blank" style={{color:'var(--accent)'}}>Terms</Link> and <Link href="/privacy" target="_blank" style={{color:'var(--accent)'}}>Privacy Policy</Link>
              </label>
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading||!fullName||!email||!password||!terms} style={{padding:14,fontSize:15}}>
              {loading
                ? <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                    <span style={{width:15,height:15,border:'2px solid rgba(0,0,0,0.25)',borderTopColor:'#080808',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/>
                    Creating...
                  </span>
                : 'Create Account'}
            </button>
          </form>
        )}
      </div>
      <p style={{fontSize:12,color:'var(--text-3)',marginTop:28}}>Need help? <a href="mailto:support@wovomedia.com" style={{color:'var(--accent)'}}>support@wovomedia.com</a></p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
