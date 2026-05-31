'use client'
import { useState } from 'react'
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
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Incorrect email or password.'); setLoading(false); return }
      // Set session client-side then redirect immediately
      await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
      window.location.replace(data.redirect || '/home')
    } catch {
      setError('Connection error. Check your internet and try again.')
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!terms) { setError('Please accept the Terms of Service to continue.'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, businessName })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Signup failed.'); setLoading(false); return }
    setSuccess(email)
    setLoading(false)
  }

  if (success) return (
    <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{textAlign:'center',maxWidth:340}}>
        <div style={{fontSize:52,marginBottom:16}}>🎉</div>
        <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:24,fontWeight:800,color:'var(--text)',marginBottom:10,letterSpacing:'-0.03em'}}>You're in!</h2>
        <p style={{fontSize:14,color:'var(--text-2)',marginBottom:24,lineHeight:1.65}}>Check <strong style={{color:'var(--text)'}}>{success}</strong> for your welcome email. Then log in below.</p>
        <button className="btn btn-primary btn-block" style={{padding:14,fontSize:15}} onClick={()=>{setSuccess('');setTab('login')}}>Log In →</button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24}}>
      {/* Logo */}
      <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:26,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em',marginBottom:36}}>
        wovo<span style={{color:'var(--accent)'}}>media</span>
      </Link>

      <div style={{width:'100%',maxWidth:380}}>
        {/* Tabs */}
        <div className="tab-row" style={{marginBottom:24}}>
          <button className={`tab-item ${tab==='login'?'active':''}`} onClick={()=>{setTab('login');setError('')}}>Log In</button>
          <button className={`tab-item ${tab==='signup'?'active':''}`} onClick={()=>{setTab('signup');setError('')}}>Sign Up</button>
        </div>

        {error && (
          <div className="alert alert-error" style={{marginBottom:16}}>
            {error}
          </div>
        )}

        {tab==='login' ? (
          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:14}}>
            <input
              className="input" type="email" value={email}
              onChange={e=>setEmail(e.target.value)}
              placeholder="Email address" required autoComplete="email"
              style={{fontSize:16}} // 16px prevents iOS zoom
            />
            <input
              className="input" type="password" value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="Password" required autoComplete="current-password"
              style={{fontSize:16}}
            />
            <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{padding:15,fontSize:16,marginTop:4}}>
              {loading ? (
                <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                  <span style={{width:16,height:16,border:'2px solid rgba(0,0,0,0.3)',borderTopColor:'#080808',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:14,marginTop:4}}>
              <button type="button" onClick={()=>setTab('signup')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontFamily:'inherit',fontWeight:600,fontSize:14}}>
                Create account
              </button>
              <Link href="/reset-password" style={{color:'var(--text-3)',textDecoration:'none',fontSize:14}}>
                Forgot password?
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup} style={{display:'flex',flexDirection:'column',gap:14}}>
            <input
              className="input" value={fullName}
              onChange={e=>setFullName(e.target.value)}
              placeholder="Your full name" required autoComplete="name"
              style={{fontSize:16}}
            />
            <input
              className="input" value={businessName}
              onChange={e=>setBusinessName(e.target.value)}
              placeholder="Business name (optional)"
              style={{fontSize:16}}
            />
            <input
              className="input" type="email" value={email}
              onChange={e=>setEmail(e.target.value)}
              placeholder="Email address" required autoComplete="email"
              style={{fontSize:16}}
            />
            <input
              className="input" type="password" value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="Password (min 8 characters)" minLength={8} required
              autoComplete="new-password" style={{fontSize:16}}
            />
            <div className="policy-check">
              <input type="checkbox" id="terms" checked={terms} onChange={e=>setTerms(e.target.checked)}/>
              <label htmlFor="terms" style={{fontSize:13,lineHeight:1.5}}>
                I agree to the <Link href="/terms" target="_blank" style={{color:'var(--accent)'}}>Terms of Service</Link> and <Link href="/privacy" target="_blank" style={{color:'var(--accent)'}}>Privacy Policy</Link>
              </label>
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading||!fullName||!email||!password||!terms} style={{padding:15,fontSize:16}}>
              {loading ? (
                <span style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                  <span style={{width:16,height:16,border:'2px solid rgba(0,0,0,0.3)',borderTopColor:'#080808',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/>
                  Creating account...
                </span>
              ) : 'Create Free Account'}
            </button>
          </form>
        )}
      </div>

      <p style={{fontSize:12,color:'var(--text-3)',marginTop:32,textAlign:'center'}}>
        Need help? <a href="mailto:support@wovomedia.com" style={{color:'var(--accent)'}}>support@wovomedia.com</a>
      </p>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
