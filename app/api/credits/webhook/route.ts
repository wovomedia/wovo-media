import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const CREDIT_AMOUNTS: Record<number, number> = {
  500: 5,    // $5 = 5 credits
  1000: 12,  // $10 = 12 credits (bonus 2)
  2500: 35,  // $25 = 35 credits (bonus 10)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  let event: any
  try { event = JSON.parse(body) } catch { return NextResponse.json({ error: 'Invalid' }, { status: 400 }) }

  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const obj = event.data.object
    const amount = obj.amount_total || obj.amount
    const email = obj.customer_details?.email || obj.receipt_email
    const clientId = obj.metadata?.client_id

    const credits = CREDIT_AMOUNTS[amount] || Math.floor(amount / 100)

    if (email || clientId) {
      // Find client
      let cId = clientId
      if (!cId && email) {
        const { data: client } = await sb.from('clients').select('id').eq('email', email).single()
        cId = client?.id
      }

      if (cId) {
        // Add credits
        const { data: existing } = await sb.from('client_credits').select('*').eq('client_id', cId).single()
        await sb.from('client_credits').upsert({
          client_id: cId,
          balance: (existing?.balance || 0) + credits,
          total_purchased: (existing?.total_purchased || 0) + credits,
          updated_at: new Date().toISOString()
        })
        await sb.from('credit_transactions').insert({
          client_id: cId,
          amount: credits,
          type: 'purchase',
          description: credits + ' Wovo AI Credits',
          stripe_payment_id: obj.id,
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}
