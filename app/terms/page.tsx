import Link from 'next/link'

export default function Terms() {
  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',position:'relative'}}>
      <div className="grid-bg"/><div className="grid-fade"/>
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 40px',borderBottom:'1px solid var(--border)',background:'var(--nav-bg)',backdropFilter:'blur(14px)',position:'sticky',top:0,zIndex:100}}>
        <Link href="/" style={{fontFamily:'Outfit,sans-serif',fontSize:19,fontWeight:800,color:'var(--text)',textDecoration:'none',letterSpacing:'-0.04em'}}>wovo<span style={{color:'var(--accent)'}}>media</span></Link>
        <Link href="/login"><button className="btn btn-ghost btn-sm">Log In</button></Link>
      </nav>
      <div style={{maxWidth:720,margin:'0 auto',padding:'60px 40px',position:'relative',zIndex:2}}>
        <Link href="/" style={{fontSize:13,color:'var(--accent)',textDecoration:'none',fontWeight:600,display:'inline-flex',alignItems:'center',gap:6,marginBottom:32}}>← Back to Wovo Media</Link>
        <h1 style={{fontSize:36,fontWeight:800,marginBottom:6,letterSpacing:'-0.03em'}}>Terms of Service</h1>
        <p style={{color:'var(--text-3)',marginBottom:44,fontSize:14}}>Last updated: May 2025 · Questions? <a href="mailto:support@wovomedia.com" style={{color:'var(--accent)'}}>support@wovomedia.com</a></p>
        
        {[
          ['1. Acceptance of Terms', 'By creating an account or using Wovo Media\'s services, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services. These terms apply to all users of our platform, including Wovo AI subscribers and Wovo Media Premium clients.'],
          ['2. Description of Services', 'Wovo Media provides digital presence management services including: Wovo AI (AI-powered content generation platform), Wovo Media Premium (full-service production and account management), website design and development, social media management, and related digital marketing services.'],
          ['3. Accounts and Registration', 'You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. Wovo Media accounts are for individual business use. You may not share accounts or transfer them to third parties without our written consent.'],
          ['4. Payment and Billing', 'Wovo AI subscriptions are billed monthly in advance. Wovo Media Premium is billed according to your agreed custom rate. All payments are processed securely through Stripe. Fees are non-refundable unless required by applicable law. You may cancel your subscription at any time — cancellation takes effect at the end of your current billing period.'],
          ['5. Cancellation Policy', 'You may cancel your Wovo AI subscription at any time through your account settings or by emailing support@wovomedia.com. Wovo Media Premium contracts may have specific cancellation terms outlined in your service agreement. No partial refunds are provided for unused time in a billing period.'],
          ['6. Intellectual Property', 'Content generated through Wovo AI for your business is owned by you upon creation. Wovo Media retains rights to its platform, technology, and proprietary systems. You grant Wovo Media a limited license to use your business information solely to provide the services you\'ve subscribed to.'],
          ['7. Acceptable Use', 'You agree not to use our services for illegal purposes, to violate any applicable laws, to infringe on the rights of others, to distribute spam or unsolicited communications, or to attempt to disrupt or harm our platform or other users.'],
          ['8. Limitation of Liability', 'To the maximum extent permitted by law, Wovo Media\'s total liability for any claims arising from these terms or your use of our services shall not exceed the amount you paid us in the three months preceding the claim. We are not liable for indirect, incidental, special, or consequential damages.'],
          ['9. Modifications to Terms', 'We may update these terms from time to time. We will notify you of significant changes via email. Continued use of our services after changes take effect constitutes acceptance of the updated terms.'],
          ['10. Governing Law', 'These terms are governed by the laws of the State of Tennessee, without regard to conflict of law provisions. Any disputes shall be resolved in the courts of Maury County, Tennessee.'],
          ['11. Contact', 'For questions about these terms, contact us at support@wovomedia.com.'],
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
