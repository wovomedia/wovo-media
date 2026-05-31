import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { businessName, ownerName, email, phone, plan, monthlyRate, managerId, notes } = await req.json()

  if (!businessName || !ownerName || !email) {
    return NextResponse.json({ error: 'Business name, owner name, and email are required.' }, { status: 400 })
  }

  let userId: string
  let tempPassword: string = ''
  let isNewUser = false

  // Check if user already exists
  const { data: { users } } = await sb.auth.admin.listUsers()
  const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

  if (existing) {
    // Use existing user - just update their metadata
    userId = existing.id
    await sb.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: ownerName, wovo_role: 'client' }
    })
  } else {
    // Create new auth user
    isNewUser = true
    tempPassword = randomBytes(8).toString('hex') + 'A1!'
    const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: ownerName, wovo_role: 'client' }
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })
    userId = authUser.user.id

    // Create profile
    await sb.from('profiles').upsert({
      user_id: userId,
      full_name: ownerName,
      wovo_role: 'client',
      terms_accepted_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
  }

  // Check if client record already exists for this user
  const { data: existingClient } = await sb.from('clients').select('*').eq('profile_id', userId).single()

  let clientId: string

  if (existingClient) {
    // Update existing client record
    await sb.from('clients').update({
      business_name: businessName,
      owner_name: ownerName,
      email,
      phone: phone || null,
      plan: plan || 'premium',
      is_active: true,
      monthly_rate: monthlyRate ? Number(monthlyRate) : null,
    }).eq('id', existingClient.id)
    clientId = existingClient.id
  } else {
    // Create new client record
    const { data: newClient, error: clientErr } = await sb.from('clients').insert({
      profile_id: userId,
      business_name: businessName,
      owner_name: ownerName,
      email,
      phone: phone || null,
      plan: plan || 'premium',
      is_active: true,
      monthly_rate: monthlyRate ? Number(monthlyRate) : null,
    }).select().single()
    if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 400 })
    clientId = newClient.id
  }

  // Assign manager if provided
  if (managerId) {
    await sb.from('client_managers').upsert({
      client_id: clientId,
      employee_id: managerId,
      is_primary: true
    }, { onConflict: 'client_id,employee_id' })
  }

  // Create welcome conversation if none exists
  const { data: existingConvo } = await sb.from('conversations').select('id').eq('client_id', clientId).single()
  if (!existingConvo) {
    const { data: convo } = await sb.from('conversations').insert({
      client_id: clientId,
      subject: `Welcome to Wovo Media, ${businessName}!`,
      type: 'general'
    }).select().single()
    if (convo) {
      await sb.from('conversation_messages').insert({
        conversation_id: convo.id,
        sender_name: 'Wovo Media Team',
        sender_role: 'owner',
        body: `Hey ${ownerName}! 👋 Welcome to the Wovo Media platform. This is your dedicated messaging channel with your team. We'll coordinate shoots, share content for review, and keep you updated here. Your account manager will reach out shortly!`
      })
    }
  }

  // Send invite email
  const inviteToken = randomBytes(32).toString('hex')
  const inviteUrl = `https://wovomedia.com/login?email=${encodeURIComponent(email)}`

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
    <p style="color:#888;line-height:1.7;margin:0 0 10px;font-size:15px">Your account for <strong style="color:#f0f0f0">${businessName}</strong> is all set up and ready to go.</p>
    <p style="color:#888;line-height:1.7;margin:0 0 24px;font-size:14px">Log in to message your team, see your shoot schedule, and track your content.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${inviteUrl}" style="display:inline-block;background:#00E5C8;color:#080808;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Access Your Account →</a>
    </div>
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px 20px;margin:20px 0">
      <div style="font-size:12px;color:#555;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.07em">Your login</div>
      <div style="font-size:14px;color:#aaa"><strong style="color:#f0f0f0">Email:</strong> ${email}</div>
      ${isNewUser ? `<div style="font-size:14px;color:#aaa;margin-top:4px"><strong style="color:#f0f0f0">Password:</strong> ${tempPassword}</div><div style="font-size:12px;color:#555;margin-top:8px">Change your password after first login.</div>` : '<div style="font-size:13px;color:#666;margin-top:6px">Use your existing password to log in.</div>'}
    </div>
    <p style="color:#444;font-size:13px">Questions? Email <a href="mailto:support@wovomedia.com" style="color:#00E5C8">support@wovomedia.com</a></p>
  </div>
  <div style="padding:14px 28px;border-top:1px solid rgba(255,255,255,0.05);text-align:center">
    <p style="color:#333;font-size:11px;margin:0">wovomedia.com · support@wovomedia.com</p>
  </div>
</div>
</body></html>`
  })

  // Notify Payton
  await resend.emails.send({
    from: 'Wovo Media <support@wovomedia.com>',
    to: 'Payton@wovomedia.com',
    subject: `✅ Client ${isNewUser ? 'onboarded' : 'updated'}: ${businessName}`,
    html: `<div style="font-family:sans-serif;background:#111;color:#f0f0f0;padding:20px;border-radius:12px;max-width:400px">
      <h3 style="color:#00E5C8;margin:0 0 14px">Client ${isNewUser ? 'Onboarded' : 'Updated'}</h3>
      <div style="font-size:14px;display:flex;flex-direction:column;gap:6px">
        <div><span style="color:#666">Business:</span> ${businessName}</div>
        <div><span style="color:#666">Owner:</span> ${ownerName}</div>
        <div><span style="color:#666">Email:</span> ${email}</div>
        <div><span style="color:#666">Plan:</span> ${plan || 'premium'}</div>
        <div><span style="color:#666">Rate:</span> ${monthlyRate ? '$' + monthlyRate + '/mo' : 'not set'}</div>
        <div><span style="color:#666">Existing user:</span> ${!isNewUser ? 'Yes — account updated' : 'No — new account created'}</div>
      </div>
    </div>`
  })

  return NextResponse.json({ success: true, clientId, isNewUser })
}
