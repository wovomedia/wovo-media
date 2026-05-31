'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AppShell from '@/components/AppShell'

export default function Business() {
  const [client, setClient] = useState<any>(null)
  const [profile, setProfile] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [chatMsgs, setChatMsgs] = useState<{r:string,t:string}[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const MAIN = ''

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const data = { user: session?.user }
      if (!data.user) { window.location.replace('/login'); return }
      const { data: c } = await supabase.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (c) {
        setClient(c); setIsActive(c.is_active)
        const { data: p } = await supabase.from('client_business_profiles').select('*').eq('client_id', c.id).maybeSingle()
        if (p) setProfile(p)
        else setProfile({ client_id: c.id, business_name: c.business_name })
      }
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const payload = { ...profile, client_id: client.id, updated_at: new Date().toISOString() }
    const fields = ['business_name','industry','description','target_audience','top_products','brand_voice']
    payload.completed = fields.filter(f => payload[f]?.trim()).length >= 4
    await supabase.from('client_business_profiles').upsert(payload)
    setSaved(true); setTimeout(() => setSaved(false), 2500); setSaving(false)
  }

  const sendChat = async () => {
    const text = chatInput.trim(); if (!text || chatLoading) return
    setChatInput('')
    const newMsgs = [...chatMsgs, {r:'user',t:text}]
    setChatMsgs(newMsgs); setChatLoading(true)
    const res = await fetch(`/api/business/learn`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, currentProfile: profile, businessName: client?.business_name, history: chatMsgs.slice(-6) })
    })
    const data = await res.json()
    if (data.reply) setChatMsgs(m => [...m, {r:'ai',t:data.reply}])
    if (data.updates) setProfile((p: any) => ({ ...p, ...data.updates }))
    setChatLoading(false)
  }

  const pct = () => {
    const fields = ['business_name','industry','description','target_audience','top_products','brand_voice','differentiators','goals']
    return Math.round(fields.filter(f => profile[f]?.trim()).length / fields.length * 100)
  }

  const set = (k: string, v: string) => setProfile((p: any) => ({ ...p, [k]: v }))

  return (
    <AppShell user={client}>
      <div style={{padding:'20px 16px 0'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div><h1 className="page-title">My Business</h1><p className="page-sub">{pct()}% complete</p></div>
          {isActive && <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saved?'✓ Saved':saving?'...':'Save'}</button>}
        </div>

        {!isActive ? (
          <div className="card card-accent" style={{textAlign:'center',padding:'40px 20px'}}>
            <div style={{fontSize:40,marginBottom:14}}>🏢</div>
            <h3 style={{fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:8}}>Business profile requires a subscription</h3>
            <p style={{fontSize:13,color:'var(--text-2)',marginBottom:20,lineHeight:1.6}}>Your business profile teaches the AI about your brand so every video, caption, and script is personalized.</p>
            <a href={`/wovo-ai`} target="_blank" rel="noreferrer"><button className="btn btn-primary" style={{padding:'11px 28px'}}>See Plans →</button></a>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="card" style={{marginBottom:14,padding:'12px 16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>Profile completion</span>
                <span style={{fontSize:12,color:pct()>=80?'var(--accent)':'var(--text-3)',fontWeight:600}}>{pct()}%</span>
              </div>
              <div style={{height:5,background:'var(--bg-3)',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',background:pct()>=80?'var(--accent)':pct()>=50?'#f59e0b':'var(--text-3)',borderRadius:3,width:`${pct()}%`,transition:'width 0.4s'}}/>
              </div>
            </div>

            {/* AI Chat */}
            <div className="card" style={{marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--accent)',marginBottom:10}}>💬 Fill with AI Chat</div>
              <div style={{maxHeight:200,overflowY:'auto',display:'flex',flexDirection:'column',gap:7,marginBottom:10}}>
                {chatMsgs.length === 0 && <p style={{fontSize:12,color:'var(--text-3)',textAlign:'center',padding:'12px 0'}}>Tell me about your business and I'll fill in your profile automatically.</p>}
                {chatMsgs.map((m,i)=>(
                  <div key={i} style={{alignSelf:m.r==='user'?'flex-end':'flex-start',maxWidth:'85%',background:m.r==='user'?'var(--accent)':'var(--bg-3)',color:m.r==='user'?'#080808':'var(--text-2)',borderRadius:m.r==='user'?'10px 10px 3px 10px':'10px 10px 10px 3px',padding:'8px 12px',fontSize:12,lineHeight:1.5}}>
                    {m.t}
                  </div>
                ))}
                {chatLoading && <div style={{alignSelf:'flex-start',background:'var(--bg-3)',borderRadius:'10px 10px 10px 3px',padding:'8px 12px',display:'flex',gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:'50%',background:'var(--text-3)',animation:'pulse 1s infinite',animationDelay:`${i*0.2}s`}}/>)}</div>}
              </div>
              <div style={{display:'flex',gap:8}}>
                <input className="input" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder="Tell me about your business..." style={{fontSize:13,padding:'9px 12px',flex:1}} disabled={chatLoading}/>
                <button className="btn btn-primary btn-sm" onClick={sendChat} disabled={chatLoading||!chatInput} style={{flexShrink:0}}>→</button>
              </div>
            </div>

            {/* Manual fields */}
            {[
              ['business_name','Business name','Your business name'],
              ['industry','Industry','e.g. Restaurant, Retail, HVAC'],
              ['location','Location','e.g. Franklin, TN'],
              ['description','What do you do?','Describe your business and what makes you special'],
              ['target_audience','Your ideal customers','Who do you serve?'],
              ['top_products','Top products/services','Your main offerings'],
              ['brand_voice','Brand voice','How should your content sound?'],
              ['goals','Goals','What do you want to achieve with content?'],
            ].map(([key,label,placeholder])=>(
              <div key={key} style={{marginBottom:12}}>
                <label style={{fontSize:12,color:'var(--text-2)',display:'block',marginBottom:5,fontWeight:600}}>{label}</label>
                {['description','target_audience','top_products','brand_voice','goals'].includes(key)
                  ? <textarea className="input" value={profile[key]||''} onChange={e=>set(key,e.target.value)} placeholder={placeholder} rows={2}/>
                  : <input className="input" value={profile[key]||''} onChange={e=>set(key,e.target.value)} placeholder={placeholder}/>
                }
              </div>
            ))}
            <button className="btn btn-primary btn-block" style={{padding:13,fontSize:14,marginBottom:20}} onClick={save} disabled={saving}>
              {saving?'Saving...':saved?'✓ Saved!':'Save Profile'}
            </button>
          </>
        )}
      </div>
    </AppShell>
  )
}
