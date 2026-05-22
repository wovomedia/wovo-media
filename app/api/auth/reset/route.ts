import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  // Generate reset link via Supabase admin
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: 'https://wovomedia.com/account' }
  })

  if (error || !data) {
    // Don't reveal if email exists or not
    return NextResponse.json({ success: true })
  }

  // Send via Resend (branded email)
  await resend.emails.send({
    from: 'Wovo Media <Payton@wovomedia.com>',
    to: email,
    subject: 'Reset your Wovo Media password',
    html: `<div style="font-family:'Helvetica Neue',sans-serif;max-width:500px;margin:40px auto;background:#111;color:#f0f0f0;padding:36px;border-radius:16px;border:1px solid rgba(255,255,255,0.08)">
      <div style="font-size:22px;font-weight:800;margin-bottom:24px;letter-spacing:-0.04em">wovo<span style="color:#00E5C8">media</span></div>
      <h2 style="font-size:20px;margin:0 0 10px">Reset your password</h2>
      <p style="color:#aaa;line-height:1.7;margin-bottom:28px">Click the button below to set a new password. This link expires in 1 hour.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${data.properties?.action_link}" style="display:inline-block;background:#00E5C8;color:#080808;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Set New Password →</a>
      </div>
      <p style="color:#555;font-size:13px">If you didn't request this, you can ignore this email.</p>
    </div>`
  })

  return NextResponse.json({ success: true })
}
