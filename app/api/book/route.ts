import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { name, business, email, phone, type, budget, date, time, notes } = await req.json()

  try {
    await resend.emails.send({
      from: 'Wovo Media <Payton@wovomedia.com>',
      to: 'Payton@wovomedia.com',
      subject: `New strategy call — ${business} — ${date} ${time}`,
      html: `<div style="font-family:Inter,sans-serif;max-width:500px;background:#0e0e0e;color:#f0f0f0;padding:32px;border-radius:12px"><h2 style="color:#00E5C8;margin:0 0 20px">New Strategy Call Booked</h2>${[['Name',name],['Business',business],['Email',email],['Phone',phone||'—'],['Type',type],['Budget',budget],['Date & Time',`${date} at ${time} CT`],['Notes',notes||'—']].map(([l,v])=>`<div style="padding:8px 0;border-bottom:0.5px solid #222"><span style="color:#666;font-size:12px">${l}</span><br><span style="color:#f0f0f0">${v}</span></div>`).join('')}</div>`
    })

    await resend.emails.send({
      from: 'Wovo Media <Payton@wovomedia.com>',
      to: email,
      subject: `Strategy call confirmed — ${date} at ${time} CT`,
      html: `<div style="font-family:Inter,sans-serif;max-width:500px;background:#0e0e0e;color:#f0f0f0;padding:32px;border-radius:12px"><div style="font-size:20px;font-weight:700;margin-bottom:24px">wovo<span style="color:#00E5C8">media</span></div><h2 style="margin:0 0 8px">You're booked, ${name.split(' ')[0]}! 🎉</h2><p style="color:#888;margin-bottom:24px">Your free strategy call with Payton is confirmed.</p><div style="background:#141414;border-radius:12px;padding:20px;margin-bottom:24px"><div style="font-size:18px;font-weight:600;color:#00E5C8;margin-bottom:8px">${date} at ${time} CT</div><div style="font-size:13px;color:#888">Payton will call you at ${phone||'your number'}</div></div><p style="color:#555;font-size:13px">Text or call (931) 458-3255 with any questions before the call.</p><p style="color:#444;font-size:13px;margin-top:16px">— Payton Cody<br>Founder, Wovo Media</p></div>`
    })
  } catch(e) {
    console.error('Email error:', e)
  }

  return NextResponse.json({ success: true })
}
