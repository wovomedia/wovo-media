import Link from 'next/link'

export default function About() {
  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 40px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100}}>
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:19,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>wovo<span style={{color:'var(--accent)'}}>media</span></Link>
        <Link href="/login"><button className="btn btn-primary btn-sm">Log In</button></Link>
      </nav>
      <div style={{maxWidth:680,margin:'0 auto',padding:'72px 40px',position:'relative',zIndex:2}}>
        <div className="tag" style={{marginBottom:20}}>About Wovo Media</div>
        <h1 style={{fontSize:40,fontWeight:800,marginBottom:16,letterSpacing:'-0.03em'}}>Built by a founder,<br/><span style={{color:'var(--accent)'}}>for founders.</span></h1>
        <p style={{fontSize:16,color:'var(--text-2)',lineHeight:1.75,marginBottom:48}}>Wovo Media is a digital presence management agency based in Middle Tennessee. We help local businesses grow their online presence through AI-powered content and full-service production.</p>

        <div className="card card-accent" style={{marginBottom:32,display:'flex',gap:24,alignItems:'flex-start'}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:'var(--accent-dim)',border:'2px solid var(--accent-border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:700,color:'var(--accent)',fontFamily:'Outfit,sans-serif',flexShrink:0}}>PC</div>
          <div>
            <h2 style={{fontSize:20,fontWeight:700,marginBottom:4}}>Payton Cody</h2>
            <div style={{fontSize:13,color:'var(--accent)',fontWeight:600,marginBottom:10}}>Founder & CEO, Wovo Media</div>
            <p style={{fontSize:14,color:'var(--text-2)',lineHeight:1.7,marginBottom:14}}>Payton started Wovo Media with a simple belief: every local business deserves a professional online presence, regardless of budget. Based in Middle Tennessee, Payton personally manages every Premium account and oversees the Wovo AI platform.</p>
            <a href="mailto:Payton@wovomedia.com" style={{fontSize:13,color:'var(--accent)',textDecoration:'none',fontWeight:600}}>Payton@wovomedia.com</a>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:40}}>
          {[['11+','Active clients managed'],['100M+','Combined views & engagements'],['Middle Tennessee','Primary service area'],['2024','Founded']].map(([n,l])=>(
            <div key={n} className="stat-card">
              <div className="stat-num">{n}</div>
              <div className="stat-label">{l}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{fontSize:16,fontWeight:700,marginBottom:8}}>General Inquiries</h3>
          <p style={{fontSize:14,color:'var(--text-2)',marginBottom:14,lineHeight:1.6}}>For questions about plans, services, or your account, reach our support team.</p>
          <a href="mailto:support@wovomedia.com" style={{color:'var(--accent)',textDecoration:'none',fontWeight:600,fontSize:15}}>support@wovomedia.com</a>
        </div>
      </div>
    </div>
  )
}
