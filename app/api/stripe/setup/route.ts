import { NextResponse } from 'next/server'

export async function GET() {
  const results: any = {}

  // Create the WELCOME50 promotion code pointing to the HGdbIp6X coupon
  const promoRes = await fetch('https://api.stripe.com/v1/promotion_codes', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code: 'WELCOME50',
      'promotion[type]': 'coupon',
      'promotion[coupon]': 'HGdbIp6X',
    }).toString()
  })
  results.promo = await promoRes.json()

  return NextResponse.json(results)
}
