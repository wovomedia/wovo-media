import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { businessName, ownerName, email, phone, plan, monthlyRate, managerId, notes } = await req.json()

  // 1. Create auth user (auto-confirmed, temp password they'll reset)
  const tempPassword = randomBytes(8).toString('hex')
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: ownerName }
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  // 2. Create profile
  await sb.from('profiles').insert({
    user_id: authUser.user.id,
    full_name: ownerName,
    wovo_role: 'client',
    terms_accepted_at: new Date().toISOString()
  })

  // 3. Create client record
  const { data: client, error: clientErr } = await sb.from('clients').insert({
    profile_id: authUser.user.id,
    business_name: businessName,
    owner_name: ownerName,
    email,
    phone: phone || null,
    plan: plan || 'premium',
    is_active: true,
    monthly_rate: monthlyRate || null,
  }).select().single()

  if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 400 })

  // 4. Assign manager if provided
  if (managerId) {
    await sb.from('client_managers').insert({
      client_id: client.id,
      employee_id: managerId,
      is_primary: true
    })
  }

  // 5. Create onboarding record
  const inviteToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await sb.from('client_onboarding').insert({
    client_id: client.id,
    invited_at: new Date().toISOString(),
    invite_email: email,
    invite_token: inviteToken,
    invite_expires_at: expiresAt.toISOString(),
    onboarding_step: 0,
    notes: notes || null
  })

  // 6. Create welcome conversation
  const { data: convo } = await sb.from('conversations').insert({
    client_id: client.id,
    subject: `Welcome to Wovo Media, ${businessName}!`,
    type: 'general'
  }).select().single()

  if (convo) {
    await sb.from('conversation_messages').insert({
      conversation_id: convo.id,
      sender_name: 'Wovo Media Team',
      sender_role: 'owner',
      body: `Hey ${ownerName}! 👋 Welcome to the Wovo Media platform. This is your dedicated messaging channel with your team. We'll use this to coordinate shoots, share content for review, and keep you updated on everything. Your account manager will reach out shortly to schedule your welcome call. Excited to work with you!`
    })
  }

  // 7. Send invite email
  const inviteUrl = `https://wovomedia.com/login?invite=${inviteToken}&email=${encodeURIComponent(email)}`
  await resend.emails.send({
    from: 'Wovo Media <support@wovomedia.com>',
    to: email,
    subject: `${ownerName}, your Wovo Media account is ready`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',sans-serif">
<div style="max-width:520px;margin:40px auto;background:#111;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
  <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <div style="font-size:20px;font-weight:800;letter-spacing:-0.04em;color:#fff">wovo<span style="color:#00E5C8">media</span></div>
  </div>
  <div style="padding:32px 28px">
    <h2 style="font-size:22px;font-weight:700;margin:0 0 12px;color:#fff">Welcome to Wovo Media, ${ownerName}! 🎉</h2>
    <p style="color:#888;line-height:1.7;margin:0 0 10px;font-size:15px">Your account for <strong style="color:#f0f0f0">${businessName}</strong> is all set up.</p>
    <p style="color:#888;line-height:1.7;margin:0 0 24px;font-size:14px">Log in to see your content, message your team, view your shoot schedule, and track your results — all in one place.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${inviteUrl}" style="display:inline-block;background:#00E5C8;color:#080808;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Access Your Account →</a>
    </div>
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px 20px;margin:20px 0">
      <div style="font-size:12px;color:#555;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.07em">Your login details</div>
      <div style="font-size:14px;color:#aaa"><strong style="color:#f0f0f0">Email:</strong> ${email}</div>
      <div style="font-size:14px;color:#aaa;margin-top:4px"><strong style="color:#f0f0f0">Temp password:</strong> ${tempPassword}</div>
      <div style="font-size:12px;color:#555;margin-top:8px">You'll be prompted to set a new password on first login.</div>
    </div>
    <p style="color:#444;font-size:13px;margin-top:16px">Questions? Reply to this email or message us through the platform.</p>
  </div>
  <div style="padding:14px 28px;border-top:1px solid rgba(255,255,255,0.05);text-align:center">
    <p style="color:#333;font-size:11px;margin:0">wovomedia.com · support@wovomedia.com</p>
  </div>
</div>
</body></html>`
  })

  // 8. Notify Payton
  await resend.emails.send({
    from: 'Wovo Media <support@wovomedia.com>',
    to: 'Payton@wovomedia.com',
    subject: `✅ Client onboarded: ${businessName}`,
    html: `<div style="font-family:sans-serif;background:#111;color:#f0f0f0;padding:20px;border-radius:12px;max-width:400px">
      <h3 style="color:#00E5C8;margin:0 0 14px">Client Onboarded</h3>
      <div style="font-size:14px;display:flex;flex-direction:column;gap:6px">
        <div><span style="color:#666">Business:</span> ${businessName}</div>
        <div><span style="color:#666">Owner:</span> ${ownerName}</div>
        <div><span style="color:#666">Email:</span> ${email}</div>
        <div><span style="color:#666">Plan:</span> ${plan}</div>
        <div><span style="color:#666">Rate:</span> ${monthlyRate ? '$'+monthlyRate+'/mo' : 'not set'}</div>
      </div>
    </div>`
  })

  return NextResponse.json({ success: true, clientId: client.id, inviteUrl })
}
