import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Discounted Wovo AI prices for Premium clients (50% off)
const DISCOUNT_PRICES: Record<string, { priceId: string; name: string; full: number; discounted: number }> = {
  starter:  { priceId: 'price_1Ta7cdFmIvQosWF9stIYpHGg', name: 'Wovo AI Starter',          full: 2900, discounted: 1450 },
  growth:   { priceId: 'price_1Ta7dWFmIvQosWF9mTJcTscY', name: 'Wovo AI Growth',           full: 4900, discounted: 2450 },
  pro_ai:   { priceId: 'price_1Ta7dgFmIvQosWF92mph9NCd', name: 'Wovo AI Pro',              full: 7900, discounted: 3950 },
  website:  { priceId: 'price_1Ta7dpFmIvQosWF9KE1qn84e', name: 'Wovo AI Website Builder',  full: 9900, discounted: 4950 },
}

export async function POST(req: NextRequest) {
  const { plan, userId } = await req.json()

  if (!plan || !userId) return NextResponse.json({ error: 'Missing plan or user' }, { status: 400 })

  // Verify this user is an active Premium client
  const { data: client } = await sb
    .from('clients')
    .select('id, plan, is_active, email, owner_name')
    .eq('profile_id', userId)
    .single()

  if (!client?.is_active) return NextResponse.json({ error: 'No active account found' }, { status: 403 })
  if (client.plan !== 'premium') return NextResponse.json({ error: 'Premium discount is only available for Wovo Media Premium clients' }, { status: 403 })

  // Check they don't already have a Wovo AI sub
  let existingSub: any = null
  try {
    const { data } = await sb.from('wovo_subscriptions').select('plan, status').eq('client_id', client.id).eq('status', 'active').single()
    existingSub = data
  } catch {}

  if (existingSub && existingSub.plan !== 'premium') {
    return NextResponse.json({ error: 'You already have an active Wovo AI subscription', plan: existingSub.plan }, { status: 409 })
  }

  const planInfo = DISCOUNT_PRICES[plan]
  if (!planInfo) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  // Create a Stripe checkout session via the API with the coupon
  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': planInfo.priceId,
      'line_items[0][quantity]': '1',
      'discounts[0][coupon]': 'PREMIUM50',
      customer_email: client.email,
      success_url: 'https://wovomedia.com/home?upgraded=1',
      cancel_url: 'https://wovomedia.com/home',
      'metadata[client_id]': client.id,
      'metadata[plan]': plan,
      'metadata[is_premium_discount]': 'true',
    }).toString()
  })

  const stripeData = await stripeRes.json()

  if (!stripeRes.ok || !stripeData.url) {
    // Coupon might not exist yet - create it first then retry
    if (stripeData.error?.code === 'resource_missing' && stripeData.error?.param === 'discounts[0][coupon]') {
      // Create the coupon
      await fetch('https://api.stripe.com/v1/coupons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          id: 'PREMIUM50',
          percent_off: '50',
          duration: 'forever',
          name: 'Premium Client 50% Off',
        }).toString()
      })

      // Retry checkout session
      const retry = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          mode: 'subscription',
          'line_items[0][price]': planInfo.priceId,
          'line_items[0][quantity]': '1',
          'discounts[0][coupon]': 'PREMIUM50',
          customer_email: client.email,
          success_url: 'https://wovomedia.com/home?upgraded=1',
          cancel_url: 'https://wovomedia.com/home',
          'metadata[client_id]': client.id,
          'metadata[plan]': plan,
          'metadata[is_premium_discount]': 'true',
        }).toString()
      })
      const retryData = await retry.json()
      if (retryData.url) return NextResponse.json({ url: retryData.url, discounted: planInfo.discounted, full: planInfo.full })
    }
    return NextResponse.json({ error: stripeData.error?.message || 'Failed to create checkout' }, { status: 500 })
  }

  return NextResponse.json({
    url: stripeData.url,
    discounted: planInfo.discounted,
    full: planInfo.full,
    name: planInfo.name
  })
}
