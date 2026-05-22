import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  // Find user
  const { data: { users } } = await sb.auth.admin.listUsers()
  const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) return NextResponse.json({ success: true }) // silent

  // Generate a secure random token (not going through Supabase verify at all)
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  // Delete any existing tokens for this user
  await sb.from('password_reset_tokens').delete().eq('user_id', user.id)

  // Store token
  await sb.from('password_reset_tokens').insert({
    user_id: user.id,
    token,
    expires_at: expiresAt.toISOString(),
  })

  const resetLink = `https://wovomedia.com/update-password?token=${token}`

  await resend.emails.send({
    from: 'Wovo Media <support@wovomedia.com>',
    to: email,
    subject: 'Reset your Wovo Media password',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:40px auto;background:#111;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
  <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <div style="font-size:20px;font-weight:800;letter-spacing:-0.04em;color:#fff">wovo<span style="color:#00E5C8">media</span></div>
  </div>
  <div style="padding:32px 28px">
    <div style="font-size:36px;margin-bottom:18px">🔐</div>
    <h2 style="font-size:20px;font-weight:700;margin:0 0 10px;color:#fff">Reset your password</h2>
    <p style="color:#888;line-height:1.7;margin:0 0 28px;font-size:14px">Click below to set a new password. This link expires in <strong style="color:#f0f0f0">1 hour</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr><td align="center" style="padding:4px 0">
        <a href="${resetLink}" target="_blank" style="display:inline-block;background:#00E5C8;color:#080808;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Set New Password →</a>
      </td></tr>
    </table>
    <p style="color:#444;font-size:12px;margin:24px 0 0;line-height:1.8">If the button doesn't work, copy this link:<br><a href="${resetLink}" style="color:#666;word-break:break-all;font-size:11px">${resetLink}</a></p>
    <p style="color:#444;font-size:12px;margin:16px 0 0">Didn't request this? Ignore this email — your password won't change.</p>
  </div>
  <div style="padding:14px 28px;border-top:1px solid rgba(255,255,255,0.05);text-align:center">
    <p style="color:#333;font-size:11px;margin:0">wovomedia.com · support@wovomedia.com</p>
  </div>
</div>
</body></html>`
  })

  return NextResponse.json({ success: true })
}
