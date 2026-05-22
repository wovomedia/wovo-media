import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '@/lib/emails'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  
  let event: any
  try {
    // Simple verification - in production use stripe.webhooks.constructEvent
    event = JSON.parse(body)
  } catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }) }

  if (event.type === 'checkout.session.completed' || event.type === 'payment_link.payment_completed') {
    const session = event.data.object
    const businessName = session.metadata?.business
    const email = session.metadata?.email || session.customer_details?.email

    if (businessName && email) {
      // Find invitation
      const { data: invite } = await sb.from('premium_invitations').select('*').eq('email', email).eq('business_name', businessName).single()
      if (invite && invite.status === 'pending') {
        // Generate temp password
        const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
        
        // Create Supabase auth user
        const { data: authUser } = await sb.auth.admin.createUser({ email, password: tempPassword, email_confirm: true })
        
        if (authUser.user) {
          // Create client record
          const { data: client } = await sb.from('clients').insert({
            profile_id: authUser.user.id,
            business_name: businessName,
            owner_name: invite.owner_name,
            email,
            phone: invite.phone,
            plan: 'premium',
            is_active: true,
            source: 'premium_onboarding'
          }).select().single()

          // Update invitation
          await sb.from('premium_invitations').update({ status: 'active', paid_at: new Date().toISOString(), stripe_subscription_id: session.subscription, client_id: client?.id }).eq('id', invite.id)

          // Create wovo subscription record
          if (client) {
            await sb.from('wovo_subscriptions').insert({
              client_id: client.id,
              stripe_subscription_id: session.subscription,
              stripe_customer_id: session.customer,
              plan: 'premium',
              status: 'active',
              amount_cents: invite.price_cents
            })
          }

          // Send welcome email
          await sendWelcomeEmail({ to: email, name: invite.owner_name, businessName, loginEmail: email, tempPassword })

          // Trigger premium welcome conversion video (background)
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://wovomedia.com'}/api/heygen/conversion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'premium_welcome', name: invite.owner_name, email, business: businessName, clientId: client?.id })
          }).catch(() => {})
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
