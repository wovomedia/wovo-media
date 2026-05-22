'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, roleRoutes } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'

export default function Login() {
  const [tab, setTab] = useState<'login'|'signup'|'employee'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [empCode, setEmpCode] = useState('')
  const [terms, setTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('profiles').select('wovo_role').eq('user_id', data.user.id).single().then(({ data: p }) => {
          window.location.href = roleRoutes[p?.wovo_role || 'client'] || '/dashboard/client'
        })
      }
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message)
      setLoading(false); return
    }
    // Ensure profile exists
    const { data: profile } = await supabase.from('profiles').select('wovo_role').eq('user_id', data.user.id).single()
    if (!profile) {
      // Create profile if missing (first login)
      await supabase.from('profiles').insert({ user_id: data.user.id, wovo_role: 'client', full_name: data.user.user_metadata?.full_name || '' })
      window.location.href = '/dashboard/client'
    } else {
      window.location.href = roleRoutes[profile.wovo_role] || '/dashboard/client'
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    if (!terms) { setError('Please accept the Terms of Service and Privacy Policy.'); setLoading(false); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); setLoading(false); return }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    })
    if (error) { setError(error.message); setLoading(false); return }

    if (data.user) {
      await supabase.from('profiles').upsert({
        user_id: data.user.id,
        full_name: fullName,
        wovo_role: 'client',
        terms_accepted_at: new Date().toISOString(),
      })
      if (businessName.trim()) {
        await supabase.from('clients').insert({
          profile_id: data.user.id,
          business_name: businessName.trim(),
          email,
          owner_name: fullName,
          is_active: false,
        })
      }
      // Check if email confirmation is required
      if (data.session) {
        // Auto-confirmed, go to dashboard
        window.location.href = '/dashboard/client'
      } else {
        setSuccess(`Account created! Check ${email} to confirm, then log in.`)
      }
    }
    setLoading(false)
  }

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const code = empCode.trim().toUpperCase()
    const { data, error } = await supabase.from('profiles').select('user_id, wovo_role, full_name').eq('employee_code', code).single()
    if (error || !data) { setError('Employee code not found. Check with your manager.'); setLoading(false); return }
    localStorage.setItem('emp_code', code)
    localStorage.setItem('emp_role', data.wovo_role)
    localStorage.setItem('emp_name', data.full_name || '')
    localStorage.setItem('emp_uid', data.user_id)
    window.location.href = '/dashboard/team'
  }

  if (success) return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',padding:20}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div className="card slide-up" style={{width:440,position:'relative',zIndex:2,textAlign:'center',padding:44}}>
        <div style={{fontSize:52,marginBottom:16}}>🎉</div>
        <h2 style={{fontSize:26,fontWeight:700,marginBottom:10}}>Check your email</h2>
        <p style={{color:'var(--text-2)',fontSize:15,lineHeight:1.7,marginBottom:28}}>{success}</p>
        <button className="btn btn-primary" style={{width:'100%',padding:13,fontSize:15}} onClick={()=>{setSuccess('');setTab('login')}}>Back to login</button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',padding:20}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div style={{position:'fixed',top:20,right:24,zIndex:200}}><ThemeToggle/></div>
      <div className="card slide-up" style={{width:480,position:'relative',zIndex:2,padding:36}}>
        <Link href="/" style={{display:'block',fontFamily:'Outfit,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)',textDecoration:'none',marginBottom:28,textAlign:'center',letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>

        {/* TABS */}
        <div style={{display:'flex',background:'var(--bg-3)',borderRadius:10,padding:4,marginBottom:24,gap:3}}>
          {([['login','Log In'],['signup','Sign Up'],['employee','Employee']] as const).map(([t,l])=>(
            <button key={t} onClick={()=>{setTab(t);setError('')}} style={{flex:1,padding:'9px 0',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',border:'none',fontFamily:'inherit',background:tab===t?'var(--bg)':'transparent',color:tab===t?'var(--text)':'var(--text-3)',transition:'all 0.15s',boxShadow:tab===t?'var(--shadow)':'none'}}>
              {l}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{marginBottom:16}}>{error}</div>}

        {/* LOG IN */}
        {tab==='login' && (
          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Email address</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@yourbusiness.com" required autoComplete="email"/>
            </div>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Password</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" required autoComplete="current-password"/>
            </div>
            <button className="btn btn-primary" type="submit" style={{width:'100%',padding:13,fontSize:15,marginTop:4}} disabled={loading}>{loading?'Signing in...':'Sign In'}</button>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <button type="button" onClick={()=>setTab('signup')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:600}}>Create account</button>
              <Link href="/reset-password" style={{color:'var(--text-3)',textDecoration:'none',fontSize:13}}>Forgot password?</Link>
            </div>
          </form>
        )}

        {/* SIGN UP */}
        {tab==='signup' && (
          <form onSubmit={handleSignup} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Full name *</label>
                <input className="input" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name" required/>
              </div>
              <div>
                <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Business name</label>
                <input className="input" value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="Optional"/>
              </div>
            </div>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Email address *</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Your email address" required autoComplete="email"/>
            </div>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Password *</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required autoComplete="new-password"/>
            </div>
            <div className="policy-check" style={{background:'var(--bg-3)',padding:'12px 14px',borderRadius:10}}>
              <input type="checkbox" id="terms" checked={terms} onChange={e=>setTerms(e.target.checked)}/>
              <label htmlFor="terms" style={{fontSize:13}}>
                I agree to the <Link href="/terms" target="_blank" style={{color:'var(--accent)'}}>Terms of Service</Link> and <Link href="/privacy" target="_blank" style={{color:'var(--accent)'}}>Privacy Policy</Link>
              </label>
            </div>
            <button className="btn btn-primary" type="submit" style={{width:'100%',padding:13,fontSize:15}} disabled={loading||!terms}>{loading?'Creating account...':'Create Free Account'}</button>
            <p style={{fontSize:13,color:'var(--text-3)',textAlign:'center'}}>Already have an account? <button type="button" onClick={()=>setTab('login')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:13,fontFamily:'inherit',fontWeight:600}}>Log in</button></p>
          </form>
        )}

        {/* EMPLOYEE */}
        {tab==='employee' && (
          <form onSubmit={handleEmployeeLogin} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{background:'var(--bg-3)',borderRadius:10,padding:14}}>
              <p style={{fontSize:14,color:'var(--text-2)',margin:0,lineHeight:1.6}}>For <strong style={{color:'var(--text)'}}>Wovo Media team members only.</strong> Enter your employee code below.</p>
            </div>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:8,fontWeight:600}}>Employee Code</label>
              <input
                className="input"
                value={empCode}
                onChange={e=>setEmpCode(e.target.value.toUpperCase())}
                placeholder="e.g. JAKE42"
                maxLength={8}
                style={{fontSize:26,fontWeight:700,letterSpacing:'0.2em',textAlign:'center',textTransform:'uppercase',fontFamily:'Outfit,sans-serif',padding:16}}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{width:'100%',padding:13,fontSize:15}} disabled={loading||empCode.length<4}>{loading?'Verifying...':'Access Dashboard →'}</button>
            <p style={{fontSize:13,color:'var(--text-3)',textAlign:'center'}}>No code? Contact your manager.</p>
          </form>
        )}
      </div>
    </div>
  )
}
