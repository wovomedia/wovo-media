'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function WovoOS() {
  const [faq, setFaq] = useState<number|null>(null)

  const FAQS = [
    ['What exactly does WOVO OS do?', 'WOVO OS is an AI agent that runs on your computer 24/7. It monitors your email, social media, calendar, and screen — drafts responses, creates content, handles tasks — and asks for your approval before doing anything consequential. You manage it from your phone.'],
    ['How does it learn my business?', 'When you first install it, WOVO OS goes through a deep onboarding — it asks about your customers, products, tone of voice, schedule, and goals. Over time it learns from every interaction what you like and don\'t like. Within a few weeks it feels like a real employee who truly knows your business.'],
    ['Does it post to social media automatically?', 'Never without your approval. WOVO OS will draft content, suggest captions, and queue posts — but it always asks you to approve before anything goes live. You get a push notification on your phone to approve with one tap.'],
    ['What happens if I cancel my subscription?', 'You have a 30-day grace period after canceling. After 30 days the system locks and goes into read-only mode. To reactivate you\'ll need to pay the $850 setup fee again plus restart your subscription.'],
    ['Does it work on Mac and Windows?', 'Yes — WOVO OS works on both Mac (macOS 13+) and Windows (10 and 11). It installs as a background app and runs silently unless you talk to it.'],
    ['Is my data secure?', 'WOVO OS only processes what\'s on your screen and in your connected accounts. All AI processing goes through Anthropic\'s Claude API (the same models that power Claude.ai). Nothing is sold or shared.'],
  ]

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh'}}>
      <div className="grid-bg"/><div className="grid-fade"/>

      {/* Nav */}
      <nav style={{position:'sticky',top:0,zIndex:100,borderBottom:'0.5px solid var(--border)',background:'rgba(8,8,8,0.95)',backdropFilter:'blur(16px)',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Link href="/" style={{fontSize:13,color:'var(--text-3)',textDecoration:'none'}}>← Back</Link>
          <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" rel="noreferrer">
            <button className="btn btn-primary btn-sm">Book a demo</button>
          </a>
        </div>
      </nav>

      <div style={{position:'relative',zIndex:2,maxWidth:860,margin:'0 auto',padding:'0 24px'}}>

        {/* Hero */}
        <div style={{padding:'80px 0 60px',textAlign:'center'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'var(--accent-dim)',border:'1px solid var(--accent-border)',borderRadius:20,padding:'5px 16px',marginBottom:24}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'var(--accent)',boxShadow:'0 0 8px var(--accent)'}}/>
            <span style={{fontSize:12,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:'0.08em'}}>Now Available</span>
          </div>
          <h1 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(40px,8vw,72px)',fontWeight:800,lineHeight:1.0,marginBottom:20,color:'var(--text)',letterSpacing:'-0.04em'}}>
            WOVO OS
          </h1>
          <p style={{fontSize:'clamp(17px,2.5vw,22px)',color:'var(--accent)',fontWeight:600,marginBottom:16,fontFamily:'Outfit,sans-serif'}}>
            Your AI employee. Always on. Always learning.
          </p>
          <p style={{fontSize:'clamp(14px,2vw,17px)',color:'var(--text-2)',maxWidth:520,margin:'0 auto 36px',lineHeight:1.7}}>
            Runs on your computer. Manages itself. You approve everything from your phone. Like hiring the best employee you've ever had — except they never sleep, never call in sick, and learn your business in days not months.
          </p>
          <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
            <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
              <button className="btn btn-primary" style={{fontSize:15,padding:'13px 28px'}}>Book a demo →</button>
            </a>
            <a href="#pricing" style={{textDecoration:'none'}}>
              <button className="btn btn-outline" style={{fontSize:15,padding:'12px 26px'}}>See pricing</button>
            </a>
          </div>
        </div>

        {/* Live demo mockup */}
        <div style={{background:'var(--bg-2)',borderRadius:16,border:'1px solid var(--border)',marginBottom:80,overflow:'hidden'}}>
          <div style={{background:'var(--bg-3)',padding:'10px 16px',display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',gap:5}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:'#ef4444'}}/>
              <div style={{width:10,height:10,borderRadius:'50%',background:'#f59e0b'}}/>
              <div style={{width:10,height:10,borderRadius:'50%',background:'#22c55e'}}/>
            </div>
            <span style={{fontSize:12,color:'var(--text-3)',fontFamily:'monospace'}}>WOVO OS — Active · Listening</span>
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'#22c55e',boxShadow:'0 0 6px #22c55e'}}/>
              <span style={{fontSize:11,color:'#22c55e',fontWeight:600}}>Online</span>
            </div>
          </div>
          <div style={{padding:24,display:'flex',flexDirection:'column',gap:16,fontFamily:'monospace'}}>
            {[
              {from:'wovo',text:'Good morning. Three things need your attention: 1 new Google review, 2 unanswered Instagram DMs, and your Tuesday post is performing 340% above average.',time:'8:02 AM'},
              {from:'you',text:'Handle the review first.',time:'8:03 AM'},
              {from:'wovo',text:'The review from Sarah M. says "Amazing service, came back for the third time this month!" — I\'ve drafted: "Sarah, you\'re the best! Thank you so much — we love having you every time 🙏" Ready to post?',time:'8:03 AM'},
              {from:'you',text:'Post it.',time:'8:04 AM'},
              {from:'wovo',text:'✓ Posted. Moving to the DMs — one is a catering inquiry for 200 people in July. Want me to draft a quote response based on your pricing sheet?',time:'8:04 AM'},
              {from:'you',text:'Yes, and schedule it for review in 2 hours.',time:'8:05 AM'},
              {from:'wovo',text:'Done. I\'ve drafted the quote and set a reminder for 10 AM. Your Tuesday reel now has 847 comments — want me to respond to the top 20?',time:'8:05 AM'},
            ].map((m,i)=>(
              <div key={i} style={{display:'flex',flexDirection:'column',alignItems:m.from==='you'?'flex-end':'flex-start',gap:3}}>
                <div style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{m.from==='wovo'?'WOVO OS':m.from==='you'?'You':''} · {m.time}</div>
                <div style={{background:m.from==='wovo'?'var(--bg-4)':m.from==='you'?'var(--accent)':'var(--bg-3)',color:m.from==='you'?'#080808':'var(--text-2)',borderRadius:10,padding:'10px 14px',fontSize:12,maxWidth:'80%',lineHeight:1.6}}>{m.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <section style={{marginBottom:80}}>
          <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>How it works</div>
          <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(22px,4vw,32px)',fontWeight:700,marginBottom:40,color:'var(--text)'}}>Set up once. Works forever.</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:14}}>
            {[
              ['01','Install','Download the WOVO OS app on your Mac or Windows computer. Takes 5 minutes.'],
              ['02','Onboard','WOVO OS interviews you about your business — customers, products, tone, schedule, goals.'],
              ['03','Connect','Link your email, social accounts, and calendar. WOVO OS starts learning immediately.'],
              ['04','Manage','Get a phone app to approve actions, review drafts, ask questions, and monitor everything WOVO OS does.'],
              ['05','Grow','Over weeks WOVO OS gets faster and smarter. Less approval needed for routine tasks. More time for you.'],
            ].map(([n,t,d])=>(
              <div key={n as string} className="card">
                <div style={{fontFamily:'Outfit,sans-serif',fontSize:32,fontWeight:800,color:'var(--accent)',opacity:0.4,marginBottom:10,lineHeight:1}}>{n}</div>
                <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:8}}>{t}</div>
                <div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.65}}>{d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section style={{marginBottom:80}}>
          <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>Features</div>
          <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(22px,4vw,32px)',fontWeight:700,marginBottom:40,color:'var(--text)'}}>Built like a real employee.</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14}}>
            {[
              ['🧠','Deep business memory','Remembers every customer, product, preference, and past decision. Gets smarter every day.'],
              ['📱','Phone management','Full control from your phone. Approve, deny, ask questions, see activity — anywhere.'],
              ['✋','Always asks permission','Never posts, sends, or publishes without your explicit approval. You\'re always in control.'],
              ['💬','Natural conversation','Talk to it like a person. It speaks back. Reads the room — serious when needed, relaxed when not.'],
              ['📅','Calendar & scheduling','Knows your schedule, books meetings, sets reminders, warns you about conflicts.'],
              ['📊','Business intelligence','Tracks what\'s working, what\'s not, which customers are most valuable, what content performs.'],
              ['🔒','Permission system','You set what it can do automatically vs. what always needs approval. Full control.'],
              ['🖥️','Mac & Windows','Native app on both platforms. Runs in the background, whisper quiet until you need it.'],
            ].map(([icon,title,desc])=>(
              <div key={title as string} className="card" style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:28}}>{icon}</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{title}</div>
                <div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.65}}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" style={{marginBottom:80}}>
          <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>Pricing</div>
          <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(22px,4vw,32px)',fontWeight:700,marginBottom:12,color:'var(--text)'}}>One hire. Transformative results.</h2>
          <p style={{color:'var(--text-2)',marginBottom:32,fontSize:14}}>Think of it like hiring a full-time employee — but at a fraction of the cost.</p>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}} className="grid-2">
            <div className="card card-accent">
              <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Setup fee — one time</div>
              <div style={{fontFamily:'Outfit,sans-serif',fontSize:48,fontWeight:800,color:'var(--text)',marginBottom:4,letterSpacing:'-0.03em'}}>$850</div>
              <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.65,marginBottom:20}}>Covers installation, deep onboarding, business profile setup, and first 30 days of learning. Paid once to activate.</p>
              {['Installation on Mac or Windows','Deep business onboarding interview','Connect all your accounts','30-day intensive learning period','Phone management app setup'].map(f=>(
                <div key={f} style={{display:'flex',gap:8,fontSize:12,color:'var(--text-2)',padding:'5px 0',borderTop:'0.5px solid var(--border)'}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>
              ))}
            </div>

            <div className="card">
              <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Monthly — keeps it running</div>
              <div style={{fontFamily:'Outfit,sans-serif',fontSize:48,fontWeight:800,color:'var(--text)',marginBottom:4,letterSpacing:'-0.03em'}}>$350<span style={{fontSize:18,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
              <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.65,marginBottom:20}}>Keeps WOVO OS active, learning, and connected. Cancel anytime — 30 day grace period before system locks.</p>
              {['Continuous learning & improvement','Full phone app access','Priority support','Software updates','Business intelligence reports'].map(f=>(
                <div key={f} style={{display:'flex',gap:8,fontSize:12,color:'var(--text-2)',padding:'5px 0',borderTop:'0.5px solid var(--border)'}}><span style={{color:'var(--text-3)',flexShrink:0}}>✓</span>{f}</div>
              ))}
            </div>
          </div>

          <div className="card" style={{background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.15)',padding:'14px 20px',marginBottom:20}}>
            <div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7}}>
              <strong style={{color:'var(--text)'}}>⚠️ Cancellation policy:</strong> If you cancel your monthly subscription, WOVO OS continues working for 30 days. After 30 days the system locks into read-only mode and stops acting. To reactivate, you pay the $850 setup fee again to unlock and restart the learning process.
            </div>
          </div>

          <div style={{textAlign:'center'}}>
            <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
              <button className="btn btn-primary" style={{fontSize:15,padding:'14px 32px'}}>Book a demo to get started →</button>
            </a>
            <p style={{fontSize:12,color:'var(--text-3)',marginTop:12}}>We walk you through everything on a call before purchase</p>
          </div>
        </section>

        {/* FAQ */}
        <section style={{marginBottom:80}}>
          <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>FAQ</div>
          <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(22px,4vw,32px)',fontWeight:700,marginBottom:32,color:'var(--text)'}}>Questions answered.</h2>
          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            {FAQS.map(([q,a],i)=>(
              <div key={i} className="card" style={{cursor:'pointer',padding:'16px 18px'}} onClick={()=>setFaq(faq===i?null:i)}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16}}>
                  <div style={{fontSize:14,fontWeight:600,color:'var(--text)',lineHeight:1.4}}>{q}</div>
                  <div style={{fontSize:18,color:'var(--accent)',flexShrink:0,transition:'transform 0.2s',transform:faq===i?'rotate(45deg)':'none'}}>+</div>
                </div>
                {faq===i && <div style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7,marginTop:12,borderTop:'0.5px solid var(--border)',paddingTop:12}}>{a}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{marginBottom:80,textAlign:'center',padding:'60px 24px',background:'var(--bg-2)',borderRadius:16,border:'1px solid var(--border)'}}>
          <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(24px,4vw,36px)',fontWeight:800,marginBottom:12,color:'var(--text)',letterSpacing:'-0.03em'}}>
            Ready to hire your AI employee?
          </h2>
          <p style={{fontSize:15,color:'var(--text-2)',marginBottom:28,maxWidth:440,margin:'0 auto 28px',lineHeight:1.7}}>
            Book a 30-minute demo. We walk you through exactly what WOVO OS will do for your specific business before you pay a cent.
          </p>
          <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
            <button className="btn btn-primary" style={{fontSize:15,padding:'14px 32px'}}>Book a free demo →</button>
          </a>
          <p style={{fontSize:12,color:'var(--text-3)',marginTop:12}}>No commitment · Demo is free · Mon–Fri 9am–5pm CT</p>
        </section>

      </div>

      {/* Footer */}
      <footer style={{borderTop:'1px solid var(--border)',padding:'28px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14}}>
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:16,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>
        <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
          {[['Home','/'],['Wovo AI','/wovo-ai'],['Privacy','/privacy'],['Terms','/terms'],['Contact','mailto:support@wovomedia.com']].map(([l,h])=>(
            <a key={l} href={h} style={{fontSize:12,color:'var(--text-3)',textDecoration:'none',fontWeight:500}}>{l}</a>
          ))}
        </div>
        <div style={{fontSize:12,color:'var(--text-3)'}}>© {new Date().getFullYear()} Wovo Media</div>
      </footer>
    </div>
  )
}
