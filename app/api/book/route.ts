import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { name, business, email, phone, type, budget, notes } = await req.json()

  // Save lead to Supabase
  await sb.from('strategy_call_leads').insert({ name, business_name: business, email, phone, business_type: type, budget, notes })

  // Notify Payton
  await resend.emails.send({
    from: 'Wovo Media <Payton@wovomedia.com>',
    to: 'Payton@wovomedia.com',
    subject: `🗓 New strategy call request — ${business}`,
    html: `<div style="font-family:Inter,sans-serif;max-width:500px;background:#0e0e0e;color:#f0f0f0;padding:32px;border-radius:12px"><h2 style="color:#00E5C8;margin:0 0 20px">New Strategy Call Request</h2>${[['Name',name],['Business',business],['Email',email],['Phone',phone||'—'],['Type',type],['Budget',budget],['Notes',notes||'—']].map(([l,v])=>`<div style="padding:9px 0;border-bottom:0.5px solid #222;display:flex;justify-content:space-between"><span style="color:#666;font-size:13px">${l}</span><span style="color:#f0f0f0;font-size:13px">${v}</span></div>`).join('')}<div style="margin-top:20px;padding:14px;background:#141414;border-radius:8px;border:0.5px solid rgba(0,229,200,0.2)"><a href="https://calendly.com/wovomedia/wovo-media-strategy-call" style="color:#00E5C8;font-size:14px">→ View Calendly to schedule or send them the booking link</a></div></div>`
  })

  // Confirm to lead
  await resend.emails.send({
    from: 'Wovo Media <Payton@wovomedia.com>',
    to: email,
    subject: `We got your request — Wovo Media Strategy Call`,
    html: `<div style="font-family:Inter,sans-serif;max-width:500px;background:#0e0e0e;color:#f0f0f0;padding:32px;border-radius:12px"><div style="font-size:20px;font-weight:700;margin-bottom:24px">wovo<span style="color:#00E5C8">media</span></div><h2 style="margin:0 0 10px">Hey ${name.split(' ')[0]}, we got it! 👋</h2><p style="color:#aaa;line-height:1.6;margin-bottom:20px">Thanks for reaching out about <strong style="color:#f0f0f0">${business}</strong>. A member of our team will reach out to you at <strong style="color:#f0f0f0">${email}</strong> within 24 hours to confirm your strategy call and send over a Google Meet link.</p><p style="color:#aaa;line-height:1.6;margin-bottom:20px">Prefer to pick a time right now? You can book directly below:</p><div style="text-align:center;margin:24px 0"><a href="https://calendly.com/wovomedia/wovo-media-strategy-call" style="display:inline-block;background:#00E5C8;color:#080808;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Book on Calendly →</a></div><p style="color:#555;font-size:13px">Questions? Reply to this email or text (931) 458-3255.</p></div>`
  })

  return NextResponse.json({ success: true })
}
