'use client'
import { useState } from 'react'
import Link from 'next/link'

// fal.ai permanent image URLs
const IMGS = {
  hero: 'https://v3b.fal.media/files/b/0a9dbfe1/O1INKqRoIQAgUfHQv4kJ5.jpg',
  social: 'https://v3b.fal.media/files/b/0a9dbfe1/WWiD5Ve9dVO8qbUP9oEyU.jpg',
  ai: 'https://v3b.fal.media/files/b/0a9dbfe2/dYb9XqiI45UdQ4bTyviSw.jpg',
  drone: 'https://v3b.fal.media/files/b/0a9dbfe1/KcYIG3LwJ0OlSZdYMfDmG.jpg',
  cinAd: 'https://v3b.fal.media/files/b/0a9dbfe1/kWoCXu5J00vLNtiTalzHk.jpg',
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)


  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',overflowX:'hidden'}}>

      {/* ── NAV ─────────────────────────────────── */}
      <nav style={{position:'sticky',top:0,zIndex:100,borderBottom:'0.5px solid var(--border)',background:'rgba(8,8,8,0.95)',backdropFilter:'blur(16px)',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>
        <div className="desktop-nav" style={{display:'flex',alignItems:'center',gap:24}}>
          {[['Wovo AI','#wovo-ai'],['WOVO OS','/wovo-os'],['Cinematic Ads','#cin-ads'],['Premium','#premium'],['Pricing','#pricing']].map(([l,h])=>(
            <a key={l} href={h} style={{color:'var(--text-2)',fontSize:13,fontWeight:500,textDecoration:'none'}}>{l}</a>
          ))}
          <Link href="/login" style={{color:'var(--text-2)',fontSize:13,fontWeight:600,textDecoration:'none'}}>Login</Link>
          <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" rel="noreferrer">
            <button className="btn btn-primary btn-sm">Book a call</button>
          </a>
        </div>
        <div className="mobile-nav-buttons" style={{display:'flex',gap:8,alignItems:'center'}}>
          <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" rel="noreferrer">
            <button className="btn btn-primary btn-sm" style={{fontSize:12,padding:'7px 14px'}}>Book a call</button>
          </a>
          <button onClick={()=>setMenuOpen(o=>!o)} style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6}}>
            {menuOpen ? <span style={{fontSize:20}}>✕</span> : <span style={{fontSize:20}}>☰</span>}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div style={{position:'fixed',top:56,left:0,right:0,background:'var(--bg-2)',borderBottom:'1px solid var(--border)',zIndex:99,padding:'16px 24px',display:'flex',flexDirection:'column',gap:0}}>
          {[['Wovo AI','#wovo-ai'],['WOVO OS','/wovo-os'],['Cinematic Ads','#cin-ads'],['Premium','#premium'],['Pricing','#pricing']].map(([l,h])=>(
            <a key={l} href={h} onClick={()=>setMenuOpen(false)} style={{padding:'13px 0',fontSize:16,fontWeight:600,color:'var(--text)',textDecoration:'none',borderBottom:'0.5px solid var(--border)'}}>{l}</a>
          ))}
          <Link href="/login" onClick={()=>setMenuOpen(false)} style={{padding:'13px 0',fontSize:16,fontWeight:600,color:'var(--accent)',textDecoration:'none'}}>Login →</Link>
        </div>
      )}

      {/* ── HERO — full bleed image ──────────────── */}
      <section style={{position:'relative',height:'92vh',minHeight:520,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
        <img src={IMGS.hero} alt="Wovo Media" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center'}}/>
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom, rgba(8,8,8,0.55) 0%, rgba(8,8,8,0.3) 50%, rgba(8,8,8,0.85) 100%)'}}/>
        <div style={{position:'relative',zIndex:2,textAlign:'center',padding:'0 24px',maxWidth:700}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:10,background:'rgba(0,229,200,0.1)',border:'1px solid rgba(0,229,200,0.3)',borderRadius:40,padding:'6px 18px',marginBottom:24}}>
            {[['11+','Clients'],['100M+','Views'],['24hr','Support']].map(([n,l])=>(
              <div key={n} style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontFamily:'Outfit,sans-serif',fontWeight:700,color:'var(--accent)',fontSize:13}}>{n}</span>
                <span style={{fontSize:11,color:'rgba(255,255,255,0.6)'}}>{l}</span>
              </div>
            ))}
          </div>
          <h1 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(36px,7vw,64px)',fontWeight:800,lineHeight:1.05,marginBottom:16,color:'#fff',letterSpacing:'-0.03em'}}>
            Your business,<br/><span style={{color:'var(--accent)'}}>seen everywhere.</span>
          </h1>
          <p style={{fontSize:'clamp(15px,2vw,18px)',color:'rgba(255,255,255,0.75)',maxWidth:480,margin:'0 auto 32px',lineHeight:1.7}}>
            AI content, cinematic ads, full-service production, and now WOVO OS — your AI employee.
          </p>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
            <a href="#wovo-ai" style={{textDecoration:'none'}}><button className="btn btn-primary" style={{fontSize:15,padding:'13px 28px'}}>See all products →</button></a>
            <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}><button style={{fontSize:15,padding:'12px 24px',background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.25)',color:'#fff',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontWeight:600,backdropFilter:'blur(8px)'}}>Book a free call</button></a>
          </div>
        </div>
      </section>

      {/* ── PRODUCTS GRID ───────────────────────── */}
      <section id="wovo-ai" style={{padding:'80px 24px'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:10}}>Everything you need</div>
            <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(24px,4vw,36px)',fontWeight:800,color:'var(--text)',letterSpacing:'-0.03em'}}>One platform. Total content domination.</h2>
          </div>

          {/* Row 1 — Social Content + WOVO OS */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}} className="grid-2">

            {/* Wovo AI Content */}
            <div className="card" style={{padding:0,overflow:'hidden',display:'flex',flexDirection:'column'}}>
              <div style={{position:'relative',height:220,overflow:'hidden'}}>
                <img src={IMGS.social} alt="AI Content Creation" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(8,8,8,0.9) 0%,rgba(8,8,8,0.2) 60%,transparent 100%)'}}/>
                <div style={{position:'absolute',bottom:16,left:16}}>
                  <span style={{background:'var(--accent)',color:'#080808',fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:20,textTransform:'uppercase',letterSpacing:'0.06em'}}>Wovo AI</span>
                </div>
              </div>
              <div style={{padding:'20px 20px 24px',flex:1,display:'flex',flexDirection:'column'}}>
                <h3 style={{fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'var(--text)',marginBottom:8,letterSpacing:'-0.02em'}}>AI Content Creation</h3>
                <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7,marginBottom:16,flex:1}}>AI characters that post for you. 3–5 pieces of ready-to-copy content per week. AI Video Generator, image ads, website builder — from $29/mo.</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:18}}>
                  {['AI character for your team','3–5 posts/week','AI Video Generator','Website Builder','Image ad generator','Ready-to-copy captions'].map(f=>(
                    <div key={f} style={{display:'flex',gap:6,fontSize:12,color:'var(--text-2)',alignItems:'flex-start'}}><span style={{color:'var(--accent)',flexShrink:0,marginTop:1}}>✓</span>{f}</div>
                  ))}
                </div>
                <a href="#pricing" style={{textDecoration:'none'}}><button className="btn btn-primary" style={{width:'100%',padding:11,fontSize:13}}>See AI plans from $29/mo →</button></a>
              </div>
            </div>

            {/* WOVO OS */}
            <div className="card" style={{padding:0,overflow:'hidden',display:'flex',flexDirection:'column',position:'relative'}}>
              <div style={{position:'absolute',top:12,right:12,zIndex:3,background:'var(--accent)',color:'#080808',fontSize:9,fontWeight:800,padding:'3px 10px',borderRadius:20,textTransform:'uppercase',letterSpacing:'0.08em'}}>New</div>
              <div style={{position:'relative',height:220,overflow:'hidden'}}>
                <video autoPlay muted loop playsInline style={{width:'100%',height:'100%',objectFit:'cover'}}>
                  <source src="https://export-download.canva.com/3pNz8/DAHMIF3pNz8/-1/0-7949359258120738989.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20260609%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260609T081410Z&X-Amz-Expires=65070&X-Amz-Signature=174a9ae7209c09b28b43dc1515ac9cc9340af306ce2d8a5760130971d866b67f&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Wed%2C%2010%20Jun%202026%2002%3A18%3A40%20GMT" type="video/mp4"/>
                  <img src={IMGS.ai} alt="WOVO OS" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                </video>
                <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(8,8,8,0.9) 0%,rgba(8,8,8,0.2) 60%,transparent 100%)'}}/>
                <div style={{position:'absolute',bottom:16,left:16}}>
                  <span style={{background:'rgba(0,229,200,0.15)',border:'1px solid rgba(0,229,200,0.4)',color:'var(--accent)',fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:20,textTransform:'uppercase',letterSpacing:'0.06em'}}>WOVO OS</span>
                </div>
              </div>
              <div style={{padding:'20px 20px 24px',flex:1,display:'flex',flexDirection:'column'}}>
                <h3 style={{fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'var(--text)',marginBottom:8,letterSpacing:'-0.02em'}}>Your AI Employee</h3>
                <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7,marginBottom:16,flex:1}}>Runs on your computer. Manages itself. Phone control. Learns your business deeply — handles emails, social, scheduling. Never acts without your approval.</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:18}}>
                  {['Mac & Windows','Phone management','Learns your business','Always asks permission','Speaks naturally','Never sleeps'].map(f=>(
                    <div key={f} style={{display:'flex',gap:6,fontSize:12,color:'var(--text-2)',alignItems:'flex-start'}}><span style={{color:'var(--accent)',flexShrink:0,marginTop:1}}>✓</span>{f}</div>
                  ))}
                </div>
                <Link href="/wovo-os" style={{textDecoration:'none'}}><button className="btn btn-outline" style={{width:'100%',padding:11,fontSize:13}}>Learn about WOVO OS →</button></Link>
              </div>
            </div>
          </div>

          {/* Row 2 — Cinematic Ads + Premium */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}} className="grid-2">

            {/* Cinematic Ad Videos */}
            <div id="cin-ads" className="card" style={{padding:0,overflow:'hidden',display:'flex',flexDirection:'column'}}>
              <div style={{position:'relative',height:220,overflow:'hidden'}}>
                <img src={IMGS.cinAd} alt="Cinematic Ad Videos" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(8,8,8,0.9) 0%,rgba(8,8,8,0.2) 60%,transparent 100%)'}}/>
                <div style={{position:'absolute',bottom:16,left:16}}>
                  <span style={{background:'rgba(139,92,246,0.2)',border:'1px solid rgba(139,92,246,0.4)',color:'#a78bfa',fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:20,textTransform:'uppercase',letterSpacing:'0.06em'}}>NEW · AI Ad Studio</span>
                </div>
              </div>
              <div style={{padding:'20px 20px 24px',flex:1,display:'flex',flexDirection:'column'}}>
                <h3 style={{fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'var(--text)',marginBottom:8,letterSpacing:'-0.02em'}}>Cinematic Product Ads</h3>
                <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7,marginBottom:16,flex:1}}>Point it at any product. AI finds photos online or uses yours, creates a 30–45 second cinematic ad with voiceover, music, and a "shop now" CTA. Done in minutes.</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:18}}>
                  {['30–45 sec cinematic video','AI voiceover included','Background music','Shop Now CTA','Finds product photos online','4K quality output'].map(f=>(
                    <div key={f} style={{display:'flex',gap:6,fontSize:12,color:'var(--text-2)',alignItems:'flex-start'}}><span style={{color:'#a78bfa',flexShrink:0,marginTop:1}}>✓</span>{f}</div>
                  ))}
                </div>
                <a href="https://pay.wovomedia.com/b/fZu9AT5LZdI76TO6EMcIE1d" style={{textDecoration:'none'}}><button style={{width:'100%',padding:11,fontSize:13,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.3)',color:'#a78bfa',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Create a Cinematic Ad →</button></a>
              </div>
            </div>

            {/* Premium Full Service */}
            <div id="premium" className="card" style={{padding:0,overflow:'hidden',display:'flex',flexDirection:'column'}}>
              <div style={{position:'relative',height:220,overflow:'hidden'}}>
                <img src={IMGS.drone} alt="Premium Production" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(8,8,8,0.9) 0%,rgba(8,8,8,0.2) 60%,transparent 100%)'}}/>
                <div style={{position:'absolute',bottom:16,left:16}}>
                  <span style={{background:'rgba(245,158,11,0.15)',border:'1px solid rgba(245,158,11,0.35)',color:'#f59e0b',fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:20,textTransform:'uppercase',letterSpacing:'0.06em'}}>Premium</span>
                </div>
              </div>
              <div style={{padding:'20px 20px 24px',flex:1,display:'flex',flexDirection:'column'}}>
                <h3 style={{fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'var(--text)',marginBottom:8,letterSpacing:'-0.02em'}}>Full-Service Production</h3>
                <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.7,marginBottom:16,flex:1}}>Real filming, drone, photography, website builds — fully managed by our team in Middle Tennessee and beyond. Custom pricing.</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:18}}>
                  {['On-site filming & drone','Website design & dev','We post for you','Google Business mgmt','Wovo AI at 50% off','Dedicated account manager'].map(f=>(
                    <div key={f} style={{display:'flex',gap:6,fontSize:12,color:'var(--text-2)',alignItems:'flex-start'}}><span style={{color:'#f59e0b',flexShrink:0,marginTop:1}}>✓</span>{f}</div>
                  ))}
                </div>
                <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                  <button style={{width:'100%',padding:11,fontSize:13,background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.25)',color:'#f59e0b',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Book a free strategy call →</button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────── */}
      <section style={{background:'var(--bg-2)',borderTop:'0.5px solid var(--border)',borderBottom:'0.5px solid var(--border)',padding:'32px 24px'}}>
        <div style={{maxWidth:800,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,textAlign:'center'}} className="grid-4">
          {[['11+','Active clients'],['100M+','Combined views'],['4M+','Monthly views (1 client)'],['$29/mo','Starting price']].map(([n,l])=>(
            <div key={l}>
              <div style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(24px,4vw,36px)',fontWeight:800,color:'var(--accent)',letterSpacing:'-0.03em'}}>{n}</div>
              <div style={{fontSize:12,color:'var(--text-3)',marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── WOVO AI PRICING ─────────────────────── */}
      <section id="pricing" style={{padding:'80px 24px'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:48}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:10}}>Wovo AI Plans</div>
            <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(24px,4vw,36px)',fontWeight:800,color:'var(--text)',letterSpacing:'-0.03em',marginBottom:10}}>Start at $29/mo. Cancel anytime.</h2>
            <p style={{color:'var(--text-2)',fontSize:14}}>Pay securely. Account created instantly. Premium clients get Wovo AI at 50% off.</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
            {[
              {name:'Starter',price:'$29',color:'var(--accent)',features:['Your AI character','3 posts/week','Ready-to-copy captions','Posting tutorials'],link:'https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y'},
              {name:'Growth',price:'$49',color:'var(--accent)',popular:true,features:['Whole team characters','5 posts/week','AI Video Generator','Unlimited edits'],link:'https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z'},
              {name:'Pro AI',price:'$79',color:'var(--accent)',features:['Everything in Growth','Daily posts + Stories','Multiple brands','Image ad generator'],link:'https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10'},
              {name:'Website',price:'$99',color:'var(--accent)',features:['Full Next.js site','7+ component files','Tailwind + TypeScript','Deploy-ready'],link:'https://pay.wovomedia.com/b/4gMcN57U7avV0vqbZ6cIE11'},
              {name:'Cinematic Ads',price:'$149',color:'#a78bfa',features:['30–45 sec product ads','AI voiceover + music','Finds product photos','Shop now CTA'],link:'https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10',new:true},
            ].map(p=>(
              <div key={p.name} className={`card ${(p as any).popular?'card-accent':''}`} style={{position:'relative',borderColor:(p as any).new?'rgba(139,92,246,0.3)':''}}>
                {(p as any).popular && <div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'var(--accent)',color:'#080808',fontSize:9,fontWeight:800,padding:'3px 10px',borderRadius:20,whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.06em'}}>Most popular</div>}
                {(p as any).new && <div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'#8b5cf6',color:'#fff',fontSize:9,fontWeight:800,padding:'3px 10px',borderRadius:20,whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.06em'}}>New</div>}
                <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,marginBottom:6}}>{p.name}</div>
                <div style={{fontSize:28,fontWeight:800,fontFamily:'Outfit,sans-serif',color:'var(--text)',marginBottom:14}}>{p.price}<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
                {p.features.map(f=>(
                  <div key={f} style={{fontSize:12,color:'var(--text-2)',padding:'5px 0',borderTop:'0.5px solid var(--border)',display:'flex',gap:7}}>
                    <span style={{color:p.color,flexShrink:0}}>✓</span>{f}
                  </div>
                ))}
                <a href={p.link} target="_blank" rel="noreferrer" style={{display:'block',marginTop:16,textDecoration:'none'}}>
                  <button style={{width:'100%',padding:10,fontSize:12,background:(p as any).popular?'var(--accent)':(p as any).new?'rgba(139,92,246,0.15)':'transparent',border:`1px solid ${(p as any).popular?'var(--accent)':(p as any).new?'rgba(139,92,246,0.4)':'var(--border-2)'}`,color:(p as any).popular?'#080808':(p as any).new?'#a78bfa':'var(--text-2)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Get {p.name} →</button>
                </a>
              </div>
            ))}
          </div>
          {/* Bundle Plans */}
          <div style={{marginTop:24,marginBottom:14}}>
            <div style={{textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:6}}>Bundle & Save</div>
              <h3 style={{fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'var(--text)',marginBottom:4}}>Get more, pay less.</h3>
              <p style={{fontSize:13,color:'var(--text-2)'}}>Add 2 plans → save $10/mo. Get everything → save $15/mo.</p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}} className="grid-2">

              {/* Duo Bundle */}
              <div className="card" style={{background:'linear-gradient(135deg,rgba(0,229,200,0.06),rgba(0,229,200,0.02))',border:'1px solid rgba(0,229,200,0.2)',position:'relative'}}>
                <div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'var(--bg-3)',border:'1px solid var(--accent-border)',color:'var(--accent)',fontSize:9,fontWeight:800,padding:'3px 12px',borderRadius:20,whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.06em'}}>Save $10/mo</div>
                <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,marginBottom:6}}>Duo Bundle — Any 2 Plans</div>
                <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                  <div style={{fontFamily:'Outfit,sans-serif',fontSize:28,fontWeight:800,color:'var(--text)'}}><span style={{fontSize:13,color:'var(--text-3)',fontWeight:400,textDecoration:'line-through',marginRight:6}}>Full price</span>−$10<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
                </div>
                <p style={{fontSize:12,color:'var(--text-2)',marginBottom:14,lineHeight:1.6}}>Pick any 2 Wovo AI plans and get $10 off every month. Mix and match whatever fits your business.</p>
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                  {[['Starter + Growth','$29 + $49 → $68/mo'],['Growth + Cinematic Ads','$49 + $149 → $188/mo'],['Pro AI + Website','$79 + $99 → $168/mo'],['Any combination works','$10 off applied automatically']].map(([a,b])=>(
                    <div key={a} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'5px 0',borderTop:'0.5px solid var(--border)'}}>
                      <span style={{color:'var(--text-2)'}}>{a}</span>
                      <span style={{color:'var(--accent)',fontWeight:600}}>{b}</span>
                    </div>
                  ))}
                </div>
                <a href="https://pay.wovomedia.com/b/8x214n8YbfQf0vq0gocIE1g" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                  <button style={{width:'100%',padding:10,fontSize:13,background:'var(--accent-dim)',border:'1px solid var(--accent-border)',color:'var(--accent)',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>Get Duo Bundle — Save $10/mo →</button>
                </a>
              </div>

              {/* All-In Bundle */}
              <div className="card" style={{background:'linear-gradient(135deg,rgba(139,92,246,0.08),rgba(0,229,200,0.04))',border:'1px solid rgba(139,92,246,0.25)',position:'relative'}}>
                <div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'#8b5cf6',color:'#fff',fontSize:9,fontWeight:800,padding:'3px 12px',borderRadius:20,whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.06em'}}>Best Value · Save $30/mo</div>
                <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,marginBottom:6}}>All-In Bundle — All 5 AI Plans</div>
                <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                  <div style={{fontFamily:'Outfit,sans-serif',fontSize:28,fontWeight:800,color:'var(--text)'}}><span style={{fontSize:13,color:'var(--text-3)',fontWeight:400,textDecoration:'line-through',marginRight:6}}>$375</span>$345<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
                </div>
                <p style={{fontSize:12,color:'var(--text-2)',marginBottom:14,lineHeight:1.6}}>All 5 Wovo AI plans bundled. Does not include WOVO OS (separate product with its own setup). The complete AI content stack.</p>
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                  {[['Starter','$29/mo'],['Growth','$49/mo'],['Pro AI','$79/mo'],['Website Builder','$99/mo'],['Cinematic Ads','$149/mo']].map(([a,b])=>(
                    <div key={a} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'5px 0',borderTop:'0.5px solid var(--border)'}}>
                      <span style={{color:'var(--text-2)'}}>✓ {a}</span>
                      <span style={{color:'var(--text-3)'}}>{b}</span>
                    </div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'8px 0',borderTop:'1px solid rgba(139,92,246,0.3)',fontWeight:700}}>
                    <span style={{color:'#a78bfa'}}>You pay</span>
                    <span style={{color:'#a78bfa'}}>$345/mo (save $30)</span>
                  </div>
                </div>
                <a href="https://pay.wovomedia.com/b/00w9AT1vJbzZguo2owcIE1i" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                  <button style={{width:'100%',padding:10,fontSize:13,background:'rgba(139,92,246,0.15)',border:'1px solid rgba(139,92,246,0.4)',color:'#a78bfa',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>Get All-In Bundle — Save $30/mo →</button>
                </a>
              </div>

            </div>
          </div>

          <div className="card" style={{marginTop:14,textAlign:'center',padding:'14px 20px'}}>
            <p style={{fontSize:13,color:'var(--text-2)',margin:0}}>
              Already have an account? <a href="/login" style={{color:'var(--accent)',fontWeight:600}}>Log in →</a>
              &nbsp;·&nbsp; Questions? <a href="mailto:support@wovomedia.com" style={{color:'var(--accent)'}}>support@wovomedia.com</a>
            </p>
          </div>
        </div>
      </section>

      {/* ── NOVA FLOATING HELP BUTTON ─────────── */}
      <a href="/meet-nova" style={{position:'fixed',bottom:24,right:24,zIndex:999,display:'flex',alignItems:'center',gap:10,background:'var(--accent)',borderRadius:40,padding:'12px 20px 12px 14px',boxShadow:'0 4px 24px rgba(0,229,200,0.35)',textDecoration:'none',animation:'pulse-nova 2.5s ease-in-out infinite'}}>
        <div style={{width:36,height:36,borderRadius:'50%',overflow:'hidden',border:'2px solid rgba(0,0,0,0.15)',flexShrink:0}}>
          <img src="https://v3b.fal.media/files/b/0a9dc045/i1MJb4Rv11UqEM1NlCVX8.jpg" alt="Nova" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:800,color:'#080808',lineHeight:1}}>Nova</div>
          <div style={{fontSize:11,color:'rgba(0,0,0,0.6)',lineHeight:1.3,marginTop:2}}>Help me find a plan</div>
        </div>
      </a>
      <style>{`@keyframes pulse-nova{0%,100%{box-shadow:0 4px 24px rgba(0,229,200,0.35);transform:scale(1)}50%{box-shadow:0 4px 32px rgba(0,229,200,0.6);transform:scale(1.03)}}`}</style>

      {/* ── FOOTER ──────────────────────────────── */}
      <footer style={{borderTop:'1px solid var(--border)',padding:'28px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14}}>
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:16,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>
        <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
          {[['WOVO OS','/wovo-os'],['Wovo AI','/wovo-ai'],['About','/about'],['Privacy','/privacy'],['Terms','/terms'],['Contact','mailto:support@wovomedia.com']].map(([l,h])=>(
            <a key={l} href={h} style={{fontSize:12,color:'var(--text-3)',textDecoration:'none',fontWeight:500}}>{l}</a>
          ))}
        </div>
        <div style={{fontSize:12,color:'var(--text-3)'}}>© {new Date().getFullYear()} Wovo Media LLC</div>
      </footer>
    </div>
  )
}
