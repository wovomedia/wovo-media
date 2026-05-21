'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ─── BOOKING FLOW ────────────────────────────────────────────────────────────
const HOURS = ['9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM']

function getWeekdays(count = 14) {
  const days: string[] = []
  const d = new Date()
  d.setDate(d.getDate() + 1)
  while (days.length < count) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) {
      days.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
    }
    d.setDate(d.getDate() + 1)
  }
  return days
}

function BookingFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({ name:'', business:'', email:'', phone:'', type:'Restaurant / Food & Drink', budget:'$300 – $600', notes:'' })
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const days = getWeekdays()

  const submit = async () => {
    setSubmitting(true)
    await fetch('/api/book', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...data, date, time }) })
    setDone(true)
    setSubmitting(false)
  }

  if (done) return (
    <div style={{textAlign:'center',padding:'20px 0'}}>
      <div style={{fontSize:48,marginBottom:16}}>🎉</div>
      <h3 style={{fontSize:20,fontWeight:700,marginBottom:8}}>You're booked!</h3>
      <p style={{color:'var(--text-2)',fontSize:14,marginBottom:8}}>
        <strong style={{color:'var(--text)'}}>{date} at {time} CT</strong>
      </p>
      <p style={{color:'var(--text-3)',fontSize:13,marginBottom:24}}>Check your email for confirmation. Payton will call you at {data.phone}.</p>
      <button className="btn btn-primary" style={{width:'100%'}} onClick={onClose}>Done</button>
    </div>
  )

  return (
    <div>
      {/* Progress */}
      <div style={{display:'flex',gap:4,marginBottom:24}}>
        {[0,1,2,3].map(i=><div key={i} style={{flex:1,height:2,borderRadius:2,background:i<=step?'var(--accent)':'var(--bg-4)',transition:'background 0.3s'}}/>)}
      </div>

      {step===0 && (
        <div>
          <h3 style={{fontSize:18,fontWeight:600,marginBottom:4}}>Tell us about your business</h3>
          <p style={{fontSize:13,color:'var(--text-3)',marginBottom:20}}>So Payton can come prepared with ideas for you.</p>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={{fontSize:11,color:'var(--text-3)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>Your name *</label><input className="input" value={data.name} onChange={e=>setData(d=>({...d,name:e.target.value}))} placeholder="Payton Cody"/></div>
              <div><label style={{fontSize:11,color:'var(--text-3)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>Business name *</label><input className="input" value={data.business} onChange={e=>setData(d=>({...d,business:e.target.value}))} placeholder="Mojo Tacos"/></div>
              <div><label style={{fontSize:11,color:'var(--text-3)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>Email *</label><input className="input" type="email" value={data.email} onChange={e=>setData(d=>({...d,email:e.target.value}))} placeholder="you@business.com"/></div>
              <div><label style={{fontSize:11,color:'var(--text-3)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>Phone *</label><input className="input" value={data.phone} onChange={e=>setData(d=>({...d,phone:e.target.value}))} placeholder="(931) 000-0000"/></div>
            </div>
            <div><label style={{fontSize:11,color:'var(--text-3)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>Business type</label>
              <select className="input" value={data.type} onChange={e=>setData(d=>({...d,type:e.target.value}))}>
                {['Restaurant / Food & Drink','Retail / Boutique','Service Business','Healthcare / Wellness','Bar / Nightlife','Other'].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={{fontSize:11,color:'var(--text-3)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>Monthly marketing budget</label>
              <select className="input" value={data.budget} onChange={e=>setData(d=>({...d,budget:e.target.value}))}>
                {['Under $300','$300 – $600','$600 – $1,000','$1,000 – $1,500','$1,500+'].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={{fontSize:11,color:'var(--text-3)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.06em'}}>Anything you want to cover? (optional)</label><textarea className="input" value={data.notes} onChange={e=>setData(d=>({...d,notes:e.target.value}))} rows={2} style={{resize:'none'}} placeholder="Main goals, current struggles, questions..."/></div>
          </div>
          <button className="btn btn-primary" style={{width:'100%',marginTop:20,padding:13}} onClick={()=>setStep(1)} disabled={!data.name||!data.business||!data.email||!data.phone}>Pick a date →</button>
        </div>
      )}

      {step===1 && (
        <div>
          <h3 style={{fontSize:18,fontWeight:600,marginBottom:4}}>Pick a date</h3>
          <p style={{fontSize:13,color:'var(--text-3)',marginBottom:20}}>Monday–Friday · All times are Central Time</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,maxHeight:280,overflowY:'auto'}}>
            {days.map(d=>(
              <button key={d} onClick={()=>{setDate(d);setStep(2)}} style={{padding:'10px 6px',borderRadius:8,fontSize:12,cursor:'pointer',border:'0.5px solid',borderColor:date===d?'var(--accent-border)':'var(--border-2)',background:date===d?'var(--accent-dim)':'var(--bg-3)',color:date===d?'var(--accent)':'var(--text-2)',fontFamily:'inherit',textAlign:'center',lineHeight:1.4}}>{d}</button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{marginTop:16}} onClick={()=>setStep(0)}>← Back</button>
        </div>
      )}

      {step===2 && (
        <div>
          <h3 style={{fontSize:18,fontWeight:600,marginBottom:4}}>Pick a time</h3>
          <p style={{fontSize:13,color:'var(--text-3)',marginBottom:20}}>{date} · Central Time</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {HOURS.map(h=>(
              <button key={h} onClick={()=>{setTime(h);setStep(3)}} style={{padding:'10px 6px',borderRadius:8,fontSize:13,cursor:'pointer',border:'0.5px solid',borderColor:time===h?'var(--accent-border)':'var(--border-2)',background:time===h?'var(--accent-dim)':'var(--bg-3)',color:time===h?'var(--accent)':'var(--text-2)',fontFamily:'inherit',textAlign:'center'}}>{h}</button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{marginTop:16}} onClick={()=>setStep(1)}>← Back</button>
        </div>
      )}

      {step===3 && (
        <div>
          <h3 style={{fontSize:18,fontWeight:600,marginBottom:20}}>Confirm your booking</h3>
          <div style={{background:'var(--bg-3)',borderRadius:12,padding:20,marginBottom:20}}>
            <div style={{fontSize:18,fontWeight:600,color:'var(--accent)',marginBottom:4}}>{date}</div>
            <div style={{fontSize:15,color:'var(--text)',marginBottom:16}}>{time} Central Time</div>
            {[['Name',data.name],['Business',data.business],['Email',data.email],['Phone',data.phone],['Type',data.type],['Budget',data.budget]].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderTop:'0.5px solid var(--border)',fontSize:13}}>
                <span style={{color:'var(--text-3)'}}>{l}</span><span style={{color:'var(--text)'}}>{v}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{width:'100%',padding:13}} onClick={submit} disabled={submitting}>{submitting?'Confirming...':'Confirm booking →'}</button>
          <button className="btn btn-ghost btn-sm" style={{width:'100%',marginTop:8}} onClick={()=>setStep(2)}>← Change time</button>
        </div>
      )}
    </div>
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
  if (l.includes('premium')||l.includes('filming')||l.includes('drone')) return "Wovo Media Premium is fully custom — on-site filming, drone, photography, full account management, website build. Payton personally manages every account. Want to book a call?"
  if (l.includes('price')||l.includes('cost')||l.includes('how much')||l.includes('$')) return "Wovo AI starts at $29/mo. Team characters at $49. Website Builder at $99. Full-service Premium is custom — usually $350–$2,000/mo depending on scope. What's your situation?"
  if (l.includes('book')||l.includes('call')||l.includes('yes')||l.includes('interested')) return "Let's do it! Click 'Book a strategy call' anywhere on the page and pick a time that works. Payton will call you — no pressure, just a conversation."
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
    if(hasTeam||budget==='$150–$500') return {plan:'Wovo AI Growth',price:'$49/mo',desc:'5 posts a week, unlimited edits, and AI characters for your entire team.',cta:'Get Growth Plan',action:'/wovo-ai?plan=growth'}
    return {plan:'Wovo AI Starter',price:'$29/mo',desc:'AI character, 3 posts/week, ready-to-copy captions. Less than a tank of gas.',cta:'Get Starter Plan',action:'/wovo-ai?plan=starter'}
  }

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>

      {/* WELCOME MODAL */}
      {modal&&(
        <div onClick={()=>setModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} className="slide-up" style={{background:'var(--bg-2)',border:'0.5px solid var(--border-2)',borderRadius:20,padding:32,width:420,maxWidth:'94vw',position:'relative'}}>
            <button onClick={()=>setModal(false)} style={{position:'absolute',top:14,right:14,background:'var(--bg-3)',border:'0.5px solid var(--border-2)',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'var(--text-2)',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            <div style={{fontSize:11,color:'var(--accent)',fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Welcome to Wovo Media</div>
            <h3 style={{fontSize:22,fontWeight:700,color:'var(--text)',marginBottom:10}}>Real content or AI-powered?</h3>
            <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.6,marginBottom:24}}>Hey — I'm Payton, founder of Wovo Media. 11+ clients, 100M+ combined views. Whether you need a full production team or AI posts on a budget, you're in the right place.</p>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={()=>{setModal(false);document.getElementById('plans')?.scrollIntoView({behavior:'smooth'})}}>Show me plans</button>
              <button className="btn btn-outline" style={{flex:1}} onClick={()=>{setModal(false);setBookOpen(true)}}>Book a call</button>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING MODAL */}
      {bookOpen&&(
        <div onClick={()=>setBookOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e=>e.stopPropagation()} className="slide-up" style={{background:'var(--bg-2)',border:'0.5px solid var(--border-2)',borderRadius:20,padding:28,width:520,maxWidth:'96vw',maxHeight:'92vh',overflowY:'auto',position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:700}}>wovo<span style={{color:'var(--accent)'}}>media</span><span style={{fontSize:12,color:'var(--text-3)',fontWeight:400,marginLeft:6}}>Strategy Call</span></div>
              <button onClick={()=>setBookOpen(false)} style={{background:'var(--bg-3)',border:'0.5px solid var(--border-2)',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'var(--text-2)',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>
            <BookingFlow onClose={()=>setBookOpen(false)}/>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 40px',borderBottom:'0.5px solid var(--border)',position:'sticky',top:0,background:'rgba(8,8,8,0.94)',backdropFilter:'blur(14px)',zIndex:100}}>
        <div style={{fontFamily:'Syne,sans-serif',fontSize:19,fontWeight:700}}>wovo<span style={{color:'var(--accent)'}}>media</span></div>
        <div style={{display:'flex',gap:24,alignItems:'center'}}>
          {[['Wovo AI','#plans'],['Premium','#premium'],['Pricing','#pricing'],['Results','#results']].map(([l,h])=>(
            <a key={l} href={h} style={{color:'var(--text-2)',fontSize:13,textDecoration:'none'}}>{l}</a>
          ))}
          <Link href="/login" style={{color:'var(--text-2)',fontSize:13,textDecoration:'none'}}>Login</Link>
          <button className="btn btn-primary btn-sm" onClick={()=>setBookOpen(true)}>Book a call</button>
        </div>
      </nav>

      <div style={{position:'relative',zIndex:2}}>

        {/* HERO */}
        <div style={{maxWidth:860,margin:'0 auto',padding:'90px 40px 70px'}}>
          <div className="fade-up" style={{display:'inline-flex',alignItems:'center',gap:16,background:'var(--bg-2)',border:'0.5px solid var(--accent-border)',borderRadius:40,padding:'7px 18px',marginBottom:24}}>
            {[['11+','Clients'],['100M+','Views & Engagements'],['24hr','Response']].map(([n,l])=>(
              <div key={n} style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,color:'var(--accent)',fontSize:13}}>{n}</span>
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
          <div id="plans" className="fade-up d5" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[
              {tag:'Wovo AI',title:'AI-powered content',price:'$29',sub:'/mo',desc:'Ready-to-post content, AI characters for you & your whole team.',features:['AI character — you (Starter) or your whole team (Growth+)','3–5 posts per week, ready-to-copy captions','Edit or swap any post mid-week','Website Builder plan available ($99/mo)'],cta:'Start Wovo AI',link:'/wovo-ai',accent:true},
              {tag:'Wovo Media Premium',title:'Full-service',price:'Custom',sub:'',desc:'Real filming, drone, websites built — fully managed by Payton.',features:['On-site filming, drone & photography','Website design & development','We post for you — full admin access','Google Business Profile management','Wovo AI included at a discount'],cta:'Book a call',link:'#',accent:false,book:true},
            ].map(p=>(
              <div key={p.tag} className={`card${p.accent?' card-accent':''}`}>
                <span className="tag" style={!p.accent?{background:'rgba(255,255,255,0.04)',color:'var(--text-3)',borderColor:'var(--border-2)'}:{}}>{p.tag}</span>
                <h3 style={{fontSize:17,fontWeight:600,color:'var(--text)',marginTop:12,marginBottom:4}}>{p.title}</h3>
                <div style={{fontSize:32,fontWeight:700,fontFamily:'Syne,sans-serif',color:p.accent?'var(--text)':'var(--text-2)',margin:'10px 0 6px',letterSpacing:'-0.02em'}}>{p.price}<span style={{fontSize:14,color:'var(--text-3)',fontWeight:400}}>{p.sub}</span></div>
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
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
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
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:12}}>
              {[
                {name:'Starter',price:'$29',popular:false,features:['AI character — you','3 posts per week','Captions & editing','Posting tutorials']},
                {name:'Growth',price:'$49',popular:true,features:['AI characters — entire team','5 posts per week','Unlimited edits','Week description input']},
              ].map(p=>(
                <div key={p.name} className={`card${p.popular?' card-accent':''}`} style={{position:'relative'}}>
                  {p.popular&&<div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'var(--accent)',color:'#080808',fontSize:10,fontWeight:600,padding:'3px 12px',borderRadius:20,whiteSpace:'nowrap'}}>Most popular</div>}
                  <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:500,marginBottom:8}}>{p.name}</div>
                  <div style={{fontSize:30,fontWeight:700,fontFamily:'Syne,sans-serif',color:'var(--text)'}}>{p.price}<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
                  <div style={{marginTop:14}}>
                    {p.features.map(f=><div key={f} style={{fontSize:13,color:'var(--text-2)',padding:'6px 0',borderTop:'0.5px solid var(--border)',display:'flex',gap:7}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>)}
                  </div>
                  <Link href={`/wovo-ai?plan=${p.name.toLowerCase()}`}><button className={`btn ${p.popular?'btn-primary':'btn-outline'}`} style={{width:'100%',marginTop:16,padding:11}}>Get {p.name}</button></Link>
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
                  <div style={{fontSize:30,fontWeight:700,fontFamily:'Syne,sans-serif',color:'var(--text)'}}>{p.price}<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
                  <div style={{marginTop:14}}>
                    {p.features.map(f=><div key={f} style={{fontSize:13,color:'var(--text-2)',padding:'6px 0',borderTop:'0.5px solid var(--border)',display:'flex',gap:7}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>)}
                  </div>
                  <Link href={`/wovo-ai?plan=${p.name.toLowerCase().replace(' ','_')}`}><button className="btn btn-outline" style={{width:'100%',marginTop:16,padding:11}}>Get {p.name}</button></Link>
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
                  <div style={{fontSize:17,fontWeight:600,color:'var(--text)',marginBottom:18,fontFamily:'Syne,sans-serif'}}>{QUIZ[qStep].q}</div>
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
                    <div style={{fontSize:44,fontWeight:800,fontFamily:'Syne,sans-serif',color:'var(--text)',letterSpacing:'-0.03em',margin:'8px 0 12px'}}>{r.price}</div>
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

        {/* PREMIUM CTA */}
        <div id="premium" style={{borderTop:'0.5px solid var(--border)'}}>
          <div style={{maxWidth:860,margin:'0 auto',padding:'70px 40px',textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Wovo Media Premium</div>
            <h2 style={{fontSize:30,fontWeight:700,marginBottom:10}}>Ready for the full package?</h2>
            <p style={{color:'var(--text-2)',maxWidth:480,margin:'0 auto 36px',lineHeight:1.7,fontSize:14}}>On-site filming, drone, website builds, full account management, and Wovo AI included at a discount. Payton personally manages every account.</p>
            <button className="btn btn-primary" style={{fontSize:15,padding:'14px 32px'}} onClick={()=>setBookOpen(true)}>Book a free strategy call →</button>
            <p style={{fontSize:12,color:'var(--text-3)',marginTop:12}}>No commitment. Mon–Fri, 9am–5pm CT.</p>
          </div>
        </div>

        {/* FOOTER */}
        <footer style={{borderTop:'0.5px solid var(--border)',padding:'32px 40px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14}}>
          <div style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700}}>wovo<span style={{color:'var(--accent)'}}>media</span></div>
          <div style={{display:'flex',gap:20}}>
            {['Privacy','Terms'].map(l=><a key={l} href="#" style={{fontSize:12,color:'var(--text-3)',textDecoration:'none'}}>{l}</a>)}
            <a href="mailto:Payton@wovomedia.com" style={{fontSize:12,color:'var(--text-3)',textDecoration:'none'}}>Contact</a>
          </div>
          <div style={{fontSize:12,color:'var(--text-3)'}}>© 2025 Wovo Media · Middle Tennessee</div>
        </footer>
      </div>

      {/* NOVA CHAT */}
      <div style={{position:'fixed',bottom:22,right:22,zIndex:500,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:10}}>
        {chatOpen&&(
          <div className="slide-up" style={{width:300,background:'var(--bg-2)',border:'0.5px solid var(--border-2)',borderRadius:16,overflow:'hidden'}}>
            <div style={{background:'var(--bg-3)',padding:'12px 14px',display:'flex',alignItems:'center',gap:9,borderBottom:'0.5px solid var(--border)'}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:'var(--accent-dim)',border:'1.5px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'var(--accent)',fontFamily:'Syne,sans-serif',flexShrink:0}}>N</div>
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
