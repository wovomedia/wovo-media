'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)

  const NAV = [
    { label: 'Wovo AI', href: '#wovo-ai' },
    { label: 'WOVO OS', href: '/wovo-os' },
    { label: 'Premium', href: '#premium' },
    { label: 'Pricing', href: '#pricing' },
  ]

  return (
    <div style={{background:'var(--bg)',minHeight:'100vh',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav style={{position:'sticky',top:0,zIndex:100,borderBottom:'0.5px solid var(--border)',background:'rgba(8,8,8,0.95)',backdropFilter:'blur(16px)',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:20,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>
          wovo<span style={{color:'var(--accent)'}}>media</span>
        </Link>

        {/* Desktop nav */}
        <div className="desktop-nav" style={{display:'flex',alignItems:'center',gap:28}}>
          {NAV.map(n=>(
            <a key={n.label} href={n.href} style={{color:'var(--text-2)',fontSize:13,fontWeight:500,textDecoration:'none',transition:'color 0.15s'}}
              onMouseEnter={e=>(e.target as HTMLElement).style.color='var(--text)'}
              onMouseLeave={e=>(e.target as HTMLElement).style.color='var(--text-2)'}>{n.label}</a>
          ))}
          <Link href="/login" style={{color:'var(--text-2)',fontSize:13,fontWeight:600,textDecoration:'none'}}>Login</Link>
          <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer">
            <button className="btn btn-primary btn-sm">Book a call</button>
          </a>
        </div>

        {/* Mobile nav */}
        <div className="mobile-nav-buttons" style={{display:'flex',gap:8,alignItems:'center'}}>
          <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer">
            <button className="btn btn-primary btn-sm" style={{fontSize:12,padding:'7px 14px'}}>Book a call</button>
          </a>
          <button onClick={()=>setMenuOpen(o=>!o)} style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:6,display:'flex',flexDirection:'column',gap:4}}>
            {menuOpen ? <span style={{fontSize:20,lineHeight:1}}>✕</span> : <>
              <span style={{display:'block',width:20,height:2,background:'var(--text)',borderRadius:2}}/>
              <span style={{display:'block',width:20,height:2,background:'var(--text)',borderRadius:2}}/>
              <span style={{display:'block',width:14,height:2,background:'var(--text)',borderRadius:2}}/>
            </>}
          </button>
        </div>
      </nav>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div style={{position:'fixed',top:56,left:0,right:0,background:'var(--bg-2)',borderBottom:'1px solid var(--border)',zIndex:99,padding:'16px 24px',display:'flex',flexDirection:'column',gap:2}}>
          {NAV.map(n=>(
            <a key={n.label} href={n.href} onClick={()=>setMenuOpen(false)} style={{padding:'12px 0',fontSize:16,fontWeight:600,color:'var(--text)',textDecoration:'none',borderBottom:'0.5px solid var(--border)'}}>{n.label}</a>
          ))}
          <Link href="/login" onClick={()=>setMenuOpen(false)} style={{padding:'12px 0',fontSize:16,fontWeight:600,color:'var(--accent)',textDecoration:'none'}}>Login →</Link>
        </div>
      )}

      <div style={{position:'relative',zIndex:2}}>

        {/* ── HERO ─────────────────────────────────────── */}
        <section style={{maxWidth:860,margin:'0 auto',padding:'80px 24px 60px'}}>
          <div className="fade-up" style={{display:'inline-flex',alignItems:'center',gap:16,background:'var(--bg-2)',border:'1px solid var(--accent-border)',borderRadius:40,padding:'6px 16px',marginBottom:24,boxShadow:'var(--shadow)'}}>
            {[['11+','Clients'],['100M+','Views'],['24hr','Response']].map(([n,l])=>(
              <div key={n} style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontFamily:'Outfit,sans-serif',fontWeight:700,color:'var(--accent)',fontSize:13}}>{n}</span>
                <span style={{fontSize:11,color:'var(--text-3)'}}>{l}</span>
              </div>
            ))}
          </div>

          <h1 className="fade-up d1" style={{fontSize:'clamp(38px,7vw,62px)',fontWeight:800,lineHeight:1.05,marginBottom:18,color:'var(--text)',fontFamily:'Outfit,sans-serif',letterSpacing:'-0.03em'}}>
            Your business,<br/><span style={{color:'var(--accent)'}}>seen everywhere.</span>
          </h1>
          <p className="fade-up d2" style={{fontSize:'clamp(15px,2vw,17px)',color:'var(--text-2)',maxWidth:480,lineHeight:1.7,marginBottom:32}}>
            AI content from $29/mo. Full-service production with a real team. Now with WOVO OS — your AI employee.
          </p>
          <div className="fade-up d3" style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <a href="#wovo-ai" style={{textDecoration:'none'}}><button className="btn btn-primary" style={{fontSize:14,padding:'12px 26px'}}>See plans →</button></a>
            <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}><button className="btn btn-outline" style={{fontSize:14,padding:'11px 24px'}}>Book a free call</button></a>
          </div>
        </section>

        {/* ── PRODUCTS ─────────────────────────────────── */}
        <section style={{borderTop:'0.5px solid var(--border)',padding:'60px 24px'}}>
          <div style={{maxWidth:860,margin:'0 auto'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>Products</div>
            <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(22px,4vw,30px)',fontWeight:700,marginBottom:32,color:'var(--text)'}}>Everything your business needs to grow online.</h2>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:14}}>

              {/* Wovo AI */}
              <div className="card card-accent" style={{display:'flex',flexDirection:'column'}}>
                <div style={{fontSize:11,color:'var(--accent)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Wovo AI</div>
                <h3 style={{fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:6,fontFamily:'Outfit,sans-serif'}}>AI-powered content</h3>
                <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.65,marginBottom:16,flex:1}}>AI characters that post for you. 3–5 pieces of content per week, ready-to-copy captions, video generation — starting at $29/mo.</p>
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:20}}>
                  {['AI character for you or your whole team','3–5 posts/week, ready to copy','AI Video Generator (Growth+)','Website Builder ($99/mo)'].map(f=>(
                    <div key={f} style={{display:'flex',gap:8,fontSize:12,color:'var(--text-2)'}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>
                  ))}
                </div>
                <a href="#wovo-ai" style={{textDecoration:'none'}}><button className="btn btn-primary" style={{width:'100%',padding:11,fontSize:13}}>See AI plans</button></a>
              </div>

              {/* WOVO OS */}
              <div className="card" style={{display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',top:12,right:12,background:'var(--accent)',color:'#080808',fontSize:9,fontWeight:800,padding:'3px 10px',borderRadius:20,textTransform:'uppercase',letterSpacing:'0.08em'}}>New</div>
                <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>WOVO OS</div>
                <h3 style={{fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:6,fontFamily:'Outfit,sans-serif'}}>Your AI employee</h3>
                <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.65,marginBottom:16,flex:1}}>Runs on your computer. Learns your business. Managed from your phone. Like having a full-time employee that never sleeps — starting at $850 setup + $350/mo.</p>
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:20}}>
                  {['Lives on your Mac or Windows PC','Managed from your phone','Learns your business deeply','Ask permission before every action'].map(f=>(
                    <div key={f} style={{display:'flex',gap:8,fontSize:12,color:'var(--text-2)'}}><span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}</div>
                  ))}
                </div>
                <Link href="/wovo-os" style={{textDecoration:'none'}}><button className="btn btn-outline" style={{width:'100%',padding:11,fontSize:13}}>Learn about WOVO OS</button></Link>
              </div>

              {/* Wovo Media Premium */}
              <div className="card" style={{display:'flex',flexDirection:'column'}}>
                <div style={{fontSize:11,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Wovo Media Premium</div>
                <h3 style={{fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:6,fontFamily:'Outfit,sans-serif'}}>Full-service production</h3>
                <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.65,marginBottom:16,flex:1}}>Real filming, drone, photography, website builds — fully managed by our team. Custom pricing.</p>
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:20}}>
                  {['On-site filming, drone & photography','Website design & development','We post for you — full admin access','Google Business Profile management'].map(f=>(
                    <div key={f} style={{display:'flex',gap:8,fontSize:12,color:'var(--text-2)'}}><span style={{color:'var(--text-3)',flexShrink:0}}>✓</span>{f}</div>
                  ))}
                </div>
                <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}><button className="btn btn-outline" style={{width:'100%',padding:11,fontSize:13}}>Book a call</button></a>
              </div>

            </div>
          </div>
        </section>

        {/* ── WOVO AI PRICING ──────────────────────────── */}
        <section id="wovo-ai" style={{borderTop:'0.5px solid var(--border)',padding:'60px 24px'}}>
          <div style={{maxWidth:860,margin:'0 auto'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>Wovo AI Plans</div>
            <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(22px,4vw,30px)',fontWeight:700,marginBottom:8,color:'var(--text)'}}>Start at $29/mo. Cancel anytime.</h2>
            <p style={{color:'var(--text-2)',marginBottom:32,fontSize:14}}>Pay on Stripe. Account created automatically. Premium clients get Wovo AI at a discount.</p>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}} id="pricing">
              {[
                {name:'Starter',price:'$29',features:['Your AI character','3 posts/week','Ready-to-copy captions','Posting tutorials'],link:'https://pay.wovomedia.com/b/7sY6oH3DRdI71zu0gocIE0Y'},
                {name:'Growth',price:'$49',popular:true,features:['Whole team characters','5 posts/week','AI Video Generator','Unlimited edits'],link:'https://pay.wovomedia.com/b/fZu6oH6Q3fQf3HC0gocIE0Z'},
                {name:'Pro AI',price:'$79',features:['Everything in Growth','Daily posts + Stories','Multiple brands','Image ad generator'],link:'https://pay.wovomedia.com/b/aFafZhfmzfQf1zu2owcIE10'},
                {name:'Website',price:'$99',features:['Full Next.js site','7+ component files','Tailwind + TypeScript','Ready to deploy'],link:'https://pay.wovomedia.com/b/4gMcN57U7avV0vqbZ6cIE11'},
              ].map(p=>(
                <div key={p.name} className={`card ${(p as any).popular?'card-accent':''}`} style={{position:'relative'}}>
                  {(p as any).popular && <div style={{position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',background:'var(--accent)',color:'#080808',fontSize:9,fontWeight:800,padding:'3px 10px',borderRadius:20,whiteSpace:'nowrap',textTransform:'uppercase',letterSpacing:'0.06em'}}>Most popular</div>}
                  <div style={{fontSize:11,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,marginBottom:6}}>{p.name}</div>
                  <div style={{fontSize:28,fontWeight:800,fontFamily:'Outfit,sans-serif',color:'var(--text)',marginBottom:14}}>{p.price}<span style={{fontSize:13,color:'var(--text-3)',fontWeight:400}}>/mo</span></div>
                  {p.features.map(f=>(
                    <div key={f} style={{fontSize:12,color:'var(--text-2)',padding:'5px 0',borderTop:'0.5px solid var(--border)',display:'flex',gap:7}}>
                      <span style={{color:'var(--accent)',flexShrink:0}}>✓</span>{f}
                    </div>
                  ))}
                  <a href={p.link} target="_blank" rel="noreferrer" style={{display:'block',marginTop:16,textDecoration:'none'}}>
                    <button className={`btn ${(p as any).popular?'btn-primary':'btn-outline'}`} style={{width:'100%',padding:10,fontSize:12}}>Get {p.name} →</button>
                  </a>
                </div>
              ))}
            </div>

            <div className="card" style={{marginTop:14,textAlign:'center',padding:'14px 20px'}}>
              <p style={{fontSize:13,color:'var(--text-2)',margin:0}}>
                Already have an account? <a href="/login" style={{color:'var(--accent)',fontWeight:600}}>Log in →</a>
                &nbsp;·&nbsp; Questions? <a href="mailto:support@wovomedia.com" style={{color:'var(--accent)'}}>support@wovomedia.com</a>
              </p>
            </div>
          </div>
        </section>

        {/* ── WOVO OS PREVIEW ──────────────────────────── */}
        <section style={{borderTop:'0.5px solid var(--border)',padding:'60px 24px',background:'var(--bg-2)'}}>
          <div style={{maxWidth:860,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'center'}} className="grid-2">
            <div>
              <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'var(--accent-dim)',border:'1px solid var(--accent-border)',borderRadius:20,padding:'5px 14px',marginBottom:20}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:'var(--accent)',boxShadow:'0 0 8px var(--accent)'}}/>
                <span style={{fontSize:12,fontWeight:700,color:'var(--accent)'}}>New Product</span>
              </div>
              <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(24px,4vw,34px)',fontWeight:800,marginBottom:12,color:'var(--text)',lineHeight:1.1,letterSpacing:'-0.03em'}}>
                Meet WOVO OS.<br/><span style={{color:'var(--accent)'}}>Your AI employee.</span>
              </h2>
              <p style={{fontSize:15,color:'var(--text-2)',lineHeight:1.7,marginBottom:24}}>
                Runs on their computer. Learns their business. They manage it from their phone like a boss. It never acts without permission — but it never sleeps either.
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:28}}>
                {[
                  ['🖥️','Lives on their Mac or Windows computer'],
                  ['📱','Managed entirely from their phone'],
                  ['🧠','Learns the business — customers, tone, schedule'],
                  ['✋','Asks permission before every consequential action'],
                  ['💬','Speaks naturally, reads the room'],
                ].map(([icon,text])=>(
                  <div key={text as string} style={{display:'flex',alignItems:'center',gap:12,fontSize:14,color:'var(--text-2)'}}>
                    <span style={{fontSize:18}}>{icon}</span>{text}
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                <Link href="/wovo-os" style={{textDecoration:'none'}}><button className="btn btn-primary" style={{padding:'12px 24px',fontSize:14}}>Learn more →</button></Link>
                <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}><button className="btn btn-outline" style={{padding:'11px 22px',fontSize:14}}>Book a demo</button></a>
              </div>
            </div>

            <div style={{background:'var(--bg-3)',borderRadius:16,border:'1px solid var(--border)',padding:24,fontFamily:'monospace'}}>
              <div style={{display:'flex',gap:6,marginBottom:16}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:'#ef4444'}}/>
                <div style={{width:10,height:10,borderRadius:'50%',background:'#f59e0b'}}/>
                <div style={{width:10,height:10,borderRadius:'50%',background:'#22c55e'}}/>
                <span style={{fontSize:11,color:'var(--text-3)',marginLeft:8}}>WOVO OS — Running</span>
              </div>
              {[
                {role:'wovo',msg:'Good morning. I found 3 unread DMs and one Google review that needs a response. Want me to draft replies?'},
                {role:'user',msg:'Yes, draft the review response.'},
                {role:'wovo',msg:'Done. Here\'s what I wrote: "Thank you so much for the kind words! We love having you..." — approve to post?'},
                {role:'user',msg:'Approved.'},
                {role:'wovo',msg:'✓ Posted to Google. I also noticed your Tuesday post has 47 comments — shall I respond to the top ones?'},
              ].map((m,i)=>(
                <div key={i} style={{marginBottom:10,display:'flex',flexDirection:'column',alignItems:m.role==='user'?'flex-end':'flex-start'}}>
                  <div style={{fontSize:9,color:'var(--text-3)',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.08em'}}>{m.role==='wovo'?'WOVO OS':'You'}</div>
                  <div style={{background:m.role==='wovo'?'var(--bg-4)':'var(--accent)',color:m.role==='wovo'?'var(--text-2)':'#080808',borderRadius:10,padding:'8px 12px',fontSize:11,maxWidth:'85%',lineHeight:1.5}}>{m.msg}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ────────────────────────────────────── */}
        <section style={{borderTop:'0.5px solid var(--border)',padding:'60px 24px'}}>
          <div style={{maxWidth:860,margin:'0 auto',textAlign:'center'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>Proven results</div>
            <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(22px,4vw,30px)',fontWeight:700,marginBottom:32,color:'var(--text)'}}>Real businesses. Real numbers.</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
              {[['11+','Active clients'],['100M+','Combined views'],['4M+','Monthly views, one client'],['24hr','Response time']].map(([n,l])=>(
                <div key={l} className="card" style={{textAlign:'center',padding:'20px 16px'}}>
                  <div style={{fontFamily:'Outfit,sans-serif',fontSize:32,fontWeight:800,color:'var(--accent)',letterSpacing:'-0.03em'}}>{n}</div>
                  <div style={{fontSize:12,color:'var(--text-3)',marginTop:6,lineHeight:1.4}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PREMIUM ──────────────────────────────────── */}
        <section id="premium" style={{borderTop:'0.5px solid var(--border)',padding:'60px 24px',textAlign:'center'}}>
          <div style={{maxWidth:560,margin:'0 auto'}}>
            <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>Wovo Media Premium</div>
            <h2 style={{fontFamily:'Outfit,sans-serif',fontSize:'clamp(22px,4vw,30px)',fontWeight:700,marginBottom:12,color:'var(--text)'}}>Ready for the full package?</h2>
            <p style={{color:'var(--text-2)',lineHeight:1.7,marginBottom:32,fontSize:14}}>On-site filming, drone, website builds, Google Business management — fully handled by our team. Wovo AI included at a discount.</p>
            <a href="https://calendly.com/wovomedia/wovo-media-strategy-call" target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
              <button className="btn btn-primary" style={{fontSize:15,padding:'14px 32px'}}>Book a free strategy call →</button>
            </a>
            <p style={{fontSize:12,color:'var(--text-3)',marginTop:12}}>No commitment · Mon–Fri 9am–5pm CT</p>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────── */}
        <footer style={{borderTop:'1px solid var(--border)',padding:'28px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14}}>
          <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:16,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>
            wovo<span style={{color:'var(--accent)'}}>media</span>
          </Link>
          <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
            {[['WOVO OS','/wovo-os'],['About','/about'],['Privacy','/privacy'],['Terms','/terms'],['Contact','mailto:support@wovomedia.com']].map(([l,h])=>(
              <a key={l} href={h} style={{fontSize:12,color:'var(--text-3)',textDecoration:'none',fontWeight:500}}>{l}</a>
            ))}
          </div>
          <div style={{fontSize:12,color:'var(--text-3)'}}>© {new Date().getFullYear()} Wovo Media</div>
        </footer>

      </div>
    </div>
  )
}
