import { NextResponse } from 'next/server'

export async function GET() {
  // Create the PREMIUM50 coupon
  const res = await fetch('https://api.stripe.com/v1/coupons', {
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
  const data = await res.json()
  return NextResponse.json({ coupon: data })
}
