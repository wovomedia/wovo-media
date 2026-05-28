import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY)

// Map Stripe price IDs to plan names
const PRICE_TO_PLAN: Record<string, string> = {
  'price_1Ta7cdFmIvQosWF9stIYpHGg': 'starter',    // $29
  'price_1Ta7dWFmIvQosWF9mTJcTscY': 'growth',     // $49
  'price_1Ta7dgFmIvQosWF92mph9NCd': 'pro_ai',     // $79
  'price_1Ta7dpFmIvQosWF9KE1qn84e': 'website',    // $99
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Wovo AI Starter',
  growth: 'Wovo AI Growth',
  pro_ai: 'Wovo AI Pro',
  website: 'Wovo AI Website Builder',
  premium: 'Wovo Media Premium',
}

async function handleWovoAISignup(session: any) {
  const email = session.customer_details?.email || session.metadata?.email
  if (!email) return

  // Determine plan from line items price ID
  const priceId = session.metadata?.price_id || 
    Object.keys(PRICE_TO_PLAN).find(p => session.amount_total && true) // fallback
  const plan = PRICE_TO_PLAN[priceId] || 'starter'

  // Check if user already exists
  const { data: { users } } = await sb.auth.admin.listUsers()
  const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  
  let userId = existing?.id
  let tempPassword = ''
  let isNewUser = false

  if (!existing) {
    // Create new user
    isNewUser = true
    tempPassword = randomBytes(8).toString('hex') + 'A1!'
    const { data: newUser } = await sb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: session.customer_details?.name || '' }
    })
    userId = newUser.user?.id
    if (userId) {
      await sb.from('profiles').insert({
        user_id: userId,
        full_name: session.customer_details?.name || '',
        wovo_role: 'client',
        terms_accepted_at: new Date().toISOString()
      })
    }
  }

  if (!userId) return

  // Check if client record exists
  const { data: existingClient } = await sb.from('clients').select('*').eq('profile_id', userId).single()
  
  let clientId = existingClient?.id
  if (!existingClient) {
    const { data: newClient } = await sb.from('clients').insert({
      profile_id: userId,
      business_name: session.customer_details?.name || email.split('@')[0],
      owner_name: session.customer_details?.name || '',
      email,
      plan,
      is_active: true,
      source: 'wovo_ai_signup'
    }).select().single()
    clientId = newClient?.id
  } else {
    // Update existing client to active with new plan
    await sb.from('clients').update({ plan, is_active: true }).eq('id', existingClient.id)
  }

  if (!clientId) return

  // Create subscription record
  await sb.from('wovo_subscriptions').upsert({
    client_id: clientId,
    stripe_subscription_id: session.subscription || session.id,
    stripe_customer_id: session.customer,
    plan,
    status: 'active',
    amount_cents: session.amount_total
  })

  // Initialize credits for Wovo AI users
  await sb.from('client_credits').upsert({ client_id: clientId, balance: 5, total_purchased: 5 })

  // Send welcome email
  const planLabel = PLAN_LABELS[plan] || plan
  await resend.emails.send({
    from: 'Wovo Media <support@wovomedia.com>',
    to: email,
    subject: `Welcome to ${planLabel} — you're all set!`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',sans-serif">
<div style="max-width:520px;margin:40px auto;background:#111;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
  <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <div style="font-size:20px;font-weight:800;letter-spacing:-0.04em;color:#fff">wovo<span style="color:#00E5C8">media</span></div>
  </div>
  <div style="padding:32px 28px">
    <div style="font-size:42px;margin-bottom:16px">🎉</div>
    <h2 style="font-size:22px;font-weight:700;margin:0 0 10px;color:#fff">You're on ${planLabel}!</h2>
    <p style="color:#888;line-height:1.7;margin:0 0 20px;font-size:15px">Your account is active. Log in to create your AI character, build your first video series, and start getting consistent content every week.</p>
    ${isNewUser ? `
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:12px;color:#555;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.07em">Your login</div>
      <div style="font-size:14px;color:#aaa"><strong style="color:#f0f0f0">Email:</strong> ${email}</div>
      <div style="font-size:14px;color:#aaa;margin-top:4px"><strong style="color:#f0f0f0">Temp password:</strong> ${tempPassword}</div>
      <div style="font-size:12px;color:#555;margin-top:8px">You'll be prompted to set a new password on first login.</div>
    </div>` : ''}
    <div style="text-align:center;margin:24px 0">
      <a href="https://wovomedia.com/home" style="display:inline-block;background:#00E5C8;color:#080808;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Open Wovo Media →</a>
    </div>
    <p style="color:#444;font-size:13px">Questions? Email <a href="mailto:support@wovomedia.com" style="color:#00E5C8">support@wovomedia.com</a></p>
  </div>
  <div style="padding:14px 28px;border-top:1px solid rgba(255,255,255,0.05);text-align:center">
    <p style="color:#333;font-size:11px;margin:0">wovomedia.com · Built for local businesses</p>
  </div>
</div>
</body></html>`
  })

  // Notify Payton
  await resend.emails.send({
    from: 'Wovo Media <support@wovomedia.com>',
    to: 'Payton@wovomedia.com',
    subject: `💰 New Wovo AI signup — ${planLabel}`,
    html: `<div style="font-family:sans-serif;background:#111;color:#f0f0f0;padding:20px;border-radius:12px;max-width:400px">
      <h3 style="color:#00E5C8;margin:0 0 14px">New ${planLabel} Subscriber</h3>
      <div style="font-size:14px;line-height:1.8">
        <div><span style="color:#666">Email:</span> ${email}</div>
        <div><span style="color:#666">Plan:</span> ${planLabel}</div>
        <div><span style="color:#666">Amount:</span> $${(session.amount_total/100).toFixed(2)}/mo</div>
        <div><span style="color:#666">New user:</span> ${isNewUser ? 'Yes' : 'Existing account'}</div>
      </div>
    </div>`
  })
}

async function handlePremiumSignup(session: any) {
  const email = session.customer_details?.email || session.metadata?.email
  const businessName = session.metadata?.business
  if (!email) return

  // Check for pending premium invitation
  let invite: any = null
  try {
    const { data } = await sb.from('premium_invitations').select('*').eq('email', email).eq('status', 'pending').single()
    invite = data
  } catch {}

  const ownerName = invite?.owner_name || session.customer_details?.name || ''
  const tempPassword = randomBytes(8).toString('hex') + 'A1!'

  const { data: authUser } = await sb.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true,
    user_metadata: { full_name: ownerName }
  })

  if (!authUser.user) return

  await sb.from('profiles').insert({
    user_id: authUser.user.id,
    full_name: ownerName,
    wovo_role: 'client',
    terms_accepted_at: new Date().toISOString()
  })

  const { data: client } = await sb.from('clients').insert({
    profile_id: authUser.user.id,
    business_name: businessName || ownerName,
    owner_name: ownerName,
    email,
    phone: invite?.phone,
    plan: 'premium',
    is_active: true,
    source: 'premium_onboarding'
  }).select().single()

  if (invite && client) {
    await sb.from('premium_invitations').update({
      status: 'active', paid_at: new Date().toISOString(),
      stripe_subscription_id: session.subscription, client_id: client.id
    }).eq('id', invite.id)
  }

  if (client) {
    await sb.from('wovo_subscriptions').insert({
      client_id: client.id,
      stripe_subscription_id: session.subscription,
      stripe_customer_id: session.customer,
      plan: 'premium', status: 'active',
      amount_cents: invite?.price_cents || session.amount_total
    })

    // Welcome conversation
    const { data: convo } = await sb.from('conversations').insert({
      client_id: client.id,
      subject: `Welcome to Wovo Media Premium, ${businessName || ownerName}!`,
      type: 'general'
    }).select().single()

    if (convo) {
      await sb.from('conversation_messages').insert({
        conversation_id: convo.id,
        sender_name: 'Wovo Media Team',
        sender_role: 'owner',
        body: `Hey ${ownerName}! 👋 Welcome to Wovo Media Premium. This is your direct line to your team. We'll coordinate shoots, share content for review, and keep you updated here. Your account manager will reach out shortly!`
      })
    }
  }

  // Welcome email
  await resend.emails.send({
    from: 'Wovo Media <support@wovomedia.com>',
    to: email,
    subject: `Welcome to Wovo Media Premium, ${ownerName}!`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',sans-serif">
<div style="max-width:520px;margin:40px auto;background:#111;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">
  <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <div style="font-size:20px;font-weight:800;letter-spacing:-0.04em;color:#fff">wovo<span style="color:#00E5C8">media</span></div>
  </div>
  <div style="padding:32px 28px">
    <div style="font-size:42px;margin-bottom:16px">🚀</div>
    <h2 style="font-size:22px;font-weight:700;margin:0 0 10px;color:#fff">Welcome to Premium, ${ownerName}!</h2>
    <p style="color:#888;line-height:1.7;margin:0 0 20px;font-size:15px">Your <strong style="color:#f0f0f0">${businessName || 'account'}</strong> is active. Log in to message your team, see your shoot schedule, and track your content.</p>
    <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:14px;color:#aaa"><strong style="color:#f0f0f0">Email:</strong> ${email}</div>
      <div style="font-size:14px;color:#aaa;margin-top:4px"><strong style="color:#f0f0f0">Temp password:</strong> ${tempPassword}</div>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="https://wovomedia.com/home" style="display:inline-block;background:#00E5C8;color:#080808;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Access Your Dashboard →</a>
    </div>
  </div>
</div>
</body></html>`
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  let event: any
  try { event = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid' }, { status: 400 }) }

  if (event.type === 'checkout.session.completed' || event.type === 'payment_link.payment_completed') {
    const session = event.data.object
    const email = session.customer_details?.email || session.metadata?.email

    if (!email) return NextResponse.json({ received: true })

    // Detect what was purchased based on amount or metadata
    const amount = session.amount_total
    const { data: pendingInvite } = await sb.from('premium_invitations').select('id').eq('email', email).eq('status','pending').maybeSingle()
    const isPremium = session.metadata?.type === 'premium' || pendingInvite !== null

    if (isPremium) {
      await handlePremiumSignup(session)
    } else {
      // Wovo AI plan
      await handleWovoAISignup(session)
    }
  }

  // Handle subscription cancelled
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    await sb.from('wovo_subscriptions').update({ status: 'cancelled' })
      .eq('stripe_subscription_id', sub.id)
    // Deactivate client
    const { data: wovoSub } = await sb.from('wovo_subscriptions').select('client_id').eq('stripe_subscription_id', sub.id).single()
    if (wovoSub) {
      await sb.from('clients').update({ is_active: false }).eq('id', wovoSub.client_id)
    }
  }

  return NextResponse.json({ received: true })
}
