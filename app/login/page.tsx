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
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // Check silently in background - form shows immediately, redirects if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      const role = session.user.user_metadata?.wovo_role || 'client'
      const routes: Record<string, string> = {
        owner: '/admin', admin: '/admin',
        content_manager: '/employee', customer_service: '/employee',
        employee: '/employee', client: '/home'
      }
      window.location.replace(routes[role] || '/home')
    }).catch(() => {})
  }, [])

  const handleOAuth = async (provider: 'google' | 'apple') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'consent' } : {}
      }
    })
    if (error) setError(error.message)
  }

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
        {/* OAuth Sign In */}
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
          <button type="button" onClick={()=>handleOAuth('google')} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'11px 16px',borderRadius:10,border:'1px solid var(--border-2)',background:'var(--bg-2)',color:'var(--text)',cursor:'pointer',fontFamily:'inherit',fontWeight:600,fontSize:14,width:'100%',transition:'background 0.15s'}}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg-3)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='var(--bg-2)'}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <div style={{flex:1,height:1,background:'var(--border)'}}/>
          <span style={{fontSize:12,color:'var(--text-3)',fontWeight:500}}>or</span>
          <div style={{flex:1,height:1,background:'var(--border)'}}/>
        </div>

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
