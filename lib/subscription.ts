import { createClient } from '@supabase/supabase-js'

export type SubStatus = 'active' | 'free' | 'loading'

export async function getSubscriptionStatus(userId: string): Promise<{
  status: SubStatus
  plan: string | null
  clientId: string | null
}> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Get client record
  const { data: client } = await sb
    .from('clients')
    .select('id, plan, is_active')
    .eq('profile_id', userId)
    .single()

  if (!client) return { status: 'free', plan: null, clientId: null }

  // Check if active via client flag OR active subscription
  if (client.is_active) {
    return { status: 'active', plan: client.plan, clientId: client.id }
  }

  // Check wovo_subscriptions for active sub
  const { data: sub } = await sb
    .from('wovo_subscriptions')
    .select('status, plan')
    .eq('client_id', client.id)
    .eq('status', 'active')
    .single()

  if (sub) {
    return { status: 'active', plan: sub.plan, clientId: client.id }
  }

  return { status: 'free', plan: null, clientId: client.id }
}
