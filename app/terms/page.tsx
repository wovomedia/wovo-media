export default function Terms() {
  return (
    <div style={{maxWidth:720,margin:'0 auto',padding:'60px 32px',color:'var(--text-2)',fontFamily:'Inter,sans-serif'}}>
      <a href="/" style={{color:'var(--accent)',textDecoration:'none',fontSize:14}}>← Back to Wovo Media</a>
      <h1 style={{fontFamily:'Syne,sans-serif',fontSize:32,fontWeight:700,color:'var(--text)',margin:'24px 0 8px'}}>Terms of Service</h1>
      <p style={{color:'var(--text-3)',marginBottom:32}}>Last updated: May 2025</p>
      {[
        ['1. Agreement','By creating an account with Wovo Media, you agree to these Terms of Service. These terms govern your use of our platform, services, and AI content tools.'],
        ['2. Services','Wovo Media provides digital marketing services including AI-powered content generation, social media management, video production, and related services. Service availability and pricing may change with notice.'],
        ['3. Payments','Wovo AI subscriptions are billed monthly. Wovo Media Premium is billed according to your agreed custom rate. All payments are non-refundable unless required by law. You may cancel at any time — cancellation takes effect at the end of your billing period.'],
        ['4. Your Content','You retain ownership of content you provide to us. By submitting content, you grant Wovo Media a license to use it to provide our services. We will not sell your content to third parties.'],
        ['5. Acceptable Use','You agree not to use our services for illegal purposes, to spam others, or to violate any applicable laws or regulations.'],
        ['6. Limitation of Liability','Wovo Media is not liable for indirect, incidental, or consequential damages arising from use of our services. Our total liability is limited to the amount you paid us in the last 3 months.'],
        ['7. Contact','Questions? Email support@wovomedia.com or call .'],
      ].map(([h,b])=>(
        <div key={h} style={{marginBottom:28}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:600,color:'var(--text)',marginBottom:8}}>{h}</h2>
          <p style={{lineHeight:1.7,fontSize:15}}>{b}</p>
        </div>
      ))}
    </div>
  )
}
