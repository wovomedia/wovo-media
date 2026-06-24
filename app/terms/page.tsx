export default function Terms() {
  return (
    <div style={{ background: '#080808', color: '#f2f2f2', fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#00E5C8', textDecoration: 'none', display: 'inline-block', marginBottom: 40 }}>← Back to wovomedia.com</a>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 48 }}>Last updated: June 2025</p>

        {[
          {
            title: '1. Agreement to Terms',
            body: `By engaging Wovo Media for any services, submitting an inquiry form, signing a service agreement, or making any payment to Wovo Media, you agree to be bound by these Terms of Service. If you do not agree, do not use our services.`,
          },
          {
            title: '2. Services',
            body: `Wovo Media provides digital marketing services including but not limited to social media management, video production, photography, drone footage, website design and development, Google Business Profile management, UGC content creation, and related services. The specific services provided to you are defined by the tier or agreement you select at the time of engagement.`,
          },
          {
            title: '3. Payment',
            body: `All services are billed monthly in advance. Payment is due on your billing anniversary date. Wovo Media reserves the right to suspend or terminate services if payment is not received within 7 days of the due date. All prices are listed in US dollars. We reserve the right to change pricing with 30 days' written notice to existing clients.`,
          },
          {
            title: '4. Client Responsibilities',
            body: `You agree to provide Wovo Media with timely access to any accounts, assets, credentials, or approvals necessary to deliver your services. Delays caused by failure to provide required access or approvals are not the responsibility of Wovo Media and do not entitle you to refunds or service credits.`,
          },
          {
            title: '5. Content Ownership',
            body: `Upon full payment for services, you own the final delivered content created specifically for your business. Wovo Media retains the right to use any created content in its portfolio, case studies, website, and marketing materials unless you notify us in writing that you wish to opt out of this usage.`,
          },
          {
            title: '6. Cancellation',
            body: `Please see our Cancellation Policy at wovomedia.com/cancellation-policy for full details. Services continue and billing continues until a valid cancellation request is received by Wovo Media via email or phone call confirmation.`,
          },
          {
            title: '7. Limitation of Liability',
            body: `Wovo Media's liability to you for any claim arising from our services is limited to the amount you paid us in the 30 days prior to the claim. We are not liable for any indirect, incidental, special, or consequential damages, including lost profits or business opportunities, even if advised of the possibility of such damages.`,
          },
          {
            title: '8. No Guarantee of Results',
            body: `Wovo Media provides professional marketing services but makes no guarantee of specific outcomes, including follower growth, engagement rates, sales conversions, or revenue results. Marketing results vary by industry, market conditions, and many factors outside our control.`,
          },
          {
            title: '9. Governing Law',
            body: `These Terms are governed by the laws of the State of Tennessee, without regard to its conflict of law provisions. Any disputes arising from these Terms or your use of Wovo Media services shall be resolved in the courts located in Williamson County, Tennessee.`,
          },
          {
            title: '10. Changes to Terms',
            body: `Wovo Media reserves the right to update these Terms at any time. We will notify active clients of material changes via email. Continued use of our services after notice constitutes acceptance of the updated Terms.`,
          },
          {
            title: '11. Contact',
            body: `Email: support@wovomedia.com\nWovo Media — wovomedia.com`,
          },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 36, paddingBottom: 36, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#f2f2f2' }}>{s.title}</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
