'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import Link from 'next/link'

export default function AdminOnboard() {
  const [employees, setEmployees] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    businessName: '', ownerName: '', email: '', phone: '',
    plan: 'premium', monthlyRate: '', managerId: '', notes: ''
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { window.location.replace('/login'); return }
      Promise.all([
        supabase.from('employees').select('*').order('full_name'),
        supabase.from('clients').select('id,business_name,owner_name,email,plan,is_active,monthly_rate').order('business_name')
      ]).then(([e, c]) => {
        setEmployees(e.data || [])
        setClients(c.data || [])
      })
    })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setMsg('')
    const res = await fetch('/api/admin/onboard-client', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, monthlyRate: form.monthlyRate ? Number(form.monthlyRate) : null })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setLoading(false); return }
    setMsg(`✓ ${form.businessName} onboarded — invite email sent!`)
    setForm({ businessName: '', ownerName: '', email: '', phone: '', plan: 'premium', monthlyRate: '', managerId: '', notes: '' })
    // Refresh clients list
    const { data: c } = await supabase.from('clients').select('id,business_name,owner_name,email,plan,is_active,monthly_rate').order('business_name')
    setClients(c || [])
    setLoading(false)
  }

  return (
    <AppShell>
      <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.03em' }}>
            Client Onboarding
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Add existing clients — they get a welcome email with login instructions</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Onboard Form */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: 'var(--text)' }}>New Client</h3>
            {msg && <div className="alert alert-success" style={{ marginBottom: 14, fontSize: 13 }}>{msg}</div>}
            {error && <div className="alert alert-error" style={{ marginBottom: 14, fontSize: 13 }}>{error}</div>}
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Business name', 'businessName', 'Their business name', true],
                ['Owner name', 'ownerName', 'Owner full name', true],
                ['Email address', 'email', 'owner@business.com', true],
                ['Phone', 'phone', '(555) 000-0000', false],
              ].map(([label, key, placeholder, req]) => (
                <div key={key as string}>
                  <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4, fontWeight: 600 }}>{label as string}{req && <span style={{ color: 'var(--accent)' }}>*</span>}</label>
                  <input className="input" value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key as string]: e.target.value }))} placeholder={placeholder as string} required={req as boolean} style={{ fontSize: 15 }}/>
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Monthly rate ($)</label>
                <input className="input" type="text" inputMode="decimal" value={form.monthlyRate} onChange={e => setForm(f => ({ ...f, monthlyRate: e.target.value }))} placeholder="e.g. 750" style={{ fontSize: 15 }}/>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Plan</label>
                <select className="input" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="premium">Wovo Media Premium</option>
                  <option value="starter">Wovo AI Starter</option>
                  <option value="growth">Wovo AI Growth</option>
                  <option value="pro_ai">Wovo AI Pro</option>
                  <option value="website">Wovo AI Website</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Assign manager</label>
                <select className="input" value={form.managerId} onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))}>
                  <option value="">No manager yet</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-3)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Internal notes</label>
                <textarea className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Content preferences, style notes..." rows={3}/>
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={loading || !form.businessName || !form.ownerName || !form.email} style={{ padding: 13, marginTop: 4, fontSize: 14 }}>
                {loading ? 'Creating Account...' : 'Create Account & Send Invite →'}
              </button>
              <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>They receive a welcome email with login instructions</p>
            </form>
          </div>

          {/* Existing Clients */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>All Clients ({clients.length})</h3>
              <Link href="/admin/clients"><button className="btn btn-ghost btn-sm">Manage →</button></Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
              {clients.length === 0 && <div className="card" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: 24 }}>No clients yet</div>}
              {clients.map(c => (
                <Link key={c.id} href={`/admin/clients/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.business_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.owner_name} · {c.email}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span className={`badge ${c.is_active ? 'badge-green' : 'badge-gray'}`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                      {c.monthly_rate && <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>${c.monthly_rate}/mo</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
