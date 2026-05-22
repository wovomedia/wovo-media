export default function Privacy() {
  return (
    <div style={{maxWidth:720,margin:'0 auto',padding:'60px 32px',color:'var(--text-2)',fontFamily:'Inter,sans-serif'}}>
      <a href="/" style={{color:'var(--accent)',textDecoration:'none',fontSize:14}}>← Back to Wovo Media</a>
      <h1 style={{fontFamily:'Syne,sans-serif',fontSize:32,fontWeight:700,color:'var(--text)',margin:'24px 0 8px'}}>Privacy Policy</h1>
      <p style={{color:'var(--text-3)',marginBottom:32}}>Last updated: May 2025</p>
      {[
        ['What we collect','We collect your name, email address, business name, and usage data when you create an account or use our services. We may also collect billing information through our payment processor, Stripe.'],
        ['How we use it','We use your information to provide our services, send account-related emails, and improve our platform. We may contact you about your account, new features, or relevant updates.'],
        ['Who we share it with','We share your data with Stripe (payments), Supabase (database), and Resend (email). We do not sell your personal information to third parties.'],
        ['Your rights','You can request to view, update, or delete your data at any time by emailing support@wovomedia.com. You can unsubscribe from marketing emails at any time.'],
        ['Security','We use industry-standard encryption and security practices to protect your data. However, no method of transmission over the internet is 100% secure.'],
        ['Contact','Questions about privacy? Email support@wovomedia.com.'],
      ].map(([h,b])=>(
        <div key={h} style={{marginBottom:28}}>
          <h2 style={{fontFamily:'Syne,sans-serif',fontSize:18,fontWeight:600,color:'var(--text)',marginBottom:8}}>{h}</h2>
          <p style={{lineHeight:1.7,fontSize:15}}>{b}</p>
        </div>
      ))}
    </div>
  )
}
