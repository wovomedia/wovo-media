'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

function UpdatePasswordForm() {
  const params = useSearchParams()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Check for Supabase error in URL (old flow fallback)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=access_denied') || hash.includes('error_code=otp_expired')) {
      setError('This reset link has expired. Please request a new one.')
    }
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    if (!token) { setError('Invalid reset link. Please request a new one.'); return }
    setLoading(true)
    const res = await fetch('/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

  if (done) return (
    <div style={{textAlign:'center',padding:'8px 0'}}>
      <div style={{fontSize:52,marginBottom:16}}>✅</div>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:10}}>Password updated!</h2>
      <p style={{color:'var(--text-2)',marginBottom:28,lineHeight:1.6,fontSize:15}}>Your new password is set. You can now log in.</p>
      <Link href="/login"><button className="btn btn-primary" style={{width:'100%',padding:13,fontSize:15}}>Go to Login →</button></Link>
    </div>
  )

  // No token — show expired state
  if (!token || error.includes('expired') || error.includes('Invalid reset')) return (
    <div style={{textAlign:'center',padding:'8px 0'}}>
      <div style={{fontSize:44,marginBottom:14}}>⚠️</div>
      <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Link expired or invalid</h2>
      <p style={{color:'var(--text-2)',fontSize:14,marginBottom:24,lineHeight:1.6}}>{error || 'This reset link has expired or is invalid. Request a new one below.'}</p>
      <Link href="/reset-password"><button className="btn btn-primary" style={{width:'100%',padding:13,fontSize:15}}>Request New Reset Link</button></Link>
    </div>
  )

  return (
    <form onSubmit={handleUpdate} style={{display:'flex',flexDirection:'column',gap:16}}>
      <div>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:6}}>Set new password</h2>
        <p style={{color:'var(--text-2)',fontSize:14,marginBottom:20,lineHeight:1.6}}>Choose a strong new password for your account.</p>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div>
        <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>New password</label>
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required autoFocus/>
      </div>
      <div>
        <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Confirm password</label>
        <input className="input" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Same as above" required/>
      </div>
      <button className="btn btn-primary" type="submit" style={{width:'100%',padding:13,fontSize:15,marginTop:4}} disabled={loading||!password||!confirm}>
        {loading?'Updating...':'Set New Password →'}
      </button>
    </form>
  )
}

export default function UpdatePassword() {
  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div style={{position:'fixed',top:20,right:24,zIndex:200}}><ThemeToggle/></div>
      <div className="card slide-up" style={{width:440,zIndex:2,padding:36,position:'relative'}}>
        <Link href="/" style={{display:'block',fontFamily:'Outfit,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)',textDecoration:'none',marginBottom:28,textAlign:'center',letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>
        <Suspense fallback={<div style={{textAlign:'center',color:'var(--text-3)',padding:'20px 0'}}>Loading...</div>}>
          <UpdatePasswordForm/>
        </Suspense>
      </div>
    </div>
  )
}
