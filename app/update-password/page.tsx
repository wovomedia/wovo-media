'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Supabase sends recovery token in URL hash: #access_token=...&type=recovery
    // OR as query params: ?token=...&type=recovery (older flow)
    const handleRecovery = async () => {
      const hash = window.location.hash
      const query = window.location.search

      // Parse hash fragment
      if (hash) {
        const params = new URLSearchParams(hash.replace('#', ''))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const type = params.get('type')

        if (type === 'recovery' && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error) { setReady(true); setChecking(false); return }
        }
      }

      // Check if Supabase already handled it via detectSessionInUrl
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setReady(true)
        setChecking(false)
        return
      }

      // Listen for PASSWORD_RECOVERY event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          setReady(true)
          setChecking(false)
          subscription.unsubscribe()
        }
      })

      // Give it 5 seconds then show error
      setTimeout(() => {
        setChecking(false)
      }, 5000)
    }

    handleRecovery()
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    await supabase.auth.signOut()
    setDone(true)
    setLoading(false)
  }

  if (done) return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div className="card slide-up" style={{width:420,zIndex:2,textAlign:'center',padding:44,position:'relative'}}>
        <div style={{fontSize:48,marginBottom:14}}>✅</div>
        <h2 style={{fontSize:24,fontWeight:700,marginBottom:10}}>Password updated!</h2>
        <p style={{color:'var(--text-2)',marginBottom:28,lineHeight:1.6,fontSize:15}}>Your new password is set. You can now log in.</p>
        <Link href="/login"><button className="btn btn-primary" style={{width:'100%',padding:13,fontSize:15}}>Go to Login →</button></Link>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div style={{position:'fixed',top:20,right:24,zIndex:200}}><ThemeToggle/></div>
      <div className="card slide-up" style={{width:440,zIndex:2,padding:36,position:'relative'}}>
        <Link href="/" style={{display:'block',fontFamily:'Outfit,sans-serif',fontSize:22,fontWeight:800,color:'var(--text)',textDecoration:'none',marginBottom:28,textAlign:'center',letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:6}}>Set new password</h2>
        <p style={{color:'var(--text-2)',fontSize:14,marginBottom:24,lineHeight:1.6}}>Choose a strong new password for your account.</p>

        {error && <div className="alert alert-error" style={{marginBottom:16}}>{error}</div>}

        {checking && (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{width:32,height:32,border:'3px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',margin:'0 auto 14px',animation:'spin 0.8s linear infinite'}}/>
            <p style={{color:'var(--text-3)',fontSize:14,margin:0}}>Verifying your reset link...</p>
          </div>
        )}

        {!checking && !ready && (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{fontSize:40,marginBottom:14}}>⚠️</div>
            <p style={{color:'var(--text-2)',fontSize:14,marginBottom:20,lineHeight:1.6}}>This reset link has expired or already been used. Request a new one.</p>
            <Link href="/reset-password"><button className="btn btn-primary" style={{width:'100%',padding:13}}>Request New Reset Link</button></Link>
          </div>
        )}

        {!checking && ready && (
          <form onSubmit={handleUpdate} style={{display:'flex',flexDirection:'column',gap:16}}>
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
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
