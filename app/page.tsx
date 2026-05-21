'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// Nova responses
const novaReply = (msg: string) => {
  const l = msg.toLowerCase()
  if (l.includes('restaurant')||l.includes('food')||l.includes('taco')||l.includes('bar')) return "Restaurants are honestly our best fit — daily specials, behind-the-scenes, promos. Your AI character posts for you. Want to see how it works?"
  if (l.includes('retail')||l.includes('boutique')||l.includes('shop')) return "Boutiques crush it with consistent AI content. We can build characters for you and your whole team. Want the 60-second quiz?"
  if (l.includes('employee')||l.includes('team')||l.includes('staff')) return "Yes! Wovo AI Growth and above lets you create AI characters for your entire team — not just yourself. Every employee gets their own character for content."
  if (l.includes('website')||l.includes('web')) return "We actually have a Website Builder plan — Wovo AI generates a full website for your business. Or if you're on Premium, website builds are included."
  if (l.includes('premium')||l.includes('filming')||l.includes('drone')) return "Wovo Media Premium is fully custom — on-site filming, drone, photography, full account management, website build included. Payton personally manages every account."
  if (l.includes('price')||l.includes('cost')||l.includes('how much')) return "Wovo AI starts at $29/mo. Team characters start at $49. Website Builder is $99/mo. Full-service Premium is custom quoted. What's your business type?"
  if (l.includes('100m')||l.includes('views')||l.includes('clients')) return "Yep — 11+ clients and over 100 million combined views and engagements across the brands we manage. Want to see what that looks like for your business?"
  if (l.includes('yes')||l.includes('book')||l.includes('call')) return "Perfect — scroll down and drop your info. Payton will reach out within 24 hours with a custom plan. No commitment needed."
  return "Good question! To find the right fit — what kind of business are you running and roughly what's your monthly marketing budget?"
}

const QUIZ = [
  { q: "What kind of business do you run?", opts: ["Restaurant / Food & Drink","Retail / Boutique","Service Business","Healthcare / Wellness","Other"] },
  { q: "How often are you posting on social media?", opts: ["Rarely or never","1–2x a week","Almost daily","I don't manage it"] },
  { q: "What's your biggest challenge?", opts: ["No time to create content","Don't know what to post","Posts aren't getting engagement","Can't afford a full team"] },
  { q: "Do you have team members who should also have content?", opts: ["Yes, I have a team","No, just me","Maybe in the future"] },
  { q: "Monthly marketing budget?", opts: ["Under $50","$50 – $150","$150 – $500","$500+"] },
  { q: "How hands-on do you want to be?", opts: ["I'll approve and post myself","I want someone to handle everything","Somewhere in between"] },
]

export default function Home() {
  const [modal, setModal] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [msgs, setMsgs] = useState([{r:'nova',t:"Hey! 👋 I'm Nova, part of the Wovo team. What kind of business do you run?"}])
  const [input, setInput] = useState('')
  const [quicks, setQuicks] = useState(true)
  const [qStep, setQStep] = useState(0)
  const [qAnswers, setQAnswers] = useState<string[]>([])
  const [qDone, setQDone] = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setTimeout(() => setModal(true), 1800) }, [])
  useEffect(() => { if(msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight }, [msgs])

  const sendMsg = (t?: string) => {
    const msg = t || input.trim()
    if(!msg) return
    setInput('')
    setQuicks(false)
    setMsgs(m => [...m, {r:'user',t:msg}])
    setTimeout(() => setMsgs(m => [...m, {r:'nova',t:novaReply(msg)}]), 750)
  }

  const qPick = (opt: string) => {
    const next = [...qAnswers, opt]
    setQAnswers(next)
    if(qStep + 1 >= QUIZ.length) setQDone(true)
    else setQStep(s => s+1)
  }

  const getResult = () => {
    const budget = qAnswers[4]||''
    const handsOn = qAnswers[5]||''
    const hasTeam = qAnswers[3]?.includes('team')
    if(budget==='$500+'||handsOn==='I want someone to handle everything') return {plan:'Wovo Media Premium',price:'Custom',desc:'Your business is ready for the full package — real filming, drone, website build, and full account management.',cta:'Book a strategy call',link:'#book'}
    if(hasTeam||budget==='$150 – $500') return {plan:'Wovo AI Growth',price:'$49/mo',desc:'5 posts a week, unlimited edits, and AI characters for your entire team — everyone gets their own content character.',cta:'Start Wovo AI Growth',link:'/wovo-ai?plan=growth'}
    return {plan:'Wovo AI Starter',price:'$29/mo',desc:'AI character, 3-day content plan, ready-to-copy captions. Less than a tank of gas a month.',cta:'Start Wovo AI Starter',link:'/wovo-ai?plan=starter'}
  }

  const S = (style: React.CSSProperties) => style

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>

      {/* WELCOME MODAL */}
      {modal && (
        <div onClick={()=>setModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center'}} className="fade-up">
          <div onClick={e=>e.stopPropagation()} className="slide-up" style={{background:'var(--bg-2)',border:'0.5px solid var(--border-2)',borderRadius:20,padding:32,width:440,maxWidth:'94vw',position:'relative'}}>
            <button onClick={()=>setModal(false)} style={{position:'absolute',top:14,right:14,background:'var(--bg-3)',border:'0.5px solid var(--border-2)',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'var(--text-2)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            <div style={{width:'100%',aspectRatio:'16/9',background:'var(--bg-3)',borderRadius:12,marginBottom:20,border:'0.5px solid var(--border)',position:'relative',overflow:'hidden',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setModal(false)}>
              <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,229,200,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,200,0.03) 1px,transparent 1px)',backgroundSize:'20px 20px'}}/>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,zIndex:1}}>
                <div style={{width:60,height:60,borderRadius:'50%',background:'var(--accent-dim)',border:'2px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:600,color:'var(--accent)',fontFamily:'Syne,sans-serif'}}>PC</div>
                <span style={{fontSize:12,color:'var(--text-3)'}}>Payton Cody — Founder, Wovo Media</span>
              </div>
              <div style={{position:'absolute',width:50,height:50,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',top:'50%',left:'50%',transform:'translate(-50%,-62%)'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#080808"><polygon points="5,3 19,12 5,21"/></svg>
              </div>
            </div>
            <div style={{fontSize:11,color:'var(--accent)',fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Welcome to Wovo Media</div>
            <h3 style={{fontSize:22,fontWeight:600,color:'var(--text)',marginBottom:8}}>Real content or AI-powered?</h3>
            <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.6,marginBottom:24}}>Hey — I'm Payton, founder of Wovo Media. 11+ clients, 100M+ combined views. Whether you need a full production team or AI posts on a budget, you're in the right place.</p>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-primary" onClick={()=>{setModal(false);document.getElementById('plans')?.scrollIntoView({behavior:'smooth'})}}>Show me both options</button>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Skip intro</button>
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 48px',borderBottom:'0.5px solid var(--border)',position:'sticky',top:0,background:'rgba(8,8,8,0.92)',backdropFilter:'blur(12px)',zIndex:100}}>
        <div style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:700,color:'var(--text)'}}>wovo<span style={{color:'var(--accent)'}}>media</span></div>
        <div style={{display:'flex',gap:28,alignItems:'center'}}>
          {[['Wovo AI','#plans'],['Premium','#book'],['Pricing','#pricing'],['Results','#results']].map(([l,h])=>(
            <a key={l} href={h} style={{color:'var(--text-2)',fontSize:14,textDecoration:'none',transition:'color 0.2s'}} onMouseEnter={e=>(e.currentTarget.style.color='var(--text)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text-2)')}>{l}</a>
          ))}
          <Link href="/wovo-ai" style={{color:'var(--text-2)',fontSize:14,textDecoration:'none'}}>Login</Link>
          <button className="btn btn-primary btn-sm" onClick={()=>document.getElementById('quiz-section')?.scrollIntoView({behavior:'smooth'})}>Find my plan</button>
        </div>
      </nav>

      <div style={{position:'relative',zIndex:2}}>

        {/* HERO */}
        <div style={{maxWidth:900,margin:'0 auto',padding:'100px 48px 80px'}}>
          {/* Social proof bar */}
          <div className="fade-up" style={{display:'inline-flex',alignItems:'center',gap:20,background:'var(--bg-2)',border:'0.5px solid var(--accent-border)',borderRadius:40,padding:'8px 20px',marginBottom:28}}>
            {[['11+','Clients'],['100M+','Views & Engagements'],['24hr','Response Time']].map(([n,l])=>(
              <div key={n} style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,color:'var(--accent)',fontSize:14}}>{n}</span>
                <span style={{fontSize:12,color:'var(--text-3)'}}>{l}</span>
              </div>
            ))}
          </div>
          <div className="fade-up d1" style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'var(--accent)',boxShadow:'0 0 8px var(--accent)'}}/>
            <span style={{fontSize:13,color:'var(--text-3)'}}>Digital presence management — Middle Tennessee & beyond</span>
          </div>
          <h1 className="fade-up d2" style={{fontSize:62,fontWeight:800,lineHeight:1.04,marginBottom:22,color:'var(--text)'}}>
            Your business,<br/><span style={{color:'var(--accent)'}}>seen everywhere.</span>
          </h1>
          <p className="fade-up d3" style={{fontSize:18,color:'var(--text-2)',maxWidth:520,lineHeight:1.65,marginBottom:36}}>
            Two ways to grow your online presence. AI-powered content from $29/mo with team characters, or full-service production with a real team behind you.
          </p>
          <div className="fade-up d4" style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:80}}>
            <button className="btn btn-primary" style={{fontSize:15,padding:'13px 28px'}} onClick={()=>document.getElementById('quiz-section')?.scrollIntoView({behavior:'smooth'})}>Find my plan — 60 sec ↗</button>
            <button className="btn btn-outline" style={{fontSize:15,padding:'12px 28px'}} onClick={()=>document.getElementById('book')?.scrollIntoView({behavior:'smooth'})}>Book a strategy call</button>
          </div>
          <div className="glow-line fade-up d5" style={{marginBottom:48}}/>

          {/* TWO LANE */}
          <div id="plans" className="fade-up d5" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div className="card card-accent">
              <span className="tag">Wovo AI</span>
              <h3 style={{fontSize:18,fontWeight:600,color:'var(--text)',marginTop:14,marginBottom:4}}>AI-powered content</h3>
              <div style={{fontSize:36,fontWeight:700,fontFamily:'Syne,sans-serif',color:'var(--text)',margin:'12px 0 6px',letterSpacing:'-0.02em'}}>$29<span style={{fontSize:15,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
              <p style={{fontSize:13,color:'var(--text-3)',marginBottom:18}}>Ready-to-post content. AI characters for you & your team.</p>
              {['Custom AI character of you or your brand','AI characters for your whole team (Growth+)','3-day rolling content plan','Ready-to-copy captions every day','Edit or swap any post mid-week','Website Builder plan available'].map(f=>(
                <div key={f} style={{display:'flex',alignItems:'flex-start',gap:9,marginTop:10,fontSize:13,color:'var(--text-2)'}}>
                  <span style={{color:'var(--accent)',marginTop:1,flexShrink:0}}>✓</span>{f}
                </div>
              ))}
              <Link href="/wovo-ai"><button className="btn btn-primary" style={{width:'100%',marginTop:22,padding:13}}>Start Wovo AI</button></Link>
            </div>
            <div className="card">
              <span className="tag" style={{background:'rgba(255,255,255,0.04)',color:'var(--text-3)',borderColor:'var(--border-2)'}}>Wovo Media</span>
              <h3 style={{fontSize:18,fontWeight:600,color:'var(--text)',marginTop:14,marginBottom:4}}>Full-service premium</h3>
              <div style={{fontSize:36,fontWeight:700,fontFamily:'Syne,sans-serif',color:'var(--text-2)',margin:'12px 0 6px',letterSpacing:'-0.02em'}}>Custom<span style={{fontSize:15,fontWeight:400}}> pricing</span></div>
              <p style={{fontSize:13,color:'var(--text-3)',marginBottom:18}}>Real filming, real people, websites built — fully managed.</p>
              {['On-site filming & drone footage','Photography & skit production','We post for you — full admin access','Google Business Profile management','Website design & development','Dedicated account manager (Payton)','Wovo AI included at a discount'].map(f=>(
                <div key={f} style={{display:'flex',alignItems:'flex-start',gap:9,marginTop:10,fontSize:13,color:'var(--text-2)'}}>
                  <span style={{color:'var(--text-3)',marginTop:1,flexShrink:0}}>✓</span>{f}
                </div>
              ))}
              <button className="btn btn-outline" style={{width:'100%',marginTop:22,padding:13}} onClick={()=>document.getElementById('book')?.scrollIntoView({behavior:'smooth'})}>Book a call</button>
            </div>
          </div>
        </div>

        {/* RESULTS SOCIAL PROOF */}
        <div id="results" style={{borderTop:'0.5px solid var(--border)'}}>
          <div style={{maxWidth:900,margin:'0 auto',padding:'64px 48px',textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14}}>Proven results</div>
            <h2 style={{fontSize:34,fontWeight:700,marginBottom:40}}>Real businesses. Real numbers.</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
              {[['11+','Active clients managed',''],['100M+','Combined views & engagements',''],['4M+','Monthly views for one client alone',''],['24hr','Response time on all inquiries','']].map(([n,l])=>(
                <div key={n} className="stat-card" style={{textAlign:'center'}}>
                  <div className="stat-num">{n}</div>
                  <div className="stat-label">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PRICING */}
        <div id="pricing" style={{borderTop:'0.5px solid var(--border)'}}>
          <div style={{maxWidth:900,margin:'0 auto',padding:'80px 48px'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14}}>Pricing</div>
            <h2 style={{fontSize:34,fontWeight:700,marginBottom:8}}>Wovo AI plans.</h2>
            <p style={{color:'var(--text-2)',marginBottom:44}}>Pick your tier. Upgrade or cancel anytime. Premium clients get Wovo AI at a discount.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14,marginBottom:14}}>
              {[
                {name:'Starter',price:'$29',desc:'Perfect for getting started.',plan:'starter',popular:false,features:['AI character creation — you','3 posts per week','Ready-to-copy captions','Basic edits','Posting tutorials']},
                {name:'Growth',price:'$49',desc:'Best for businesses with a team.',plan:'growth',popular:true,features:['Everything in Starter','AI characters for your whole team','5 posts per week','Unlimited edits','Week description input','Priority updates']},
              ].map(p=>(
                <div key={p.name} className={`card ${p.popular?'card-accent':''}`} style={{position:'relative'}}>
                  {p.popular&&<div style={{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',background:'var(--accent)',color:'#080808',fontSize:10,fontWeight:600,padding:'3px 14px',borderRadius:20,whiteSpace:'nowrap'}}>Most popular</div>}
                  <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:500,marginBottom:10}}>{p.name}</div>
                  <div style={{fontSize:34,fontWeight:700,fontFamily:'Syne,sans-serif',color:'var(--text)',letterSpacing:'-0.02em'}}>{p.price}<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
                  <p style={{fontSize:13,color:'var(--text-3)',margin:'8px 0 18px',lineHeight:1.5}}>{p.desc}</p>
                  {p.features.map(f=><div key={f} style={{fontSize:13,color:'var(--text-2)',padding:'7px 0',borderTop:'0.5px solid var(--border)',display:'flex',gap:7}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>)}
                  <Link href={`/wovo-ai?plan=${p.plan}`}><button className={`btn ${p.popular?'btn-primary':'btn-outline'}`} style={{width:'100%',marginTop:18,padding:12}}>Get {p.name}</button></Link>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
              {[
                {name:'Pro AI',price:'$79',desc:'Daily content + Stories. Max visibility.',plan:'pro_ai',features:['Everything in Growth','Daily posts + Stories','Multiple brand characters','Monthly strategy report','Early feature access']},
                {name:'Website Builder',price:'$99',desc:'Wovo AI builds your website for you.',plan:'website',highlight:true,features:['Full website generation with AI','Choose your style and vibe','Business info → live site','Easy to edit and update','Hosted and deployed for you']},
              ].map(p=>(
                <div key={p.name} className={`card ${(p as any).highlight?'card-accent':''}`}>
                  {(p as any).highlight&&<div style={{fontSize:11,color:'var(--accent)',fontWeight:500,marginBottom:6}}>🌐 NEW</div>}
                  <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:500,marginBottom:10}}>{p.name}</div>
                  <div style={{fontSize:34,fontWeight:700,fontFamily:'Syne,sans-serif',color:'var(--text)',letterSpacing:'-0.02em'}}>{p.price}<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
                  <p style={{fontSize:13,color:'var(--text-3)',margin:'8px 0 18px',lineHeight:1.5}}>{p.desc}</p>
                  {p.features.map(f=><div key={f} style={{fontSize:13,color:'var(--text-2)',padding:'7px 0',borderTop:'0.5px solid var(--border)',display:'flex',gap:7}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>)}
                  <Link href={`/wovo-ai?plan=${p.plan}`}><button className="btn btn-outline" style={{width:'100%',marginTop:18,padding:12}}>Get {p.name}</button></Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QUIZ */}
        <div style={{borderTop:'0.5px solid var(--border)'}}>
          <div id="quiz-section" style={{maxWidth:900,margin:'0 auto',padding:'80px 48px'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14}}>60-second quiz</div>
            <h2 style={{fontSize:34,fontWeight:700,marginBottom:12}}>Not sure which plan fits?<br/><span style={{color:'var(--accent)'}}>We'll tell you.</span></h2>
            <p style={{color:'var(--text-2)',marginBottom:40}}>Answer a few questions and get a personalized recommendation.</p>
            <div className="card" style={{maxWidth:580,margin:'0 auto'}}>
              <div style={{display:'flex',gap:5,marginBottom:28}}>
                {QUIZ.map((_,i)=><div key={i} style={{flex:1,height:2,borderRadius:2,background:i<qStep||(qDone)?'var(--accent)':'var(--bg-4)',transition:'background 0.3s'}}/>)}
              </div>
              {!qDone ? (
                <>
                  <div style={{fontSize:18,fontWeight:600,color:'var(--text)',marginBottom:20,fontFamily:'Syne,sans-serif'}}>{QUIZ[qStep].q}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:9}}>
                    {QUIZ[qStep].opts.map(opt=>(
                      <button key={opt} onClick={()=>qPick(opt)} className="btn btn-ghost" style={{justifyContent:'flex-start',padding:'12px 16px',fontSize:14}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent-border)';(e.currentTarget as HTMLElement).style.color='var(--text)'}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border-2)';(e.currentTarget as HTMLElement).style.color='var(--text-2)'}}>
                        {opt}
                      </button>
                    ))}
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:22,alignItems:'center'}}>
                    <span style={{fontSize:12,color:'var(--text-3)'}}>Question {qStep+1} of {QUIZ.length}</span>
                    {qStep>0&&<button className="btn btn-ghost btn-sm" onClick={()=>{setQStep(s=>s-1);setQAnswers(a=>a.slice(0,-1))}}>← Back</button>}
                  </div>
                </>
              ) : (()=>{
                const r=getResult()
                return (
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:11,color:'var(--accent)',fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10}}>Your recommended plan</div>
                    <h3 style={{fontSize:22,fontWeight:700,color:'var(--text)',marginBottom:8}}>{r.plan}</h3>
                    <div style={{fontSize:48,fontWeight:800,fontFamily:'Syne,sans-serif',color:'var(--text)',letterSpacing:'-0.03em',margin:'10px 0 14px'}}>{r.price}</div>
                    <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.6,marginBottom:26}}>{r.desc}</p>
                    <Link href={r.link}><button className="btn btn-primary" style={{width:'100%',padding:13}}>{r.cta}</button></Link>
                    <button className="btn btn-ghost" style={{width:'100%',marginTop:10}} onClick={()=>{setQStep(0);setQAnswers([]);setQDone(false)}}>Retake quiz</button>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {/* COMPARE */}
        <div style={{borderTop:'0.5px solid var(--border)'}}>
          <div style={{maxWidth:900,margin:'0 auto',padding:'80px 48px'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14}}>Compare</div>
            <h2 style={{fontSize:34,fontWeight:700,marginBottom:36}}>Everything side by side.</h2>
            <div style={{overflowX:'auto'}}>
              <table>
                <thead><tr><th>Feature</th><th style={{color:'var(--accent)'}}>Wovo AI</th><th>Premium</th></tr></thead>
                <tbody>
                  {[
                    ['AI character — you',true,true],
                    ['AI characters — whole team','Growth+',true],
                    ['3-day rolling content plan',true,true],
                    ['Ready-to-copy captions',true,true],
                    ['Edit posts mid-week',true,true],
                    ['Website Builder','$99 plan',true],
                    ['On-site filming & drone',false,true],
                    ['We post for you',false,true],
                    ['Google Business Profile',false,true],
                    ['Dedicated account manager',false,true],
                    ['Monthly pricing','From $29','Custom'],
                  ].map(([f,ai,prem])=>(
                    <tr key={String(f)}>
                      <td style={{color:'var(--text-2)'}}>{f}</td>
                      <td>{typeof ai==='boolean'?(ai?<span style={{color:'var(--accent)'}}>✓</span>:<span style={{color:'var(--border-2)'}}>—</span>):<span style={{color:'var(--accent)',fontSize:12}}>{ai}</span>}</td>
                      <td>{typeof prem==='boolean'?(prem?<span style={{color:'var(--accent)'}}>✓</span>:<span style={{color:'var(--border-2)'}}>—</span>):<span style={{color:'var(--text-3)',fontSize:12}}>{prem}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* BOOK A CALL */}
        <div id="book" style={{borderTop:'0.5px solid var(--border)'}}>
          <div style={{maxWidth:900,margin:'0 auto',padding:'80px 48px',textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14}}>Wovo Media Premium</div>
            <h2 style={{fontSize:34,fontWeight:700,marginBottom:12}}>Ready for the full package?</h2>
            <p style={{color:'var(--text-2)',maxWidth:500,margin:'0 auto 36px',lineHeight:1.7}}>On-site filming, drone, website builds, full account management, and Wovo AI included at a discount. Payton personally manages every account.</p>
            <div className="card" style={{maxWidth:520,margin:'0 auto'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
                {[['Business type',['Restaurant / Food','Retail / Boutique','Service Business','Healthcare','Other']],['Monthly budget',['$300 – $600','$600 – $1,000','$1,000 – $1,500','$1,500+']]].map(([label,opts])=>(
                  <div key={String(label)} style={{background:'var(--bg-3)',borderRadius:10,padding:'14px 16px'}}>
                    <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>{label}</div>
                    <select style={{background:'transparent',border:'none',color:'var(--text-2)',fontSize:13,width:'100%',outline:'none',fontFamily:'inherit'}}>
                      {(opts as string[]).map((o:string)=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{width:'100%',padding:15,fontSize:15}} onClick={()=>window.open('https://calendly.com/wovomedia','_blank')}>Book a free strategy call →</button>
              <p style={{fontSize:12,color:'var(--text-3)',marginTop:10}}>No commitment. Our team reaches out within 24 hours.</p>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer style={{borderTop:'0.5px solid var(--border)',padding:'40px 48px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
          <div style={{fontFamily:'Syne,sans-serif',fontSize:17,fontWeight:700}}>wovo<span style={{color:'var(--accent)'}}>media</span></div>
          <div style={{display:'flex',gap:24}}>
            {['Privacy','Terms','Contact'].map(l=><a key={l} href="#" style={{fontSize:13,color:'var(--text-3)',textDecoration:'none'}}>{l}</a>)}
          </div>
          <div style={{fontSize:12,color:'var(--text-3)'}}>© 2025 Wovo Media. Middle Tennessee.</div>
        </footer>
      </div>

      {/* NOVA CHAT */}
      <div style={{position:'fixed',bottom:24,right:24,zIndex:500,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:12}}>
        {chatOpen && (
          <div className="slide-up" style={{width:310,background:'var(--bg-2)',border:'0.5px solid var(--border-2)',borderRadius:18,overflow:'hidden'}}>
            <div style={{background:'var(--bg-3)',padding:'14px 16px',display:'flex',alignItems:'center',gap:10,borderBottom:'0.5px solid var(--border)'}}>
              <div style={{width:34,height:34,borderRadius:'50%',background:'var(--accent-dim)',border:'1.5px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:600,color:'var(--accent)',fontFamily:'Syne,sans-serif',flexShrink:0}}>N</div>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>Nova</div>
                <div style={{fontSize:11,color:'var(--accent)',display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:5,height:5,borderRadius:'50%',background:'var(--accent)',boxShadow:'0 0 6px var(--accent)'}}/>Online now
                </div>
              </div>
            </div>
            <div ref={msgsRef} style={{padding:14,display:'flex',flexDirection:'column',gap:9,maxHeight:230,overflowY:'auto'}}>
              {msgs.map((m,i)=>(
                <div key={i} style={{maxWidth:'83%',fontSize:13,lineHeight:1.5,padding:'9px 13px',borderRadius:m.r==='nova'?'10px 10px 10px 2px':'10px 10px 2px 10px',background:m.r==='nova'?'var(--bg-3)':'var(--accent-dim)',border:m.r==='user'?'0.5px solid var(--accent-border)':'none',color:m.r==='nova'?'var(--text-2)':'var(--text)',alignSelf:m.r==='user'?'flex-end':'flex-start'}}>
                  {m.t}
                </div>
              ))}
            </div>
            {quicks && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'0 14px 10px'}}>
                {['Restaurant 🍽️','Retail 🛍️','Team characters?','Pricing?'].map(q=>(
                  <button key={q} onClick={()=>sendMsg(q)} style={{background:'var(--bg-3)',border:'0.5px solid var(--border-2)',borderRadius:20,padding:'5px 12px',fontSize:12,color:'var(--text-2)',cursor:'pointer',transition:'all 0.18s'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent-border)';(e.currentTarget as HTMLElement).style.color='var(--accent)'}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border-2)';(e.currentTarget as HTMLElement).style.color='var(--text-2)'}}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div style={{display:'flex',gap:8,padding:'10px 14px',borderTop:'0.5px solid var(--border)'}}>
              <input className="input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} placeholder="Type a message..." style={{fontSize:13,padding:'8px 11px'}}/>
              <button onClick={()=>sendMsg()} style={{background:'var(--accent)',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
            <div style={{fontSize:11,color:'var(--text-3)',textAlign:'center',padding:'6px 0 8px'}}>Powered by Wovo AI</div>
          </div>
        )}
        <button onClick={()=>setChatOpen(o=>!o)} className="pulse-ring" style={{width:52,height:52,borderRadius:'50%',background:'var(--accent)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
          {chatOpen
            ?<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            :<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#080808" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          }
          {!chatOpen&&<div style={{position:'absolute',top:-2,right:-2,width:14,height:14,borderRadius:'50%',background:'#ff4444',border:'2px solid var(--bg)',fontSize:9,color:'#fff',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>1</div>}
        </button>
      </div>
    </div>
  )
}
