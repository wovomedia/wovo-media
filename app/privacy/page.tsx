export default function Privacy() {
  return (
    <div style={{ background: '#080808', color: '#f2f2f2', fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', padding: '80px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#00E5C8', textDecoration: 'none', display: 'inline-block', marginBottom: 40 }}>← Back to wovomedia.com</a>
        <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 48 }}>Last updated: June 2025</p>

        {[
          {
            title: '1. Information We Collect',
            body: `We collect information you provide directly to us, including your name, business name, email address, phone number, and any other information you submit through our inquiry form or service agreements. We also collect basic analytics data about how visitors interact with our website.`,
          },
          {
            title: '2. How We Use Your Information',
            body: `We use your information to:\n• Respond to your inquiries and provide our services\n• Send service-related communications and invoices\n• Improve our website and services\n• Comply with legal obligations\n\nWe do not sell, rent, or share your personal information with third parties for their marketing purposes.`,
          },
          {
            title: '3. Data Security',
            body: `We take reasonable measures to protect your information from unauthorized access, use, or disclosure. However, no internet transmission is completely secure, and we cannot guarantee the absolute security of your data.`,
          },
          {
            title: '4. Cookies',
            body: `Our website may use cookies and similar tracking technologies to improve your browsing experience and analyze site traffic. You can control cookie settings through your browser.`,
          },
          {
            title: '5. Third-Party Services',
            body: `We may use third-party services (such as payment processors, email providers, and analytics tools) that have their own privacy policies. We encourage you to review the privacy policies of any third-party services you interact with through our platform.`,
          },
          {
            title: '6. Your Rights',
            body: `You may request access to, correction of, or deletion of your personal information by contacting us at support@wovomedia.com. We will respond to your request within a reasonable timeframe.`,
          },
          {
            title: '7. Contact',
            body: `For privacy-related questions:\n\nEmail: support@wovomedia.com\nWovo Media — wovomedia.com`,
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
