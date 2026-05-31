'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import AppShell from '@/components/AppShell'

const MAIN = ''

export default function AdminClients() {
  const [clients, setClients] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showOnboard, setShowOnboard] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  const [form, setForm] = useState({
    businessName: '', ownerName: '', email: '', phone: '',
    plan: 'premium', monthlyRate: '', managerId: '', notes: ''
  })

  useEffect(() => {
    loadData()
    // Check URL for ?action=onboard
    if (window.location.search.includes('onboard')) setShowOnboard(true)
  }, [])

  const toggleActive = async (clientId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    if (!confirm(`${action.charAt(0).toUpperCase()+action.slice(1)} this account? ${currentStatus ? 'They will lose access immediately.' : 'They will regain full access.'}`)) return
    await supabase.from('clients').update({ is_active: !currentStatus }).eq('id', clientId)
    await loadData()
    setMsg(`✓ Account ${currentStatus ? 'deactivated' : 'activated'}`)
  }

  const loadData = async () => {
    const [c, e, mgrs] = await Promise.all([
      supabase.from('clients').select('*, client_managers(employee_id, employees(full_name, role))').order('created_at', { ascending: false }),
      supabase.from('employees').select('*').eq('is_active', true).in('role', ['account_manager','owner']),
      supabase.from('client_managers').select('client_id, employee_id')
    ])
    setClients(c.data || [])
    setEmployees(e.data || [])
    setLoading(false)
  }

  const handleOnboard = async () => {
    if (!form.businessName || !form.ownerName || !form.email) { setMsg('Business name, owner name, and email are required.'); return }
    setSubmitting(true); setMsg('')
    const res = await fetch(`/api/admin/onboard-client`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, monthlyRate: form.monthlyRate ? Number(form.monthlyRate) : null })
    })
    const data = await res.json()
    if (!res.ok) { setMsg(data.error || 'Failed'); setSubmitting(false); return }
    setMsg(`✓ ${form.businessName} onboarded! Invite email sent to ${form.email}.`)
    setShowOnboard(false)
    setForm({ businessName:'',ownerName:'',email:'',phone:'',plan:'premium',monthlyRate:'',managerId:'',notes:'' })
    await loadData()
    setSubmitting(false)
  }

  const filtered = clients.filter(c =>
    c.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppShell>
    <div style={{padding:'20px 16px 0'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <h1 className="page-title">Clients</h1>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowOnboard(true)}>+ Onboard</button>
      </div>

      {/* Onboard modal */}
      {showOnboard && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:600,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0'}}>
          <div style={{background:'var(--bg-2)',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:600,maxHeight:'92dvh',overflowY:'auto',padding:'24px 20px 32px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{fontSize:20,fontWeight:700}}>Onboard Existing Client</h2>
              <button onClick={()=>setShowOnboard(false)} style={{background:'none',border:'none',color:'var(--text-2)',fontSize:22,cursor:'pointer'}}>×</button>
            </div>
            {msg && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`} style={{marginBottom:14}}>{msg}</div>}

            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="grid-2">
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:5,fontWeight:600}}>Business name *</label>
                  <input className="input" value={form.businessName} onChange={e=>setForm(f=>({...f,businessName:e.target.value}))} placeholder="Business name"/>
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:5,fontWeight:600}}>Owner name *</label>
                  <input className="input" value={form.ownerName} onChange={e=>setForm(f=>({...f,ownerName:e.target.value}))} placeholder="Owner full name"/>
                </div>
              </div>
              <div>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:5,fontWeight:600}}>Email address *</label>
                <input className="input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="owner@business.com"/>
              </div>
              <div className="grid-2">
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:5,fontWeight:600}}>Phone</label>
                  <input className="input" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="(555) 000-0000"/>
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:5,fontWeight:600}}>Monthly rate ($)</label>
                  <input className="input" type="text" inputMode="decimal" value={form.monthlyRate} onChange={e=>setForm(f=>({...f,monthlyRate:e.target.value}))} placeholder="e.g. 750" style={{fontSize:16}}/>
                </div>
              </div>
              <div className="grid-2">
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:5,fontWeight:600}}>Plan type</label>
                  <select className="input" value={form.plan} onChange={e=>setForm(f=>({...f,plan:e.target.value}))}>
                    <option value="premium">Wovo Media Premium</option>
                    <option value="wovo_ai_starter">Wovo AI Starter</option>
                    <option value="wovo_ai_growth">Wovo AI Growth</option>
                    <option value="wovo_ai_pro">Wovo AI Pro</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:5,fontWeight:600}}>Assign manager</label>
                  <select className="input" value={form.managerId} onChange={e=>setForm(f=>({...f,managerId:e.target.value}))}>
                    <option value="">No manager yet</option>
                    {employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:5,fontWeight:600}}>Notes (internal)</label>
                <textarea className="input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes about this client, their preferences, content style..." rows={2}/>
              </div>
              <button className="btn btn-primary btn-block" style={{padding:13,marginTop:4}} onClick={handleOnboard} disabled={submitting}>
                {submitting?'Onboarding...':'Create Account & Send Invite →'}
              </button>
              <p style={{fontSize:12,color:'var(--text-3)',textAlign:'center'}}>They'll receive an email with login credentials and a welcome message from their team.</p>
            </div>
          </div>
        </div>
      )}

      {msg && !showOnboard && <div className={`alert ${msg.startsWith('✓')?'alert-success':'alert-error'}`} style={{marginBottom:14}}>{msg}</div>}

      <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients..." style={{marginBottom:14,fontSize:14}}/>

      {loading ? <div style={{textAlign:'center',padding:40}}><div className="spinner" style={{margin:'0 auto'}}/></div> :
        filtered.length === 0 ? <div className="card" style={{textAlign:'center',padding:40,color:'var(--text-3)'}}>No clients yet. Onboard your first client above.</div> :
        filtered.map(c => {
          const manager = c.client_managers?.[0]?.employees
          return (
            <Link key={c.id} href={`/admin/clients/${c.id}`} style={{textDecoration:'none'}}>
              <div className="card" style={{marginBottom:10,padding:'14px 16px',cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:3}}>{c.business_name}</div>
                    <div style={{fontSize:12,color:'var(--text-3)'}}>{c.owner_name} · {c.email}</div>
                    {manager && <div style={{fontSize:11,color:'var(--accent)',marginTop:4}}>👔 {manager.full_name}</div>}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0,marginLeft:10}}>
                    <span className={`badge ${c.is_active?'badge-green':'badge-gray'}`} style={{fontSize:10}}>{c.is_active?'Active':'Inactive'}</span>
                    {c.monthly_rate && <span style={{fontSize:11,color:'var(--text-3)',fontWeight:600}}>${c.monthly_rate}/mo</span>}
                    <button onClick={e=>{e.preventDefault();e.stopPropagation();toggleActive(c.id,c.is_active)}} style={{fontSize:10,padding:'3px 8px',borderRadius:6,border:'1px solid',borderColor:c.is_active?'rgba(239,68,68,0.3)':'rgba(34,197,94,0.3)',background:'transparent',color:c.is_active?'#ef4444':'#22c55e',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>
                      {c.is_active?'Deactivate':'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          )
        })
      }
    </div>
  </AppShell>
  )
}
