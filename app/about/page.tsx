import Link from 'next/link'

export default function About() {
  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 40px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100}}>
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:19,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>wovo<span style={{color:'var(--accent)'}}>media</span></Link>
        <Link href="/login"><button className="btn btn-ghost btn-sm">Log In</button></Link>
      </nav>
      <div style={{maxWidth:720,margin:'0 auto',padding:'60px 40px',position:'relative',zIndex:2}}>
        <Link href="/" style={{fontSize:13,color:'var(--accent)',textDecoration:'none',fontWeight:600,display:'inline-flex',alignItems:'center',gap:6,marginBottom:32}}>← Back to Wovo Media</Link>

        <div style={{marginBottom:56}}>
          <span className="tag" style={{marginBottom:20,display:'inline-block'}}>About Us</span>
          <h1 style={{fontSize:40,fontWeight:800,lineHeight:1.1,marginBottom:16,letterSpacing:'-0.03em'}}>
            Built for local businesses.<br/><span style={{color:'var(--accent)'}}>Proven results.</span>
          </h1>
          <p style={{fontSize:16,color:'var(--text-2)',lineHeight:1.75,maxWidth:560}}>
            Wovo Media is a digital presence management agency based in Middle Tennessee. We help local businesses grow their online presence through AI-powered content tools and full-service production — at every budget level.
          </p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14,marginBottom:56}}>
          {[['11+','Active clients managed'],['100M+','Combined views & engagements'],['2024','Year founded'],['Middle Tennessee','Primary service area']].map(([n,l])=>(
            <div key={n} className="stat-card">
              <div className="stat-num">{n}</div>
              <div className="stat-label" style={{marginTop:6}}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{marginBottom:48}}>
          <h2 style={{fontSize:24,fontWeight:700,marginBottom:20}}>Our services</h2>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[
              ['Wovo AI','AI-powered content platform. Custom AI characters, weekly posts, captions — no filming needed. Starting at $29/mo.'],
              ['Wovo Media Premium','Full-service production. On-site filming, drone footage, photography, website builds, and full account management. Custom pricing.'],
              ['Website Design','Professional websites built for local businesses. Desktop and mobile optimized.'],
              ['Social Media Management','We manage your accounts end-to-end — content, posting, engagement, and growth strategy.'],
              ['Google Business Profile','Setup, optimization, and ongoing management of your Google Business Profile.'],
            ].map(([title, desc]) => (
              <div key={title} className="card" style={{padding:'20px 24px'}}>
                <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:5}}>{title}</div>
                <div style={{fontSize:14,color:'var(--text-2)',lineHeight:1.6}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{marginBottom:48}}>
          <h2 style={{fontSize:24,fontWeight:700,marginBottom:20}}>Leadership</h2>
          <div className="card card-accent" style={{display:'flex',gap:20,alignItems:'flex-start'}}>
            <div style={{width:60,height:60,borderRadius:'50%',background:'var(--accent-dim)',border:'2px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:'var(--accent)',fontFamily:'Outfit,sans-serif',flexShrink:0}}>PC</div>
            <div>
              <h3 style={{fontSize:18,fontWeight:700,marginBottom:4}}>Payton Cody</h3>
              <div style={{fontSize:13,color:'var(--accent)',fontWeight:600,marginBottom:10}}>Founder &amp; CEO</div>
              <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.7,marginBottom:12}}>Payton founded Wovo Media with the belief that every local business deserves a professional online presence. Based in Middle Tennessee, Payton personally oversees every Premium account and leads the development of the Wovo AI platform.</p>
              <a href="mailto:Payton@wovomedia.com" style={{fontSize:13,color:'var(--accent)',textDecoration:'none',fontWeight:600}}>Payton@wovomedia.com</a>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{fontSize:16,fontWeight:700,marginBottom:8}}>Get in touch</h3>
          <p style={{fontSize:14,color:'var(--text-2)',marginBottom:16,lineHeight:1.6}}>For general inquiries, support, or to learn more about our services, reach our team at any time.</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <a href="mailto:support@wovomedia.com" style={{textDecoration:'none'}}><button className="btn btn-primary btn-sm">support@wovomedia.com</button></a>
            <a href="https://calendly.com/wovomedia/wovo-media-premium-strategy-call" target="_blank" style={{textDecoration:'none'}}><button className="btn btn-ghost btn-sm">Book a Strategy Call</button></a>
          </div>
        </div>
      </div>
    </div>
  )
}
