import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function DELETE(req: NextRequest) {
  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

  // Get the client record first
  const { data: client } = await sb.from('clients').select('profile_id, email').eq('id', clientId).single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Delete all related data in order
  await sb.from('conversation_messages').delete().in('conversation_id',
    (await sb.from('conversations').select('id').eq('client_id', clientId)).data?.map(c => c.id) || []
  )
  await sb.from('conversations').delete().eq('client_id', clientId)
  await sb.from('client_videos').delete().eq('client_id', clientId)
  await sb.from('client_images').delete().eq('client_id', clientId)
  await sb.from('client_ai_characters').delete().eq('client_id', clientId)
  await sb.from('client_video_series').delete().eq('client_id', clientId)
  await sb.from('client_business_profiles').delete().eq('client_id', clientId)
  await sb.from('client_credits').delete().eq('client_id', clientId)
  await sb.from('credit_transactions').delete().eq('client_id', clientId)
  await sb.from('client_managers').delete().eq('client_id', clientId)
  await sb.from('jobs').delete().eq('client_id', clientId)
  await sb.from('wovo_subscriptions').delete().eq('client_id', clientId)
  await sb.from('client_onboarding').delete().eq('client_id', clientId)
  await sb.from('clients').delete().eq('id', clientId)

  // Delete auth user
  if (client.profile_id) {
    await sb.from('profiles').delete().eq('user_id', client.profile_id)
    await sb.auth.admin.deleteUser(client.profile_id)
  }

  return NextResponse.json({ success: true })
}
