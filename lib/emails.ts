import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Wovo Media <Payton@wovomedia.com>'

export async function sendPremiumInvite({ to, name, businessName, price, paymentLink }: {
  to: string, name: string, businessName: string, price: number, paymentLink: string
}) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Your Wovo Media Premium plan — action required`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:Inter,sans-serif;color:#f0f0f0">
<div style="max-width:580px;margin:40px auto;background:#0e0e0e;border:0.5px solid rgba(255,255,255,0.09);border-radius:16px;overflow:hidden">
  <div style="padding:32px 32px 0;text-align:center">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:4px">wovo<span style="color:#00E5C8">media</span></div>
    <div style="font-size:12px;color:#555;margin-bottom:32px">Digital Presence Management</div>
    <div style="width:56px;height:2px;background:#00E5C8;margin:0 auto 32px"></div>
  </div>
  <div style="padding:0 32px 32px">
    <p style="font-size:18px;font-weight:600;margin:0 0 8px">Hey ${name} 👋</p>
    <p style="color:#888;line-height:1.6;margin:0 0 24px">Great talking with you. Here's your custom Wovo Media Premium plan for <strong style="color:#fff">${businessName}</strong>.</p>
    <div style="background:#141414;border:0.5px solid rgba(0,229,200,0.22);border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
      <div style="font-size:12px;color:#00E5C8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Your Monthly Plan</div>
      <div style="font-size:42px;font-weight:700;color:#fff;font-family:Georgia,serif">$${(price/100).toLocaleString()}<span style="font-size:16px;color:#888;font-weight:400">/mo</span></div>
      <div style="font-size:13px;color:#666;margin-top:8px">Billed monthly · Cancel anytime</div>
    </div>
    <p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 24px">To get started, complete your payment below. Once confirmed, I'll personally reach out to begin onboarding your account within 24 hours.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${paymentLink}" style="display:inline-block;background:#00E5C8;color:#080808;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Complete Payment →</a>
    </div>
    <p style="color:#444;font-size:13px;line-height:1.6;margin:0">Questions? Reply directly to this email or text/call me at support@wovomedia.com.</p>
    <p style="color:#444;font-size:13px;margin:16px 0 0">— Payton Cody<br><span style="color:#333">Founder, Wovo Media</span></p>
  </div>
  <div style="padding:20px 32px;border-top:0.5px solid rgba(255,255,255,0.06);text-align:center">
    <p style="color:#333;font-size:12px;margin:0">wovomedia.com · Payton@wovomedia.com · support@wovomedia.com</p>
  </div>
</div>
</body></html>`
  })
}

export async function sendWelcomeEmail({ to, name, businessName, loginEmail, tempPassword }: {
  to: string, name: string, businessName: string, loginEmail: string, tempPassword: string
}) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to Wovo Media — your account is ready`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#080808;font-family:Inter,sans-serif;color:#f0f0f0">
<div style="max-width:580px;margin:40px auto;background:#0e0e0e;border:0.5px solid rgba(255,255,255,0.09);border-radius:16px;overflow:hidden">
  <div style="padding:32px;text-align:center;border-bottom:0.5px solid rgba(255,255,255,0.06)">
    <div style="font-size:22px;font-weight:700;color:#fff">wovo<span style="color:#00E5C8">media</span></div>
  </div>
  <div style="padding:32px">
    <p style="font-size:18px;font-weight:600;margin:0 0 16px">Welcome aboard, ${name}! 🎉</p>
    <p style="color:#888;line-height:1.6;margin:0 0 24px">Your Wovo Media Premium account for <strong style="color:#fff">${businessName}</strong> is live. Here are your login details:</p>
    <div style="background:#141414;border-radius:12px;padding:20px;margin-bottom:24px">
      <div style="margin-bottom:12px"><span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Email</span><br><span style="color:#fff;font-size:15px">${loginEmail}</span></div>
      <div><span style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em">Temporary Password</span><br><span style="color:#00E5C8;font-size:15px;font-family:monospace">${tempPassword}</span></div>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="https://wovomedia.com/login" style="display:inline-block;background:#00E5C8;color:#080808;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Log In to Your Dashboard →</a>
    </div>
    <p style="color:#555;font-size:13px">Please change your password after your first login. I'll be in touch within 24 hours to kick things off.</p>
    <p style="color:#444;font-size:13px;margin:16px 0 0">— Payton Cody<br><span style="color:#333">Founder, Wovo Media</span></p>
  </div>
</div>
</body></html>`
  })
}

export async function sendMonthlyReport({ to, name, businessName, month, views, engagements, posts, summary }: {
  to: string, name: string, businessName: string, month: string, views: number, engagements: number, posts: number, summary: string
}) {
  const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return resend.emails.send({
    from: FROM,
    to,
    subject: `${businessName} — ${monthLabel} Results from Wovo Media`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#080808;font-family:Inter,sans-serif;color:#f0f0f0">
<div style="max-width:580px;margin:40px auto;background:#0e0e0e;border:0.5px solid rgba(255,255,255,0.09);border-radius:16px;overflow:hidden">
  <div style="padding:32px;text-align:center;border-bottom:0.5px solid rgba(255,255,255,0.06)">
    <div style="font-size:22px;font-weight:700;color:#fff">wovo<span style="color:#00E5C8">media</span></div>
    <div style="font-size:13px;color:#555;margin-top:4px">${monthLabel} Report</div>
  </div>
  <div style="padding:32px">
    <p style="font-size:16px;font-weight:600;margin:0 0 16px">Hey ${name},</p>
    <p style="color:#888;line-height:1.6;margin:0 0 24px">Here's a look at how <strong style="color:#fff">${businessName}</strong> performed this month.</p>
    <div style="display:grid;gap:12px;margin-bottom:24px">
      ${[['Views',views.toLocaleString()],['Engagements',engagements.toLocaleString()],['Posts Published',posts.toString()]].map(([l,v])=>`
      <div style="background:#141414;border-radius:10px;padding:16px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;color:#666">${l}</span>
        <span style="font-size:22px;font-weight:700;color:#00E5C8;font-family:Georgia,serif">${v}</span>
      </div>`).join('')}
    </div>
    ${summary ? `<div style="background:#141414;border-left:3px solid #00E5C8;padding:16px 20px;border-radius:0 10px 10px 0;margin-bottom:24px"><p style="color:#aaa;font-size:14px;line-height:1.6;margin:0">${summary}</p></div>` : ''}
    <p style="color:#555;font-size:13px;margin:0">Log in to your dashboard to see the full breakdown.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="https://wovomedia.com/dashboard/client" style="display:inline-block;background:#00E5C8;color:#080808;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Dashboard →</a>
    </div>
    <p style="color:#444;font-size:13px;margin:16px 0 0">— Payton Cody<br><span style="color:#333">Founder, Wovo Media</span></p>
  </div>
</div>
</body></html>`
  })
}
