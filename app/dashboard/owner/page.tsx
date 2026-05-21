'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const PRICE_OPTIONS = [
  { label: '$350/mo', cents: 35000 },
  { label: '$650/mo', cents: 65000 },
  { label: '$750/mo', cents: 75000 },
  { label: '$1,000/mo', cents: 100000 },
  { label: '$1,500/mo', cents: 150000 },
  { label: '$2,000/mo', cents: 200000 },
  { label: 'Custom', cents: 0 },
]

export default function OwnerDashboard() {
  const [clients, setClients] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [showOnboard, setShowOnboard] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [tab, setTab] = useState<'overview'|'clients'|'invitations'|'team'>('overview')
  const [msg, setMsg] = useState('')

  // Onboard form
  const [form, setForm] = useState({ businessName:'', ownerName:'', email:'', phone:'', priceCents:65000, customPrice:'', notes:'' })
  const [onboarding, setOnboarding] = useState(false)

  // Report form
  const [reportForm, setReportForm] = useState({ month: new Date().toISOString().slice(0,7), views:'', engagements:'', posts:'', newFollowers:'', summary:'', notes:'' })
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    sb.auth.getUser().then(({data}) => {
      if(!data.user) { window.location.href='/login'; return }
      loadData()
    })
  }, [])

  const loadData = async () => {
    const [c, i] = await Promise.all([
      sb.from('clients').select('*').order('created_at', {ascending:false}),
      sb.from('premium_invitations').select('*').order('created_at', {ascending:false}).limit(20)
    ])
    if(c.data) setClients(c.data)
    if(i.data) setInvitations(i.data)
  }

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault(); setOnboarding(true); setMsg('')
    const priceCents = form.priceCents === 0 ? parseInt(form.customPrice) * 100 : form.priceCents
    const res = await fetch('/api/premium/onboard', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ businessName:form.businessName, ownerName:form.ownerName, email:form.email, phone:form.phone, priceCents, notes:form.notes }) })
    const data = await res.json()
    if(data.success) { setMsg(`✓ Payment link sent to ${form.email}`); setShowOnboard(false); setForm({businessName:'',ownerName:'',email:'',phone:'',priceCents:65000,customPrice:'',notes:''}); loadData() }
    else setMsg('Error: ' + (data.error || 'Something went wrong'))
    setOnboarding(false)
  }

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault(); setReporting(true)
    const res = await fetch('/api/premium/report', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ clientId: selectedClient.id, month: reportForm.month, views: parseInt(reportForm.views)||0, engagements: parseInt(reportForm.engagements)||0, posts: parseInt(reportForm.posts)||0, newFollowers: parseInt(reportForm.newFollowers)||0, summary: reportForm.summary, notes: reportForm.notes }) })
    const data = await res.json()
    if(data.success) { setMsg(`✓ Report sent to ${selectedClient.business_name}`); setShowReport(false) }
    else setMsg('Error sending report')
    setReporting(false)
  }

  const premiumClients = clients.filter(c => c.plan === 'premium')
  const aiClients = clients.filter(c => c.plan !== 'premium')
  const pendingInvites = invitations.filter(i => i.status === 'pending')

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>

      {/* MODALS */}
      {showOnboard && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div className="card slide-up" style={{width:500,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{fontSize:18,fontWeight:600}}>Onboard Premium Client</h3>
              <button onClick={()=>setShowOnboard(false)} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:20}}>×</button>
            </div>
            <form onSubmit={handleOnboard} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Business name *</label><input className="input" value={form.businessName} onChange={e=>setForm(f=>({...f,businessName:e.target.value}))} required/></div>
                <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Owner name *</label><input className="input" value={form.ownerName} onChange={e=>setForm(f=>({...f,ownerName:e.target.value}))} required/></div>
                <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Email *</label><input className="input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required/></div>
                <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Phone</label><input className="input" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
              </div>
              <div>
                <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:8}}>Monthly price *</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {PRICE_OPTIONS.map(p=>(
                    <button key={p.cents} type="button" onClick={()=>setForm(f=>({...f,priceCents:p.cents}))} style={{padding:'8px 14px',borderRadius:8,fontSize:13,cursor:'pointer',border:'0.5px solid',borderColor:form.priceCents===p.cents?'var(--accent-border)':'var(--border-2)',background:form.priceCents===p.cents?'var(--accent-dim)':'transparent',color:form.priceCents===p.cents?'var(--accent)':'var(--text-2)',fontFamily:'inherit'}}>{p.label}</button>
                  ))}
                </div>
                {form.priceCents === 0 && <input className="input" type="number" value={form.customPrice} onChange={e=>setForm(f=>({...f,customPrice:e.target.value}))} placeholder="Enter amount (e.g. 850)" style={{marginTop:8}}/>}
              </div>
              <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Notes (internal)</label><textarea className="input" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{resize:'none'}}/></div>
              <div style={{background:'var(--accent-dim)',border:'0.5px solid var(--accent-border)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'var(--accent)'}}>
                This will: create a Stripe payment link → send a branded email to {form.email||'the client'} → auto-create their account when they pay
              </div>
              <button className="btn btn-primary" type="submit" style={{width:'100%',padding:13}} disabled={onboarding}>{onboarding?'Sending...':'Send payment link →'}</button>
            </form>
          </div>
        </div>
      )}

      {showReport && selectedClient && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div className="card slide-up" style={{width:480}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div>
                <h3 style={{fontSize:18,fontWeight:600}}>Send Monthly Report</h3>
                <p style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>{selectedClient.business_name}</p>
              </div>
              <button onClick={()=>setShowReport(false)} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:20}}>×</button>
            </div>
            <form onSubmit={handleReport} style={{display:'flex',flexDirection:'column',gap:14}}>
              <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Month</label><input className="input" type="month" value={reportForm.month} onChange={e=>setReportForm(f=>({...f,month:e.target.value}))}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[['Views','views'],['Engagements','engagements'],['Posts Published','posts'],['New Followers','newFollowers']].map(([l,k])=>(
                  <div key={k}><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>{l}</label><input className="input" type="number" value={(reportForm as any)[k]} onChange={e=>setReportForm(f=>({...f,[k]:e.target.value}))}/></div>
                ))}
              </div>
              <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Client-facing summary</label><textarea className="input" value={reportForm.summary} onChange={e=>setReportForm(f=>({...f,summary:e.target.value}))} rows={3} placeholder="Great month for engagement! Your taco Tuesday post went viral..." style={{resize:'none'}}/></div>
              <button className="btn btn-primary" type="submit" style={{width:'100%',padding:13}} disabled={reporting}>{reporting?'Sending...':'Send report email →'}</button>
            </form>
          </div>
        </div>
      )}

      {/* MAIN */}
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 32px',borderBottom:'0.5px solid var(--border)',background:'rgba(8,8,8,0.92)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:100}}>
        <div style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:700}}>wovo<span style={{color:'var(--accent)'}}>media</span><span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>Owner</span></div>
        <div style={{display:'flex',gap:4}}>
          {(['overview','clients','invitations','team'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?'var(--accent-dim)':'transparent',border:'0.5px solid',borderColor:tab===t?'var(--accent-border)':'transparent',color:tab===t?'var(--accent)':'var(--text-2)',padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit',textTransform:'capitalize'}}>{t}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowOnboard(true)}>+ Onboard Premium Client</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>sb.auth.signOut().then(()=>window.location.href='/')}>Sign out</button>
        </div>
      </nav>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'32px',position:'relative',zIndex:2}}>
        {msg && <div style={{background:msg.startsWith('✓')?'var(--accent-dim)':'rgba(255,80,80,0.1)',border:`0.5px solid ${msg.startsWith('✓')?'var(--accent-border)':'rgba(255,80,80,0.3)'}`,borderRadius:8,padding:'10px 14px',fontSize:13,color:msg.startsWith('✓')?'var(--accent)':'#ff5050',marginBottom:20}}>{msg}</div>}

        {tab==='overview' && (
          <>
            <div style={{marginBottom:28}}>
              <h1 style={{fontSize:26,fontWeight:700,marginBottom:4}}>Good morning 👋</h1>
              <p style={{color:'var(--text-2)',fontSize:14}}>Here's your Wovo Media overview.</p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:28}}>
              {[['Total Clients',clients.length.toString(),'accent'],['Premium',premiumClients.length.toString(),''],['Wovo AI',aiClients.length.toString(),''],['Pending Invites',pendingInvites.length.toString(),'']].map(([l,v,a])=>(
                <div key={l} className="stat-card"><div className="stat-label" style={{marginBottom:8}}>{l}</div><div className="stat-num" style={{color:a==='accent'?'var(--accent)':'var(--text)'}}>{v as string}</div></div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
              <div className="card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                  <h3 style={{fontSize:15,fontWeight:600}}>Premium Clients</h3>
                  <button className="btn btn-primary btn-sm" onClick={()=>setShowOnboard(true)}>+ Add</button>
                </div>
                {premiumClients.length===0 ? <p style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:'20px 0'}}>No premium clients yet. Onboard your first one →</p> : premiumClients.slice(0,5).map(c=>(
                  <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'0.5px solid var(--border)'}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:500,color:'var(--text)'}}>{c.business_name}</div>
                      <div style={{fontSize:12,color:'var(--text-3)'}}>{c.email}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={()=>{setSelectedClient(c);setShowReport(true)}}>Send Report</button>
                  </div>
                ))}
              </div>
              <div className="card">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                  <h3 style={{fontSize:15,fontWeight:600}}>Pending Invitations</h3>
                </div>
                {pendingInvites.length===0 ? <p style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:'20px 0'}}>No pending invitations</p> : pendingInvites.map(i=>(
                  <div key={i.id} style={{padding:'10px 0',borderBottom:'0.5px solid var(--border)'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <div style={{fontSize:14,fontWeight:500,color:'var(--text)'}}>{i.business_name}</div>
                      <span className="badge badge-gray">${(i.price_cents/100).toLocaleString()}/mo</span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{i.email} · Sent {new Date(i.sent_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab==='clients' && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <h2 style={{fontSize:22,fontWeight:700}}>All Clients</h2>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowOnboard(true)}>+ Onboard Premium Client</button>
            </div>
            <div className="card">
              {clients.length===0 ? <p style={{textAlign:'center',padding:'40px 0',color:'var(--text-3)'}}>No clients yet</p> : (
                <table>
                  <thead><tr><th>Business</th><th>Owner</th><th>Email</th><th>Plan</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {clients.map(c=>(
                      <tr key={c.id}>
                        <td style={{color:'var(--text)',fontWeight:500}}>{c.business_name}</td>
                        <td>{c.owner_name||'—'}</td>
                        <td>{c.email||'—'}</td>
                        <td><span className={`badge ${c.plan==='premium'?'badge-accent':'badge-gray'}`}>{c.plan}</span></td>
                        <td><span className={`badge ${c.is_active?'badge-green':'badge-gray'}`}>{c.is_active?'Active':'Inactive'}</span></td>
                        <td>
                          {c.plan==='premium' && <button className="btn btn-ghost btn-sm" onClick={()=>{setSelectedClient(c);setShowReport(true)}}>Send Report</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab==='invitations' && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
              <h2 style={{fontSize:22,fontWeight:700}}>Premium Invitations</h2>
              <button className="btn btn-primary btn-sm" onClick={()=>setShowOnboard(true)}>+ New Invitation</button>
            </div>
            <div className="card">
              {invitations.length===0 ? <p style={{textAlign:'center',padding:'40px 0',color:'var(--text-3)'}}>No invitations sent yet</p> : (
                <table>
                  <thead><tr><th>Business</th><th>Owner</th><th>Email</th><th>Price</th><th>Status</th><th>Sent</th></tr></thead>
                  <tbody>
                    {invitations.map(i=>(
                      <tr key={i.id}>
                        <td style={{color:'var(--text)',fontWeight:500}}>{i.business_name}</td>
                        <td>{i.owner_name}</td>
                        <td>{i.email}</td>
                        <td style={{color:'var(--accent)',fontWeight:600}}>${(i.price_cents/100).toLocaleString()}/mo</td>
                        <td><span className={`badge ${i.status==='active'?'badge-green':i.status==='pending'?'badge-gray':'badge-gray'}`}>{i.status}</span></td>
                        <td style={{fontSize:12,color:'var(--text-3)'}}>{new Date(i.sent_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab==='team' && (
          <div>
            <h2 style={{fontSize:22,fontWeight:700,marginBottom:24}}>Team Management</h2>
            <div className="card" style={{textAlign:'center',padding:48}}>
              <div style={{fontSize:32,marginBottom:12}}>👥</div>
              <h3 style={{fontSize:18,fontWeight:600,marginBottom:8}}>Team accounts</h3>
              <p style={{color:'var(--text-2)',fontSize:14,marginBottom:24,maxWidth:400,margin:'0 auto 24px'}}>Create accounts for your team members. Each role has different access levels.</p>
              <Link href="/dashboard/owner/team"><button className="btn btn-primary">Manage Team →</button></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
// Employee management is accessible via /dashboard/owner (team tab)
