import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { name, business, email, phone, service, message } = await req.json()

  if (!name || !email || !business) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const rows = [
    ['Name', name],
    ['Business', business],
    ['Email', email],
    ['Phone', phone || '—'],
    ['Interested in', service || '—'],
    ['Message', message || '—'],
  ]

  const rowsHtml = rows.map(([l, v]) => `
    <div style="padding:10px 0;border-bottom:1px solid #1e1e1e;display:flex;gap:16px;font-size:14px;">
      <span style="color:#666;min-width:110px;flex-shrink:0;">${l}</span>
      <span style="color:#f0f0f0;">${v}</span>
    </div>`).join('')

  const internalHtml = `
    <div style="font-family:sans-serif;max-width:520px;background:#111;color:#f0f0f0;padding:28px;border-radius:12px;">
      <div style="font-size:18px;font-weight:800;margin-bottom:20px;letter-spacing:-0.04em;">
        wovo<span style="color:#00E5C8;">media</span>
      </div>
      <h2 style="color:#00E5C8;margin:0 0 6px;font-size:20px;">New Inquiry</h2>
      <p style="color:#555;font-size:13px;margin:0 0 20px;">Submitted via wovomedia.com</p>
      ${rowsHtml}
      <div style="margin-top:20px;padding:14px;background:#1a1a1a;border-radius:8px;border:1px solid rgba(0,229,200,0.15);font-size:13px;color:#999;">
        Reply directly to this email to respond to ${name.split(' ')[0]} — reply-to is set to their address.
      </div>
    </div>`

  const confirmHtml = `
    <div style="font-family:sans-serif;max-width:540px;background:#111;color:#f0f0f0;padding:32px;border-radius:16px;">
      <div style="font-size:20px;font-weight:800;margin-bottom:24px;letter-spacing:-0.04em;">
        wovo<span style="color:#00E5C8;">media</span>
      </div>
      <h2 style="margin:0 0 10px;font-size:22px;">Hey ${name.split(' ')[0]}, we got your message!</h2>
      <p style="color:#999;line-height:1.7;margin-bottom:20px;">
        Thanks for reaching out about <strong style="color:#f0f0f0;">${business}</strong>. 
        Our team will be in touch within 24 hours to go over next steps.
      </p>
      <div style="padding:16px;background:#1a1a1a;border-radius:10px;border:1px solid rgba(0,229,200,0.15);margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#666;">What you submitted</p>
        ${rowsHtml}
      </div>
      <p style="color:#444;font-size:13px;margin:0;">
        Questions? Reply to this email or reach us at 
        <a href="mailto:support@wovomedia.com" style="color:#00E5C8;">support@wovomedia.com</a>
      </p>
    </div>`

  // Send to both internal addresses simultaneously
  await Promise.all([
    resend.emails.send({
      from: 'Wovo Media <support@wovomedia.com>',
      to: ['support@wovomedia.com', 'Payton@wovomedia.com'],
      replyTo: email,
      subject: `New inquiry — ${business} (${service || 'General'})`,
      html: internalHtml,
    }),
    resend.emails.send({
      from: 'Wovo Media <support@wovomedia.com>',
      to: email,
      replyTo: 'support@wovomedia.com',
      subject: `We got your message — Wovo Media`,
      html: confirmHtml,
    }),
  ])

  return NextResponse.json({ success: true })
}
