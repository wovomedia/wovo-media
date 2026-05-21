import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPremiumInvite } from '@/lib/emails'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { businessName, ownerName, email, phone, priceCents, notes } = await req.json()

  // 1. Create Stripe payment link for this custom price
  const stripeRes = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      unit_amount: priceCents,
      currency: 'usd',
      'recurring[interval]': 'month',
      'product_data[name]': `Wovo Media Premium — ${businessName}`,
      'metadata[business]': businessName,
      'metadata[type]': 'premium'
    })
  })
  const priceData = await stripeRes.json()

  // 2. Create payment link
  const linkRes = await fetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'line_items[0][price]': priceData.id, 'line_items[0][quantity]': '1', 'metadata[business]': businessName, 'metadata[email]': email })
  })
  const linkData = await linkRes.json()

  // 3. Save to Supabase
  await sb.from('premium_invitations').insert({
    business_name: businessName,
    owner_name: ownerName,
    email,
    phone,
    price_cents: priceCents,
    stripe_price_id: priceData.id,
    stripe_payment_link: linkData.url,
    notes,
    status: 'pending'
  })

  // 4. Send the invite email
  await sendPremiumInvite({ to: email, name: ownerName, businessName, price: priceCents, paymentLink: linkData.url })

  return NextResponse.json({ success: true, paymentLink: linkData.url })
}
