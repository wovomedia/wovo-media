'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

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

  const roleRoutes: Record<string,string> = {
    owner: '/dashboard/owner',
    admin: '/dashboard/owner',
    content_manager: '/dashboard/team',
    customer_service: '/dashboard/team',
    employee: '/dashboard/team',
    client: '/dashboard/client'
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    
    // Try to get role from profiles
    const { data: profile } = await sb.from('profiles').select('wovo_role').eq('user_id', data.user.id).single()
    const role = profile?.wovo_role || 'client'
    window.location.href = roleRoutes[role] || '/dashboard/client'
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    if (!terms) { setError('Please accept the Terms of Service and Privacy Policy to continue.'); setLoading(false); return }
    
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
    if (error) { setError(error.message); setLoading(false); return }
    
    if (data.user) {
      // Create profile record
      await sb.from('profiles').upsert({
        user_id: data.user.id,
        full_name: fullName,
        terms_accepted_at: new Date().toISOString(),
        wovo_role: 'client'
      })
      // Create client record if business name given
      if (businessName.trim()) {
        await sb.from('clients').insert({
          profile_id: data.user.id,
          business_name: businessName.trim(),
          email,
          owner_name: fullName,
          is_active: false
        })
      }
      setSuccess(`Account created for ${email}! Check your inbox to verify your email, then come back and log in.`)
    }
    setLoading(false)
  }

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const code = empCode.trim().toUpperCase()
    const { data, error } = await sb.from('profiles').select('user_id, wovo_role, full_name').eq('employee_code', code).single()
    if (error || !data) { setError('Employee code not found. Double-check the code or contact your manager.'); setLoading(false); return }
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
        <div style={{fontSize:52,marginBottom:18}}>🎉</div>
        <h2 style={{fontSize:28,fontWeight:700,marginBottom:12}}>Account created!</h2>
        <p style={{color:'var(--text-2)',fontSize:15,lineHeight:1.7,marginBottom:28}}>{success}</p>
        <button className="btn btn-primary" style={{width:'100%',padding:14,fontSize:16}} onClick={()=>{ setSuccess(''); setTab('login') }}>Go to login</button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',padding:20}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div className="card slide-up" style={{width:480,position:'relative',zIndex:2}}>
        <Link href="/" style={{display:'block',fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:700,color:'var(--text)',textDecoration:'none',marginBottom:30,textAlign:'center'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>

        {/* TABS */}
        <div style={{display:'flex',background:'var(--bg-3)',borderRadius:10,padding:4,marginBottom:28}}>
          {([['login','Log In'],['signup','Sign Up'],['employee','Employee']] as const).map(([t,l])=>(
            <button key={t} onClick={()=>{setTab(t);setError('')}} style={{flex:1,padding:'10px 0',borderRadius:7,fontSize:14,fontWeight:500,cursor:'pointer',border:'none',fontFamily:'inherit',background:tab===t?'var(--bg-2)':'transparent',color:tab===t?'var(--text)':'var(--text-3)',transition:'all 0.18s',boxShadow:tab===t?'0 1px 4px rgba(0,0,0,0.4)':'none'}}>
              {l}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{marginBottom:16}}>{error}</div>}

        {/* LOG IN */}
        {tab==='login' && (
          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:18}}>
            <div>
              <label style={{fontSize:14,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Email address</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email address" required autoComplete="email"/>
            </div>
            <div>
              <label style={{fontSize:14,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Password</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password"/>
            </div>
            <button className="btn btn-primary" type="submit" style={{width:'100%',padding:14,fontSize:16,marginTop:4}} disabled={loading}>{loading?'Signing in...':'Sign In'}</button>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <button type="button" onClick={()=>setTab('signup')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:14,fontFamily:'inherit'}}>Create an account</button>
              <Link href="/reset-password" style={{color:'var(--text-3)',textDecoration:'none',fontSize:14}}>Forgot password?</Link>
            </div>
          </form>
        )}

        {/* SIGN UP */}
        {tab==='signup' && (
          <form onSubmit={handleSignup} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <label style={{fontSize:14,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Full name *</label>
              <input className="input" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name" required/>
            </div>
            <div>
              <label style={{fontSize:14,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Business name <span style={{color:'var(--text-3)',fontWeight:400,fontSize:13}}>(optional)</span></label>
              <input className="input" value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="Your business name"/>
            </div>
            <div>
              <label style={{fontSize:14,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Email address *</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Your email address" required autoComplete="email"/>
            </div>
            <div>
              <label style={{fontSize:14,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Password *</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required autoComplete="new-password"/>
            </div>
            <div className="policy-check" style={{marginTop:4,padding:'14px',background:'var(--bg-3)',borderRadius:9}}>
              <input type="checkbox" id="terms" checked={terms} onChange={e=>setTerms(e.target.checked)}/>
              <label htmlFor="terms" style={{fontSize:14}}>
                I agree to the <Link href="/terms" target="_blank" style={{color:'var(--accent)'}}>Terms of Service</Link> and <Link href="/privacy" target="_blank" style={{color:'var(--accent)'}}>Privacy Policy</Link>. I understand Wovo Media may contact me about my account.
              </label>
            </div>
            <button className="btn btn-primary" type="submit" style={{width:'100%',padding:14,fontSize:16}} disabled={loading||!terms}>
              {loading?'Creating account...':'Create Account — Free'}
            </button>
            <p style={{fontSize:14,color:'var(--text-3)',textAlign:'center'}}>Already have an account? <button type="button" onClick={()=>setTab('login')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:14,fontFamily:'inherit'}}>Log in</button></p>
          </form>
        )}

        {/* EMPLOYEE */}
        {tab==='employee' && (
          <form onSubmit={handleEmployeeLogin} style={{display:'flex',flexDirection:'column',gap:18}}>
            <div style={{background:'var(--bg-3)',borderRadius:10,padding:16}}>
              <p style={{fontSize:14,color:'var(--text-2)',margin:0,lineHeight:1.6}}>This section is for <strong style={{color:'var(--text)'}}>Wovo Media team members only</strong>. Enter your employee code to access your dashboard.</p>
            </div>
            <div>
              <label style={{fontSize:14,color:'var(--text-2)',display:'block',marginBottom:10,fontWeight:500}}>Employee Code</label>
              <input
                className="input"
                value={empCode}
                onChange={e=>setEmpCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={8}
                style={{fontSize:28,fontWeight:700,letterSpacing:'0.25em',textAlign:'center',textTransform:'uppercase',fontFamily:'Syne,sans-serif',padding:'16px'}}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{width:'100%',padding:14,fontSize:16}} disabled={loading||empCode.length<4}>
              {loading?'Verifying...':'Access Dashboard →'}
            </button>
            <p style={{fontSize:14,color:'var(--text-3)',textAlign:'center'}}>Don't have a code? Contact your manager.</p>
          </form>
        )}
      </div>
    </div>
  )
}
