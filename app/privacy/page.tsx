import Link from 'next/link'

export default function Privacy() {
  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 40px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100}}>
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:19,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>wovo<span style={{color:'var(--accent)'}}>media</span></Link>
        <Link href="/login"><button className="btn btn-ghost btn-sm">Log In</button></Link>
      </nav>
      <div style={{maxWidth:720,margin:'0 auto',padding:'60px 40px',position:'relative',zIndex:2}}>
        <Link href="/" style={{fontSize:13,color:'var(--accent)',textDecoration:'none',fontWeight:600,display:'inline-flex',alignItems:'center',gap:6,marginBottom:32}}>← Back to Wovo Media</Link>
        <h1 style={{fontSize:36,fontWeight:800,marginBottom:6,letterSpacing:'-0.03em'}}>Privacy Policy</h1>
        <p style={{color:'var(--text-3)',marginBottom:44,fontSize:14}}>Last updated: May 2025 · Questions? <a href="mailto:support@wovomedia.com" style={{color:'var(--accent)'}}>support@wovomedia.com</a></p>

        {[
          ['Information We Collect', 'We collect information you provide directly, including your name, email address, business name, and payment information. We also collect usage data such as pages visited, features used, and content generated through our platform. We do not collect sensitive personal information beyond what is necessary to provide our services.'],
          ['How We Use Your Information', 'We use your information to: provide and improve our services, process payments, send account-related communications, send marketing communications (you can opt out at any time), generate AI content personalized to your business, and comply with legal obligations.'],
          ['Information Sharing', 'We share your information only with trusted service providers necessary to operate our platform: Stripe (payment processing), Supabase (secure database storage), Resend (email delivery), and our secure AI video and content infrastructure. We do not sell your personal information to third parties. We do not share your information with advertisers.'],
          ['Data Storage and Security', 'Your data is stored securely on servers provided by Supabase with industry-standard encryption. We implement appropriate technical and organizational measures to protect your information against unauthorized access, alteration, or destruction. However, no method of transmission over the internet is 100% secure.'],
          ['Your Rights', 'You have the right to: access the personal information we hold about you, request correction of inaccurate data, request deletion of your data, opt out of marketing communications at any time, and data portability (receive your data in a machine-readable format). To exercise these rights, email support@wovomedia.com.'],
          ['Cookies', 'We use cookies and similar technologies to maintain your login session and remember your preferences (such as light/dark mode). We do not use third-party advertising cookies or tracking pixels. You can control cookies through your browser settings.'],
          ['Data Retention', 'We retain your account data for as long as your account is active. If you close your account, we will delete your personal data within 30 days, except where we are required to retain it for legal or financial compliance purposes.'],
          ['Children\'s Privacy', 'Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If you believe we have inadvertently collected information from a minor, contact us immediately at support@wovomedia.com.'],
          ['Changes to This Policy', 'We may update this privacy policy from time to time. We will notify you of significant changes via email or a prominent notice on our website. Your continued use of our services after changes take effect constitutes acceptance of the updated policy.'],
          ['Contact Us', 'If you have questions about this privacy policy or how we handle your data, please contact our team at support@wovomedia.com. We aim to respond to all privacy inquiries within 48 hours.'],
        ].map(([title, body]) => (
          <div key={title} style={{marginBottom:36}}>
            <h2 style={{fontSize:17,fontWeight:700,color:'var(--text)',marginBottom:10}}>{title}</h2>
            <p style={{fontSize:15,color:'var(--text-2)',lineHeight:1.75,margin:0}}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
