'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',padding:20}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div style={{position:'fixed',top:20,right:24,zIndex:200}}></div>
      <div className="card slide-up" style={{width:420,position:'relative',zIndex:2,textAlign:'center',padding:40}}>
        <Link href="/" style={{display:'block',fontFamily:'Outfit,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)',textDecoration:'none',marginBottom:28,letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>
        {sent ? (
          <>
            <div style={{fontSize:48,marginBottom:14}}>📬</div>
            <h2 style={{fontSize:22,fontWeight:700,marginBottom:8}}>Check your email</h2>
            <p style={{color:'var(--text-2)',fontSize:15,lineHeight:1.7,marginBottom:24}}>
              We sent a reset link to <strong style={{color:'var(--text)'}}>{email}</strong>. Click it to set a new password.
            </p>
            <Link href="/login"><button className="btn btn-ghost" style={{width:'100%',padding:12}}>Back to login</button></Link>
          </>
        ) : (
          <>
            <h2 style={{fontSize:22,fontWeight:700,marginBottom:8}}>Reset your password</h2>
            <p style={{color:'var(--text-2)',fontSize:14,marginBottom:24,lineHeight:1.6}}>Enter your email and we'll send you a reset link.</p>
            <form onSubmit={handleReset} style={{display:'flex',flexDirection:'column',gap:14,textAlign:'left'}}>
              <div>
                <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Email address</label>
                <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Your email address" required/>
              </div>
              <button className="btn btn-primary" type="submit" style={{width:'100%',padding:13,fontSize:15}} disabled={loading}>{loading?'Sending...':'Send Reset Link'}</button>
            </form>
            <p style={{fontSize:13,color:'var(--text-3)',marginTop:16}}><Link href="/login" style={{color:'var(--text-3)'}}>← Back to login</Link></p>
          </>
        )}
      </div>
    </div>
  )
}
