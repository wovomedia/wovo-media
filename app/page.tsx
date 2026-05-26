'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

// ─── BOOKING FLOW ────────────────────────────────────────────────────────────
function BookingFlow({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState({ name:'', business:'', email:'', phone:'', type:'Restaurant / Food & Drink', budget:'$300 – $600', notes:'' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/book', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) })
    setDone(true)
    setSubmitting(false)
  }

  if (done) return (
    <div style={{textAlign:'center',padding:'20px 0'}}>
      <div style={{fontSize:52,marginBottom:18}}>✅</div>
      <h3 style={{fontSize:22,fontWeight:700,marginBottom:12}}>Request received!</h3>
      <p style={{color:'var(--text-2)',fontSize:15,lineHeight:1.7,marginBottom:8}}>
        A member of our team will reach out to <strong style={{color:'var(--text)'}}>{data.email}</strong> within 24 hours to confirm your strategy call and send a Google Meet link.
      </p>
      <p style={{color:'var(--text-3)',fontSize:13,marginBottom:28}}>Mon–Fri · 9am–5pm CT · Or pick a time right now 👇</p>
      <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer">
        <button className="btn btn-primary" style={{width:'100%',marginBottom:10,padding:14,fontSize:15}}>Pick a time on Calendly →</button>
      </a>
      <button className="btn btn-ghost" style={{width:'100%'}} onClick={onClose}>Done for now</button>
    </div>
  )

  return (
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:16}}>
      <h3 style={{fontSize:20,fontWeight:700,marginBottom:2}}>Book a Free Strategy Call</h3>
      <p style={{fontSize:14,color:'var(--text-2)',marginBottom:4,lineHeight:1.6}}>Tell us about your business and a team member will reach out within 24 hours with a Google Meet link.</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div>
          <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:500}}>Your name *</label>
          <input className="input" value={data.name} onChange={e=>setData(d=>({...d,name:e.target.value}))} placeholder="Your full name" required/>
        </div>
        <div>
          <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:500}}>Business name *</label>
          <input className="input" value={data.business} onChange={e=>setData(d=>({...d,business:e.target.value}))} placeholder="Your business name" required/>
        </div>
        <div>
          <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:500}}>Email address *</label>
          <input className="input" type="email" value={data.email} onChange={e=>setData(d=>({...d,email:e.target.value}))} placeholder="Your email address" required/>
        </div>
        <div>
          <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:500}}>Phone number *</label>
          <input className="input" value={data.phone} onChange={e=>setData(d=>({...d,phone:e.target.value}))} placeholder="(000) 000-0000 (optional)"/>
        </div>
      </div>
      <div>
        <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:500}}>Business type</label>
        <select className="input" value={data.type} onChange={e=>setData(d=>({...d,type:e.target.value}))}>
          {['Restaurant / Food & Drink','Retail / Boutique','Service Business','Healthcare / Wellness','Bar / Nightlife','Other'].map(o=><option key={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:500}}>Monthly marketing budget</label>
        <select className="input" value={data.budget} onChange={e=>setData(d=>({...d,budget:e.target.value}))}>
          {['Under $300','$300 – $600','$600 – $1,000','$1,000 – $1,500','$1,500+'].map(o=><option key={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <label style={{fontSize:13,color:'var(--text-2)',display:'block',marginBottom:6,fontWeight:500}}>Anything to cover? <span style={{color:'var(--text-3)',fontWeight:400}}>(optional)</span></label>
        <textarea className="input" value={data.notes} onChange={e=>setData(d=>({...d,notes:e.target.value}))} rows={2} placeholder="Goals, current challenges, questions..."/>
      </div>
      <div style={{background:'var(--bg-3)',borderRadius:9,padding:'12px 16px',fontSize:13,color:'var(--text-3)'}}>
        📅 Mon–Fri · 9am–5pm CT · Google Meet link sent after confirmation
      </div>
      <button className="btn btn-primary" type="submit" style={{padding:14,fontSize:16,width:'100%'}} disabled={submitting||!data.name||!data.business||!data.email}>
        {submitting?'Submitting...':'Request Strategy Call →'}
      </button>
    </form>
  )
}

// ─── NOVA CHAT ───────────────────────────────────────────────────────────────
const QUICK = ['Restaurant 🍽️','Retail / Boutique','Team characters?','How much does it cost?']

const novaReply = (msg: string) => {
  const l = msg.toLowerCase()
  if (l.includes('restaurant')||l.includes('food')||l.includes('taco')||l.includes('bar')||l.includes('drink')) return "Restaurants are our best fit — daily specials, behind-the-scenes, promos. Your AI character posts for you every day. Want to book a free strategy call?"
  if (l.includes('retail')||l.includes('boutique')||l.includes('shop')) return "Boutiques crush it with consistent AI content. We can build characters for you and your whole team. What does your team look like?"
  if (l.includes('team')||l.includes('employee')||l.includes('staff')) return "Yes — Wovo AI Growth and above lets you create AI characters for your entire team. Every employee gets their own character. It's $49/mo."
  if (l.includes('website')) return "Two options: our Website Builder plan ($99/mo) where Wovo AI generates your full site, or Premium where we build it custom. Which fits better?"
  if (l.includes('premium')||l.includes('filming')||l.includes('drone')) return "Wovo Media Premium is fully custom — on-site filming, drone, photography, full account management, website builds. Our team manages every account personally. Want to book a free strategy call?"
  if (l.includes('price')||l.includes('cost')||l.includes('how much')||l.includes('$')) return "Wovo AI starts at $29/mo. Team characters at $49. Website Builder at $99. Full-service Premium is custom — usually $350–$2,000/mo depending on scope. What's your situation?"
  if (l.includes('book')||l.includes('call')||l.includes('yes')||l.includes('interested')) return "Let's do it! Click 'Book a strategy call' anywhere on this page and pick a time that works. Our team will reach out — no pressure, just a real conversation."
  return "Good question! What kind of business do you run? That'll help me point you to the right plan."
}

// ─── QUIZ ────────────────────────────────────────────────────────────────────
const QUIZ = [
  {q:"What kind of business do you run?",opts:["Restaurant / Food & Drink","Retail / Boutique","Service Business","Healthcare / Wellness","Other"]},
  {q:"How often are you posting on social right now?",opts:["Rarely or never","1–2x a week","Almost daily","I don't manage it"]},
  {q:"What's your biggest challenge?",opts:["No time to post","Don't know what to post","Posts aren't getting engagement","Can't afford a full team"]},
  {q:"Do you have team members who should also post?",opts:["Yes, I have a team","No, just me","Maybe in the future"]},
  {q:"Monthly marketing budget?",opts:["Under $50","$50–$150","$150–$500","$500+"]},
]

export default function Home() {
  const [modal, setModal] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [msgs, setMsgs] = useState([{r:'nova',t:"Hey! 👋 I'm Nova, part of the Wovo team. What kind of business do you run?"}])
  const [input, setInput] = useState('')
  const [quicks, setQuicks] = useState(true)
  const [qStep, setQStep] = useState(0)
  const [qAnswers, setQAnswers] = useState<string[]>([])
  const [qDone, setQDone] = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{setTimeout(()=>setModal(true),1800)},[])
  useEffect(()=>{if(msgsRef.current)msgsRef.current.scrollTop=msgsRef.current.scrollHeight},[msgs])

  const sendMsg = (t?: string) => {
    const msg = t||input.trim(); if(!msg) return
    setInput(''); setQuicks(false)
    setMsgs(m=>[...m,{r:'user',t:msg}])
    setTimeout(()=>setMsgs(m=>[...m,{r:'nova',t:novaReply(msg)}]),700)
  }

  const qPick = (opt: string) => {
    const next=[...qAnswers,opt]; setQAnswers(next)
    if(qStep+1>=QUIZ.length) setQDone(true); else setQStep(s=>s+1)
  }

  const getResult = () => {
    const budget=qAnswers[4]||''; const hasTeam=qAnswers[3]?.includes('team')
    if(budget==='$500+') return {plan:'Wovo Media Premium',price:'Custom',desc:'Your business is ready for the full package — filming, drone, website build, and full account management.',cta:'Book a strategy call',action:'book'}
    if(hasTeam||budget==='$150–$500') return {plan:'Wovo AI Growth',price:'$49/mo',desc:'5 posts a week, unlimited edits, and AI characters for your entire team.',cta:'Get Growth Plan',action:"https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z"}
    return {plan:'Wovo AI Starter',price:'$29/mo',desc:'AI character, 3 posts/week, ready-to-copy captions. Less than a tank of gas.',cta:'Get Starter Plan',action:"https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y"}
  }

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>

      {/* WELCOME MODAL — Nova AI Onboarding */}
      {modal&&(
        <div onClick={()=>setModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} className="slide-up" style={{background:'#111',border:'1px solid rgba(255,255,255,0.1)',borderRadius:22,padding:32,width:420,maxWidth:'94vw',position:'relative',boxShadow:'0 32px 80px rgba(0,0,0,0.6)'}}>
            <button onClick={()=>setModal(false)} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,0.07)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'rgba(255,255,255,0.5)',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            
            {/* Nova avatar */}
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
              <div style={{width:52,height:52,borderRadius:'50%',border:'2px solid rgba(0,229,200,0.4)',flexShrink:0,boxShadow:'0 0 20px rgba(0,229,200,0.15)',overflow:'hidden',background:'#111'}}>
              <img src="https://files2.heygen.ai/avatar/v3/79b245561ad448e796b7e77cd2773d0b_14263/preview_talk_11.webp" alt="Nova" style={{width:'100%',height:'140%',objectFit:'cover',objectPosition:'top center',marginTop:'-10%'}} onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
            </div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>Meet Nova</div>
                <div style={{fontSize:12,color:'rgba(0,229,200,0.8)',display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'#00E5C8',boxShadow:'0 0 6px #00E5C8'}}/>
                  Wovo Media AI Guide
                </div>
              </div>
            </div>

            <h3 style={{fontSize:20,fontWeight:700,color:'#fff',marginBottom:10,letterSpacing:'-0.02em'}}>Not sure which plan is right for you?</h3>
            <p style={{fontSize:14,color:'rgba(255,255,255,0.55)',lineHeight:1.65,marginBottom:24}}>Nova is our AI guide. He'll ask you a few quick questions about your business and recommend the exact plan that fits — then walk you through it with a personalized video.</p>
            
            {/* Stats */}
            <div style={{display:'flex',gap:16,marginBottom:22,padding:'12px 16px',background:'rgba(255,255,255,0.03)',borderRadius:10,border:'1px solid rgba(255,255,255,0.06)'}}>
              {[['🎬','AI video'],['💬','You pick'],['🎯','Gets personalized']].map(([icon,label])=>(
                <div key={label} style={{flex:1,textAlign:'center'}}>
                  <div style={{fontSize:18,marginBottom:3}}>{icon}</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:500}}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:9}}>
              <Link href="/meet-nova" style={{textDecoration:'none'}}>
                <button className="btn btn-primary" style={{width:'100%',padding:13,fontSize:15,borderRadius:12}}>
                  Talk to Nova →
                </button>
              </Link>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-ghost" style={{flex:1,padding:'10px 0',fontSize:13}} onClick={()=>{setModal(false);document.getElementById('plans')?.scrollIntoView({behavior:'smooth'})}}>See plans</button>
                <button className="btn btn-ghost" style={{flex:1,padding:'10px 0',fontSize:13}} onClick={()=>{setModal(false);setBookOpen(true)}}>Book a call</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING MODAL */}
      {bookOpen&&(
        <div onClick={()=>setBookOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} className="slide-up" style={{background:'var(--bg-2)',border:'0.5px solid var(--border-2)',borderRadius:20,padding:28,width:520,maxWidth:'96vw',maxHeight:'92vh',overflowY:'auto',position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontFamily:'Outfit,sans-serif',fontSize:17,fontWeight:700}}>wovo<span style={{color:'var(--accent)'}}>media</span><span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:6}}>Strategy Call</span></div>
              <button onClick={()=>setBookOpen(false)} style={{background:'var(--bg-3)',border:'0.5px solid var(--border-2)',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'var(--text-2)',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <BookingFlow onClose={()=>setBookOpen(false)}/>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 40px',borderBottom:'0.5px solid var(--border)',position:'sticky',top:0,background:'rgba(8,8,8,0.94)',backdropFilter:'blur(14px)',zIndex:100}}>
        <div style={{fontFamily:'Outfit,sans-serif',fontSize:19,fontWeight:700}}>wovo<span style={{color:'var(--accent)'}}>media</span></div>
        <div className="desktop-nav" style={{display:'flex',gap:24,alignItems:'center'}}>
          {[['Wovo AI','#plans'],['Premium','#premium'],['Pricing','#pricing'],['Results','#results']].map(([l,h])=>(
            <a key={l} href={h} style={{color:'var(--text-2)',fontSize:13,textDecoration:'none',fontWeight:500}}>{l}</a>
          ))}
          <Link href="/login" style={{color:'var(--text-2)',fontSize:13,textDecoration:'none',fontWeight:600}}>Login</Link>
          <ThemeToggle/>
          <button className="btn btn-primary btn-sm" onClick={()=>setBookOpen(true)}>Book a call</button>
        </div>
        {/* Mobile nav */}
        <div style={{display:'flex',gap:8,alignItems:'center'}} className="mobile-nav-buttons">
          <ThemeToggle/>
          <button className="btn btn-primary btn-sm" onClick={()=>setBookOpen(true)} style={{fontSize:12,padding:'7px 12px'}}>Book a call</button>
          <Link href="/login"><button className="btn btn-ghost btn-sm" style={{fontSize:12,padding:'7px 12px'}}>Login</button></Link>
        </div>
      </nav>

      <div style={{position:'relative',zIndex:2}}>

        {/* HERO */}
        <div style={{maxWidth:860,margin:'0 auto',padding:'90px 40px 70px'}}>
          <div className="fade-up proof-bar" style={{display:'inline-flex',alignItems:'center',gap:16,background:'var(--bg-2)',border:'1px solid var(--accent-border)',borderRadius:40,padding:'7px 18px',marginBottom:24,boxShadow:'var(--shadow)'}}>
            {[['11+','Clients'],['100M+','Views & Engagements'],['24hr','Response']].map(([n,l])=>(
              <div key={n} style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontFamily:'Outfit,sans-serif',fontWeight:700,color:'var(--accent)',fontSize:13}}>{n}</span>
                <span style={{fontSize:11,color:'var(--text-3)'}}>{l}</span>
              </div>
            ))}
          </div>
          <h1 className="fade-up d1" style={{fontSize:58,fontWeight:800,lineHeight:1.05,marginBottom:20,color:'var(--text)'}}>
            Your business,<br/><span style={{color:'var(--accent)'}}>seen everywhere.</span>
          </h1>
          <p className="fade-up d2" style={{fontSize:17,color:'var(--text-2)',maxWidth:500,lineHeight:1.65,marginBottom:32}}>
            AI-powered content from $29/mo, or full-service production with a real team. Middle Tennessee & beyond.
          </p>
          <div className="fade-up d3" style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:72}}>
            <button className="btn btn-primary" style={{fontSize:14,padding:'12px 26px'}} onClick={()=>document.getElementById('quiz-section')?.scrollIntoView({behavior:'smooth'})}>Find my plan — 60 sec ↗</button>
            <button className="btn btn-outline" style={{fontSize:14,padding:'11px 24px'}} onClick={()=>setBookOpen(true)}>Book a free strategy call</button>
          </div>
          <div className="glow-line fade-up d4" style={{marginBottom:44}}/>

          {/* TWO LANE */}
          <div id="plans" className="fade-up d5 grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[
              {tag:'Wovo AI',title:'AI-powered content',price:'$29',sub:'/mo',desc:'Ready-to-post content, AI characters for you & your whole team.',features:['AI character — you (Starter) or your whole team (Growth+)','3–5 posts per week, ready-to-copy captions','Edit or swap any post mid-week','Website Builder plan available ($99/mo)'],cta:'Start Wovo AI',link:'/wovo-ai',accent:true},
              {tag:'Wovo Media Premium',title:'Full-service',price:'Custom',sub:'',desc:'Real filming, drone, websites built — fully managed by our team.',features:['On-site filming, drone & photography','Website design & development','We post for you — full admin access','Google Business Profile management','Wovo AI included at a discount'],cta:'Book a call',link:'#',accent:false,book:true},
            ].map(p=>(
              <div key={p.tag} className={`card${p.accent?' card-accent':''}`}>
                <span className="tag" style={!p.accent?{background:'rgba(255,255,255,0.04)',color:'var(--text-3)',borderColor:'var(--border-2)'}:{}}>{p.tag}</span>
                <h3 style={{fontSize:17,fontWeight:600,color:'var(--text)',marginTop:12,marginBottom:4}}>{p.title}</h3>
                <div style={{fontSize:32,fontWeight:700,fontFamily:'Outfit,sans-serif',color:p.accent?'var(--text)':'var(--text-2)',margin:'10px 0 6px',letterSpacing:'-0.02em'}}>{p.price}<span style={{fontSize:14,color:'var(--text-3)',fontWeight:400}}>{p.sub}</span></div>
                <p style={{fontSize:12,color:'var(--text-3)',marginBottom:16}}>{p.desc}</p>
                {p.features.map(f=><div key={f} style={{display:'flex',gap:8,marginTop:8,fontSize:12.5,color:'var(--text-2)'}}><span style={{color:p.accent?'var(--accent)':'var(--text-3)',flexShrink:0}}>✓</span>{f}</div>)}
                {p.book
                  ?<button className="btn btn-outline" style={{width:'100%',marginTop:20,padding:12}} onClick={()=>setBookOpen(true)}>{p.cta}</button>
                  :<Link href={p.link}><button className="btn btn-primary" style={{width:'100%',marginTop:20,padding:12}}>{p.cta}</button></Link>
                }
              </div>
            ))}
          </div>
        </div>

        {/* RESULTS */}
        <div id="results" style={{borderTop:'0.5px solid var(--border)'}}>
          <div style={{maxWidth:860,margin:'0 auto',padding:'60px 40px',textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Proven results</div>
            <h2 style={{fontSize:30,fontWeight:700,marginBottom:36}}>Real businesses. Real numbers.</h2>
            <div className="grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              {[['11+','Active clients'],['100M+','Combined views & engagements'],['4M+','Monthly views, one client'],['24hr','Response time']].map(([n,l])=>(
                <div key={n} className="stat-card" style={{textAlign:'center'}}>
                  <div className="stat-num">{n}</div>
                  <div className="stat-label" style={{marginTop:6}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PRICING */}
        <div id="pricing" style={{borderTop:'0.5px solid var(--border)'}}>
          <div style={{maxWidth:860,margin:'0 auto',padding:'70px 40px'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Pricing</div>
            <h2 style={{fontSize:30,fontWeight:700,marginBottom:6}}>Wovo AI plans.</h2>
            <p style={{color:'var(--text-2)',marginBottom:36,fontSize:14}}>Start free from $29/mo. Cancel anytime. Premium clients get Wovo AI at a discount.</p>
            <div className="grid-2" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:12}}>
              {[
                {name:'Starter',price:'$29',popular:false,features:['AI character — you','3 posts per week','Captions & editing','Posting tutorials']},
                {name:'Growth',price:'$49',popular:true,features:['AI characters — entire team','5 posts per week','Unlimited edits','Week description input']},
              ].map(p=>(
                <div key={p.name} className={`card${p.popular?' card-accent':''}`} style={{position:'relative'}}>
                  {p.popular&&<div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'var(--accent)',color:'#080808',fontSize:10,fontWeight:600,padding:'3px 12px',borderRadius:20,whiteSpace:'nowrap'}}>Most popular</div>}
                  <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:500,marginBottom:8}}>{p.name}</div>
                  <div style={{fontSize:30,fontWeight:700,fontFamily:'Outfit,sans-serif',color:'var(--text)'}}>{p.price}<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
                  <div style={{marginTop:14}}>
                    {p.features.map(f=><div key={f} style={{fontSize:13,color:'var(--text-2)',padding:'6px 0',borderTop:'0.5px solid var(--border)',display:'flex',gap:7}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>)}
                  </div>
                  <a href={p.name.toLowerCase()==="starter"?"https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y":p.name.toLowerCase()==="growth"?"https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z":"https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10"} target="_blank" rel="noreferrer"><button className={`btn ${p.popular?"btn-primary":"btn-outline"}`} style={{width:"100%",marginTop:16,padding:11}}>Get {p.name}</button></a>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
              {[
                {name:'Pro AI',price:'$79',features:['Everything in Growth','Daily posts + Stories','Multiple brand characters','Monthly strategy report']},
                {name:'Website Builder',price:'$99',new:true,features:['Wovo AI generates full website','Pick your style','Business info → live site','Hosted & deployed']},
              ].map(p=>(
                <div key={p.name} className={`card${(p as any).new?' card-accent':''}`}>
                  {(p as any).new&&<div style={{fontSize:11,color:'var(--accent)',fontWeight:500,marginBottom:4}}>🌐 NEW</div>}
                  <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:500,marginBottom:8}}>{p.name}</div>
                  <div style={{fontSize:30,fontWeight:700,fontFamily:'Outfit,sans-serif',color:'var(--text)'}}>{p.price}<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
                  <div style={{marginTop:14}}>
                    {p.features.map(f=><div key={f} style={{fontSize:13,color:'var(--text-2)',padding:'6px 0',borderTop:'0.5px solid var(--border)',display:'flex',gap:7}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>)}
                  </div>
                  <a href={p.name.toLowerCase().includes("website")?"https://pay.wovomedia.com/b/4gMcN57U7avV0vqbZ6cIE11":"https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10"} target="_blank" rel="noreferrer"><button className="btn btn-outline" style={{width:"100%",marginTop:16,padding:11}}>Get {p.name}</button></a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QUIZ */}
        <div style={{borderTop:'0.5px solid var(--border)'}}>
          <div id="quiz-section" style={{maxWidth:860,margin:'0 auto',padding:'70px 40px'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>60-second quiz</div>
            <h2 style={{fontSize:30,fontWeight:700,marginBottom:8}}>Not sure which plan fits? <span style={{color:'var(--accent)'}}>We'll tell you.</span></h2>
            <p style={{color:'var(--text-2)',marginBottom:36,fontSize:14}}>Answer 5 questions and get a personalized recommendation.</p>
            <div className="card" style={{maxWidth:540,margin:'0 auto'}}>
              <div style={{display:'flex',gap:4,marginBottom:24}}>
                {QUIZ.map((_,i)=><div key={i} style={{flex:1,height:2,borderRadius:2,background:i<qStep||(qDone&&i<QUIZ.length)?'var(--accent)':'var(--bg-4)',transition:'background 0.3s'}}/>)}
              </div>
              {!qDone ? (
                <>
                  <div style={{fontSize:17,fontWeight:600,color:'var(--text)',marginBottom:18,fontFamily:'Outfit,sans-serif'}}>{QUIZ[qStep].q}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {QUIZ[qStep].opts.map(opt=>(
                      <button key={opt} onClick={()=>qPick(opt)} className="btn btn-ghost" style={{justifyContent:'flex-start',padding:'11px 14px',fontSize:13,textAlign:'left'}}>{opt}</button>
                    ))}
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:18,alignItems:'center'}}>
                    <span style={{fontSize:12,color:'var(--text-3)'}}>Question {qStep+1} of {QUIZ.length}</span>
                    {qStep>0&&<button className="btn btn-ghost btn-sm" onClick={()=>{setQStep(s=>s-1);setQAnswers(a=>a.slice(0,-1))}}>← Back</button>}
                  </div>
                </>
              ) : (()=>{
                const r=getResult()
                return (
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:11,color:'var(--accent)',fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Your plan</div>
                    <h3 style={{fontSize:20,fontWeight:700,color:'var(--text)',marginBottom:6}}>{r.plan}</h3>
                    <div style={{fontSize:44,fontWeight:800,fontFamily:'Outfit,sans-serif',color:'var(--text)',letterSpacing:'-0.03em',margin:'8px 0 12px'}}>{r.price}</div>
                    <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,marginBottom:22}}>{r.desc}</p>
                    {r.action==='book'
                      ?<button className="btn btn-primary" style={{width:'100%',padding:12}} onClick={()=>setBookOpen(true)}>{r.cta}</button>
                      :<Link href={r.action}><button className="btn btn-primary" style={{width:'100%',padding:12}}>{r.cta}</button></Link>
                    }
                    <button className="btn btn-ghost" style={{width:'100%',marginTop:8,fontSize:12}} onClick={()=>{setQStep(0);setQAnswers([]);setQDone(false)}}>Retake quiz</button>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {/* NOVA INLINE SECTION */}
        <div style={{borderTop:'1px solid var(--border)',background:'var(--bg-2)'}}>
          <div style={{maxWidth:860,margin:'0 auto',padding:'70px 40px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'center'}} className="grid-2">
              
              {/* LEFT — copy */}
              <div>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
                  <div style={{width:44,height:44,borderRadius:'50%',overflow:'hidden',border:'2px solid var(--accent-border)',flexShrink:0}}>
                    <img src="https://files2.heygen.ai/avatar/v3/79b245561ad448e796b7e77cd2773d0b_14263/preview_talk_11.webp" alt="Nova" style={{width:'100%',height:'140%',objectFit:'cover',objectPosition:'top center',marginTop:'-10%'}}/>
                  </div>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>Meet Nova</div>
                    <div style={{fontSize:12,color:'var(--accent)',display:'flex',alignItems:'center',gap:5}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:'var(--accent)',boxShadow:'0 0 6px var(--accent)'}}/>
                      Wovo Media AI Guide
                    </div>
                  </div>
                </div>
                <h2 style={{fontSize:28,fontWeight:800,marginBottom:12,letterSpacing:'-0.03em',lineHeight:1.15}}>
                  Not sure where<br/>to start?<br/><span style={{color:'var(--accent)'}}>Ask Nova.</span>
                </h2>
                <p style={{fontSize:15,color:'var(--text-2)',lineHeight:1.7,marginBottom:24}}>
                  Nova is our AI guide. Answer a few quick questions and he'll recommend the exact plan for your business — with a personalized video response for each answer you pick.
                </p>
                <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:28}}>
                  {[['🎬','AI video — Nova actually speaks to you'],['💬','You pick answers, Nova responds personally'],['🎯','Ends with a specific plan recommendation']].map(([icon,text])=>(
                    <div key={text} style={{display:'flex',alignItems:'center',gap:10,fontSize:14,color:'var(--text-2)'}}>
                      <span style={{fontSize:18}}>{icon}</span>{text}
                    </div>
                  ))}
                </div>
                <Link href="/meet-nova">
                  <button className="btn btn-primary" style={{padding:'13px 28px',fontSize:15}}>
                    Talk to Nova →
                  </button>
                </Link>
              </div>

              {/* RIGHT — video preview */}
              <div style={{position:'relative'}}>
                <div style={{borderRadius:16,overflow:'hidden',background:'#0a0a0a',border:'1px solid rgba(0,229,200,0.15)',boxShadow:'0 24px 60px rgba(0,0,0,0.2)',aspectRatio:'16/9',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                  {/* Office background hint */}
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,#0d1a18 0%,#0a1412 100%)',opacity:0.95}}/>
                  <div style={{position:'relative',zIndex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
                    <div style={{width:64,height:64,borderRadius:'50%',overflow:'hidden',border:'3px solid rgba(0,229,200,0.4)',boxShadow:'0 0 30px rgba(0,229,200,0.2)'}}>
                      <img src="https://files2.heygen.ai/avatar/v3/79b245561ad448e796b7e77cd2773d0b_14263/preview_talk_11.webp" alt="Nova" style={{width:'100%',height:'140%',objectFit:'cover',objectPosition:'top center',marginTop:'-10%'}}/>
                    </div>
                    <Link href="/meet-nova">
                      <div style={{width:48,height:48,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 0 30px rgba(0,229,200,0.4)',transition:'transform 0.2s'}}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='scale(1.1)'}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='scale(1)'}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#0a0a0a"><polygon points="5,3 19,12 5,21"/></svg>
                      </div>
                    </Link>
                    <p style={{fontSize:12,color:'rgba(255,255,255,0.4)',margin:0}}>Click to start your conversation</p>
                  </div>
                </div>
                {/* Sample option pills */}
                <div style={{marginTop:14,display:'flex',flexWrap:'wrap',gap:8}}>
                  {['🍽️ Restaurant','🛍️ Retail','💼 Service','🏥 Healthcare'].map(opt=>(
                    <Link key={opt} href="/meet-nova">
                      <div style={{padding:'8px 14px',borderRadius:20,background:'var(--bg-3)',border:'1px solid var(--border-2)',fontSize:13,color:'var(--text-2)',cursor:'pointer',transition:'all 0.15s',fontWeight:500}}
                        onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor='var(--accent)';el.style.color='var(--accent)';el.style.background='var(--accent-dim)'}}
                        onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor='var(--border-2)';el.style.color='var(--text-2)';el.style.background='var(--bg-3)'}}>
                        {opt}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PREMIUM CTA */}
        <div id="premium" style={{borderTop:'0.5px solid var(--border)'}}>
          <div style={{maxWidth:860,margin:'0 auto',padding:'70px 40px',textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Wovo Media Premium</div>
            <h2 style={{fontSize:30,fontWeight:700,marginBottom:10}}>Ready for the full package?</h2>
            <p style={{color:'var(--text-2)',maxWidth:480,margin:'0 auto 36px',lineHeight:1.7,fontSize:14}}>On-site filming, drone, website builds, and full account management by our team. Wovo AI included at a discount.</p>
            <button className="btn btn-primary" style={{fontSize:15,padding:'14px 32px'}} onClick={()=>setBookOpen(true)}>Book a free strategy call →</button>
            <p style={{fontSize:12,color:'var(--text-3)',marginTop:12}}>No commitment. Mon–Fri, 9am–5pm CT.</p>
          </div>
        </div>

        {/* FOOTER */}
        <footer style={{borderTop:'1px solid var(--border)',padding:'32px 40px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14}}>
          <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:16,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>wovo<span style={{color:'var(--accent)'}}>media</span></Link>
          <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
            {[['About','/about'],['Privacy','/privacy'],['Terms','/terms'],['Contact','mailto:support@wovomedia.com']].map(([l,h])=>(
              <a key={l} href={h} style={{fontSize:13,color:'var(--text-3)',textDecoration:'none',fontWeight:500,transition:'color 0.15s'}}
                onMouseEnter={e=>(e.currentTarget as HTMLAnchorElement).style.color='var(--text)'}
                onMouseLeave={e=>(e.currentTarget as HTMLAnchorElement).style.color='var(--text-3)'}>{l}</a>
            ))}
          </div>
          <div style={{fontSize:12,color:'var(--text-3)'}}>© 2025 Wovo Media · Middle Tennessee</div>
        </footer>
      </div>

      {/* NOVA CHAT */}
      <div style={{position:'fixed',bottom:22,right:22,zIndex:500,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:10}}>
        {chatOpen&&(
          <div className="slide-up" style={{width:300,background:'var(--bg-2)',border:'0.5px solid var(--border-2)',borderRadius:16,overflow:'hidden'}}>
            <div style={{background:'var(--bg-3)',padding:'12px 14px',display:'flex',alignItems:'center',gap:9,borderBottom:'0.5px solid var(--border)'}}>
              <div style={{width:32,height:32,borderRadius:'50%',overflow:'hidden',border:'1.5px solid var(--accent-border)',flexShrink:0}}>
                <img src="https://files2.heygen.ai/avatar/v3/79b245561ad448e796b7e77cd2773d0b_14263/preview_talk_11.webp" alt="Nova" style={{width:'100%',height:'140%',objectFit:'cover',objectPosition:'top center',marginTop:'-10%'}} onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>Nova</div>
                <div style={{fontSize:11,color:'var(--accent)',display:'flex',alignItems:'center',gap:4}}><div style={{width:5,height:5,borderRadius:'50%',background:'var(--accent)'}}/>Online</div>
              </div>
              <button onClick={()=>setChatOpen(false)} style={{marginLeft:'auto',background:'none',border:'none',color:'var(--text-3)',cursor:'pointer',fontSize:18}}>×</button>
            </div>
            <div ref={msgsRef} style={{padding:12,display:'flex',flexDirection:'column',gap:8,maxHeight:220,overflowY:'auto'}}>
              {msgs.map((m,i)=>(
                <div key={i} style={{maxWidth:'85%',fontSize:13,lineHeight:1.5,padding:'8px 12px',borderRadius:m.r==='nova'?'10px 10px 10px 2px':'10px 10px 2px 10px',background:m.r==='nova'?'var(--bg-3)':'var(--accent-dim)',border:m.r==='user'?'0.5px solid var(--accent-border)':'none',color:'var(--text-2)',alignSelf:m.r==='user'?'flex-end':'flex-start'}}>{m.t}</div>
              ))}
            </div>
            {quicks&&(
              <div style={{display:'flex',flexWrap:'wrap',gap:5,padding:'0 12px 8px'}}>
                {QUICK.map(q=>(
                  <button key={q} onClick={()=>sendMsg(q)} style={{background:'var(--bg-3)',border:'0.5px solid var(--border-2)',borderRadius:16,padding:'4px 10px',fontSize:11,color:'var(--text-2)',cursor:'pointer'}}>{q}</button>
                ))}
              </div>
            )}
            <div style={{display:'flex',gap:7,padding:'8px 12px',borderTop:'0.5px solid var(--border)'}}>
              <input className="input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} placeholder="Ask anything..." style={{fontSize:12,padding:'7px 10px'}}/>
              <button onClick={()=>sendMsg()} style={{background:'var(--accent)',border:'none',borderRadius:7,width:30,height:30,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
            <div style={{fontSize:10,color:'var(--text-3)',textAlign:'center',paddingBottom:8}}>Powered by Wovo AI</div>
          </div>
        )}
        <button onClick={()=>setChatOpen(o=>!o)} className="pulse-ring" style={{width:50,height:50,borderRadius:'50%',background:'var(--accent)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
          {chatOpen
            ?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            :<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <div style={{position:'absolute',top:-2,right:-2,width:13,height:13,borderRadius:'50%',background:'#ff4444',border:'2px solid var(--bg)',fontSize:8,color:'#fff',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>1</div></>
          }
        </button>
      </div>
    </div>
  )
}
