import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { email, password, fullName, businessName } = await req.json()

  // Validate
  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  // Check if user already exists
  
  // Create auth user (auto-confirm via service role)
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm so they can log in immediately
    user_metadata: { full_name: fullName }
  })

  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      return NextResponse.json({ error: 'An account with that email already exists. Try logging in.' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data.user) {
    return NextResponse.json({ error: 'Could not create account. Please try again.' }, { status: 500 })
  }

  // Create profile
  await sb.from('profiles').upsert({
    user_id: data.user.id,
    full_name: fullName,
    wovo_role: 'client',
    terms_accepted_at: new Date().toISOString(),
  })

  // Create client record if business name given
  if (businessName?.trim()) {
    await sb.from('clients').insert({
      profile_id: data.user.id,
      business_name: businessName.trim(),
      email,
      owner_name: fullName,
      is_active: false,
    })
  }

  // Send welcome email
  resend.emails.send({
    from: 'Wovo Media <Payton@wovomedia.com>',
    to: email,
    subject: `Welcome to Wovo Media, ${fullName.split(' ')[0]}!`,
    html: `<div style="font-family:'Helvetica Neue',sans-serif;max-width:540px;margin:40px auto;background:#111;color:#f0f0f0;padding:36px;border-radius:16px;border:1px solid rgba(255,255,255,0.08)">
      <div style="font-size:22px;font-weight:800;margin-bottom:24px;letter-spacing:-0.04em">wovo<span style="color:#00E5C8">media</span></div>
      <h2 style="font-size:22px;margin:0 0 10px">Welcome, ${fullName.split(' ')[0]}! 🎉</h2>
      <p style="color:#aaa;line-height:1.7;margin-bottom:20px">Your Wovo Media account is ready. ${businessName ? `We've added <strong style="color:#f0f0f0">${businessName}</strong> to your profile.` : ''}</p>
      <p style="color:#aaa;line-height:1.7;margin-bottom:28px">Log in anytime to manage your account, view your content, and explore Wovo AI plans.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="https://wovomedia.com/login" style="display:inline-block;background:#00E5C8;color:#080808;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Log In to Your Account →</a>
      </div>
      <p style="color:#555;font-size:13px">Questions? Reply to this email or text (931) 458-3255.</p>
      <p style="color:#444;font-size:13px;margin-top:14px">— Payton Cody<br>Founder, Wovo Media</p>
    </div>`
  })

  // Notify Payton of new signup
  resend.emails.send({
    from: 'Wovo Media <Payton@wovomedia.com>',
    to: 'Payton@wovomedia.com',
    subject: `New signup — ${fullName}${businessName ? ` (${businessName})` : ''}`,
    html: `<div style="font-family:sans-serif;max-width:400px;background:#111;color:#f0f0f0;padding:24px;border-radius:12px"><h3 style="color:#00E5C8;margin:0 0 16px">New Free Account</h3><div style="font-size:14px"><div style="padding:8px 0;border-bottom:1px solid #222"><span style="color:#666">Name</span> · ${fullName}</div><div style="padding:8px 0;border-bottom:1px solid #222"><span style="color:#666">Email</span> · ${email}</div><div style="padding:8px 0"><span style="color:#666">Business</span> · ${businessName || '—'}</div></div></div>`
  })

  return NextResponse.json({ success: true })
}
