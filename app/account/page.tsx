'use client'
import { useState, useEffect } from 'react'
import { supabase as sb } from '@/lib/supabase'
import AppShell from '@/components/AppShell'
import Link from 'next/link'

export default function Account() {
  const [client, setClient] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [sub, setSub] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUser(data.user)
      const { data: c } = await sb.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (c) {
        setClient(c)
        const { data: s } = await sb.from('wovo_subscriptions').select('*').eq('client_id', c.id).eq('status','active').maybeSingle()
        setSub(s)
      }
      setLoading(false)
    })
  }, [])

  const signOut = async () => {
    await sb.auth.signOut()
    document.cookie = 'wovo-app-auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    window.location.href = '/login'
  }

  const isActive = client?.is_active || sub?.status === 'active'

  if (loading) return <div style={{minHeight:'100dvh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:28,height:28,border:'3px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>

  return (
    <AppShell user={client}>
      <div style={{padding:'20px 16px 0'}}>
        <h1 style={{fontFamily:'Outfit,sans-serif',fontSize:24,fontWeight:800,marginBottom:20,letterSpacing:'-0.03em'}}>Account</h1>

        <div className="card" style={{marginBottom:14,display:'flex',alignItems:'center',gap:14}}>
          <div style={{width:52,height:52,borderRadius:'50%',background:'var(--accent-dim)',border:'2px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:'var(--accent)',fontFamily:'Outfit,sans-serif',flexShrink:0}}>
            {(client?.owner_name||user?.email||'U')[0].toUpperCase()}
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:'var(--text)'}}>{client?.owner_name||user?.email}</div>
            <div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{user?.email}</div>
            {isActive && <span style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:6,background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700,color:'#22c55e'}}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'#22c55e'}}/>Active
            </span>}
          </div>
        </div>

        <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',margin:'16px 0 10px'}}>Subscription</div>
        {isActive ? (
          <div className="card card-accent" style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)',textTransform:'capitalize',marginBottom:4}}>
                  {sub?.plan?.replace('_',' ') || client?.plan || 'Active Plan'}
                </div>
                <div style={{fontSize:12,color:'var(--text-3)'}}>{sub?.amount_cents ? `$${sub.amount_cents/100}/mo` : 'Active subscription'}</div>
              </div>
              <span style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:700,color:'#22c55e'}}>Active</span>
            </div>
          </div>
        ) : (
          <div className="card" style={{marginBottom:14}}>
            <div style={{fontSize:14,color:'var(--text-2)',marginBottom:12}}>No active subscription. Upgrade to unlock all features.</div>
            <div style={{display:'flex',gap:8}}>
              <Link href="/wovo-ai" style={{flex:1,textDecoration:'none'}}><button className="btn btn-primary btn-block" style={{fontSize:13}}>See Plans</button></Link>
              <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" rel="noreferrer" style={{flex:1,textDecoration:'none'}}><button className="btn btn-outline btn-block" style={{fontSize:13}}>Book a Call</button></a>
            </div>
          </div>
        )}

        <div style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',margin:'16px 0 10px'}}>Quick links</div>
        <div className="card" style={{marginBottom:14,padding:0,overflow:'hidden'}}>
          {[
            ['💬', 'Messages', '/messages'],
            ['🎬', 'AI Videos', '/videos'],
            ['🎨', 'Creative Studio', '/studio'],
            ['🏢', 'Business Profile', '/business'],
            ['📧', 'Email Support', 'mailto:support@wovomedia.com'],
            ['📅', 'Book a Strategy Call', 'https://calendly.com/wovomedia/wovo-media-premium-strategy-call'],
          ].map(([icon,label,href],i)=>(
            <a key={label} href={href} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:i<5?'1px solid var(--border)':'none',textDecoration:'none',color:'var(--text-2)'}}>
              <span style={{fontSize:18}}>{icon}</span>
              <span style={{fontSize:14,fontWeight:500}}>{label}</span>
              <i className="ti ti-chevron-right" style={{marginLeft:'auto',fontSize:16,color:'var(--text-3)'}}/>
            </a>
          ))}
        </div>

        <button className="btn btn-outline btn-block" style={{marginBottom:32,color:'#ef4444',borderColor:'rgba(239,68,68,0.25)',padding:13}} onClick={signOut}>
          Sign Out
        </button>
      </div>
    </AppShell>
  )
}
