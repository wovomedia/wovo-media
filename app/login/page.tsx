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
    owner:'/dashboard/owner', admin:'/dashboard/owner',
    content_manager:'/dashboard/team', customer_service:'/dashboard/team',
    employee:'/dashboard/team', client:'/dashboard/client'
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    const { data: profile } = await sb.from('profiles').select('wovo_role').eq('user_id', data.user.id).single()
    window.location.href = roleRoutes[profile?.wovo_role || 'client'] || '/dashboard/client'
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    if (!terms) { setError('Please accept the Terms of Service and Privacy Policy to continue.'); setLoading(false); return }
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      await sb.from('profiles').upsert({ user_id: data.user.id, full_name: fullName, terms_accepted_at: new Date().toISOString(), wovo_role: 'client' })
      if (businessName) await sb.from('clients').insert({ profile_id: data.user.id, business_name: businessName, email, owner_name: fullName })
      setSuccess("You're in! Check your email to confirm your account, then come back and log in.")
    }
    setLoading(false)
  }

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    const code = empCode.trim().toUpperCase()
    const { data, error } = await sb.from('profiles').select('user_id, wovo_role, full_name').eq('employee_code', code).single()
    if (error || !data) { setError('Invalid employee code. Check with your manager.'); setLoading(false); return }
    // Sign in via magic link / passwordless using service — for now redirect to employee dashboard with code stored in session
    // Store code in localStorage for session
    localStorage.setItem('emp_code', code)
    localStorage.setItem('emp_role', data.wovo_role)
    localStorage.setItem('emp_name', data.full_name || '')
    localStorage.setItem('emp_uid', data.user_id)
    window.location.href = '/dashboard/team'
  }

  if (success) return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div className="card slide-up" style={{width:420,position:'relative',zIndex:2,textAlign:'center',padding:40}}>
        <div style={{fontSize:44,marginBottom:16}}>🎉</div>
        <h2 style={{fontSize:26,fontWeight:700,marginBottom:10}}>Account created!</h2>
        <p style={{color:'var(--text-2)',fontSize:15,lineHeight:1.6,marginBottom:24}}>{success}</p>
        <button className="btn btn-primary" style={{width:'100%',padding:14}} onClick={()=>setSuccess('')}>Back to login</button>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',padding:20}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div className="card slide-up" style={{width:460,position:'relative',zIndex:2}}>
        <Link href="/" style={{display:'block',fontFamily:'Syne,sans-serif',fontSize:22,fontWeight:700,color:'var(--text)',textDecoration:'none',marginBottom:28,textAlign:'center'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>

        {/* TAB SWITCHER */}
        <div style={{display:'flex',background:'var(--bg-3)',borderRadius:10,padding:4,marginBottom:28,gap:4}}>
          {([['login','Log In'],['signup','Sign Up'],['employee','Employee']] as const).map(([t,l])=>(
            <button key={t} onClick={()=>{setTab(t);setError('')}} style={{flex:1,padding:'9px 0',borderRadius:7,fontSize:14,fontWeight:500,cursor:'pointer',border:'none',fontFamily:'inherit',background:tab===t?'var(--bg-2)':'transparent',color:tab===t?'var(--text)':'var(--text-3)',boxShadow:tab===t?'0 1px 4px rgba(0,0,0,0.3)':'none',transition:'all 0.18s'}}>{l}</button>
          ))}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* LOGIN */}
        {tab==='login' && (
          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Email address</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email" required/>
            </div>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Password</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required/>
            </div>
            <button className="btn btn-primary" type="submit" style={{width:'100%',padding:14,marginTop:4,fontSize:16}} disabled={loading}>{loading?'Signing in...':'Sign In'}</button>
            <p style={{fontSize:13,color:'var(--text-3)',textAlign:'center'}}><Link href="/reset-password" style={{color:'var(--accent)',textDecoration:'none'}}>Forgot your password?</Link></p>
          </form>
        )}

        {/* SIGN UP */}
        {tab==='signup' && (
          <form onSubmit={handleSignup} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Full name</label>
              <input className="input" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name" required/>
            </div>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Business name <span style={{color:'var(--text-3)',fontWeight:400}}>(optional)</span></label>
              <input className="input" value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="Your business name"/>
            </div>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Email address</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Your email address" required/>
            </div>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Password</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required/>
            </div>
            <div className="policy-check" style={{marginTop:4}}>
              <input type="checkbox" id="terms" checked={terms} onChange={e=>setTerms(e.target.checked)}/>
              <label htmlFor="terms">I agree to the <a href="/terms" target="_blank">Terms of Service</a> and <a href="/privacy" target="_blank">Privacy Policy</a>. I understand Wovo Media may contact me about my account.</label>
            </div>
            <button className="btn btn-primary" type="submit" style={{width:'100%',padding:14,fontSize:16}} disabled={loading||!terms}>{loading?'Creating account...':'Create Account'}</button>
            <p style={{fontSize:13,color:'var(--text-3)',textAlign:'center'}}>Already have an account? <button type="button" onClick={()=>setTab('login')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>Log in</button></p>
          </form>
        )}

        {/* EMPLOYEE LOGIN */}
        {tab==='employee' && (
          <form onSubmit={handleEmployeeLogin} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{background:'var(--bg-3)',borderRadius:10,padding:16,marginBottom:4}}>
              <p style={{fontSize:14,color:'var(--text-2)',margin:0,lineHeight:1.6}}>This login is for Wovo Media team members only. Enter your employee code to access your dashboard.</p>
            </div>
            <div>
              <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:7,fontWeight:500}}>Employee Code</label>
              <input
                className="input"
                value={empCode}
                onChange={e=>setEmpCode(e.target.value.toUpperCase())}
                placeholder="Enter your 6-character code"
                maxLength={6}
                style={{fontSize:22,fontWeight:700,letterSpacing:'0.2em',textAlign:'center',textTransform:'uppercase',fontFamily:'Syne,sans-serif'}}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{width:'100%',padding:14,fontSize:16}} disabled={loading||empCode.length<4}>{loading?'Verifying...':'Access Dashboard'}</button>
            <p style={{fontSize:13,color:'var(--text-3)',textAlign:'center'}}>Don't have a code? Contact your manager.</p>
          </form>
        )}
      </div>
    </div>
  )
}
