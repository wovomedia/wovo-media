import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { name, business, email, phone, type, budget, notes } = await req.json()

  // Save lead
  await sb.from('strategy_call_leads').insert({
    name, business_name: business, email, phone,
    business_type: type, budget, notes
  })

  // Notify Payton
  resend.emails.send({
    from: 'Wovo Media <Payton@wovomedia.com>',
    to: 'Payton@wovomedia.com',
    subject: `📅 Strategy call request — ${business}`,
    html: `<div style="font-family:sans-serif;max-width:500px;background:#111;color:#f0f0f0;padding:28px;border-radius:12px"><h2 style="color:#00E5C8;margin:0 0 18px">New Strategy Call Request</h2>${[['Name',name],['Business',business],['Email',email],['Phone',phone||'—'],['Type',type],['Budget',budget],['Notes',notes||'—']].map(([l,v])=>`<div style="padding:8px 0;border-bottom:1px solid #222;display:flex;justify-content:space-between;font-size:14px"><span style="color:#666">${l}</span><span>${v}</span></div>`).join('')}<div style="margin-top:18px;padding:14px;background:#1a1a1a;border-radius:8px;border:1px solid rgba(0,229,200,0.2)"><a href="https://calendly.com/wovomedia/wovo-media-strategy-call" style="color:#00E5C8;font-size:14px;text-decoration:none">→ View Calendly to send booking link</a></div></div>`
  })

  // Send confirmation to lead
  resend.emails.send({
    from: 'Wovo Media <Payton@wovomedia.com>',
    to: email,
    subject: `We got your request — Wovo Media`,
    html: `<div style="font-family:sans-serif;max-width:540px;background:#111;color:#f0f0f0;padding:32px;border-radius:16px"><div style="font-size:20px;font-weight:800;margin-bottom:22px;letter-spacing:-0.04em">wovo<span style="color:#00E5C8">media</span></div><h2 style="margin:0 0 10px;font-size:22px">Hey ${name.split(' ')[0]}, we got it! 👋</h2><p style="color:#999;line-height:1.7;margin-bottom:20px">Thanks for reaching out about <strong style="color:#f0f0f0">${business}</strong>. A member of our team will reach out within 24 hours to confirm your strategy call and send a Google Meet link.</p><p style="color:#999;line-height:1.7;margin-bottom:24px">Want to pick a time right now?</p><div style="text-align:center;margin:24px 0"><a href="https://calendly.com/wovomedia/wovo-media-strategy-call" style="display:inline-block;background:#00E5C8;color:#080808;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Book on Calendly →</a></div><p style="color:#444;font-size:13px">Text (931) 458-3255 with any questions.</p></div>`
  })

  // Trigger post-booking conversion video (background, no await)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://wovomedia.com'}/api/heygen/conversion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'post_booking', name, email, business })
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
