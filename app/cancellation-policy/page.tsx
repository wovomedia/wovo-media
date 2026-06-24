export default function CancellationPolicy() {
  return (
    <div style={{ background: '#080808', color: '#f2f2f2', fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#00E5C8', textDecoration: 'none', display: 'inline-block', marginBottom: 40 }}>← Back to wovomedia.com</a>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Cancellation Policy</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 48 }}>Last updated: June 2025</p>

        {[
          {
            title: '1. Monthly Billing & Auto-Renewal',
            body: `All Wovo Media services are billed on a monthly recurring basis. Your subscription automatically renews each month on your billing anniversary date unless you provide written notice of cancellation as described below. You authorize Wovo Media to charge your payment method on file each billing cycle until cancellation is properly confirmed.`,
          },
          {
            title: '2. How to Cancel',
            body: `To cancel your Wovo Media services, you must notify us in one of the following ways:\n\n• Email: Send a written cancellation request to support@wovomedia.com from the email address associated with your account. Include your business name and the services you wish to cancel.\n\n• Phone call: Call Wovo Media directly and speak with a representative to verbally confirm your cancellation. A written confirmation will be sent to your email following the call.\n\nCancellation requests submitted through any other channel (social media DMs, text messages, verbal requests not confirmed in writing, etc.) will not be accepted or processed.`,
          },
          {
            title: '3. Cancellation Timing & Final Billing',
            body: `Cancellations take effect at the end of your current billing period. You will continue to have access to all services through the end of the period for which you have already been charged. No partial-month refunds are issued.\n\nIf a cancellation request is received after your billing date has already processed for the next period, that charge stands and services will continue through that final period before terminating.`,
          },
          {
            title: '4. No Cancellation = Continued Billing',
            body: `Wovo Media will continue to provide services and charge your payment method each month until a valid cancellation is received and confirmed. Failure to use services, changes in your business circumstances, or dissatisfaction communicated informally do not constitute cancellation and will not stop billing. It is the client's responsibility to submit a formal cancellation request.`,
          },
          {
            title: '5. Early Termination',
            body: `Clients who have agreed to a minimum commitment period (if applicable as noted in your service agreement) may be subject to an early termination fee equal to the remaining months of that commitment. Month-to-month clients with no committed term may cancel at any time with no early termination fee, subject to the notice requirements above.`,
          },
          {
            title: '6. Refund Policy',
            body: `All fees paid to Wovo Media are non-refundable except as required by applicable law. If you believe you have been billed in error, contact us at support@wovomedia.com within 14 days of the charge and we will review your account.`,
          },
          {
            title: '7. Reactivation',
            body: `If you cancel and wish to reactivate services at a later date, reactivation is subject to current pricing and availability. Wovo Media makes no guarantee that your prior rate or service package will be available upon reactivation.`,
          },
          {
            title: '8. Contact',
            body: `For all cancellation requests and billing questions:\n\nEmail: support@wovomedia.com\nWovo Media — wovomedia.com`,
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
