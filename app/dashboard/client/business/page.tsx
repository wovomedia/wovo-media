'use client'
import { useState, useEffect } from 'react'
import { supabase as sb } from '@/lib/supabase'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

const SECTIONS = [
  { key: 'basics', label: '🏢 The Basics', desc: 'Name, location, industry' },
  { key: 'story', label: '📖 Your Story', desc: 'What you do, why you exist' },
  { key: 'audience', label: '🎯 Your Audience', desc: 'Who you serve' },
  { key: 'products', label: '🛍️ Products & Services', desc: 'What you offer' },
  { key: 'voice', label: '🎙️ Brand Voice', desc: 'How you want to sound' },
  { key: 'goals', label: '🚀 Goals', desc: 'What you want to achieve' },
]

export default function BusinessProfile() {
  const [client, setClient] = useState<any>(null)
  const [profile, setProfile] = useState<any>({})
  const [section, setSection] = useState('basics')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [chatMsgs, setChatMsgs] = useState<{r:string,t:string}[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      const { data: c } = await sb.from('clients').select('*').eq('profile_id', data.user.id).single()
      if (!c) { window.location.href = '/login'; return }
      // Gate: check active subscription
      const isClientActive = c.is_active
      if (!isClientActive) {
        const { data: activeSub } = await sb.from('wovo_subscriptions').select('status').eq('client_id', c.id).eq('status','active').maybeSingle()
        if (!activeSub) { window.location.href = '/dashboard/client'; return }
      }
      if (c) {
        setClient(c)
        const { data: p } = await sb.from('client_business_profiles').select('*').eq('client_id', c.id).single()
        if (p) setProfile(p)
        else setProfile({ client_id: c.id, business_name: c.business_name })
      }
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const payload = { ...profile, client_id: client.id, updated_at: new Date().toISOString() }
    // Check completeness
    const fields = ['business_name','industry','description','target_audience','top_products','brand_voice']
    const filled = fields.filter(f => payload[f]?.trim()).length
    payload.completed = filled >= 4

    await sb.from('client_business_profiles').upsert(payload)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setSaving(false)
  }

  const set = (key: string, val: string) => setProfile((p: any) => ({ ...p, [key]: val }))

  // AI Chat to fill profile
  const sendChat = async (msg?: string) => {
    const text = msg || chatInput.trim()
    if (!text) return
    setChatInput('')
    setChatMsgs(m => [...m, { r: 'user', t: text }])
    setChatLoading(true)

    const res = await fetch('/api/business/learn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        currentProfile: profile,
        businessName: client?.business_name,
        history: chatMsgs.slice(-6)
      })
    })
    const data = await res.json()

    if (data.reply) setChatMsgs(m => [...m, { r: 'ai', t: data.reply }])
    if (data.updates) setProfile((p: any) => ({ ...p, ...data.updates }))
    setChatLoading(false)
  }

  const completionPct = () => {
    const fields = ['business_name','industry','description','target_audience','top_products','brand_voice','differentiators','goals']
    const filled = fields.filter(f => profile[f]?.trim()).length
    return Math.round((filled / fields.length) * 100)
  }

  if (!client) return <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'var(--text-2)'}}>Loading...</div></div>

  const pct = completionPct()

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>

      {/* AI CHAT */}
      {aiChatOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div className="card slide-up" style={{width:500,maxHeight:'88vh',display:'flex',flexDirection:'column',position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <h3 style={{fontSize:18,fontWeight:700}}>Tell us about your business</h3>
                <p style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>Just chat — our AI fills in your profile automatically.</p>
              </div>
              <button onClick={()=>setAiChatOpen(false)} style={{background:'none',border:'none',color:'var(--text-2)',cursor:'pointer',fontSize:22,flexShrink:0}}>×</button>
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,marginBottom:14,maxHeight:400}}>
              {chatMsgs.length === 0 && (
                <div style={{textAlign:'center',padding:'28px 0'}}>
                  <div style={{fontSize:32,marginBottom:10}}>👋</div>
                  <p style={{color:'var(--text-2)',fontSize:14,lineHeight:1.6}}>Tell me about <strong style={{color:'var(--text)'}}>{client?.business_name}</strong>. What do you do? Who do you serve? What makes you different?</p>
                  <div style={{display:'flex',flexWrap:'wrap',gap:7,justifyContent:'center',marginTop:16}}>
                    {[`We're a restaurant that...`, `I run a boutique...`, `My business helps...`, `We specialize in...`].map(q=>(
                      <button key={q} onClick={()=>sendChat(q)} style={{padding:'7px 14px',borderRadius:20,fontSize:12,cursor:'pointer',border:'1px solid var(--border-2)',background:'var(--bg-3)',color:'var(--text-2)',fontFamily:'inherit'}}>{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMsgs.map((m,i)=>(
                <div key={i} style={{alignSelf:m.r==='user'?'flex-end':'flex-start',maxWidth:'85%',background:m.r==='user'?'var(--accent-dim)':'var(--bg-3)',border:m.r==='user'?'1px solid var(--accent-border)':'1px solid var(--border)',borderRadius:m.r==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',padding:'10px 14px',fontSize:14,color:'var(--text-2)',lineHeight:1.6}}>
                  {m.t}
                </div>
              ))}
              {chatLoading && (
                <div style={{alignSelf:'flex-start',background:'var(--bg-3)',borderRadius:'14px 14px 14px 4px',padding:'10px 14px',fontSize:13,color:'var(--text-3)',display:'flex',gap:4}}>
                  <span style={{animation:'pulse 1s infinite'}}>●</span>
                  <span style={{animation:'pulse 1s infinite',animationDelay:'0.2s'}}>●</span>
                  <span style={{animation:'pulse 1s infinite',animationDelay:'0.4s'}}>●</span>
                </div>
              )}
            </div>

            <div style={{display:'flex',gap:8}}>
              <input className="input" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder="Tell me about your business..." style={{flex:1}}/>
              <button className="btn btn-primary" style={{padding:'0 16px',flexShrink:0}} onClick={()=>sendChat()} disabled={chatLoading||!chatInput.trim()}>→</button>
            </div>

            <button className="btn btn-ghost btn-sm" style={{marginTop:10,width:'100%'}} onClick={()=>{setAiChatOpen(false);save()}}>Save what we learned →</button>
          </div>
        </div>
      )}

      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100,flexWrap:'wrap',gap:10}}>
        <div style={{fontFamily:'Outfit,sans-serif',fontSize:17,fontWeight:800,letterSpacing:'-0.04em'}}>wovo<span style={{color:'var(--accent)'}}>media</span><span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:8}}>Business Profile</span></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Link href="/dashboard/client"><button className="btn btn-ghost btn-sm">← Dashboard</button></Link>
          <ThemeToggle/>
        </div>
      </nav>

      <div style={{maxWidth:860,margin:'0 auto',padding:'32px 20px',position:'relative',zIndex:2}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28,flexWrap:'wrap',gap:16}}>
          <div>
            <h1 style={{fontSize:26,fontWeight:800,marginBottom:6}}>Business Profile</h1>
            <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.6}}>The more we know about {client?.business_name}, the better your AI content, video scripts, and captions will be.</p>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button className="btn btn-outline" onClick={()=>{ setChatMsgs([]); setAiChatOpen(true) }}>💬 Fill with AI Chat</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':saved?'✓ Saved':'Save Profile'}</button>
          </div>
        </div>

        {/* Completion bar */}
        <div className="card" style={{marginBottom:24,padding:'16px 20px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>Profile completion</span>
            <span style={{fontSize:13,color:pct>=80?'var(--accent)':'var(--text-3)',fontWeight:600}}>{pct}%</span>
          </div>
          <div style={{height:6,background:'var(--bg-3)',borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',background:pct>=80?'var(--accent)':pct>=50?'#f59e0b':'var(--text-3)',borderRadius:3,width:`${pct}%`,transition:'width 0.4s ease'}}/>
          </div>
          <p style={{fontSize:12,color:'var(--text-3)',marginTop:6}}>
            {pct < 50 ? '⚡ Fill in more details for better AI content' : pct < 80 ? '🔥 Almost there — add a few more details' : '✨ Great profile — your AI content will be highly personalized'}
          </p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:20}} className="grid-2">
          {/* Sidebar sections */}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {SECTIONS.map(s=>(
              <button key={s.key} onClick={()=>setSection(s.key)} style={{padding:'10px 14px',borderRadius:9,textAlign:'left',border:'1px solid',borderColor:section===s.key?'var(--accent-border)':'transparent',background:section===s.key?'var(--accent-dim)':'transparent',cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s'}}>
                <div style={{fontSize:13,fontWeight:600,color:section===s.key?'var(--accent)':'var(--text)'}}>{s.label}</div>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:1}}>{s.desc}</div>
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className="card">
            {section==='basics' && (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:4}}>The Basics</h3>
                <Field label="Business name" value={profile.business_name||''} onChange={(v: string)=>set('business_name',v)} placeholder="Your business name"/>
                <Field label="Industry / type" value={profile.industry||''} onChange={(v: string)=>set('industry',v)} placeholder="e.g. Restaurant, Boutique, Auto repair, Healthcare"/>
                <Field label="Location" value={profile.location||''} onChange={(v: string)=>set('location',v)} placeholder="e.g. Franklin, TN · Middle Tennessee"/>
                <Field label="Year founded" value={profile.founded_year||''} onChange={(v: string)=>set('founded_year',v)} placeholder="e.g. 2019"/>
                <Field label="Tagline" value={profile.tagline||''} onChange={(v: string)=>set('tagline',v)} placeholder="One-line description of your business"/>
                <Field label="Website" value={profile.website||''} onChange={(v: string)=>set('website',v)} placeholder="yoursite.com"/>
              </div>
            )}
            {section==='story' && (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:4}}>Your Story</h3>
                <Field label="What does your business do?" value={profile.description||''} onChange={(v: string)=>set('description',v)} placeholder="Describe what you do, your main services, and what makes you special..." multiline/>
                <Field label="What makes you different from competitors?" value={profile.differentiators||''} onChange={(v: string)=>set('differentiators',v)} placeholder="e.g. Family-owned since 1987, only organic ingredients, fastest service in town..." multiline/>
              </div>
            )}
            {section==='audience' && (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:4}}>Your Audience</h3>
                <Field label="Who are your ideal customers?" value={profile.target_audience||''} onChange={(v: string)=>set('target_audience',v)} placeholder="e.g. Young professionals 25-40, families in Franklin, local business owners..." multiline/>
                <Field label="What problems do you solve for them?" value={profile.goals||''} onChange={(v: string)=>set('goals',v)} placeholder="e.g. They want quick healthy lunch options, they need reliable auto service..." multiline/>
              </div>
            )}
            {section==='products' && (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:4}}>Products & Services</h3>
                <Field label="Top products / services" value={profile.top_products||''} onChange={(v: string)=>set('top_products',v)} placeholder="List your main offerings. e.g. Signature tacos, catering, daily lunch specials, private events..." multiline/>
                <Field label="Social media handles" value={profile.social_handles||''} onChange={(v: string)=>set('social_handles',v)} placeholder="e.g. @yourbusiness on Instagram, TikTok, Facebook"/>
              </div>
            )}
            {section==='voice' && (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:4}}>Brand Voice</h3>
                <Field label="How should your content sound?" value={profile.brand_voice||''} onChange={(v: string)=>set('brand_voice',v)} placeholder="e.g. Fun and casual, professional but approachable, bold and energetic, warm and community-focused..." multiline/>
                <Field label="Topics or phrases to avoid" value={profile.avoid_topics||''} onChange={(v: string)=>set('avoid_topics',v)} placeholder="e.g. Don't mention competitors, avoid political topics, no slang..." multiline/>
              </div>
            )}
            {section==='goals' && (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:4}}>Goals</h3>
                <Field label="What do you want to achieve with content?" value={profile.goals||''} onChange={(v: string)=>set('goals',v)} placeholder="e.g. Drive more foot traffic, grow Instagram following, promote weekend specials, build brand awareness..." multiline/>
              </div>
            )}
            <button className="btn btn-primary" style={{marginTop:20,padding:'12px 24px',fontSize:15}} onClick={save} disabled={saving}>
              {saving?'Saving...':saved?'✓ Saved!':'Save Changes'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, multiline }: any) {
  return (
    <div>
      <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>{label}</label>
      {multiline
        ? <textarea className="input" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3}/>
        : <input className="input" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
      }
    </div>
  )
}
