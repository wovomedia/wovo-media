'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const PLANS = [
  {key:'starter',name:'Starter',price:'$29/mo',desc:'AI character for yourself. 3 posts/week.',features:['Your own AI character','3 posts per week','Ready-to-copy captions','Basic edits','Posting tutorials']},
  {key:'growth',name:'Growth',price:'$49/mo',desc:'AI characters for your whole team.',features:['Everything in Starter','AI characters for every employee','5 posts per week','Unlimited edits','Week description input']},
  {key:'pro_ai',name:'Pro AI',price:'$79/mo',desc:'Daily posts, Stories, multiple brands.',features:['Everything in Growth','Daily posts + Stories','Multiple brand characters','Monthly strategy report','Early feature access']},
  {key:'website',name:'Website Builder',price:'$99/mo',desc:'Wovo AI builds your website.',features:['Full AI website generation','Choose your style','Business info → live site','Easy to update anytime','Hosted and deployed']},
]


function VideoGenerator() {
  const [script, setScript] = useState('')
  const [style, setStyle] = useState('professional')
  const [generating, setGenerating] = useState(false)
  const [videoId, setVideoId] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const generate = async () => {
    if (!script.trim()) return
    setGenerating(true); setError(''); setVideoId(''); setVideoUrl(''); setStatus('processing')
    const res = await fetch('/api/heygen/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, type: 'custom' })
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setGenerating(false); return }
    setVideoId(data.videoId)
    // Poll for completion
    const poll = setInterval(async () => {
      const s = await fetch(`/api/heygen/status?id=${data.videoId}`)
      const sd = await s.json()
      setStatus(sd.status)
      if (sd.status === 'completed' && sd.videoUrl) {
        setVideoUrl(sd.videoUrl)
        setGenerating(false)
        clearInterval(poll)
      } else if (sd.status === 'failed') {
        setError('Video generation failed. Please try again.')
        setGenerating(false)
        clearInterval(poll)
      }
    }, 5000)
  }

  return (
    <div style={{maxWidth:600}}>
      <div className="card" style={{marginBottom:16}}>
        <h3 style={{fontSize:16,fontWeight:600,marginBottom:16}}>Generate a video</h3>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Video style</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[['professional','Professional'],['casual','Casual & Friendly'],['exciting','High Energy']].map(([v,l])=>(
              <button key={v} onClick={()=>setStyle(v)} style={{padding:'7px 14px',borderRadius:8,fontSize:13,cursor:'pointer',border:'1px solid',borderColor:style===v?'var(--accent)':'var(--border-2)',background:style===v?'var(--accent-dim)':'transparent',color:style===v?'var(--accent)':'var(--text-2)',fontFamily:'inherit',fontWeight:500}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:600}}>Script — what should the avatar say?</label>
          <textarea className="input" value={script} onChange={e=>setScript(e.target.value)} rows={5} placeholder="e.g. Hey everyone! Come check out our new summer menu — we've got something for everyone. See you soon!"/>
          <p style={{fontSize:12,color:'var(--text-3)',marginTop:5}}>{script.length} characters · ~{Math.ceil(script.split(' ').length/150)} min video</p>
        </div>
        {error && <div className="alert alert-error" style={{marginBottom:12}}>{error}</div>}
        <button className="btn btn-primary" style={{width:'100%',padding:12,fontSize:15}} onClick={generate} disabled={generating||!script.trim()}>
          {generating ? (status === 'processing' ? 'Generating video...' : `Status: ${status}`) : 'Generate AI Video ✨'}
        </button>
        {generating && <p style={{fontSize:12,color:'var(--text-3)',textAlign:'center',marginTop:8}}>Takes 2–5 minutes. You can leave this page.</p>}
      </div>
      {videoUrl && (
        <div className="card card-accent">
          <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Your video is ready ✓</div>
          <video src={videoUrl} controls style={{width:'100%',borderRadius:10,marginBottom:14}}/>
          <a href={videoUrl} download><button className="btn btn-primary btn-sm" style={{width:'100%'}}>Download Video</button></a>
        </div>
      )}
      <div className="card" style={{marginTop:16,background:'var(--bg-3)'}}>
        <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6}}>💡 <strong>Tips:</strong> Keep scripts under 60 seconds for social. Mention your business name early. End with a clear call to action.</p>
      </div>
    </div>
  )
}

function WebsiteBuilderFull({ isLoggedIn, hasActiveSubscription, authChecked }: { isLoggedIn: boolean, hasActiveSubscription: boolean, authChecked: boolean }) {
  const [step, setStep] = useState(0)
  const [researching, setResearching] = useState(false)
  const [researchData, setResearchData] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState('')
  const [msg, setMsg] = useState('')
  const [d, setD] = useState({
    businessName:'', businessType:'', location:'', tagline:'', style:'Modern & Clean',
    description:'', phone:'', email:'', address:'', hours:'',
    currentWebsite:'', instagram:'', facebook:'', tiktok:'', youtube:'', google:'',
    pages:'Home, About, Services, Contact', staffMembers:'', menuItems:'', services:'',
    testimonials:'', logoUrl:'', aboutStory:''
  })
  const set = (k: string, v: string) => setD(p => ({...p, [k]: v}))

  const doResearch = async () => {
    if (!d.businessName) return
    setResearching(true)
    try {
      const res = await fetch(`/api/website-builder?name=${encodeURIComponent(d.businessName)}&location=${encodeURIComponent(d.location)}`)
      const data = await res.json()
      setResearchData(data.research || '')
    } catch {}
    setResearching(false)
  }

  const generate = async () => {
    setStep(4); setGenerating(true)
    const res = await fetch('/api/website-builder', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({...d, researchData})
    })
    const data = await res.json()
    setResult(data.html || '')
    setGenerating(false); setStep(5)
  }

  const F = ({label, k, placeholder, multi=false, req=false}: any) => (
    <div>
      <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>{label}{req&&<span style={{color:'var(--accent)'}}>*</span>}</label>
      {multi ? <textarea className="input" value={d[k as keyof typeof d]} onChange={e=>set(k,e.target.value)} placeholder={placeholder} rows={3}/> :
        <input className="input" value={d[k as keyof typeof d]} onChange={e=>set(k,e.target.value)} placeholder={placeholder}/>}
    </div>
  )

  const progress = [
    'Basics', 'Contact & Online', 'Your Content', 'Branding & Pages', 'Generate'
  ]

  if (step === 5 && result) return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <h3 style={{fontSize:20,fontWeight:700,color:'var(--text)'}}>🎉 Your website is ready!</h3>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setStep(0);setResult('')}}>Start over</button>
          <button className="btn btn-primary btn-sm" onClick={()=>{const b=new Blob([result],{type:'text/html'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`${d.businessName.toLowerCase().replace(/\s+/g,'-')}-website.html`;a.click()}}>⬇ Download HTML</button>
        </div>
      </div>
      <div style={{borderRadius:12,overflow:'hidden',border:'1px solid var(--border)',height:620,marginBottom:16}}>
        <iframe srcDoc={result} style={{width:'100%',height:'100%',border:'none'}} title="Preview"/>
      </div>
      <div className="card" style={{textAlign:'center',padding:'20px 24px'}}>
        <p style={{color:'var(--text-2)',marginBottom:14,fontSize:14}}>Want us to deploy this, connect a domain, and maintain it? That's included in Wovo Media Premium.</p>
        <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer"><button className="btn btn-primary">Book a call to deploy →</button></a>
      </div>
    </div>
  )

  if (step === 4) return (
    <div style={{textAlign:'center',padding:'80px 0'}}>
      <div style={{width:52,height:52,border:'3px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',margin:'0 auto 20px',animation:'spin 1s linear infinite'}}/>
      <h3 style={{fontSize:20,fontWeight:600,color:'var(--text)',marginBottom:8}}>Building your website...</h3>
      <p style={{color:'var(--text-2)',fontSize:14}}>Wovo AI is crafting a complete website for {d.businessName}. This takes about 30 seconds.</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!authChecked) return <div style={{textAlign:'center',padding:48}}><div className='spinner' style={{margin:'0 auto'}}/></div>

  if (!isLoggedIn) return (
    <div className="card card-accent" style={{textAlign:'center',padding:'48px 32px',maxWidth:500}}>
      <div style={{fontSize:40,marginBottom:14}}>🔒</div>
      <h3 style={{fontSize:20,fontWeight:700,marginBottom:10,color:'var(--text)'}}>Subscription required</h3>
      <p style={{color:'var(--text-2)',marginBottom:24,lineHeight:1.65}}>The Website Builder is available on the Website Builder plan ($99/mo). Subscribe to unlock.</p>
      <a href="https://pay.wovomedia.com/b/4gMcN57U7avV0vqbZ6cIE11" target="_blank" rel="noreferrer">
        <button className="btn btn-primary" style={{padding:'12px 28px',fontSize:14}}>Get Website Builder — $99/mo</button>
      </a>
    </div>
  )

  if (!hasActiveSubscription) return (
    <div className="card card-accent" style={{textAlign:'center',padding:'48px 32px',maxWidth:500}}>
      <div style={{fontSize:40,marginBottom:14}}>🔒</div>
      <h3 style={{fontSize:20,fontWeight:700,marginBottom:10,color:'var(--text)'}}>Website Builder plan required</h3>
      <p style={{color:'var(--text-2)',marginBottom:24,lineHeight:1.65}}>You need the Website Builder plan ($99/mo) to access this feature.</p>
      <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
        <a href="https://pay.wovomedia.com/b/4gMcN57U7avV0vqbZ6cIE11" target="_blank" rel="noreferrer">
          <button className="btn btn-primary">Get Website Builder — $99/mo</button>
        </a>
        <a href="/login"><button className="btn btn-outline">Log In</button></a>
      </div>
    </div>
  )

  return (
    <div style={{maxWidth:600}}>
      <h1 style={{fontSize:32,fontWeight:700,marginBottom:6,color:'var(--text)'}}>Website <span style={{color:'var(--accent)'}}>Builder</span></h1>
      <p style={{color:'var(--text-2)',marginBottom:28,fontSize:14}}>Tell Wovo AI about your business. The more you share, the better your site. We'll also search online to fill in any gaps.</p>

      {/* Progress */}
      <div style={{display:'flex',gap:4,marginBottom:28}}>
        {progress.map((p,i) => (
          <div key={p} style={{flex:1,height:3,borderRadius:2,background:i<=step?'var(--accent)':'var(--bg-4)',transition:'background 0.3s',cursor:i<step?'pointer':'default'}} onClick={()=>i<step&&setStep(i)}/>
        ))}
      </div>
      <div style={{fontSize:12,color:'var(--text-3)',marginBottom:20,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em'}}>Step {step+1} of 4 — {progress[step]}</div>

      {step===0 && (
        <div className="card" style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Business name<span style={{color:'var(--accent)'}}>*</span></label>
              <input className="input" value={d.businessName} onChange={e=>{const v=e.target.value;setD(p=>({...p,businessName:v}))}} placeholder="Your business name"/>
            </div>
          <div>
            <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Business type<span style={{color:'var(--accent)'}}>*</span></label>
            <select className="input" value={d.businessType} onChange={e=>set('businessType',e.target.value)}>
              <option value="">Select type...</option>
              {['Restaurant / Food & Drink','Bar / Nightlife','Coffee Shop / Cafe','Retail / Boutique','Hair / Beauty Salon','Spa / Wellness','Healthcare / Medical','Auto / Car Services','HVAC / Plumbing / Electrical','Landscaping / Lawn Care','Cleaning Services','Photography / Videography','Real Estate','Gym / Fitness','Law / Legal Services','Accounting / Finance','Other Service Business','Other'].map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>City, State<span style={{color:'var(--accent)'}}>*</span></label>
              <input className="input" value={d.location} onChange={e=>{const v=e.target.value;setD(p=>({...p,location:v}))}} placeholder="City, State"/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Your tagline / what makes you special</label>
              <input className="input" value={d.tagline} onChange={e=>{const v=e.target.value;setD(p=>({...p,tagline:v}))}} placeholder="What makes your business special"/>
            </div>
          <div>
            <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:6,fontWeight:500}}>Website style</label>
            <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
              {['Modern & Clean','Bold & Vibrant','Minimal','Warm & Friendly','Luxury','Fun & Playful'].map(s=>(
                <button key={s} onClick={()=>set('style',s)} style={{padding:'7px 14px',borderRadius:20,fontSize:12,cursor:'pointer',border:'1px solid',fontFamily:'inherit',fontWeight:500,borderColor:d.style===s?'var(--accent)':'var(--border-2)',background:d.style===s?'var(--accent-dim)':'transparent',color:d.style===s?'var(--accent)':'var(--text-2)'}}>{s}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" style={{padding:12,marginTop:4}} onClick={async ()=>{setStep(1);await doResearch()}} disabled={!d.businessName||!d.businessType||!d.location}>
            Next → {d.businessName ? "(we'll look you up online)" : ''}
          </button>
        </div>
      )}

      {step===1 && (
        <div className="card" style={{display:'flex',flexDirection:'column',gap:14}}>
          {researching && (
            <div style={{background:'var(--accent-dim)',border:'1px solid var(--accent-border)',borderRadius:10,padding:'10px 14px',fontSize:13,color:'var(--accent)',display:'flex',alignItems:'center',gap:8}}>
              <span style={{width:14,height:14,border:'2px solid var(--accent)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block',flexShrink:0}}/>
              Searching online for {d.businessName}...
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {researchData && !researching && (
            <div style={{background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#22c55e'}}>
              ✓ Found info online — we'll use this to fill in your site. Review and correct anything below.
            </div>
          )}
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Phone number</label>
              <input className="input" value={d.phone} onChange={e=>{const v=e.target.value;setD(p=>({...p,phone:v}))}} placeholder="(555) 000-0000"/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Email address</label>
              <input className="input" value={d.email} onChange={e=>{const v=e.target.value;setD(p=>({...p,email:v}))}} placeholder="hello@yourbusiness.com"/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Full street address</label>
              <input className="input" value={d.address} onChange={e=>{const v=e.target.value;setD(p=>({...p,address:v}))}} placeholder="123 Main St, Your City, State 00000"/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Business hours</label>
              <input className="input" value={d.hours} onChange={e=>{const v=e.target.value;setD(p=>({...p,hours:v}))}} placeholder="Mon–Fri 11am–9pm, Sat–Sun 10am–10pm"/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Current website (if you have one)</label>
              <input className="input" value={d.currentWebsite} onChange={e=>{const v=e.target.value;setD(p=>({...p,currentWebsite:v}))}} placeholder="https://yourbusiness.com"/>
            </div>
          <div style={{borderTop:'1px solid var(--border)',paddingTop:14}}>
            <div style={{fontSize:12,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Social Media Handles</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[['instagram','Instagram','@yourbusiness'],['facebook','Facebook','facebook.com/yourbusiness'],['tiktok','TikTok','@yourbusiness'],['youtube','YouTube','youtube.com/@channel'],['google','Google Business URL','g.co/...']].map(([k,l,p])=>(
                <div key={k} style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:12,color:'var(--text-3)',width:70,flexShrink:0,fontWeight:500}}>{l}</span>
                  <input className="input" style={{fontSize:13}} value={d[k as keyof typeof d]} onChange={e=>set(k,e.target.value)} placeholder={p}/>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setStep(0)}>← Back</button>
            <button className="btn btn-primary" style={{flex:2,padding:12}} onClick={()=>setStep(2)}>Next →</button>
          </div>
        </div>
      )}

      {step===2 && (
        <div className="card" style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>About your business — what do you do, your story, what makes you special</label>
              <textarea className="input" value={d.description} onChange={e=>{const v=e.target.value;setD(p=>({...p,description:v}))}} placeholder="Tell us your story — how long you've been open, what makes you different..." rows={3}/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Staff / team members (name + role, one per line)</label>
              <textarea className="input" value={d.staffMembers} onChange={e=>{const v=e.target.value;setD(p=>({...p,staffMembers:v}))}} placeholder={"Owner Name — Role\nEmployee Name — Role"} rows={3}/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Menu items or products (name + description, one per line)</label>
              <textarea className="input" value={d.menuItems} onChange={e=>{const v=e.target.value;setD(p=>({...p,menuItems:v}))}} placeholder={"Item Name — $Price · Description\nAnother Item — $Price · Description"} rows={3}/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Services you offer (one per line)</label>
              <textarea className="input" value={d.services} onChange={e=>{const v=e.target.value;setD(p=>({...p,services:v}))}} placeholder={"Service Name — starting at $Price\nAnother Service — $Price"} rows={3}/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Customer reviews / testimonials (paste a few of your best)</label>
              <textarea className="input" value={d.testimonials} onChange={e=>{const v=e.target.value;setD(p=>({...p,testimonials:v}))}} placeholder={"'Great service!' — Customer Name\n'Highly recommend!' — Another Customer"} rows={3}/>
            </div>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setStep(1)}>← Back</button>
            <button className="btn btn-primary" style={{flex:2,padding:12}} onClick={()=>setStep(3)}>Next →</button>
          </div>
        </div>
      )}

      {step===3 && (
        <div className="card" style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Pages / sections you want on your site</label>
              <input className="input" value={d.pages} onChange={e=>{const v=e.target.value;setD(p=>({...p,pages:v}))}} placeholder="Home, About, Services, Contact"/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Your logo URL (optional — paste a direct image link)</label>
              <input className="input" value={d.logoUrl} onChange={e=>{const v=e.target.value;setD(p=>({...p,logoUrl:v}))}} placeholder="https://... or leave blank"/>
            </div>
          <div>
              <label style={{fontSize:12,color:'var(--text-3)',display:'block',marginBottom:5,fontWeight:500}}>Brand story — anything else about your business history or mission</label>
              <textarea className="input" value={d.aboutStory} onChange={e=>{const v=e.target.value;setD(p=>({...p,aboutStory:v}))}} placeholder="Share your origin story and what drives your business..." rows={3}/>
            </div>
          {researchData && (
            <div style={{background:'var(--bg-3)',borderRadius:10,padding:12}}>
              <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>Found online about your business</div>
              <p style={{fontSize:12,color:'var(--text-2)',lineHeight:1.6,margin:0}}>{researchData.slice(0,400)}{researchData.length>400?'...':''}</p>
            </div>
          )}
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setStep(2)}>← Back</button>
            <button className="btn btn-primary" style={{flex:2,padding:12,fontSize:15}} onClick={generate}>
              Generate My Website ✨
            </button>
          </div>
          <p style={{fontSize:11,color:'var(--text-3)',textAlign:'center'}}>Takes ~30 seconds · Uses your info + our online research</p>
        </div>
      )}
    </div>
  )
}

function WovoAIContent() {
  const params = useSearchParams()
  const plan = params.get('plan') || ''
  const [selectedPlan, setSelectedPlan] = useState(plan)
  const [activeTab, setActiveTab] = useState<'content'|'team'|'website'|'video'>('content')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const [clientPlan, setClientPlan] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setIsLoggedIn(true)
        const { data: client } = await supabase.from('clients').select('is_active, plan').eq('profile_id', session.user.id).single()
        if (client?.is_active) {
          setClientPlan(client.plan || '')
          // Only Wovo AI plans get access - not premium (they pay separately)
          const wovoAiPlans = ['starter', 'growth', 'pro_ai', 'website']
          setHasActiveSubscription(wovoAiPlans.includes(client.plan))
        }
      }
      setAuthChecked(true)
    })
  }, [])
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

  const STRIPE_LINKS: Record<string,string> = {
    starter: 'https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y',
    growth:  'https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z',
    pro_ai:  'https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10',
    website: 'https://pay.wovomedia.com/b/4gMcN57U7avV0vqbZ6cIE11',
  }
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const url = STRIPE_LINKS[selectedPlan]
    if (url) {
      // Add prefilled email to Stripe link if provided
      const stripeUrl = email ? `${url}?prefilled_email=${encodeURIComponent(email)}` : url
      window.location.href = stripeUrl
    }
    setLoading(false)
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
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:700,color:'var(--text)',textDecoration:'none'}}>wovo<span style={{color:'var(--accent)'}}>media</span></Link>
        <div style={{display:'flex',gap:8}}>
          {(['content','team','website','video'] as const).map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)} style={{background:activeTab===t?'var(--accent-dim)':'transparent',border:'0.5px solid',borderColor:activeTab===t?'var(--accent-border)':'transparent',color:activeTab===t?'var(--accent)':'var(--text-2)',padding:'7px 16px',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit',textTransform:'capitalize'}}>{t==='website'?'Website Builder':t==='video'?'AI Videos':t}</button>
          ))}
        </div>
        <Link href="/"><button className="btn btn-ghost btn-sm">← Home</button></Link>
      </nav>

      <div style={{maxWidth:900,margin:'0 auto',padding:'48px 32px',position:'relative',zIndex:2}}>

        {activeTab==='content' && (
          <>
            <h1 style={{fontSize:32,fontWeight:700,marginBottom:8}}>Wovo AI <span style={{color:'var(--accent)'}}>Plans</span></h1>
            <p style={{color:'var(--text-2)',marginBottom:32,fontSize:15}}>Pick a plan. Pay on Stripe. Your account is created automatically and you get instant access.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14,marginBottom:20}}>
              {[
                {name:'Starter',price:'$29/mo',desc:'AI character for yourself.',features:['Your own AI character','3 posts per week','Ready-to-copy captions','Posting tutorials'],link:'https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y'},
                {name:'Growth',price:'$49/mo',desc:'AI characters for your whole team.',features:['Characters for entire team','5 posts per week','Unlimited edits','Week description input'],link:'https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z',popular:true},
                {name:'Pro AI',price:'$79/mo',desc:'Daily posts, Stories, multiple brands.',features:['Everything in Growth','Daily posts + Stories','Multiple brand characters','Monthly strategy report'],link:'https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10'},
                {name:'Website Builder',price:'$99/mo',desc:'AI builds your full website.',features:['Full AI website generation','6 style options','Uses your real business info','Hosted & deployed'],link:'https://pay.wovomedia.com/b/4gMcN57U7avV0vqbZ6cIE11'},
              ].map(p=>(
                <div key={p.name} className={`card ${(p as any).popular?'card-accent':''}`} style={{position:'relative'}}>
                  {(p as any).popular&&<div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'var(--accent)',color:'#080808',fontSize:10,fontWeight:700,padding:'3px 12px',borderRadius:20,whiteSpace:'nowrap'}}>Most popular</div>}
                  <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,marginBottom:6}}>{p.name}</div>
                  <div style={{fontSize:26,fontWeight:800,fontFamily:'Outfit,sans-serif',color:'var(--text)',marginBottom:4}}>{p.price}</div>
                  <p style={{fontSize:13,color:'var(--text-3)',marginBottom:14}}>{p.desc}</p>
                  {p.features.map(f=><div key={f} style={{fontSize:12,color:'var(--text-2)',padding:'5px 0',borderTop:'0.5px solid var(--border)',display:'flex',gap:7}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>)}
                  <a href={p.link} target="_blank" rel="noreferrer" style={{display:'block',marginTop:16,textDecoration:'none'}}>
                    <button className={`btn ${(p as any).popular?'btn-primary':'btn-outline'}`} style={{width:'100%',padding:11,fontSize:13}}>Get {p.name} →</button>
                  </a>
                </div>
              ))}
            </div>
            <div className="card" style={{textAlign:'center',padding:'16px 20px'}}>
              <p style={{fontSize:13,color:'var(--text-2)',marginBottom:0}}>
                Already have an account? <a href="/login" style={{color:'var(--accent)',fontWeight:600}}>Log in →</a>
                &nbsp;·&nbsp; Questions? <a href="mailto:support@wovomedia.com" style={{color:'var(--accent)'}}>support@wovomedia.com</a>
              </p>
            </div>
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
          <WebsiteBuilderFull isLoggedIn={isLoggedIn} hasActiveSubscription={hasActiveSubscription && clientPlan==='website'} authChecked={authChecked}/>
        )}
      {activeTab==='video' && (
        <>
          <h1 style={{fontSize:30,fontWeight:700,marginBottom:8}}>AI <span style={{color:'var(--accent)'}}>Video Generator</span></h1>
          <p style={{color:'var(--text-2)',marginBottom:32,fontSize:15}}>Generate short AI avatar videos for social media.</p>
          {!authChecked ? (
            <div style={{textAlign:'center',padding:48}}><div className='spinner' style={{margin:'0 auto'}}/></div>
          ) : !isLoggedIn || !['growth','pro_ai','website'].includes(clientPlan) ? (
            <div className="card card-accent" style={{textAlign:'center',padding:'48px 32px',maxWidth:500}}>
              <div style={{fontSize:40,marginBottom:14}}>🔒</div>
              <h3 style={{fontSize:20,fontWeight:700,marginBottom:10}}>Active subscription required</h3>
              <p style={{color:'var(--text-2)',marginBottom:24,lineHeight:1.65}}>AI Video Generation is available on Growth ($49/mo) and above. Subscribe to unlock.</p>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <a href="https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z" target="_blank" rel="noreferrer"><button className="btn btn-primary">Get Growth — $49/mo</button></a>
                <a href="https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10" target="_blank" rel="noreferrer"><button className="btn btn-outline">Get Pro — $79/mo</button></a>
              </div>
            </div>
          ) : (
            <VideoGenerator/>
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
