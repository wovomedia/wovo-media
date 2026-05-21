'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` })
    setSent(true); setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div className="grid-bg" /><div className="grid-fade" />
      <div className="card slide-up" style={{ width: 380, position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <Link href="/" style={{ display: 'block', fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', textDecoration: 'none', marginBottom: 24 }}>wovo<span style={{ color: 'var(--accent)' }}>media</span></Link>
        {sent ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Check your email</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>We sent a reset link to <strong style={{ color: 'var(--text)' }}>{email}</strong>. Click it to set a new password.</p>
            <Link href="/login"><button className="btn btn-ghost" style={{ width: '100%' }}>Back to login</button></Link>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Reset password</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24 }}>Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com" required />
              <button className="btn btn-primary" type="submit" style={{ width: '100%', padding: 13 }} disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</button>
            </form>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 16 }}><Link href="/login" style={{ color: 'var(--text-3)' }}>← Back to login</Link></p>
          </>
        )}
      </div>
    </div>
  )
}
