'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const PLANS = [
  {key:'starter',name:'Starter',price:'$29/mo',desc:'AI character for yourself. 3 posts/week.',features:['Your own AI character','3 posts per week','Ready-to-copy captions','Basic edits','Posting tutorials']},
  {key:'growth',name:'Growth',price:'$49/mo',desc:'AI characters for your whole team.',features:['Everything in Starter','AI characters for every employee','5 posts per week','Unlimited edits','Week description input']},
  {key:'pro_ai',name:'Pro AI',price:'$79/mo',desc:'Daily posts, Stories, multiple brands.',features:['Everything in Growth','Daily posts + Stories','Multiple brand characters','Monthly strategy report','Early feature access']},
  {key:'website',name:'Website Builder',price:'$99/mo',desc:'Wovo AI builds your website.',features:['Full AI website generation','Choose your style','Business info → live site','Easy to update anytime','Hosted and deployed']},
]

function WovoAIContent() {
  const params = useSearchParams()
  const plan = params.get('plan') || ''
  const [selectedPlan, setSelectedPlan] = useState(plan)
  const [activeTab, setActiveTab] = useState<'content'|'team'|'website'>('content')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [business, setBusiness] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Website builder state
  const [wbStep, setWbStep] = useState(0)
  const [wbData, setWbData] = useState({businessName:'',type:'',location:'',tagline:'',style:'modern'})
  const [wbGenerating, setWbGenerating] = useState(false)
  const [wbResult, setWbResult] = useState('')

  const generateWebsite = async () => {
    setWbGenerating(true)
    try {
      const res = await fetch('/api/website-builder', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(wbData)
      })
      const data = await res.json()
      setWbResult(data.html || '')
      setWbStep(3)
    } catch(e) {
      setWbResult('<h1>Error generating site. Please try again.</h1>')
      setWbStep(3)
    }
    setWbGenerating(false)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setDone(true); setLoading(false) }, 1000)
  }

  if(done) return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <div className="card slide-up" style={{width:420,position:'relative',zIndex:2,textAlign:'center',padding:40}}>
        <div style={{fontSize:48,marginBottom:16}}>🎉</div>
        <h2 style={{fontSize:24,fontWeight:700,marginBottom:8}}>You're in!</h2>
        <p style={{color:'var(--text-2)',marginBottom:24}}>Welcome to Wovo AI. Your account is being set up — you'll hear from us within 24 hours to complete onboarding and start building your AI character.</p>
        <Link href="/"><button className="btn btn-primary" style={{width:'100%',padding:13}}>Back to home</button></Link>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 48px',borderBottom:'0.5px solid var(--border)',background:'rgba(8,8,8,0.92)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:100}}>
        <Link href="/" style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:700,color:'var(--text)',textDecoration:'none'}}>wovo<span style={{color:'var(--accent)'}}>media</span></Link>
        <div style={{display:'flex',gap:8}}>
          {(['content','team','website'] as const).map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)} style={{background:activeTab===t?'var(--accent-dim)':'transparent',border:'0.5px solid',borderColor:activeTab===t?'var(--accent-border)':'transparent',color:activeTab===t?'var(--accent)':'var(--text-2)',padding:'7px 16px',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit',textTransform:'capitalize'}}>{t==='website'?'Website Builder':t}</button>
          ))}
        </div>
        <Link href="/"><button className="btn btn-ghost btn-sm">← Home</button></Link>
      </nav>

      <div style={{maxWidth:900,margin:'0 auto',padding:'48px 32px',position:'relative',zIndex:2}}>

        {activeTab==='content' && (
          <>
            <h1 style={{fontSize:32,fontWeight:700,marginBottom:8}}>Wovo AI <span style={{color:'var(--accent)'}}>Content</span></h1>
            <p style={{color:'var(--text-2)',marginBottom:40}}>Choose your plan and get started. All plans include AI character creation.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14,marginBottom:40}}>
              {PLANS.filter(p=>p.key!=='website').map(p=>(
                <div key={p.key} className={`card ${selectedPlan===p.key?'card-accent':''}`} style={{cursor:'pointer',transition:'border-color 0.2s'}} onClick={()=>setSelectedPlan(p.key)}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                    <div>
                      <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:500,marginBottom:6}}>{p.name}</div>
                      <div style={{fontSize:28,fontWeight:700,fontFamily:'Syne,sans-serif',color:'var(--text)'}}>{p.price}</div>
                    </div>
                    <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${selectedPlan===p.key?'var(--accent)':'var(--border-2)'}`,background:selectedPlan===p.key?'var(--accent)':'transparent',transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {selectedPlan===p.key&&<div style={{width:8,height:8,borderRadius:'50%',background:'#080808'}}/>}
                    </div>
                  </div>
                  <p style={{fontSize:13,color:'var(--text-3)',marginBottom:14}}>{p.desc}</p>
                  {p.features.map(f=><div key={f} style={{fontSize:12,color:'var(--text-2)',padding:'6px 0',borderTop:'0.5px solid var(--border)',display:'flex',gap:7}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>)}
                </div>
              ))}
            </div>
            {selectedPlan && (
              <div className="card card-accent" style={{maxWidth:480}}>
                <h3 style={{fontSize:18,fontWeight:600,marginBottom:20}}>Create your account</h3>
                <form onSubmit={handleSignup} style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Your name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Payton Cody" required/></div>
                  <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Business name</label><input className="input" value={business} onChange={e=>setBusiness(e.target.value)} placeholder="Mojo Tacos" required/></div>
                  <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@business.com" required/></div>
                  <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 8 characters" minLength={8} required/></div>
                  <button className="btn btn-primary" type="submit" style={{width:'100%',padding:13,marginTop:4}} disabled={loading}>{loading?'Creating account...':'Create account & continue'}</button>
                </form>
                <p style={{fontSize:12,color:'var(--text-3)',textAlign:'center',marginTop:16}}>Secure billing powered by Stripe. Cancel anytime.</p>
              </div>
            )}
            {!selectedPlan&&<p style={{color:'var(--text-3)',fontSize:14}}>👆 Select a plan above to get started</p>}
          </>
        )}

        {activeTab==='team' && (
          <>
            <h1 style={{fontSize:32,fontWeight:700,marginBottom:8}}>Team <span style={{color:'var(--accent)'}}>Characters</span></h1>
            <p style={{color:'var(--text-2)',marginBottom:40}}>Available on Growth and above. Create a unique AI character for every employee — they all post as themselves, with your brand's voice.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:40}}>
              {['Owner / Founder','Manager','Front of House','Chef / Kitchen','Bartender','Brand Rep'].map(role=>(
                <div key={role} className="card" style={{textAlign:'center',padding:24}}>
                  <div style={{width:56,height:56,borderRadius:'50%',background:'var(--accent-dim)',border:'2px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,margin:'0 auto 12px',color:'var(--accent)'}}>👤</div>
                  <div style={{fontSize:14,fontWeight:500,color:'var(--text)',marginBottom:4}}>{role}</div>
                  <div style={{fontSize:12,color:'var(--text-3)'}}>Upload photos → AI character created</div>
                </div>
              ))}
            </div>
            <div className="card card-accent" style={{maxWidth:560}}>
              <h3 style={{fontSize:16,fontWeight:600,marginBottom:8}}>How team characters work</h3>
              <div style={{display:'flex',flexDirection:'column',gap:12,marginTop:16}}>
                {[['1','Upload 3–5 photos of each team member'],['2','We build a realistic AI character based on their look'],['3','Each character creates content for their role'],['4','All tied to your account — you approve everything']].map(([n,t])=>(
                  <div key={n} style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div style={{width:24,height:24,borderRadius:'50%',background:'var(--accent)',color:'#080808',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{n}</div>
                    <span style={{fontSize:14,color:'var(--text-2)',paddingTop:3}}>{t}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{marginTop:24,width:'100%'}} onClick={()=>{setSelectedPlan('growth');setActiveTab('content')}}>Get Growth Plan — $49/mo</button>
            </div>
          </>
        )}

        {activeTab==='website' && (
          <>
            <h1 style={{fontSize:32,fontWeight:700,marginBottom:8}}>Website <span style={{color:'var(--accent)'}}>Builder</span></h1>
            <p style={{color:'var(--text-2)',marginBottom:40}}>Tell Wovo AI about your business and it generates a complete, professional website — ready to launch.</p>

            {wbStep===0 && (
              <div className="card card-accent" style={{maxWidth:560}}>
                <h3 style={{fontSize:16,fontWeight:600,marginBottom:20}}>Tell us about your business</h3>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Business name</label><input className="input" value={wbData.businessName} onChange={e=>setWbData(d=>({...d,businessName:e.target.value}))} placeholder="Mojo Tacos"/></div>
                  <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Business type</label>
                    <select className="input" value={wbData.type} onChange={e=>setWbData(d=>({...d,type:e.target.value}))}>
                      <option value="">Select type...</option>
                      {['Restaurant / Food','Retail / Boutique','Service Business','Healthcare','Bar / Nightlife','Other'].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Location</label><input className="input" value={wbData.location} onChange={e=>setWbData(d=>({...d,location:e.target.value}))} placeholder="Columbia, TN"/></div>
                  <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Tagline / what makes you special</label><input className="input" value={wbData.tagline} onChange={e=>setWbData(d=>({...d,tagline:e.target.value}))} placeholder="Best tacos in Middle Tennessee"/></div>
                  <div><label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6}}>Website style</label>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {[['modern','Modern & Clean'],['bold','Bold & Vibrant'],['minimal','Minimal'],['warm','Warm & Friendly']].map(([v,l])=>(
                        <button key={v} onClick={()=>setWbData(d=>({...d,style:v}))} style={{padding:'8px 16px',borderRadius:8,fontSize:13,cursor:'pointer',border:'0.5px solid',borderColor:wbData.style===v?'var(--accent-border)':'var(--border-2)',background:wbData.style===v?'var(--accent-dim)':'transparent',color:wbData.style===v?'var(--accent)':'var(--text-2)',fontFamily:'inherit'}}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{width:'100%',padding:13,marginTop:8}} onClick={()=>setWbStep(1)} disabled={!wbData.businessName||!wbData.type}>Next →</button>
                </div>
              </div>
            )}

            {wbStep===1 && (
              <div className="card card-accent" style={{maxWidth:560,textAlign:'center',padding:48}}>
                <div style={{fontSize:48,marginBottom:16}}>🎨</div>
                <h3 style={{fontSize:20,fontWeight:600,marginBottom:8}}>Ready to build your site</h3>
                <div style={{textAlign:'left',background:'var(--bg-3)',borderRadius:10,padding:16,marginBottom:24}}>
                  {[['Business',wbData.businessName],['Type',wbData.type],['Location',wbData.location],['Style',wbData.style]].map(([k,v])=>v&&(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid var(--border)',fontSize:13}}>
                      <span style={{color:'var(--text-3)'}}>{k}</span><span style={{color:'var(--text)'}}>{v}</span>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" style={{width:'100%',padding:13}} onClick={()=>{setWbStep(2);generateWebsite()}} disabled={wbGenerating}>Generate My Website ✨</button>
                <button className="btn btn-ghost" style={{width:'100%',marginTop:10}} onClick={()=>setWbStep(0)}>← Edit details</button>
              </div>
            )}

            {wbStep===2 && (
              <div style={{textAlign:'center',padding:'60px 0'}}>
                <div style={{width:48,height:48,border:'3px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',margin:'0 auto 20px',animation:'spin 1s linear infinite'}}/>
                <h3 style={{fontSize:20,fontWeight:600,marginBottom:8}}>Building your website...</h3>
                <p style={{color:'var(--text-2)'}}>Wovo AI is generating a complete website for {wbData.businessName}</p>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            {wbStep===3 && wbResult && (
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                  <h3 style={{fontSize:20,fontWeight:600}}>Your website is ready! 🎉</h3>
                  <div style={{display:'flex',gap:10}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>{setWbStep(0);setWbResult('')}}>Start over</button>
                    <button className="btn btn-primary btn-sm" onClick={()=>{const b=new Blob([wbResult],{type:'text/html'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${wbData.businessName.toLowerCase().replace(/\s+/g,'-')}-website.html`;a.click()}}>Download HTML</button>
                  </div>
                </div>
                <div style={{borderRadius:12,overflow:'hidden',border:'1px solid var(--border)',height:600}}>
                  <iframe srcDoc={wbResult} style={{width:'100%',height:'100%',border:'none'}} title="Generated website preview"/>
                </div>
                <div className="card" style={{marginTop:16,textAlign:'center'}}>
                  <p style={{color:'var(--text-2)',marginBottom:16}}>Want us to deploy this and connect it to your domain? That's included in Wovo Media Premium.</p>
                  <button className="btn btn-outline" onClick={()=>window.open('https://calendly.com/wovomedia','_blank')}>Book a call to deploy →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function WovoAI() {
  return <Suspense fallback={<div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'var(--text-2)'}}>Loading...</div></div>}><WovoAIContent/></Suspense>
}
