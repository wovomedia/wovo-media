import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  // Check user exists first
  const { data: users } = await sb.auth.admin.listUsers()
  const user = users?.users?.find(u => u.email === email)

  if (!user) {
    // Don't reveal if email exists - just return success
    return NextResponse.json({ success: true })
  }

  // Generate recovery link
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: 'https://wovomedia.com/update-password'
    }
  })

  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ success: true }) // silent fail
  }

  const resetLink = data.properties.action_link

  // Send branded email via Resend
  await resend.emails.send({
    from: 'Wovo Media <Payton@wovomedia.com>',
    to: email,
    subject: 'Reset your Wovo Media password',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,sans-serif">
<div style="max-width:500px;margin:40px auto;background:#111;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
  <div style="padding:28px 32px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <div style="font-size:20px;font-weight:800;letter-spacing:-0.04em;color:#fff">wovo<span style="color:#00E5C8">media</span></div>
  </div>
  <div style="padding:32px">
    <div style="font-size:36px;margin-bottom:16px">🔐</div>
    <h2 style="font-size:22px;font-weight:700;margin:0 0 10px;color:#fff">Reset your password</h2>
    <p style="color:#999;line-height:1.7;margin:0 0 28px;font-size:15px">Click the button below to set a new password. This link expires in <strong style="color:#f0f0f0">1 hour</strong>.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${resetLink}" style="display:inline-block;background:#00E5C8;color:#080808;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-0.01em">Set New Password →</a>
    </div>
    <p style="color:#555;font-size:13px;line-height:1.6">If you didn't request a password reset, you can safely ignore this email. Your password won't change.</p>
  </div>
  <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center">
    <p style="color:#333;font-size:11px;margin:0">wovomedia.com · Payton@wovomedia.com</p>
  </div>
</div>
</body></html>`
  })

  return NextResponse.json({ success: true })
}
