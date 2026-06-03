import { NextResponse } from 'next/server'

export async function GET() {
  const headers = {
    'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  // Create WELCOME50 promotion code for the HGdbIp6X coupon (2 months 50% off)
  const promoRes = await fetch('https://api.stripe.com/v1/promotion_codes', {
    method: 'POST', headers,
    body: new URLSearchParams({
      code: 'WELCOME50',
      'promotion[type]': 'coupon',
      'promotion[coupon]': 'HGdbIp6X',
    }).toString()
  })
  const promo = await promoRes.json()

  // Also ensure PREMIUM50 coupon exists
  const couponRes = await fetch('https://api.stripe.com/v1/coupons', {
    method: 'POST', headers,
    body: new URLSearchParams({
      id: 'PREMIUM50', percent_off: '50',
      duration: 'forever', name: 'Premium Client 50% Off',
    }).toString()
  })
  const coupon = await couponRes.json()

  return NextResponse.json({ promo, coupon })
}
