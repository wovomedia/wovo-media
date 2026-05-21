import { NextRequest, NextResponse } from 'next/server'

const PLAN_PRICES: Record<string, number> = {
  starter: 2900,
  growth: 4900,
  pro_ai: 7900,
  website: 9900
}

export async function POST(req: NextRequest) {
  const { plan, email, name, businessName } = await req.json()
  const priceCents = PLAN_PRICES[plan]
  if (!priceCents) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const planNames: Record<string,string> = { starter:'Wovo AI Starter', growth:'Wovo AI Growth', pro_ai:'Wovo AI Pro', website:'Wovo AI Website Builder' }

  // Create Stripe price
  const priceRes = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      unit_amount: String(priceCents),
      currency: 'usd',
      'recurring[interval]': 'month',
      'product_data[name]': planNames[plan],
      'product_data[metadata][plan]': plan,
    })
  })
  const priceData = await priceRes.json()
  if (priceData.error) return NextResponse.json({ error: priceData.error.message }, { status: 400 })

  // Create payment link
  const params = new URLSearchParams({
    'line_items[0][price]': priceData.id,
    'line_items[0][quantity]': '1',
    'customer_creation': 'always',
    'metadata[plan]': plan,
    'metadata[email]': email || '',
    'metadata[business]': businessName || '',
    'metadata[name]': name || '',
    'after_completion[type]': 'redirect',
    'after_completion[redirect][url]': `${process.env.NEXT_PUBLIC_APP_URL || 'https://wovomedia.com'}/dashboard/client?subscribed=true`,
  })
  if (email) params.set('customer_email', email)

  const linkRes = await fetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })
  const linkData = await linkRes.json()
  if (linkData.error) return NextResponse.json({ error: linkData.error.message }, { status: 400 })

  return NextResponse.json({ url: linkData.url })
}
