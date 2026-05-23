import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  const { videoDbId, script, clientId } = await req.json()

  const { data: client } = await sb.from('clients').select('business_name').eq('id', clientId).single()
  const businessName = (client as any)?.business_name || 'this business'

  let profileCtx = ''
  try {
    const { data: bp } = await sb.from('client_business_profiles').select('*').eq('client_id', clientId).single()
    if (bp) {
      const parts = []
      if (bp.industry) parts.push('Industry: ' + bp.industry)
      if (bp.target_audience) parts.push('Audience: ' + bp.target_audience)
      if (bp.brand_voice) parts.push('Voice: ' + bp.brand_voice)
      if (bp.social_handles) parts.push('Handles: ' + bp.social_handles)
      if (bp.avoid_topics) parts.push('Avoid: ' + bp.avoid_topics)
      profileCtx = parts.join(' | ')
    }
  } catch {}

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: 'Write a social media caption for this video for ' + businessName + '. ' + (profileCtx ? 'Context: ' + profileCtx + '. ' : '') + '\n\nVideo script: "' + script + '"\n\nRequirements:\n- 2-3 sentences max, punchy and engaging\n- Include 3-5 relevant hashtags at the end\n- Match the tone of the script\n- Do not start with I or We\n- No quotes, just the caption text\n\nReply with ONLY the caption, nothing else.'
      }]
    })
  })

  const data = await res.json()
  const caption = data.content?.[0]?.text?.trim()

  if (caption && videoDbId) {
    await sb.from('client_videos').update({ caption }).eq('id', videoDbId)
  }

  return NextResponse.json({ caption })
}
