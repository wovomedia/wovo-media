import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMonthlyReport } from '@/lib/emails'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { clientId, month, views, engagements, posts, newFollowers, reach, summary, notes, topPostUrl } = await req.json()

  // Get client info
  const { data: client } = await sb.from('clients').select('*, profiles(email, full_name)').eq('id', clientId).single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Save report
  const { data: report } = await sb.from('client_reports').insert({
    client_id: clientId, month, views, engagements, posts_published: posts,
    new_followers: newFollowers, reach, summary, notes, top_post_url: topPostUrl,
    sent_at: new Date().toISOString()
  }).select().single()

  // Save to stats history for charting
  await sb.from('client_stats_history').insert({ client_id: clientId, views, engagements, posts, followers: newFollowers })

  // Send email
  const clientEmail = client.email || (client as any).profiles?.email
  const clientName = client.owner_name || (client as any).profiles?.full_name || 'there'
  if (clientEmail) {
    await sendMonthlyReport({ to: clientEmail, name: clientName, businessName: client.business_name, month, views, engagements, posts, summary })
  }

  return NextResponse.json({ success: true, reportId: report?.id })
}
